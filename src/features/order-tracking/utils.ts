import {
  AlertCircle,
  CheckCircle2,
  ChefHat,
  Clock3,
  CreditCard,
  HandCoins,
  Landmark,
  MapPinned,
  PackageCheck,
  ShieldAlert,
  Store,
  Truck,
  UserRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { DeliveryStatus } from "@/components/DeliveryProgressTracker";
import type {
  OrderRecord,
  OrderStatus,
  PaymentBanner,
  TrackingMilestone,
} from "./types";

export const CARD_REQUIRED_PAYMENT_METHODS = ["card", "online", "payfast"];
export const EFT_PAYMENT_METHODS = ["eft", "bank_transfer", "bank transfer"];
export const PAID_PAYMENT_STATUSES = ["paid", "completed", "success", "succeeded"];
export const FAILED_PAYMENT_STATUSES = ["failed", "cancelled", "canceled", "expired"];
export const PENDING_PAYMENT_STATUSES = ["pending", "processing", "initiated", "unpaid", ""];
export const ADVANCED_ORDER_STATUSES: OrderStatus[] = [
  "confirmed",
  "preparing",
  "ready_for_delivery",
  "on_the_way",
  "arrived",
  "delivered",
];

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function normalize(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

export function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(Number(value || 0));
}

export function formatTime(value: string | null | undefined) {
  if (!value) return "Calculating...";
  return new Date(value).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "—";

  const now = Date.now();
  const then = new Date(value).getTime();
  const diffMs = Math.max(0, now - then);

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function normalizeOrderStatus(value: string | null | undefined): OrderStatus {
  const status = normalize(value);

  switch (status) {
    case "confirmed":
    case "preparing":
    case "ready_for_delivery":
    case "on_the_way":
    case "arrived":
    case "delivered":
    case "cancelled":
      return status;
    default:
      return "pending";
  }
}

export function getStatusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    preparing: "Preparing",
    ready_for_delivery: "Ready for Delivery",
    on_the_way: "On the Way",
    arrived: "Arrived",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

  return labels[status];
}

export function getTrackerStatus(status: OrderStatus): DeliveryStatus {
  if (status === "cancelled") return "cancelled";
  if (status === "delivered") return "delivered";
  if (status === "arrived") return "arrived";
  if (status === "on_the_way") return "on_the_way";
  if (status === "ready_for_delivery") return "ready_for_delivery";
  if (status === "preparing") return "preparing";
  if (status === "confirmed") return "confirmed";
  return "pending";
}

export function getSummaryIcon(status: OrderStatus): LucideIcon {
  if (status === "cancelled") return XCircle;
  if (status === "delivered") return CheckCircle2;
  if (status === "arrived") return MapPinned;
  if (status === "on_the_way") return Truck;
  if (status === "ready_for_delivery") return PackageCheck;
  if (status === "preparing") return ChefHat;
  if (status === "confirmed") return Store;
  return AlertCircle;
}

export function getSummaryTone(status: OrderStatus) {
  if (status === "cancelled") return "border-rose-200 bg-gradient-to-r from-rose-50 to-rose-100/80";
  if (status === "delivered") return "border-emerald-300 bg-gradient-to-r from-emerald-50 to-emerald-100/80";
  if (status === "arrived") return "border-cyan-200 bg-gradient-to-r from-cyan-50 to-cyan-100/75";
  if (status === "on_the_way") return "border-indigo-200 bg-gradient-to-r from-indigo-50 to-indigo-100/75";
  if (status === "ready_for_delivery") return "border-orange-200 bg-gradient-to-r from-orange-50 to-amber-100/75";
  if (status === "preparing") {
    return "border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-100/70";
  }
  if (status === "confirmed") {
    return "border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-100/70";
  }
  return "border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-100/70";
}

export function getPaymentBanner(args: {
  order: OrderRecord | null;
  isOrderCancelled: boolean;
  hasPaymentMismatch: boolean;
  isCashPayment: boolean;
  isCardPayment: boolean;
  isEftPayment: boolean;
  cashCollected: boolean;
  isArrived: boolean;
  paymentIsPaid: boolean;
  paymentIsFailed: boolean;
  paymentIsPending: boolean;
}): PaymentBanner | null {
  const {
    order,
    isOrderCancelled,
    hasPaymentMismatch,
    isCashPayment,
    isCardPayment,
    isEftPayment,
    cashCollected,
    isArrived,
    paymentIsPaid,
    paymentIsFailed,
    paymentIsPending,
  } = args;

  if (!order || isOrderCancelled) return null;

  if (hasPaymentMismatch) {
    return {
      tone: "border-rose-200 bg-rose-50 text-rose-800",
      icon: ShieldAlert,
      title: "Payment verification mismatch",
      description:
        "This order has progressed beyond the normal payment stage, but payment is not marked as confirmed yet. The team should review this order status and payment record together.",
    };
  }

  if (isCashPayment && cashCollected) {
    return {
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
      icon: HandCoins,
      title: "Cash payment received",
      description: order.cash_collected_at
        ? `Cash payment was collected successfully at ${formatDateTime(order.cash_collected_at)}.`
        : "Cash payment was collected successfully.",
    };
  }

  if (isCashPayment && isArrived && !cashCollected) {
    return {
      tone: "border-amber-200 bg-amber-50 text-amber-800",
      icon: HandCoins,
      title: "Cash due now",
      description: `Your driver has arrived. Please pay the cash amount of ${formatCurrency(
        order.total
      )} to complete delivery.`,
    };
  }

  if (isCashPayment && !cashCollected) {
    return {
      tone: "border-slate-200 bg-slate-50 text-slate-700",
      icon: HandCoins,
      title: "Cash on delivery",
      description: "This is a cash order. Payment will be collected by the driver on arrival.",
    };
  }

  if (isCardPayment && paymentIsPaid) {
    return {
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
      icon: CheckCircle2,
      title: "Card payment confirmed",
      description: "Your online card payment has been received successfully.",
    };
  }

  if (isCardPayment && paymentIsFailed) {
    return {
      tone: "border-rose-200 bg-rose-50 text-rose-800",
      icon: XCircle,
      title: "Card payment needs attention",
      description:
        "Your card payment was not completed. Retry payment below to continue with your order.",
    };
  }

  if (isCardPayment && paymentIsPending) {
    return {
      tone: "border-amber-200 bg-amber-50 text-amber-800",
      icon: CreditCard,
      title: "Waiting for card payment confirmation",
      description:
        "Your order should remain in the early order stage until card payment is marked as paid.",
    };
  }

  if (isEftPayment && paymentIsPaid) {
    return {
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
      icon: CheckCircle2,
      title: "EFT payment confirmed",
      description:
        "Your EFT payment has been confirmed successfully and your order can continue normally.",
    };
  }

  if (isEftPayment && paymentIsFailed) {
    return {
      tone: "border-rose-200 bg-rose-50 text-rose-800",
      icon: XCircle,
      title: "EFT payment needs attention",
      description:
        "Your EFT payment is not confirmed. Please contact support or send proof of payment if needed.",
    };
  }

  if (isEftPayment && paymentIsPending) {
    return {
      tone: "border-amber-200 bg-amber-50 text-amber-800",
      icon: Landmark,
      title: "Awaiting EFT confirmation",
      description:
        "Your order is saved with payment pending. Preparation and dispatch should only continue after your EFT payment is confirmed manually.",
    };
  }

  return null;
}

export function getTrackingMilestones(order: OrderRecord | null): TrackingMilestone[] {
  if (!order) return [];

  const entries: TrackingMilestone[] = [
    {
      label: "Order placed",
      value: order.created_at,
      icon: Clock3,
    },
    {
      label: "Driver accepted",
      value: order.accepted_at || "",
      icon: UserRound,
    },
    {
      label: "Trip started",
      value: order.started_delivery_at || "",
      icon: Truck,
    },
    {
      label: "Driver arrived",
      value: order.arrived_at || "",
      icon: MapPinned,
    },
    {
      label: "Delivered",
      value: order.delivered_at || "",
      icon: CheckCircle2,
    },
  ];

  return entries.filter((entry) => entry.value);
}

export function getOrderStatusBadgeTone(status: OrderStatus) {
  const map: Record<OrderStatus, string> = {
    pending: "border-amber-200 bg-amber-50 text-amber-700",
    confirmed: "border-sky-200 bg-sky-50 text-sky-700",
    preparing: "border-violet-200 bg-violet-50 text-violet-700",
    ready_for_delivery: "border-orange-200 bg-orange-50 text-orange-700",
    on_the_way: "border-indigo-200 bg-indigo-50 text-indigo-700",
    arrived: "border-cyan-200 bg-cyan-50 text-cyan-700",
    delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
    cancelled: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return map[status];
}
