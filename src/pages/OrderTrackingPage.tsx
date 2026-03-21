import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChefHat,
  Clock3,
  CreditCard,
  HandCoins,
  Landmark,
  Loader2,
  MapPinned,
  Navigation,
  PackageCheck,
  Phone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Store,
  Truck,
  UserRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import maplibregl from "maplibre-gl";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import Footer from "@/components/Footer";
import DeliveryProgressTracker, {
  type DeliveryStatus,
} from "@/components/DeliveryProgressTracker";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready_for_delivery"
  | "on_the_way"
  | "arrived"
  | "delivered"
  | "cancelled";

type DriverInfo = {
  id: string;
  name: string;
  phone: string | null;
};

type OrderRecord = {
  id: string;
  user_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  delivery_address: string | null;
  notes: string | null;
  payment_method: string | null;
  payment_provider: string | null;
  payment_reference: string | null;
  payment_status: string | null;
  status: OrderStatus | null;
  subtotal: number | null;
  delivery_fee: number | null;
  discount_amount: number | null;
  total: number | null;
  created_at: string;
  estimated_delivery_time: string | null;
  driver_distance_km: number | null;
  driver_lat: number | null;
  driver_lng: number | null;
  driver_last_updated: string | null;
  driver_id: string | null;
  accepted_at: string | null;
  started_delivery_at: string | null;
  arrived_at: string | null;
  delivered_at: string | null;
  cash_collected: boolean | null;
  cash_collected_amount: number | null;
  cash_collected_at: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
};

type OrderItemOptionRecord = {
  id: string;
  order_item_id: string;
  option_group_name: string;
  option_item_name: string;
  price_delta: number;
};

type OrderItemRecord = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  final_unit_price: number;
  options_total: number;
  total_price: number;
  item_note: string | null;
  selectedOptions: OrderItemOptionRecord[];
};

type PaymentBanner = {
  tone: string;
  icon: typeof AlertCircle;
  title: string;
  description: string;
};

