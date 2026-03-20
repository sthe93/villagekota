import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CheckCircle2,
  ChefHat,
  Clock3,
  CreditCard,
  Loader2,
  MapPinned,
  PackageCheck,
  RefreshCw,
  Store,
  Truck,
  XCircle,
  Navigation,
  AlertCircle,
  HandCoins,
  Phone,
  UserRound,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Footer from "@/components/Footer";
import maplibregl from "maplibre-gl";
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

const CARD_REQUIRED_PAYMENT_METHODS = ["card"];

function formatCurrency(value: number | null | undefined) {
  return `R${Number(value || 0).toFixed(2)}`;
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

function normalize(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
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

type PaymentBanner = {
  tone: string;
  icon: typeof AlertCircle;
  title: string;
  description: string;
};

export default function OrderTrackingPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [items, setItems] = useState<OrderItemRecord[]>([]);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const paymentStatus = useMemo(() => normalize(order?.payment_status), [order?.payment_status]);
  const orderStatus = useMemo<OrderStatus>(
    () => ((normalize(order?.status) || "pending") as OrderStatus),
    [order?.status]
  );
  const paymentMethod = useMemo(() => normalize(order?.payment_method), [order?.payment_method]);

  const paymentIsPaid = paymentStatus === "paid";
  const paymentIsFailed = paymentStatus === "failed";
  const paymentIsCancelled = paymentStatus === "cancelled";
  const paymentIsPending = paymentStatus === "pending" || paymentStatus === "";

  const isOrderCancelled = orderStatus === "cancelled";
  const isReadyForDelivery = orderStatus === "ready_for_delivery";
  const isOnTheWay = orderStatus === "on_the_way";
  const isArrived = orderStatus === "arrived";
  const isDelivered = orderStatus === "delivered";

  const isCardPayment = CARD_REQUIRED_PAYMENT_METHODS.includes(paymentMethod);
  const isCashPayment = paymentMethod === "cash";
  const isEftPayment = paymentMethod === "eft";
  const cashCollected = !!order?.cash_collected;
  const hasAssignedDriver = !!order?.driver_id && !!driver;

  const canRetryPayment = useMemo(() => {
    if (!order) return false;

    return (
      isCardPayment &&
      ["pending", "failed", "cancelled", ""].includes(paymentStatus) &&
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
    if (isOrderCancelled) return "border-rose-200 bg-rose-50 text-rose-800";
    if (isDelivered) return "border-emerald-200 bg-emerald-50 text-emerald-800";
    if (isArrived) return "border-cyan-200 bg-cyan-50 text-cyan-800";
    if (isOnTheWay) return "border-indigo-200 bg-indigo-50 text-indigo-800";
    if (isReadyForDelivery) return "border-orange-200 bg-orange-50 text-orange-800";
    if (orderStatus === "preparing") return "border-violet-200 bg-violet-50 text-violet-800";
    if (orderStatus === "confirmed") return "border-sky-200 bg-sky-50 text-sky-800";
    return "border-amber-200 bg-amber-50 text-amber-800";
  }, [isOrderCancelled, isDelivered, isArrived, isOnTheWay, isReadyForDelivery, orderStatus]);

  const paymentBanner = useMemo<PaymentBanner | null>(() => {
    if (!order || isOrderCancelled) return null;

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

    if (isCardPayment && (paymentIsFailed || paymentIsCancelled)) {
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
          "Your order cannot move into confirmation, preparation, dispatch, or delivery until the card payment is marked as paid.",
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

    if (isEftPayment && (paymentIsFailed || paymentIsCancelled)) {
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
    isCashPayment,
    isCardPayment,
    isEftPayment,
    cashCollected,
    isArrived,
    paymentIsPaid,
    paymentIsFailed,
    paymentIsCancelled,
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
    async (showRefreshToast = false) => {
      if (!orderId) return;

      try {
        if (!loading) setRefreshing(true);

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
            cash_collected_at
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
          .order("id", { ascending: true });

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

        const nextOrder = orderData as OrderRecord;
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

        if (showRefreshToast) {
          toast.success("Order refreshed");
        }
      } catch (error: any) {
        toast.error(error.message || "Failed to load order");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId, loading]
  );

  useEffect(() => {
    void fetchOrder();

    if (!orderId) return;

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        () => {
          void fetchOrder();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, fetchOrder]);

  useEffect(() => {
    if (!showMap || !mapContainerRef.current || !order) return;

    const lngLat: [number, number] = [order.driver_lng as number, order.driver_lat as number];
    const key = import.meta.env.VITE_MAPTILER_KEY;

    if (!key) return;

    if (!mapRef.current) {
      mapRef.current = new maplibregl.Map({
        container: mapContainerRef.current,
        style: `https://api.maptiler.com/maps/streets/style.json?key=${key}`,
        center: lngLat,
        zoom: isArrived ? 16 : 14,
      });

      markerRef.current = new maplibregl.Marker({ color: "#111827" })
        .setLngLat(lngLat)
        .addTo(mapRef.current);
    } else {
      mapRef.current.easeTo({
        center: lngLat,
        zoom: isArrived ? 16 : 14,
        duration: 800,
      });
      markerRef.current?.setLngLat(lngLat);
    }
  }, [showMap, isArrived, order?.driver_lat, order?.driver_lng, order]);

  useEffect(() => {
    if (showMap) return;

    markerRef.current?.remove();
    mapRef.current?.remove();
    markerRef.current = null;
    mapRef.current = null;
  }, [showMap]);

  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      mapRef.current?.remove();
      markerRef.current = null;
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

    if (paymentIsFailed || paymentIsCancelled) {
      return (
        <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700">
          <XCircle className="h-4 w-4" />
          Awaiting payment
        </div>
      );
    }

    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
        <Clock3 className="h-4 w-4" />
        Payment verification pending
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl py-8 md:py-10">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Live order updates · Payment status · Delivery tracking
            </div>

            <h1 className="font-display text-4xl text-foreground sm:text-5xl">
              Track Your Order
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Order ID: {order.id}
            </p>
          </div>

          <button
            onClick={() => void fetchOrder(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </button>
        </div>

        <div className="mb-6 overflow-hidden rounded-[28px] border bg-card shadow-card">
          <div className="border-b border-border bg-muted/30 p-5 md:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  {orderBadge()}
                  <div className="inline-flex rounded-full border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground">
                    Placed {formatDateTime(order.created_at)}
                  </div>
                </div>

                <div className={`rounded-2xl border p-4 ${summaryTone}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70">
                      <SummaryIcon className="h-5 w-5" />
                    </div>

                    <div>
                      <h2 className="text-xl font-semibold">What’s happening now</h2>
                      <p className="mt-1 text-sm leading-6 opacity-90">{statusSummary}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[400px]">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Status</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {getStatusLabel(orderStatus)}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Payment</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {isCashPayment
                      ? cashCollected
                        ? "Cash collected"
                        : "Cash on delivery"
                      : isEftPayment
                      ? paymentIsPaid
                        ? "EFT confirmed"
                        : "EFT pending"
                      : paymentIsPaid
                      ? "Paid online"
                      : "Awaiting payment"}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Driver</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {hasAssignedDriver ? driver?.name || "Assigned" : "Waiting"}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Total</p>
                  <p className="mt-1 text-sm font-semibold text-primary">
                    {formatCurrency(order.total)}
                  </p>
                </div>
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

            {hasAssignedDriver && (
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Your Driver</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Driver details for this delivery.
                    </p>
                  </div>

                  {order.accepted_at && (
                    <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                      Accepted {formatTime(order.accepted_at)}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border p-4">
                    <p className="mb-1 text-sm text-muted-foreground">Driver name</p>
                    <p className="flex items-center gap-2 text-base font-semibold text-foreground">
                      <UserRound className="h-4 w-4 text-primary" />
                      {driver?.name || "Assigned driver"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border p-4">
                    <p className="mb-1 text-sm text-muted-foreground">Driver phone</p>
                    {driver?.phone ? (
                      <div className="flex items-center justify-between gap-3">
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
                      <p className="text-base font-semibold text-foreground">Not available</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showMap && (
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      {isArrived ? "Driver Has Arrived" : "Live Driver Location"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isArrived
                        ? "Your driver is at your delivery location."
                        : "Real-time driver tracking for your active delivery."}
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                    <Navigation className="h-4 w-4" />
                    Live
                  </div>
                </div>

                <div
                  ref={mapContainerRef}
                  className="h-[320px] w-full overflow-hidden rounded-2xl border border-border"
                />

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border p-4">
                    <p className="mb-1 text-sm text-muted-foreground">Driver distance</p>
                    <p className="text-base font-semibold text-foreground">
                      {order.driver_distance_km != null
                        ? `${order.driver_distance_km.toFixed(1)} km`
                        : isArrived
                        ? "At your location"
                        : "Calculating..."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border p-4">
                    <p className="mb-1 text-sm text-muted-foreground">
                      {isArrived ? "Arrival time" : "Estimated arrival"}
                    </p>
                    <p className="text-base font-semibold text-foreground">
                      {isArrived
                        ? formatTime(order.arrived_at || order.estimated_delivery_time)
                        : formatTime(order.estimated_delivery_time)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border p-4">
                    <p className="mb-1 text-sm text-muted-foreground">Last updated</p>
                    <p className="text-base font-semibold text-foreground">
                      {order.driver_last_updated ? formatTime(order.driver_last_updated) : "Waiting..."}
                    </p>
                  </div>
                </div>

                {order.driver_last_updated && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Last full update: {formatDateTime(order.driver_last_updated)}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <h2 className="mb-5 text-xl font-semibold text-foreground">Customer & Delivery</h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border p-4 text-sm">
                  <p className="mb-1 text-muted-foreground">Customer</p>
                  <p className="font-medium text-foreground">{order.customer_name}</p>
                  {order.customer_phone && <p className="text-foreground">{order.customer_phone}</p>}
                  {order.customer_email && <p className="break-all text-foreground">{order.customer_email}</p>}
                </div>

                <div className="rounded-2xl border border-border p-4 text-sm">
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
                <div className="mt-4 rounded-2xl border border-border p-4 text-sm">
                  <p className="mb-1 text-muted-foreground">Notes</p>
                  <p className="whitespace-pre-line leading-6 text-foreground">{order.notes}</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Payment</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Secure checkout and payment status.
                  </p>
                </div>

                {paymentBadge()}
              </div>

              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div className="rounded-2xl border border-border p-4">
                  <p className="mb-1 text-muted-foreground">Payment method</p>
                  <p className="font-medium capitalize text-foreground">{order.payment_method || "N/A"}</p>
                </div>

                <div className="rounded-2xl border border-border p-4">
                  <p className="mb-1 text-muted-foreground">Payment provider</p>
                  <p className="font-medium text-foreground">{order.payment_provider || "N/A"}</p>
                </div>

                <div className="rounded-2xl border border-border p-4">
                  <p className="mb-1 text-muted-foreground">Payment reference</p>
                  <p className="break-all font-medium text-foreground">
                    {order.payment_reference || "Not available yet"}
                  </p>
                </div>

                <div className="rounded-2xl border border-border p-4">
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
            </div>

            {milestones.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <h2 className="mb-5 text-xl font-semibold text-foreground">Milestones</h2>

                <div className="space-y-3">
                  {milestones.map((milestone) => {
                    const Icon = milestone.icon;

                    return (
                      <div
                        key={milestone.label}
                        className="flex items-start gap-3 rounded-2xl border border-border p-4"
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
              </div>
            )}
          </div>

          <div className="xl:col-span-2">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <h2 className="mb-5 text-xl font-semibold text-foreground">Order Summary</h2>

                <div className="mb-5 space-y-3">
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No items found for this order.</p>
                  ) : (
                    items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-border bg-background p-3 text-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{item.product_name}</p>
                            <p className="text-muted-foreground">
                              {item.quantity} × {formatCurrency(item.final_unit_price || item.unit_price)}
                            </p>
                          </div>

                          <p className="font-medium text-foreground">
                            {formatCurrency(item.total_price)}
                          </p>
                        </div>

                        {item.selectedOptions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.selectedOptions.map((option) => (
                              <span
                                key={option.id}
                                className="rounded-full bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground"
                              >
                                {option.option_group_name}: {option.option_item_name}
                                {option.price_delta > 0
                                  ? ` (+${formatCurrency(option.price_delta)})`
                                  : ""}
                              </span>
                            ))}
                          </div>
                        )}

                        {item.item_note && (
                          <p className="mt-2 rounded-lg bg-card px-2.5 py-2 text-xs text-muted-foreground">
                            Note: {item.item_note}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2 border-t border-border pt-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">{formatCurrency(order.subtotal)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery</span>
                    <span className="text-foreground">{formatCurrency(order.delivery_fee)}</span>
                  </div>

                  {!!Number(order.discount_amount || 0) && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount</span>
                      <span>-{formatCurrency(order.discount_amount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
                    <span className="text-foreground">Total</span>
                    <span className="text-primary">{formatCurrency(order.total)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <h2 className="mb-4 text-xl font-semibold text-foreground">Quick Info</h2>

                <div className="space-y-3 text-sm">
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="text-muted-foreground">Placed</p>
                    <p className="mt-1 font-medium text-foreground">
                      {formatDateTime(order.created_at)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatRelativeTime(order.created_at)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="text-muted-foreground">Estimated arrival</p>
                    <p className="mt-1 font-medium text-foreground">
                      {formatTime(order.estimated_delivery_time)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="text-muted-foreground">Payment state</p>
                    <div className="mt-2">{paymentBadge()}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <h2 className="mb-3 text-xl font-semibold text-foreground">Need help?</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Refresh this page for the latest status, or contact your driver once assigned.
                  If your payment is still pending, complete it before the order can continue.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}