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

type OrderItemRecord = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
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

  const isOrderCancelled = orderStatus === "cancelled";
  const isReadyForDelivery = orderStatus === "ready_for_delivery";
  const isOnTheWay = orderStatus === "on_the_way";
  const isArrived = orderStatus === "arrived";
  const isDelivered = orderStatus === "delivered";

  const isCardPayment = CARD_REQUIRED_PAYMENT_METHODS.includes(paymentMethod);
  const isCashPayment = paymentMethod === "cash";
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

  const paymentNeedsAttention = useMemo(() => {
    return isCardPayment && !paymentIsPaid;
  }, [isCardPayment, paymentIsPaid]);

  const showMap = useMemo(() => {
    return (
      (isOnTheWay || isArrived) &&
      order?.driver_lat != null &&
      order?.driver_lng != null
    );
  }, [isOnTheWay, isArrived, order?.driver_lat, order?.driver_lng]);

  const statusSummary = useMemo(() => {
    if (!order) return "Loading order status...";

    if (isOrderCancelled) {
      return "This order has been cancelled.";
    }

    if (isDelivered) {
      return isCashPayment && cashCollected
        ? "Your order has been delivered and cash payment was collected successfully."
        : "Your order has been delivered. Enjoy your meal.";
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

    return paymentNeedsAttention
      ? "Your order is placed and awaiting payment confirmation."
      : "Your order has been placed and is waiting for confirmation.";
  }, [
    order,
    isOrderCancelled,
    isDelivered,
    isArrived,
    isOnTheWay,
    isReadyForDelivery,
    orderStatus,
    paymentNeedsAttention,
    isCashPayment,
    cashCollected,
    hasAssignedDriver,
    driver,
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

  const summaryIconClass = useMemo(() => {
    if (isOrderCancelled) return "text-rose-600";
    if (isDelivered) return "text-emerald-600";
    if (isArrived) return "text-cyan-600";
    if (isOnTheWay) return "text-indigo-600";
    if (isReadyForDelivery) return "text-orange-600";
    if (orderStatus === "preparing") return "text-violet-600";
    if (orderStatus === "confirmed") return "text-sky-600";
    return "text-primary";
  }, [isOrderCancelled, isDelivered, isArrived, isOnTheWay, isReadyForDelivery, orderStatus]);

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

        const { data: itemData, error: itemsError } = await supabase
          .from("order_items")
          .select("id, product_name, quantity, unit_price, total_price")
          .eq("order_id", orderId)
          .order("id", { ascending: true });

        if (itemsError) throw itemsError;

        const nextOrder = orderData as OrderRecord;
        setOrder(nextOrder);
        setItems((itemData || []) as OrderItemRecord[]);

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
    fetchOrder();

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
          fetchOrder();
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
          Paid
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
      <div className="flex min-h-[70vh] items-center justify-center">
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
            <p className="mb-6 text-muted-foreground">
              We could not find that order.
            </p>
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

  return (
    <div>
      <div className="container max-w-7xl py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-4xl text-foreground">Track Order</h1>
            <p className="mt-1 text-muted-foreground">Order ID: {order.id}</p>
          </div>

          <button
            onClick={() => fetchOrder(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </button>
        </div>

        <div className="mb-6 overflow-hidden rounded-3xl border border-border bg-card">
          <div className="border-b border-border bg-muted/30 p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  {orderBadge()}
                  <div className="inline-flex rounded-full border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground">
                    Created {formatDateTime(order.created_at)}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-background">
                    <SummaryIcon className={`h-5 w-5 ${summaryIconClass}`} />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Order Status</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{statusSummary}</p>

                    {paymentNeedsAttention && !isOrderCancelled && (
                      <p className="mt-2 text-sm text-amber-700">
                        Card orders must be paid before confirmation, preparation, dispatch, or delivery can continue.
                      </p>
                    )}

                    {isCashPayment && isArrived && !cashCollected && (
                      <p className="mt-2 text-sm text-amber-700">
                        Please have your cash ready for the driver.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[380px]">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{getStatusLabel(orderStatus)}</p>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Payment</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {isCashPayment
                      ? cashCollected
                        ? "Cash collected"
                        : "Cash on delivery"
                      : paymentIsPaid
                      ? "Paid online"
                      : "Awaiting payment"}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Driver</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {hasAssignedDriver ? driver?.name || "Assigned" : "Waiting"}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                  <p className="mt-1 text-sm font-semibold text-primary">{formatCurrency(order.total)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 md:p-6">
            <DeliveryProgressTracker status={orderStatus as DeliveryStatus} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <div className="space-y-6 xl:col-span-3">
            {hasAssignedDriver && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Your Driver</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Driver details for this delivery.
                    </p>
                  </div>

                  {order.accepted_at && (
                    <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
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
              <div className="rounded-2xl border border-border bg-card p-6">
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

            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-5 text-xl font-semibold text-foreground">Customer & Delivery</h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border p-4 text-sm">
                  <p className="mb-1 text-muted-foreground">Customer</p>
                  <p className="font-medium text-foreground">{order.customer_name}</p>
                  {order.customer_phone && <p className="text-foreground">{order.customer_phone}</p>}
                  {order.customer_email && <p className="text-foreground">{order.customer_email}</p>}
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
                  <p className="text-foreground">{order.notes}</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Payment</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Secure checkout and payment status
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

              {paymentNeedsAttention && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  This order cannot move into confirmation, preparation, dispatch, or delivery until the card payment is marked as paid.
                </div>
              )}

              {isCashPayment && isArrived && !cashCollected && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Your driver has arrived. Please pay the cash amount of {formatCurrency(order.total)} to complete delivery.
                </div>
              )}

              {isCashPayment && isOnTheWay && !cashCollected && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  This is a cash order. Payment will be collected by the driver on arrival.
                </div>
              )}

              {isCashPayment && cashCollected && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  Cash payment was collected successfully
                  {order.cash_collected_at ? ` at ${formatDateTime(order.cash_collected_at)}.` : "."}
                </div>
              )}

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
          </div>

          <div className="xl:col-span-2">
            <div className="sticky top-24 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-5 text-xl font-semibold text-foreground">Order Summary</h2>

              <div className="mb-5 space-y-3">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items found for this order.</p>
                ) : (
                  items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium text-foreground">{item.product_name}</p>
                        <p className="text-muted-foreground">
                          {item.quantity} × {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                      <p className="font-medium text-foreground">
                        {formatCurrency(item.total_price)}
                      </p>
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
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}