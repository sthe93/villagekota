const PUSH_NOTIFICATIONS_ENABLED_KEY = "villagekota.pushNotifications.enabled";

export type AppNotificationAudience = "customer" | "driver" | "admin";

export interface AppNotificationPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
  audience: AppNotificationAudience;
}

export interface AppNotificationPermissionState {
  supported: boolean;
  enabled: boolean;
  permission: NotificationPermission | "unsupported";
}

function canUseWindow() {
  return typeof window !== "undefined";
}

export function arePushNotificationsSupported() {
  return (
    canUseWindow() &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

export function getStoredPushNotificationsEnabled() {
  if (!canUseWindow()) return false;
  return window.localStorage.getItem(PUSH_NOTIFICATIONS_ENABLED_KEY) === "true";
}

export function setStoredPushNotificationsEnabled(enabled: boolean) {
  if (!canUseWindow()) return;
  window.localStorage.setItem(PUSH_NOTIFICATIONS_ENABLED_KEY, String(enabled));
}

export function getPushNotificationPermissionState(): AppNotificationPermissionState {
  if (!arePushNotificationsSupported()) {
    return {
      supported: false,
      enabled: false,
      permission: "unsupported",
    };
  }

  return {
    supported: true,
    enabled: getStoredPushNotificationsEnabled() && Notification.permission === "granted",
    permission: Notification.permission,
  };
}

export async function registerPushNotificationsServiceWorker() {
  if (!arePushNotificationsSupported()) return null;

  const registration = await navigator.serviceWorker.register(
    `${import.meta.env.BASE_URL}notifications-sw.js`,
    { scope: import.meta.env.BASE_URL }
  );

  return registration;
}

export async function requestPushNotificationPermission() {
  if (!arePushNotificationsSupported()) {
    return getPushNotificationPermissionState();
  }

  const permission = await Notification.requestPermission();
  const enabled = permission === "granted";
  setStoredPushNotificationsEnabled(enabled);

  return {
    supported: true,
    enabled,
    permission,
  } satisfies AppNotificationPermissionState;
}

export function disablePushNotifications() {
  setStoredPushNotificationsEnabled(false);

  if (canUseWindow() && "Notification" in window) {
    Notification.get?.().forEach((notification) => notification.close());
  }
}

export function buildOrderNotification({
  status,
  orderId,
}: {
  status: string;
  orderId: string;
}): AppNotificationPayload | null {
  const orderPath = `/order-tracking/${orderId}`;
  const normalizedStatus = status.trim().toLowerCase();

  const messages: Record<string, Pick<AppNotificationPayload, "title" | "body">> = {
    pending: {
      title: "Order received",
      body: "We received your order and will confirm it shortly.",
    },
    confirmed: {
      title: "Order confirmed",
      body: "The kitchen has confirmed your order.",
    },
    preparing: {
      title: "Preparing your meal",
      body: "Your order is being freshly prepared.",
    },
    ready_for_delivery: {
      title: "Order ready for delivery",
      body: "Your order is packed and waiting for a driver.",
    },
    on_the_way: {
      title: "Driver on the way",
      body: "Your driver is on the way with your order.",
    },
    arrived: {
      title: "Driver arrived",
      body: "Your driver has arrived with your order.",
    },
    delivered: {
      title: "Order delivered",
      body: "Your order was marked as delivered. Enjoy your meal!",
    },
    cancelled: {
      title: "Order cancelled",
      body: "Your order status changed to cancelled.",
    },
  };

  const message = messages[normalizedStatus];
  if (!message) return null;

  return {
    ...message,
    tag: `customer-order-${orderId}-${normalizedStatus}`,
    url: orderPath,
    audience: "customer",
  };
}

export function buildPaymentNotification({
  paymentStatus,
  orderId,
}: {
  paymentStatus: string;
  orderId: string;
}): AppNotificationPayload | null {
  const normalizedStatus = paymentStatus.trim().toLowerCase();

  if (["paid", "completed", "success", "successful"].includes(normalizedStatus)) {
    return {
      title: "Payment confirmed",
      body: "Your payment was confirmed successfully.",
      tag: `customer-payment-${orderId}-paid`,
      url: `/order-tracking/${orderId}`,
      audience: "customer",
    };
  }

  if (["failed", "cancelled", "canceled", "expired"].includes(normalizedStatus)) {
    return {
      title: "Payment needs attention",
      body: "Your payment did not go through. Open your order to review the next step.",
      tag: `customer-payment-${orderId}-${normalizedStatus}`,
      url: `/order-tracking/${orderId}`,
      audience: "customer",
    };
  }

  return null;
}

export function buildDriverDispatchNotification(orderId: string): AppNotificationPayload {
  return {
    title: "New delivery available",
    body: "A new order is ready for delivery. Open the driver dashboard to accept it.",
    tag: `driver-order-${orderId}`,
    url: "/driver",
    audience: "driver",
  };
}

export function buildAdminOrderNotification(orderId: string): AppNotificationPayload {
  return {
    title: "New order received",
    body: "A new customer order just came in. Review it in the admin orders queue.",
    tag: `admin-order-${orderId}`,
    url: "/admin/orders",
    audience: "admin",
  };
}

export async function showAppNotification(payload: AppNotificationPayload) {
  if (!arePushNotificationsSupported()) return false;
  if (Notification.permission !== "granted") return false;
  if (!getStoredPushNotificationsEnabled()) return false;

  const registration = await navigator.serviceWorker.ready;
  const iconUrl = `${import.meta.env.BASE_URL}favicon.ico`;

  await registration.showNotification(payload.title, {
    body: payload.body,
    tag: payload.tag,
    icon: iconUrl,
    badge: iconUrl,
    data: {
      url: payload.url,
    },
  });

  return true;
}
