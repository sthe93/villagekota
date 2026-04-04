import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";

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

export interface NativePushRegistrationResult {
  token: string;
  platform: "ios" | "android";
}

function canUseWindow() {
  return typeof window !== "undefined";
}

export function arePushNotificationsSupported() {
  if (Capacitor.isNativePlatform()) {
    return true;
  }

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

  if (Capacitor.isNativePlatform()) {
    const enabled = getStoredPushNotificationsEnabled();
    return {
      supported: true,
      enabled,
      permission: enabled ? "granted" : "default",
    };
  }

  return {
    supported: true,
    enabled: getStoredPushNotificationsEnabled() && Notification.permission === "granted",
    permission: Notification.permission,
  };
}

export async function registerPushNotificationsServiceWorker() {
  if (Capacitor.isNativePlatform()) return null;
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

  if (Capacitor.isNativePlatform()) {
    const [localPermissions, pushPermissions] = await Promise.all([
      LocalNotifications.requestPermissions(),
      PushNotifications.requestPermissions(),
    ]);

    const enabled =
      localPermissions.display === "granted" && pushPermissions.receive === "granted";

    setStoredPushNotificationsEnabled(enabled);

    return {
      supported: true,
      enabled,
      permission: enabled ? "granted" : "denied",
    } satisfies AppNotificationPermissionState;
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

export async function registerNativePushToken(): Promise<NativePushRegistrationResult | null> {
  if (!Capacitor.isNativePlatform()) return null;

  const permissions = await PushNotifications.checkPermissions();
  const receivePermission =
    permissions.receive === "prompt"
      ? (await PushNotifications.requestPermissions()).receive
      : permissions.receive;

  if (receivePermission !== "granted") return null;

  const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";

  return await new Promise<NativePushRegistrationResult>((resolve, reject) => {
    void (async () => {
      const [registrationSubscription, errorSubscription] = await Promise.all([
        PushNotifications.addListener("registration", (token) => {
          cleanup();
          resolve({ token: token.value, platform });
        }),
        PushNotifications.addListener("registrationError", (error) => {
          cleanup();
          reject(new Error(error.error));
        }),
      ]);

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out while registering push token"));
      }, 10000);

      function cleanup() {
        clearTimeout(timeout);
        void registrationSubscription.remove();
        void errorSubscription.remove();
      }

      void PushNotifications.register();
    })().catch((error) => {
      reject(error instanceof Error ? error : new Error("Failed to register native push token"));
    });
  });
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
  if (!getStoredPushNotificationsEnabled()) return false;

  if (Capacitor.isNativePlatform()) {
    const id = Math.floor(Date.now() % 1_000_000_000);
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: payload.title,
          body: payload.body,
          extra: { url: payload.url, tag: payload.tag, audience: payload.audience },
          schedule: { at: new Date(Date.now() + 300) },
        },
      ],
    });

    return true;
  }

  if (Notification.permission !== "granted") return false;

  const registration = await navigator.serviceWorker.ready;
  const iconUrl = `${import.meta.env.BASE_URL}favicon.ico`;

  await registration.showNotification(payload.title, {
    body: payload.body,
    tag: payload.tag,
    icon: iconUrl,
    badge: iconUrl,
    data: {
      url: payload.url,
      audience: payload.audience,
    },
  });

  return true;
}
