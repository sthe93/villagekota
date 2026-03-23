import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CreditCard,
  Loader2,
  MapPinned,
  Navigation,
  PackageCheck,
  Phone,
  RefreshCw,
  ShieldCheck,
  Truck,
  UserRound,
  Star,
} from "lucide-react";
import maplibregl from "maplibre-gl";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/components/ui/sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Footer from "@/components/Footer";
import OrderReviewDialog from "@/components/OrderReviewDialog";
import DeliveryProgressTracker from "@/components/DeliveryProgressTracker";
import {
  fetchOrderTrackingSnapshot,
} from "@/features/order-tracking/api";
import {
  InfoTile,
  OrderStatusBadge,
  OrderTotalsCard,
  SectionCard,
} from "@/features/order-tracking/components";
import type {
  DriverInfo,
  OrderItemRecord,
  OrderRecord,
  OrderStatus,
  PaymentBanner,
} from "@/features/order-tracking/types";
import {
  ADVANCED_ORDER_STATUSES,
  CARD_REQUIRED_PAYMENT_METHODS,
  EFT_PAYMENT_METHODS,
  FAILED_PAYMENT_STATUSES,
  PAID_PAYMENT_STATUSES,
  PENDING_PAYMENT_STATUSES,
  formatCurrency,
  formatDateTime,
  formatRelativeTime,
  formatTime,
  getPaymentBanner,
  getStatusLabel,
  getSummaryIcon,
  getSummaryTone,
  getTrackingMilestones,
  getTrackerStatus,
  normalize,
  normalizeOrderStatus,
} from "@/features/order-tracking/utils";
import {
  deriveDeliveryConfirmationCode,
  formatDeliveryConfirmationCode,
} from "@/lib/deliveryConfirmation";

