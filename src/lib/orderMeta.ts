export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready_for_delivery"
  | "on_the_way"
  | "arrived"
  | "delivered"
  | "cancelled";

export type PaymentFilterStatus = "all" | "paid" | "pending" | "failed" | "cancelled";

export function normalizeValue(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

export function isCardPaymentMethod(value?: string | null) {
  return normalizeValue(value) === "card";
}

export function isCashPaymentMethod(value?: string | null) {
  return normalizeValue(value) === "cash";
}

export function isPaidPaymentStatus(value?: string | null) {
  return normalizeValue(value) === "paid";
}

export function formatStatusLabel(value: string) {
  return value.replace(/_/g, " ");
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

export function getStatusColorClass(status?: string | null) {
  const normalized = normalizeValue(status);

  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    confirmed: "bg-blue-100 text-blue-700 border-blue-200",
    preparing: "bg-purple-100 text-purple-700 border-purple-200",
    ready_for_delivery: "bg-orange-100 text-orange-700 border-orange-200",
    on_the_way: "bg-indigo-100 text-indigo-700 border-indigo-200",
    arrived: "bg-cyan-100 text-cyan-700 border-cyan-200",
    delivered: "bg-green-100 text-green-700 border-green-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
  };

  return map[normalized] || "border-border bg-muted text-muted-foreground";
}

export function getPaymentStatusColorClass(paymentStatus?: string | null) {
  const normalized = normalizeValue(paymentStatus);

  const map: Record<string, string> = {
    paid: "bg-green-100 text-green-700 border-green-200",
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    failed: "bg-red-100 text-red-700 border-red-200",
    cancelled: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return map[normalized] || "border-border bg-muted text-muted-foreground";
}

export function getPaymentLabel(paymentStatus?: string | null, paymentMethod?: string | null) {
  const status = normalizeValue(paymentStatus);
  const method = normalizeValue(paymentMethod);

  if (status === "paid") return "Paid";
  if (method === "cash") return "Cash on delivery";
  if (method === "card" && (status === "pending" || status === "")) {
    return "Awaiting card payment";
  }
  if (status === "failed" || status === "cancelled") return "Payment failed";
  return "Awaiting payment";
}

export function getAccountOrderStatusClass(status?: string | null) {
  return getStatusColorClass(status);
}

export function getOrderStatusSummary(status?: string | null) {
  const normalized = normalizeValue(status);

  switch (normalized) {
    case "pending":
      return "Order placed and waiting for confirmation.";
    case "confirmed":
      return "Confirmed and queued for kitchen.";
    case "preparing":
      return "Being freshly prepared.";
    case "ready_for_delivery":
      return "Ready and waiting for a driver.";
    case "on_the_way":
      return "Driver is on the way.";
    case "arrived":
      return "Driver has arrived.";
    case "delivered":
      return "Order delivered successfully.";
    case "cancelled":
      return "Order cancelled.";
    default:
      return "Status updating.";
  }
}