const CARD_REQUIRED_PAYMENT_METHODS = ["card", "online", "payfast"];
const EFT_PAYMENT_METHODS = ["eft", "bank_transfer", "bank transfer"];
const PAID_PAYMENT_STATUSES = ["paid", "completed", "success", "succeeded"];
const FAILED_PAYMENT_STATUSES = ["failed", "cancelled", "canceled", "expired"];
const PENDING_PAYMENT_STATUSES = ["pending", "processing", "initiated", "unpaid", ""];
const ADVANCED_ORDER_STATUSES: OrderStatus[] = [
  "confirmed",
  "preparing",
  "ready_for_delivery",
  "on_the_way",
  "arrived",
  "delivered",
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalize(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(Number(value || 0));
}

function formatTime(value: string | null | undefined) {
  if (!value) return "Calculating...";
  return new Date(value).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(value: string | null | undefined) {
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

function normalizeOrderStatus(value: string | null | undefined): OrderStatus {
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

function getStatusLabel(status: OrderStatus) {
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

function getTrackerStatus(status: OrderStatus): DeliveryStatus {
  if (status === "cancelled") return "cancelled";
  if (status === "delivered") return "delivered";
  if (status === "arrived") return "arrived";
  if (status === "on_the_way") return "on_the_way";
  if (status === "ready_for_delivery") return "ready_for_delivery";
  if (status === "preparing") return "preparing";
  if (status === "confirmed") return "confirmed";
  return "pending";
}

function normalizeOrder(raw: any): OrderRecord {
  return {
    id: String(raw.id),
    user_id: raw.user_id ?? null,
    customer_name: raw.customer_name ?? "",
    customer_phone: raw.customer_phone ?? null,
    customer_email: raw.customer_email ?? null,
    delivery_address: raw.delivery_address ?? null,
    notes: raw.notes ?? null,
    payment_method: raw.payment_method ?? null,
    payment_provider: raw.payment_provider ?? null,
    payment_reference: raw.payment_reference ?? null,
    payment_status: raw.payment_status ?? null,
    status: normalizeOrderStatus(raw.status),
    subtotal: toNumberOrNull(raw.subtotal),
    delivery_fee: toNumberOrNull(raw.delivery_fee),
    discount_amount: toNumberOrNull(raw.discount_amount),
    total: toNumberOrNull(raw.total),
    created_at: raw.created_at,
    estimated_delivery_time: raw.estimated_delivery_time ?? null,
    driver_distance_km: toNumberOrNull(raw.driver_distance_km),
    driver_lat: toNumberOrNull(raw.driver_lat),
    driver_lng: toNumberOrNull(raw.driver_lng),
    driver_last_updated: raw.driver_last_updated ?? null,
    driver_id: raw.driver_id ?? null,
    accepted_at: raw.accepted_at ?? null,
    started_delivery_at: raw.started_delivery_at ?? null,
    arrived_at: raw.arrived_at ?? null,
    delivered_at: raw.delivered_at ?? null,
    cash_collected: raw.cash_collected ?? null,
    cash_collected_amount: toNumberOrNull(raw.cash_collected_amount),
    cash_collected_at: raw.cash_collected_at ?? null,
    destination_lat: toNumberOrNull(raw.destination_lat),
    destination_lng: toNumberOrNull(raw.destination_lng),
  };
}

function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-[28px] border border-border bg-card shadow-card", className)}>
      <div className="border-b border-border bg-muted/30 px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            {Icon && (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
            )}

            <div>
              <h2 className="text-xl font-semibold text-foreground">{title}</h2>
              {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
          </div>

          {action}
        </div>
      </div>

      <div className={cn("p-5 md:p-6", bodyClassName)}>{children}</div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-[22px] border border-border bg-background p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 truncate text-base font-semibold text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function InfoTile({
  label,
  value,
  subValue,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  icon?: LucideIcon;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <div className={cn("mt-2 text-base font-semibold", accent ? "text-primary" : "text-foreground")}>
            {value}
          </div>
          {subValue ? <div className="mt-1 text-xs text-muted-foreground">{subValue}</div> : null}
        </div>

        {Icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function OrderTrackingPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [items, setItems] = useState<OrderItemRecord[]>([]);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destinationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lastOrderSnapshotRef = useRef<{
    status: OrderStatus | null;
    paymentStatus: string;
    driverId: string | null;
  } | null>(null);

  const paymentStatus = useMemo(() => normalize(order?.payment_status), [order?.payment_status]);
  const orderStatus = useMemo<OrderStatus>(() => normalizeOrderStatus(order?.status), [order?.status]);
  const paymentMethod = useMemo(() => normalize(order?.payment_method), [order?.payment_method]);

  const paymentIsPaid = PAID_PAYMENT_STATUSES.includes(paymentStatus);
  const paymentIsFailed = FAILED_PAYMENT_STATUSES.includes(paymentStatus);
  const paymentIsPending = PENDING_PAYMENT_STATUSES.includes(paymentStatus);

  const isOrderCancelled = orderStatus === "cancelled";
  const isReadyForDelivery = orderStatus === "ready_for_delivery";
  const isOnTheWay = orderStatus === "on_the_way";
  const isArrived = orderStatus === "arrived";
  const isDelivered = orderStatus === "delivered";

  const isCardPayment = CARD_REQUIRED_PAYMENT_METHODS.includes(paymentMethod);
  const isCashPayment = paymentMethod === "cash";
  const isEftPayment = EFT_PAYMENT_METHODS.includes(paymentMethod);
  const cashCollected = !!order?.cash_collected;
  const hasAssignedDriver = !!order?.driver_id && !!driver;

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const hasPaymentMismatch = useMemo(() => {
    if (!order) return false;
    if (!(isCardPayment || isEftPayment)) return false;
    if (paymentIsPaid) return false;

    return ADVANCED_ORDER_STATUSES.includes(orderStatus);
  }, [order, isCardPayment, isEftPayment, paymentIsPaid, orderStatus]);

  const canRetryPayment = useMemo(() => {
    if (!order) return false;

    return (
      isCardPayment &&
      ["pending", "failed", "cancelled", "canceled", "expired", ""].includes(paymentStatus) &&
      ["pending", "cancelled"].includes(orderStatus)
    );
  }, [order, isCardPayment, paymentStatus, orderStatus]);

  const showMap = useMemo(() => {
    return (isOnTheWay || isArrived) && order?.driver_lat != null && order?.driver_lng != null;
  }, [isOnTheWay, isArrived, order?.driver_lat, order?.driver_lng]);

  const statusSummary = useMemo(() => {
    if (!order) return "Loading order status...";

    if (isOrderCancelled) {
      return "This order has been cancelled.";
    }

    if (isDelivered) {
      if (isCashPayment && cashCollected) {
        return "Your order has been delivered and cash payment was collected successfully.";
      }
      return "Your order has been delivered. Enjoy your meal.";
    }

    if (isArrived) {
      if (isCashPayment && !cashCollected) {
        return "Your driver has arrived and is waiting to collect cash payment.";
      }
      return "Your driver has arrived with your order.";
    }

    if (isOnTheWay) {
      const distance =
        order.driver_distance_km != null
          ? `Driver is ${order.driver_distance_km.toFixed(1)} km away`
          : "Driver is on the way";

      const eta = order.estimated_delivery_time
        ? `ETA ${formatTime(order.estimated_delivery_time)}`
        : "ETA updating";

      return `Your order is on the way · ${distance} · ${eta}`;
    }

    if (isReadyForDelivery && hasAssignedDriver) {
      return `${driver?.name || "A driver"} accepted your order and will start the trip shortly.`;
    }

    if (isReadyForDelivery) {
      return "Your order is ready and waiting for a driver to accept delivery.";
    }

    if (orderStatus === "preparing") {
      return "Your order is being freshly prepared.";
    }

    if (orderStatus === "confirmed") {
      return "Your order has been confirmed and the kitchen will start shortly.";
    }

    if (isCardPayment && !paymentIsPaid) {
      return "Your order is placed and awaiting card payment confirmation.";
    }

    if (isEftPayment && !paymentIsPaid) {
      return "Your order is placed and awaiting EFT payment confirmation.";
    }

    return "Your order has been placed and is waiting for confirmation.";
  }, [
    order,
    isOrderCancelled,
    isDelivered,
    isArrived,
    isOnTheWay,
    isReadyForDelivery,
    orderStatus,
    isCashPayment,
    isCardPayment,
    isEftPayment,
    cashCollected,
    hasAssignedDriver,
    driver,
    paymentIsPaid,
  ]);

  const summaryIcon = useMemo(() => {
    if (isOrderCancelled) return XCircle;
    if (isDelivered) return CheckCircle2;
    if (isArrived) return MapPinned;
    if (isOnTheWay) return Truck;
    if (isReadyForDelivery) return PackageCheck;
    if (orderStatus === "preparing") return ChefHat;
    if (orderStatus === "confirmed") return Store;
    return AlertCircle;
  }, [isOrderCancelled, isDelivered, isArrived, isOnTheWay, isReadyForDelivery, orderStatus]);

  const summaryTone = useMemo(() => {
    if (isOrderCancelled) return "border-rose-200 bg-gradient-to-r from-rose-50 to-rose-100/80";
    if (isDelivered) return "border-emerald-300 bg-gradient-to-r from-emerald-50 to-emerald-100/80";
    if (isArrived) return "border-cyan-200 bg-gradient-to-r from-cyan-50 to-cyan-100/75";
    if (isOnTheWay) return "border-indigo-200 bg-gradient-to-r from-indigo-50 to-indigo-100/75";
    if (isReadyForDelivery) return "border-orange-200 bg-gradient-to-r from-orange-50 to-amber-100/75";
    if (orderStatus === "preparing") {
      return "border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-100/70";
    }
    if (orderStatus === "confirmed") {
      return "border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-100/70";
    }
    return "border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-100/70";
  }, [isOrderCancelled, isDelivered, isArrived, isOnTheWay, isReadyForDelivery, orderStatus]);

  const paymentBanner = useMemo<PaymentBanner | null>(() => {
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
  }, [
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
  ]);

  const milestones = useMemo(() => {
    if (!order) return [];

    const entries = [
      {
        label: "Order placed",
        value: order.created_at,
        icon: Clock3,
      },
      {
        label: "Driver accepted",
        value: order.accepted_at,
        icon: UserRound,
      },
      {
        label: "Trip started",
        value: order.started_delivery_at,
        icon: Truck,
      },
      {
        label: "Driver arrived",
        value: order.arrived_at,
        icon: MapPinned,
      },
      {
        label: "Delivered",
        value: order.delivered_at,
        icon: CheckCircle2,
      },
    ];

    return entries.filter((entry) => entry.value);
  }, [order]);

  const fetchOrder = useCallback(
    async ({
      showRefreshToast = false,
      background = false,
    }: {
      showRefreshToast?: boolean;
      background?: boolean;
    } = {}) => {
      if (!orderId) return;

      try {
        if (background) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select(`
            id,
            user_id,
            customer_name,
            customer_phone,
            customer_email,
            delivery_address,
            notes,
            payment_method,
            payment_provider,
            payment_reference,
            payment_status,
            status,
            subtotal,
            delivery_fee,
            discount_amount,
            total,
            created_at,
            estimated_delivery_time,
            driver_distance_km,
            driver_lat,
            driver_lng,
            driver_last_updated,
            driver_id,
            accepted_at,
            started_delivery_at,
            arrived_at,
            delivered_at,
            cash_collected,
            cash_collected_amount,
            cash_collected_at,
            destination_lat,
            destination_lng
          `)
          .eq("id", orderId)
          .single();

        if (orderError) throw orderError;

        const { data: itemData, error: itemsError } = await (supabase as any)
          .from("order_items")
          .select(`
            id,
            product_name,
            quantity,
            unit_price,
            final_unit_price,
            options_total,
            total_price,
            item_note
          `)
          .eq("order_id", orderId)
          .order("created_at", { ascending: true });

        if (itemsError) throw itemsError;

        const normalizedItems: OrderItemRecord[] = ((itemData || []) as any[]).map((item) => ({
          id: String(item.id),
          product_name: item.product_name,
          quantity: Number(item.quantity ?? 1),
          unit_price: Number(item.unit_price ?? 0),
          final_unit_price: Number(item.final_unit_price ?? item.unit_price ?? 0),
          options_total: Number(item.options_total ?? 0),
          total_price: Number(item.total_price ?? 0),
          item_note: item.item_note || null,
          selectedOptions: [],
        }));

        if (normalizedItems.length > 0) {
          const orderItemIds = normalizedItems.map((item) => item.id);

          const { data: optionData, error: optionsError } = await (supabase as any)
            .from("order_item_options")
            .select(`
              id,
              order_item_id,
              option_group_name,
              option_item_name,
              price_delta
            `)
            .in("order_item_id", orderItemIds)
            .order("created_at", { ascending: true });

          if (optionsError) throw optionsError;

          const optionsByItemId = new Map<string, OrderItemOptionRecord[]>();

          ((optionData || []) as any[]).forEach((option) => {
            const row: OrderItemOptionRecord = {
              id: String(option.id),
              order_item_id: String(option.order_item_id),
              option_group_name: option.option_group_name,
              option_item_name: option.option_item_name,
              price_delta: Number(option.price_delta ?? 0),
            };

            const existing = optionsByItemId.get(row.order_item_id) || [];
            existing.push(row);
            optionsByItemId.set(row.order_item_id, existing);
          });

          normalizedItems.forEach((item) => {
            item.selectedOptions = optionsByItemId.get(item.id) || [];
          });
        }

        const nextOrder = normalizeOrder(orderData);
        setOrder(nextOrder);
        setItems(normalizedItems);

        if (nextOrder.driver_id) {
          const { data: driverData, error: driverError } = await supabase
            .from("drivers")
            .select("id, name, phone")
            .eq("id", nextOrder.driver_id)
            .maybeSingle();

          if (!driverError) {
            setDriver((driverData as DriverInfo | null) || null);
          } else {
            setDriver(null);
          }
        } else {
          setDriver(null);
        }

        const nextSnapshot = {
          status: nextOrder.status,
          paymentStatus: normalize(nextOrder.payment_status),
          driverId: nextOrder.driver_id,
        };

        if (background) {
          const previousSnapshot = lastOrderSnapshotRef.current;

          if (previousSnapshot) {
            if (previousSnapshot.status !== nextSnapshot.status && nextOrder.status) {
              toast.success(`Order is now ${getStatusLabel(nextOrder.status)}`, {
                description: "Your tracking page updated automatically with the latest status.",
                duration: 2400,
              });
            } else if (!previousSnapshot.driverId && nextSnapshot.driverId) {
              toast.success("Driver assigned", {
                description: "Your order now has a driver and live tracking details are being refreshed.",
                duration: 2400,
              });
            } else if (previousSnapshot.paymentStatus !== nextSnapshot.paymentStatus) {
              toast.success("Payment status updated", {
                description: "Your payment details changed and have been refreshed automatically.",
                duration: 2400,
              });
            }
          }
        }

        lastOrderSnapshotRef.current = nextSnapshot;
        setLastSyncAt(new Date().toISOString());

        if (showRefreshToast) {
          toast.success("Tracking updated", {
            description: "Latest order, payment, and driver details have been loaded.",
            duration: 2200,
          });
        }
      } catch (error: any) {
        toast.error(error.message || "Failed to load order");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId]
  );

  useEffect(() => {
    void fetchOrder();

    if (!orderId) return;

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        () => {
          void fetchOrder({ background: true });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          void fetchOrder({ background: true });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId, fetchOrder]);

  useEffect(() => {
    if (!orderId) return;

    const pollId = window.setInterval(() => {
      void fetchOrder({ background: true });
    }, 15000);

    return () => {
      window.clearInterval(pollId);
    };
  }, [orderId, fetchOrder]);

  useEffect(() => {
    if (!showMap || !mapContainerRef.current || !order) return;

    const driverLngLat: [number, number] = [order.driver_lng as number, order.driver_lat as number];
    const destinationLngLat =
      order.destination_lng != null && order.destination_lat != null
        ? ([order.destination_lng, order.destination_lat] as [number, number])
        : null;

    const key = import.meta.env.VITE_MAPTILER_KEY;
    if (!key) return;

    if (!mapRef.current) {
      mapRef.current = new maplibregl.Map({
        container: mapContainerRef.current,
        style: `https://api.maptiler.com/maps/streets/style.json?key=${key}`,
        center: driverLngLat,
        zoom: isArrived ? 16 : 14,
      });

      driverMarkerRef.current = new maplibregl.Marker({ color: "#111827" })
        .setLngLat(driverLngLat)
        .addTo(mapRef.current);

      if (destinationLngLat) {
        destinationMarkerRef.current = new maplibregl.Marker({ color: "#059669" })
          .setLngLat(destinationLngLat)
          .addTo(mapRef.current);
      }
    } else {
      driverMarkerRef.current?.setLngLat(driverLngLat);

      if (destinationLngLat) {
        if (!destinationMarkerRef.current) {
          destinationMarkerRef.current = new maplibregl.Marker({ color: "#059669" })
            .setLngLat(destinationLngLat)
            .addTo(mapRef.current);
        } else {
          destinationMarkerRef.current.setLngLat(destinationLngLat);
        }
      } else {
        destinationMarkerRef.current?.remove();
        destinationMarkerRef.current = null;
      }
    }

    if (mapRef.current) {
      if (destinationLngLat && !isArrived) {
        const bounds = new maplibregl.LngLatBounds(driverLngLat, driverLngLat);
        bounds.extend(destinationLngLat);
        mapRef.current.fitBounds(bounds, {
          padding: 60,
          maxZoom: 15,
          duration: 800,
        });
      } else {
        mapRef.current.easeTo({
          center: driverLngLat,
          zoom: isArrived ? 16 : 14,
          duration: 800,
        });
      }
    }
  }, [
    showMap,
    isArrived,
    order?.driver_lat,
    order?.driver_lng,
    order?.destination_lat,
    order?.destination_lng,
    order,
  ]);

  useEffect(() => {
    if (showMap) return;

    driverMarkerRef.current?.remove();
    destinationMarkerRef.current?.remove();
    mapRef.current?.remove();

    driverMarkerRef.current = null;
    destinationMarkerRef.current = null;
    mapRef.current = null;
  }, [showMap]);

  useEffect(() => {
    return () => {
      driverMarkerRef.current?.remove();
      destinationMarkerRef.current?.remove();
      mapRef.current?.remove();

      driverMarkerRef.current = null;
      destinationMarkerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  const handleRetryPayment = async () => {
    if (!order || !canRetryPayment) return;

    setRetryingPayment(true);

    try {
      const customerEmail = order.customer_email?.trim();

      if (!customerEmail) {
        toast.error("This order has no customer email, so online payment cannot be restarted.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-payfast-checkout", {
        body: {
          orderId: order.id,
          total: order.total || 0,
          customerName: order.customer_name,
          customerEmail,
          itemName: `Village Eats Order #${order.id.slice(0, 8).toUpperCase()}`,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to start payment");
      }

      if (!data?.url) {
        throw new Error("No payment URL returned");
      }

      window.location.href = data.url;
    } catch (error: any) {
      toast.error(error.message || "Failed to restart payment");
    } finally {
      setRetryingPayment(false);
    }
  };

  const paymentBadge = () => {
    if (hasPaymentMismatch) {
      return (
        <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700">
          <ShieldAlert className="h-4 w-4" />
          Payment mismatch
        </div>
      );
    }

    if (paymentIsPaid) {
      return (
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {isEftPayment ? "EFT confirmed" : "Paid"}
        </div>
      );
    }

    if (isCashPayment && isDelivered && cashCollected) {
      return (
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
          <HandCoins className="h-4 w-4" />
          Cash collected
        </div>
      );
    }

    if (isCashPayment && isArrived && !cashCollected) {
      return (
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
          <HandCoins className="h-4 w-4" />
          Cash due now
        </div>
      );
    }

    if (isCashPayment) {
      return (
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
          <HandCoins className="h-4 w-4" />
          Cash on delivery
        </div>
      );
    }

    if (isEftPayment && paymentIsPending) {
      return (
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
          <Landmark className="h-4 w-4" />
          EFT pending
        </div>
      );
    }

    if (paymentIsFailed) {
      return (
        <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700">
          <XCircle className="h-4 w-4" />
          Payment failed
        </div>
      );
    }

    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
        <Clock3 className="h-4 w-4" />
        Payment pending
      </div>
    );
  };

  const orderBadge = () => {
    const map: Record<string, string> = {
      pending: "border-amber-200 bg-amber-50 text-amber-700",
      confirmed: "border-sky-200 bg-sky-50 text-sky-700",
      preparing: "border-violet-200 bg-violet-50 text-violet-700",
      ready_for_delivery: "border-orange-200 bg-orange-50 text-orange-700",
      on_the_way: "border-indigo-200 bg-indigo-50 text-indigo-700",
      arrived: "border-cyan-200 bg-cyan-50 text-cyan-700",
      delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
      cancelled: "border-rose-200 bg-rose-50 text-rose-700",
    };

    return (
      <div
        className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-medium ${
          map[orderStatus] || "border-border bg-muted text-foreground"
        }`}
      >
        {getStatusLabel(orderStatus)}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <div className="container py-16">
          <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
            <h1 className="mb-3 text-3xl font-bold text-foreground">Order not found</h1>
            <p className="mb-6 text-muted-foreground">We could not find that order.</p>
            <button
              onClick={() => navigate("/menu")}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Back to Menu
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const SummaryIcon = summaryIcon;
  const PaymentBannerIcon = paymentBanner?.icon;

  const deliverySectionTitle = isArrived ? "Driver Has Arrived" : showMap ? "Live Driver Location" : "Delivery";
  const deliverySectionDescription = isArrived
    ? "Your driver is currently at your delivery location."
    : showMap
      ? order.destination_lat != null && order.destination_lng != null
        ? "Live map showing both the driver and your destination."
        : "Real-time driver tracking for your active delivery."
      : hasAssignedDriver
        ? "Driver and delivery status for this order."
        : "Dispatch and delivery updates will appear here as your order progresses.";

  const driverCardDescription = hasAssignedDriver
    ? order.accepted_at
      ? `Accepted ${formatTime(order.accepted_at)}`
      : "Assigned to your order"
    : "Not assigned yet";

  const paymentMetricTitle = hasPaymentMismatch
    ? "Needs review"
    : isCashPayment
      ? cashCollected
        ? "Cash collected"
        : "Cash on delivery"
      : isEftPayment
        ? paymentIsPaid
          ? "EFT confirmed"
          : "EFT pending"
        : paymentIsPaid
          ? "Paid online"
          : "Awaiting payment";

  const paymentMetricDescription = hasPaymentMismatch
    ? "Order/payment out of sync"
    : isCashPayment
      ? cashCollected
        ? "Received successfully"
        : "Collected on arrival"
      : isEftPayment
        ? paymentIsPaid
          ? "Manual confirmation complete"
          : "Waiting for proof/verification"
        : paymentIsPaid
          ? "Provider confirmed"
          : "Provider still pending";

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl py-8 md:py-10">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Live order updates · Payment status · Delivery tracking
            </div>

            <h1 className="font-display text-4xl text-foreground sm:text-5xl">Track Your Order</h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">Order ID: {order.id}</p>
          </div>

          <button
            onClick={() => void fetchOrder({ showRefreshToast: true, background: true })}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>

        {hasPaymentMismatch && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Order status and payment are out of sync</p>
                <p className="mt-1 text-sm leading-6">
                  This order has already moved into a later delivery stage, but payment is not yet marked as confirmed.
                  That usually means the order needs an admin/payment review.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 overflow-hidden rounded-[30px] border border-border bg-card shadow-card">
          <div className="border-b border-border bg-muted/30 p-5 md:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  {orderBadge()}
                  <div className="inline-flex rounded-full border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground">
                    Placed {formatDateTime(order.created_at)}
                  </div>
                </div>

                <div className={`rounded-[24px] border p-5 shadow-sm ${summaryTone}`}>
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white text-foreground shadow-sm">
                      <SummaryIcon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/60">
                        What’s happening now
                      </p>
                      <p className="mt-2 text-base font-semibold leading-7 text-foreground sm:text-lg">
                        {statusSummary}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:min-w-[520px] xl:grid-cols-4">
                <MetricCard
                  label="Status"
                  value={getStatusLabel(orderStatus)}
                  description={
                    isDelivered
                      ? "Order completed"
                      : isArrived
                        ? "Driver at location"
                        : isOnTheWay
                          ? "Delivery in progress"
                          : isReadyForDelivery
                            ? "Waiting for dispatch"
                            : orderStatus === "preparing"
                              ? "Kitchen active"
                              : orderStatus === "confirmed"
                                ? "Store accepted"
                                : "Waiting to start"
                  }
                  icon={SummaryIcon}
                />

                <MetricCard
                  label="Payment"
                  value={paymentMetricTitle}
                  description={paymentMetricDescription}
                  icon={
                    isCashPayment
                      ? HandCoins
                      : isEftPayment
                        ? Landmark
                        : hasPaymentMismatch
                          ? ShieldAlert
                          : CreditCard
                  }
                />

                <MetricCard
                  label="Driver"
                  value={hasAssignedDriver ? driver?.name || "Assigned" : "Waiting"}
                  description={driverCardDescription}
                  icon={UserRound}
                />

                <MetricCard
                  label="Total"
                  value={formatCurrency(order.total)}
                  description={`${totalItems} item${totalItems === 1 ? "" : "s"} in this order`}
                  icon={PackageCheck}
                />
              </div>
            </div>
          </div>

          <div className="p-5 md:p-6">
            <DeliveryProgressTracker status={getTrackerStatus(orderStatus)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <div className="space-y-6 xl:col-span-3">
            {paymentBanner && PaymentBannerIcon && (
              <div className={`rounded-2xl border p-5 text-sm ${paymentBanner.tone}`}>
                <div className="flex items-start gap-3">
                  <PaymentBannerIcon className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">{paymentBanner.title}</p>
                    <p className="mt-1 leading-6">{paymentBanner.description}</p>
                  </div>
                </div>
              </div>
            )}

            <SectionCard
              title={deliverySectionTitle}
              description={deliverySectionDescription}
              icon={showMap ? Navigation : Truck}
              action={
                showMap ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                    <Navigation className="h-4 w-4" />
                    Live
                  </div>
                ) : null
              }
            >
              <div className="space-y-5">
                {showMap && (
                  <>
                    <div
                      ref={mapContainerRef}
                      className="h-[320px] w-full overflow-hidden rounded-[24px] border border-border"
                    />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <InfoTile
                        label="Driver distance"
                        value={
                          order.driver_distance_km != null
                            ? `${order.driver_distance_km.toFixed(1)} km`
                            : isArrived
                              ? "At your location"
                              : "Calculating..."
                        }
                      />
                      <InfoTile
                        label={isArrived ? "Arrival time" : "Estimated arrival"}
                        value={
                          isArrived
                            ? formatTime(order.arrived_at || order.estimated_delivery_time)
                            : formatTime(order.estimated_delivery_time)
                        }
                      />
                      <InfoTile
                        label="Last updated"
                        value={
                          order.driver_last_updated
                            ? formatRelativeTime(order.driver_last_updated)
                            : "Waiting..."
                        }
                      />
                    </div>

                    {order.driver_last_updated && (
                      <p className="text-xs text-muted-foreground">
                        Last full update: {formatDateTime(order.driver_last_updated)}
                      </p>
                    )}
                  </>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InfoTile
                    label="Driver"
                    value={hasAssignedDriver ? driver?.name || "Assigned driver" : "Waiting for assignment"}
                    subValue={driverCardDescription}
                    icon={UserRound}
                  />

                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Driver phone
                    </p>

                    {driver?.phone ? (
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="text-base font-semibold text-foreground">{driver.phone}</p>
                        <a
                          href={`tel:${driver.phone}`}
                          className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                        >
                          <Phone className="h-4 w-4" />
                          Call
                        </a>
                      </div>
                    ) : (
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {hasAssignedDriver ? "Not available" : "Available after assignment"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Customer & Delivery"
              description="Delivery address, customer details, and order notes."
              icon={MapPinned}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background p-4 text-sm">
                  <p className="mb-1 text-muted-foreground">Customer</p>
                  <p className="font-medium text-foreground">{order.customer_name}</p>
                  {order.customer_phone && <p className="text-foreground">{order.customer_phone}</p>}
                  {order.customer_email && <p className="break-all text-foreground">{order.customer_email}</p>}
                </div>

                <div className="rounded-2xl border border-border bg-background p-4 text-sm">
                  <p className="mb-1 text-muted-foreground">Delivery address</p>
                  <div className="flex items-start gap-2">
                    <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="whitespace-pre-line font-medium text-foreground">
                      {order.delivery_address || "No address provided"}
                    </p>
                  </div>
                </div>
              </div>

              {order.notes && (
                <div className="mt-4 rounded-2xl border border-border bg-background p-4 text-sm">
                  <p className="mb-1 text-muted-foreground">Notes</p>
                  <p className="whitespace-pre-line leading-6 text-foreground">{order.notes}</p>
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Payment"
              description="Secure checkout, provider details, and payment state."
              icon={CreditCard}
              action={paymentBadge()}
            >
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="mb-1 text-muted-foreground">Payment method</p>
                  <p className="font-medium capitalize text-foreground">{order.payment_method || "N/A"}</p>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="mb-1 text-muted-foreground">Payment provider</p>
                  <p className="font-medium text-foreground">{order.payment_provider || "N/A"}</p>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="mb-1 text-muted-foreground">Payment reference</p>
                  <p className="break-all font-medium text-foreground">
                    {order.payment_reference || "Not available yet"}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="mb-1 text-muted-foreground">Amount</p>
                  <p className="font-medium text-foreground">{formatCurrency(order.total)}</p>
                </div>
              </div>

              {canRetryPayment && !paymentIsPaid && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 p-4">
                  <div>
                    <p className="font-medium text-foreground">Complete your payment</p>
                    <p className="text-sm text-muted-foreground">
                      Retry payment is available only while the order is still pending or cancelled.
                    </p>
                  </div>

                  <button
                    onClick={handleRetryPayment}
                    disabled={retryingPayment}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {retryingPayment ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    {retryingPayment ? "Starting payment..." : "Retry Payment"}
                  </button>
                </div>
              )}
            </SectionCard>

            {milestones.length > 0 && (
              <SectionCard
                title="Milestones"
                description="Important delivery timestamps recorded for this order."
                icon={Clock3}
              >
                <div className="space-y-3">
                  {milestones.map((milestone) => {
                    const Icon = milestone.icon;

                    return (
                      <div
                        key={milestone.label}
                        className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>

                        <div>
                          <p className="font-medium text-foreground">{milestone.label}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatDateTime(milestone.value)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}
          </div>

          <div className="xl:col-span-2">
            <div className="sticky top-24 space-y-4">
              <section className="overflow-hidden rounded-[28px] border border-border bg-card shadow-card">
                <div className="border-b border-border bg-muted/30 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                        <PackageCheck className="h-3.5 w-3.5" />
                        Order Summary
                      </div>
                      <h2 className="text-2xl font-semibold text-foreground">Your items</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Review quantities, selected options, and final line totals.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border bg-background px-4 py-3 text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Items
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{totalItems}</p>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-5 space-y-3">
                    {items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
                        No items found for this order.
                      </div>
                    ) : (
                      items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-[22px] border border-border bg-background p-4 transition-shadow hover:shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary/10 px-2 text-xs font-semibold text-primary">
                                  {item.quantity}×
                                </span>
                                <p className="truncate text-[15px] font-semibold text-foreground">
                                  {item.product_name}
                                </p>
                              </div>

                              <p className="text-sm text-muted-foreground">
                                Unit price{" "}
                                <span className="font-medium text-foreground">
                                  {formatCurrency(item.final_unit_price || item.unit_price)}
                                </span>
                              </p>
                            </div>

                            <div className="rounded-xl bg-card px-3 py-2 text-right">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Line total
                              </p>
                              <p className="mt-1 text-sm font-semibold text-foreground">
                                {formatCurrency(item.total_price)}
                              </p>
                            </div>
                          </div>

                          {item.selectedOptions.length > 0 && (
                            <div className="mt-4 border-t border-border/70 pt-3">
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                Selected options
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {item.selectedOptions.map((option) => (
                                  <span
                                    key={option.id}
                                    className="rounded-full border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground/80"
                                  >
                                    {option.option_group_name}: {option.option_item_name}
                                    {option.price_delta > 0
                                      ? ` (+${formatCurrency(option.price_delta)})`
                                      : ""}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {item.item_note && (
                            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 px-3 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                                Kitchen note
                              </p>
                              <p className="mt-1 text-sm leading-6 text-amber-900">{item.item_note}</p>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="rounded-[22px] border border-border bg-muted/25 p-4">
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium text-foreground">{formatCurrency(order.subtotal)}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Delivery fee</span>
                        <span className="font-medium text-foreground">{formatCurrency(order.delivery_fee)}</span>
                      </div>

                      {!!Number(order.discount_amount || 0) && (
                        <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
                          <span className="font-medium">Discount</span>
                          <span className="font-semibold">-{formatCurrency(order.discount_amount)}</span>
                        </div>
                      )}

                      <div className="border-t border-border pt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-base font-semibold text-foreground">Total</span>
                          <span className="text-xl font-semibold text-primary">{formatCurrency(order.total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <SectionCard
                title="Quick Info"
                description="Key timing and payment information at a glance."
                icon={Clock3}
                bodyClassName="space-y-3"
              >
                <InfoTile
                  label="Placed"
                  value={formatDateTime(order.created_at)}
                  subValue={formatRelativeTime(order.created_at)}
                />

                <InfoTile
                  label="Estimated arrival"
                  value={formatTime(order.estimated_delivery_time)}
                  icon={MapPinned}
                />

                <div className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Payment state
                      </p>
                      <div className="mt-2">{paymentBadge()}</div>
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <CreditCard className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </SectionCard>

              <section className="rounded-[28px] border border-border bg-gradient-to-br from-card to-muted/25 p-5 shadow-card">
                <h2 className="text-xl font-semibold text-foreground">Need help?</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  This page refreshes automatically when admins or drivers update your order. Last
                  live sync: {lastSyncAt ? formatRelativeTime(lastSyncAt) : "Just now"}. Contact
                  your driver once assigned, and remember that card and EFT orders should be
                  confirmed before the order advances.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