export default function OrderTrackingPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [items, setItems] = useState<OrderItemRecord[]>([]);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

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
  const deliveryConfirmationCode = useMemo(
    () => formatDeliveryConfirmationCode(deriveDeliveryConfirmationCode(order?.id)),
    [order?.id]
  );
  const deliveryConfirmationReady = useMemo(() => {
    return !!deliveryConfirmationCode && ["on_the_way", "arrived", "delivered"].includes(orderStatus);
  }, [deliveryConfirmationCode, orderStatus]);

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

  const paymentBanner = useMemo<PaymentBanner | null>(() => {
    return getPaymentBanner({
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
    });
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
    return getTrackingMilestones(order);
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

        const {
          order: nextOrder,
          items: normalizedItems,
          driver: nextDriver,
          snapshot: nextSnapshot,
        } = await fetchOrderTrackingSnapshot(orderId);
        setOrder(nextOrder);
        setItems(normalizedItems);
        setDriver(nextDriver);

        if (background) {
          const previousSnapshot = lastOrderSnapshotRef.current;

          if (previousSnapshot) {
            if (previousSnapshot.status !== nextSnapshot.status && nextOrder.status === "arrived") {
              toast.success("Your driver has arrived", {
                description: "Please be ready to receive your order.",
                duration: 2400,
              });
            } else if (previousSnapshot.status !== nextSnapshot.status && nextOrder.status === "delivered") {
              toast.success("Order delivered", {
                description: "Your order was marked as delivered successfully.",
                duration: 2400,
              });
            } else if (!previousSnapshot.driverId && nextSnapshot.driverId) {
              toast.success("Driver assigned", {
                description: "Your order now has a driver and delivery progress will update here.",
                duration: 2400,
              });
            }
          }
        }

        lastOrderSnapshotRef.current = nextSnapshot;
        setLastSyncAt(new Date().toISOString());
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to load order");
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
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to restart payment");
    } finally {
      setRetryingPayment(false);
    }
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

  const driverRatingLabel = driver?.review_count && driver.review_count > 0
    ? `${Number(driver.rating ?? 0).toFixed(1)} (${driver.review_count})`
    : "No reviews yet";

  const driverCardDescription = hasAssignedDriver
    ? order.accepted_at
      ? `Accepted ${formatTime(order.accepted_at)}`
      : "Assigned to your order"
    : "Not assigned yet";

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl py-8 md:py-10">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Live delivery progress
            </div>

            <h1 className="font-display text-4xl text-foreground sm:text-5xl">Track Your Order</h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">Order ID: {order.id}</p>
          </div>

          <button
            onClick={() => void fetchOrder({ background: true })}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>

        <div className="mb-6 overflow-hidden rounded-[30px] border border-border bg-card shadow-card">
          <div className="border-b border-border bg-muted/30 p-5 md:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <OrderStatusBadge status={orderStatus} />
                  <div className="inline-flex rounded-full border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground">
                    Placed {formatDateTime(order.created_at)}
                  </div>
                </div>

                <div className="rounded-[24px] border border-border bg-background p-5 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    What’s happening now
                  </p>
                  <p className="mt-2 text-base font-semibold leading-7 text-foreground sm:text-lg">
                    {statusSummary}
                  </p>
                </div>

                {isDelivered && user && (
                  <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                          Ratings & reviews
                        </p>
                        <p className="mt-2 text-sm leading-6 text-foreground">
                          Rate the food and your delivery person to help improve service quality and build trust for future customers.
                        </p>
                      </div>

                      <button
                        onClick={() => setReviewDialogOpen(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-background px-4 py-3 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100/60"
                      >
                        <Star className="h-4 w-4" />
                        Rate this order
                      </button>
                    </div>
                  </div>
                )}

                {deliveryConfirmationCode && !isOrderCancelled && (
                  <div className="mt-4 rounded-[24px] border border-primary/20 bg-primary/5 p-5 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                          Delivery confirmation PIN
                        </p>
                        <p className="mt-2 text-sm leading-6 text-foreground">
                          {isDelivered
                            ? "This PIN was used to confirm handoff."
                            : deliveryConfirmationReady
                              ? "Share this PIN with your driver when they hand over the order."
                              : "Your PIN is already prepared and will be needed once the driver is close."}
                        </p>
                      </div>

                      <div className="rounded-[20px] border border-primary/20 bg-background px-5 py-4 text-center">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          PIN
                        </p>
                        <p className="mt-2 font-mono text-3xl font-semibold tracking-[0.35em] text-primary sm:text-4xl">
                          {deliveryConfirmationCode}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[420px]">
                <InfoTile
                  label="Estimated arrival"
                  value={
                    isDelivered
                      ? "Delivered"
                      : isArrived
                        ? "At your location"
                        : formatTime(order.estimated_delivery_time)
                  }
                  subValue={
                    isOnTheWay || isArrived
                      ? order.driver_distance_km != null
                        ? `${order.driver_distance_km.toFixed(1)} km away`
                        : "Delivery in progress"
                      : formatRelativeTime(order.created_at)
                  }
                  icon={MapPinned}
                />

                <InfoTile
                  label="Driver"
                  value={hasAssignedDriver ? driver?.name || "Assigned" : "Waiting for assignment"}
                  subValue={driverCardDescription}
                  icon={UserRound}
                />

                <InfoTile
                  label="Order total"
                  value={formatCurrency(order.total)}
                  subValue={`${totalItems} item${totalItems === 1 ? "" : "s"} in this order`}
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
                    subValue={hasAssignedDriver ? `${driverCardDescription} · ${driverRatingLabel}` : driverCardDescription}
                    icon={UserRound}
                  />

                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Delivery address
                    </p>
                    <div className="mt-2 flex items-start gap-2">
                      <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <p className="whitespace-pre-line text-base font-semibold text-foreground">
                        {order.delivery_address || "No address provided"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Driver rating
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-base font-semibold text-foreground">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span>{driverRatingLabel}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ratings from completed deliveries.
                    </p>
                  </div>

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

                  <OrderTotalsCard
                    subtotal={order.subtotal}
                    deliveryFee={order.delivery_fee}
                    discountAmount={order.discount_amount}
                    total={order.total}
                  />
                </div>
              </section>

              <section className="overflow-hidden rounded-[28px] border border-border bg-card shadow-card">
                <div className="border-b border-border bg-muted/30 px-5 py-5">
                  <h2 className="text-xl font-semibold text-foreground">Order details</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Secondary information like payment records, delivery notes, and timeline history.
                  </p>
                </div>

                <div className="px-5">
                  <Accordion type="multiple" className="w-full">
                    <AccordionItem value="customer">
                      <AccordionTrigger className="text-left text-foreground">
                        Customer & delivery details
                      </AccordionTrigger>
                      <AccordionContent>
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
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="payment">
                      <AccordionTrigger className="text-left text-foreground">
                        Payment details
                      </AccordionTrigger>
                      <AccordionContent>
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
                      </AccordionContent>
                    </AccordionItem>

                    {milestones.length > 0 && (
                      <AccordionItem value="history">
                        <AccordionTrigger className="text-left text-foreground">
                          Delivery history
                        </AccordionTrigger>
                        <AccordionContent>
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
                        </AccordionContent>
                      </AccordionItem>
                    )}
                  </Accordion>
                </div>
              </section>

              <section className="rounded-[28px] border border-border bg-gradient-to-br from-card to-muted/25 p-5 shadow-card">
                <h2 className="text-xl font-semibold text-foreground">Need help?</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  This page refreshes automatically while your order is active. Last live sync:{" "}
                  {lastSyncAt ? formatRelativeTime(lastSyncAt) : "Just now"}. If you need more
                  detail, open the order details section above. Contact your driver once assigned.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>

      <OrderReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        order={order}
        items={items}
        driver={driver}
        userId={user?.id ?? null}
        onSubmitted={() => fetchOrder({ background: true })}
      />

      <Footer />
    </div>
  );
}
