import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Loader2,
  MapPin,
  Play,
  Square,
  Phone,
  CheckCircle2,
  Truck,
  PackageCheck,
  UserRound,
  HandCoins,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/components/ui/sonner";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import Footer from "@/components/Footer";
import DeliveryProgressTracker, {
  type DeliveryStatus,
} from "@/components/DeliveryProgressTracker";
import {
  geocodeSouthAfricaAddress,
  getSouthAfricaDrivingRouteMeta,
} from "@/lib/maps";
import {
  DELIVERY_CONFIRMATION_CODE_LENGTH,
  isDeliveryConfirmationCodeComplete,
  normalizeDeliveryConfirmationCode,
} from "@/lib/deliveryConfirmation";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready_for_delivery"
  | "on_the_way"
  | "arrived"
  | "delivered"
  | "cancelled";

interface DriverRecord {
  id: string;
  name: string;
  phone: string | null;
  auth_user_id: string | null;
}

interface DriverOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_address: string;
  payment_method: string | null;
  payment_status: string | null;
  total: number;
  status: OrderStatus;
  created_at: string;
  driver_id: string | null;
  estimated_delivery_time: string | null;
  driver_distance_km: number | null;
  driver_lat: number | null;
  driver_lng: number | null;
  driver_last_updated: string | null;
  accepted_at: string | null;
  started_delivery_at: string | null;
  arrived_at: string | null;
  delivered_at: string | null;
  cash_collected: boolean | null;
  cash_collected_amount: number | null;
  cash_collected_at: string | null;
  delivery_confirmation_code: string | null;
  delivery_confirmation_verified_at: string | null;
}

function normalizeValue(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function isCashPaymentMethod(value?: string | null) {
  return normalizeValue(value) === "cash";
}

function isCardPaymentMethod(value?: string | null) {
  return normalizeValue(value) === "card";
}

function formatCurrency(value: number | null | undefined) {
  return `R${Number(value || 0).toFixed(2)}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status: OrderStatus) {
  const map: Record<OrderStatus, string> = {
    pending: "bg-amber-100 text-amber-700",
    confirmed: "bg-blue-100 text-blue-700",
    preparing: "bg-purple-100 text-purple-700",
    ready_for_delivery: "bg-orange-100 text-orange-700",
    on_the_way: "bg-indigo-100 text-indigo-700",
    arrived: "bg-cyan-100 text-cyan-700",
    delivered: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize ${map[status]}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function getFlowLabel(order: DriverOrder) {
  if (order.status === "ready_for_delivery") return "Accepted · waiting to start";
  if (order.status === "on_the_way") return "Trip in progress";
  if (order.status === "arrived") {
    if (isCashPaymentMethod(order.payment_method) && !order.cash_collected) {
      return "Arrived · collect cash";
    }
    return "Arrived · ready to complete";
  }
  return "Waiting";
}

function getTrackerStatus(order: DriverOrder): DeliveryStatus {
  if (order.status === "ready_for_delivery") return "ready_for_delivery";
  if (order.status === "on_the_way") return "on_the_way";
  if (order.status === "arrived") return "arrived";
  if (order.status === "delivered") return "delivered";
  if (order.status === "cancelled") return "cancelled";
  if (order.status === "preparing") return "preparing";
  if (order.status === "confirmed") return "confirmed";
  return "pending";
}

export default function DriverPage() {
  const { user, loading } = useAuth();
  const [driver, setDriver] = useState<DriverRecord | null>(null);
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [actionOrderId, setActionOrderId] = useState<string | null>(null);
  const [newOrderIds, setNewOrderIds] = useState<string[]>([]);
  const [deliveryCodes, setDeliveryCodes] = useState<Record<string, string>>({});
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const audioUnlockedRef = useRef(false);

  const playNotificationSound = () => {
    try {
      const AudioCtx =
        window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(988, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.3);

      oscillator.onended = () => {
        ctx.close().catch(() => undefined);
      };
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    const unlockAudio = () => {
      audioUnlockedRef.current = true;
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };

    window.addEventListener("click", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);

    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  const availableOrders = useMemo(() => {
    return orders.filter((o) => o.status === "ready_for_delivery" && !o.driver_id);
  }, [orders]);

  const myOrders = useMemo(() => {
    if (!driver) return [];
    return orders.filter(
      (o) =>
        o.driver_id === driver.id &&
        ["ready_for_delivery", "on_the_way", "arrived"].includes(o.status)
    );
  }, [orders, driver]);

  const activeJob = useMemo(() => {
    if (myOrders.length === 0) return null;
    const priority = ["on_the_way", "arrived", "ready_for_delivery"];
    return [...myOrders].sort(
      (a, b) => priority.indexOf(a.status) - priority.indexOf(b.status)
    )[0];
  }, [myOrders]);
  const confirmingOrder = useMemo(() => {
    if (!confirmingOrderId) return null;
    return orders.find((order) => order.id === confirmingOrderId) || null;
  }, [confirmingOrderId, orders]);

  const loadDriverAndOrders = useCallback(async () => {
    if (!user) return;

    setPageLoading(true);

    const { data: driverData, error: driverError } = await supabase
      .from("drivers")
      .select("id, name, phone, auth_user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (driverError) {
      toast.error(driverError.message || "Failed to load driver profile");
      setPageLoading(false);
      return;
    }

    if (!driverData) {
      setDriver(null);
      setPageLoading(false);
      return;
    }

    setDriver(driverData as DriverRecord);

    const { data: orderData, error: ordersError } = await supabase
      .from("orders")
      .select(`
        id,
        customer_name,
        customer_phone,
        customer_email,
        delivery_address,
        payment_method,
        payment_status,
        total,
        status,
        created_at,
        driver_id,
        estimated_delivery_time,
        driver_distance_km,
        driver_lat,
        driver_lng,
        driver_last_updated,
        accepted_at,
        started_delivery_at,
        arrived_at,
        delivered_at,
        cash_collected,
        cash_collected_amount,
        cash_collected_at,
        delivery_confirmation_code,
        delivery_confirmation_verified_at
      `)
      .in("status", ["ready_for_delivery", "on_the_way", "arrived"])
      .order("created_at", { ascending: false });

    if (ordersError) {
      toast.error(ordersError.message || "Failed to load delivery orders");
    } else {
      setOrders((orderData || []) as DriverOrder[]);
    }

    setPageLoading(false);
  }, [user]);

  const pushLiveLocationUpdate = async (orderId: string, lat: number, lng: number) => {
    const order = orders.find((o) => o.id === orderId);
    const timestamp = new Date().toISOString();

    let driver_distance_km: number | null = null;
    let estimated_delivery_time: string | null = null;

    if (order?.delivery_address) {
      const dest = await geocodeSouthAfricaAddress(order.delivery_address);
      if (dest) {
        const route = await getSouthAfricaDrivingRouteMeta(lat, lng, dest.lat, dest.lng);
        if (route) {
          driver_distance_km = route.distanceKm;
          estimated_delivery_time = new Date(Date.now() + route.durationMinutes * 60000).toISOString();
        }
      }
    }

    const { error } = await supabase
      .from("orders")
      .update({
        driver_lat: lat,
        driver_lng: lng,
        driver_last_updated: timestamp,
        driver_distance_km,
        estimated_delivery_time,
        updated_at: timestamp,
      })
      .eq("id", orderId)
      .eq("driver_id", driver?.id || "");

    if (!error) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                driver_lat: lat,
                driver_lng: lng,
                driver_last_updated: timestamp,
                driver_distance_km,
                estimated_delivery_time,
              }
            : o
        )
      );
    }
  };

  const startLiveTracking = (orderId: string) => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported on this device");
      return;
    }

    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }

    setTrackingOrderId(orderId);

    const id = navigator.geolocation.watchPosition(
      async (position) => {
        await pushLiveLocationUpdate(orderId, position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error("Location permission was denied");
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error("Location unavailable");
            break;
          case error.TIMEOUT:
            toast.error("Location request timed out");
            break;
          default:
            toast.error("Failed to start tracking");
        }
        setTrackingOrderId(null);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      }
    );

    setWatchId(id);
    toast.success("Live tracking started");
  };

  const stopLiveTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setTrackingOrderId(null);
    toast.success("Live tracking stopped");
  };

  const acceptOrder = async (orderId: string) => {
    if (!driver) return;

    setActionOrderId(orderId);

    const { data, error } = await supabase.rpc("accept_delivery_order", {
      p_order_id: orderId,
      p_driver_id: driver.id,
    });

    if (error) {
      toast.error(error.message || "Failed to accept order");
      setActionOrderId(null);
      return;
    }

    if (!data) {
      toast.error("This order was already accepted by another driver.");
      setActionOrderId(null);
      await loadDriverAndOrders();
      return;
    }

    setNewOrderIds((prev) => prev.filter((id) => id !== orderId));
    toast.success("Order accepted");
    setActionOrderId(null);
    await loadDriverAndOrders();
  };

  const startDelivery = async (orderId: string) => {
    if (!driver) return;

    setActionOrderId(orderId);

    const { data, error } = await supabase.rpc("start_delivery_order", {
      p_order_id: orderId,
      p_driver_id: driver.id,
    });

    if (error) {
      toast.error(error.message || "Failed to start delivery");
      setActionOrderId(null);
      return;
    }

    if (!data) {
      toast.error("This delivery could not be started.");
      setActionOrderId(null);
      await loadDriverAndOrders();
      return;
    }

    toast.success("Delivery started");
    setActionOrderId(null);
    await loadDriverAndOrders();
    startLiveTracking(orderId);
  };

  const markArrived = async (orderId: string) => {
    if (!driver) return;

    setActionOrderId(orderId);

    const { data, error } = await supabase.rpc("arrive_delivery_order", {
      p_order_id: orderId,
      p_driver_id: driver.id,
    });

    if (error) {
      toast.error(error.message || "Failed to mark arrived");
      setActionOrderId(null);
      return;
    }

    if (!data) {
      toast.error("This delivery could not be marked as arrived.");
      setActionOrderId(null);
      await loadDriverAndOrders();
      return;
    }

    if (trackingOrderId === orderId) {
      stopLiveTracking();
    }

    toast.success("Marked as arrived");
    setActionOrderId(null);
    await loadDriverAndOrders();
  };

  const collectCash = async (orderId: string) => {
    if (!driver) return;

    setActionOrderId(orderId);

    const { data, error } = await supabase.rpc("collect_cash_for_order", {
      p_order_id: orderId,
      p_driver_id: driver.id,
    });

    if (error) {
      toast.error(error.message || "Failed to collect cash");
      setActionOrderId(null);
      return;
    }

    if (!data) {
      toast.error("Cash could not be collected for this order.");
      setActionOrderId(null);
      await loadDriverAndOrders();
      return;
    }

    toast.success("Cash marked as collected");
    setDeliveryCodes((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    setActionOrderId(null);
    await loadDriverAndOrders();
  };

  const sendCustomerReceipt = async (orderId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("send-order-receipt", {
        body: { orderId },
      });

      if (error) throw error;

      if (data?.skipped && data?.reason === "missing_customer_email") {
        toast.message("Order completed", {
          description: "No receipt email was sent because the customer did not provide an email address.",
        });
        return;
      }

      if (!data?.success && !data?.skipped) {
        throw new Error("Receipt email could not be sent.");
      }

      toast.success("Receipt emailed", {
        description: "A thank-you receipt was sent to the customer email.",
      });
    } catch (error) {
      toast.error("Order completed, but the receipt email failed.", {
        description: error instanceof Error ? error.message : "Unexpected receipt email error.",
      });
    }
  };

  const completeDelivery = async (orderId: string) => {
    if (!driver) return;
    const confirmationCode = normalizeDeliveryConfirmationCode(deliveryCodes[orderId]);
    const expectedCode = normalizeDeliveryConfirmationCode(
      orders.find((order) => order.id === orderId)?.delivery_confirmation_code
    );

    if (!isDeliveryConfirmationCodeComplete(confirmationCode)) {
      toast.error("Enter the 4-digit delivery PIN from the customer.");
      return;
    }

    if (confirmationCode !== expectedCode) {
      toast.error("That PIN does not match this order.");
      return;
    }

    setActionOrderId(orderId);

    const { data: latestOrder, error: latestOrderError } = await supabase
      .from("orders")
      .select("status, payment_method, cash_collected")
      .eq("id", orderId)
      .maybeSingle();

    if (!latestOrderError && latestOrder) {
      const latestPaymentMethod = normalizeValue(latestOrder.payment_method);
      const latestCashCollected = !!latestOrder.cash_collected;

      if (normalizeValue(latestOrder.status) !== "arrived") {
        toast.error("This delivery is no longer in the arrival step.");
        setActionOrderId(null);
        await loadDriverAndOrders();
        return;
      }

      if (latestPaymentMethod === "cash" && !latestCashCollected) {
        toast.error("Collect cash before completing this delivery.");
        setActionOrderId(null);
        await loadDriverAndOrders();
        return;
      }
    }

    const { data, error } = await supabase.functions.invoke("complete-driver-delivery", {
      body: { orderId },
    });

    if (error) {
      toast.error(error.message || "Failed to complete delivery");
      setActionOrderId(null);
      return;
    }

    if (!data?.success) {
      toast.error(data?.error || "This delivery cannot be completed yet.");
      setActionOrderId(null);
      await loadDriverAndOrders();
      return;
    }

    if (trackingOrderId === orderId) {
      stopLiveTracking();
    }

    toast.success("Delivery completed");
    setDeliveryCodes((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    setConfirmingOrderId(null);
    setActionOrderId(null);
    await loadDriverAndOrders();
    await sendCustomerReceipt(orderId);
  };

  useEffect(() => {
    if (!loading && user) {
      void loadDriverAndOrders();
    }
  }, [loading, user, loadDriverAndOrders]);

  useEffect(() => {
    if (!driver) return;

    const channel = supabase
      .channel("driver-orders-live-ux-sound")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        async (payload) => {
          const next = payload.new as Partial<DriverOrder> | null;
          const previous = payload.old as Partial<DriverOrder> | null;

          if (
            next?.status === "ready_for_delivery" &&
            previous?.status !== "ready_for_delivery" &&
            !next?.driver_id
          ) {
            if (next.id) {
              setNewOrderIds((prev) => Array.from(new Set([next.id!, ...prev])));
              setTimeout(() => {
                setNewOrderIds((prev) => prev.filter((id) => id !== next.id));
              }, 12000);
            }

            if (audioUnlockedRef.current) {
              playNotificationSound();
            }

            toast.success("New delivery available");
          }

          await loadDriverAndOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driver, loadDriverAndOrders]);

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading driver page...
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (!driver) {
    return (
      <div>
        <div className="container py-16 text-center">
          <h1 className="mb-4 font-display text-4xl text-foreground">DRIVER PAGE</h1>
          <p className="text-muted-foreground">
            Your account is not linked to a driver profile yet.
          </p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="mb-2 font-display text-5xl text-foreground">DRIVER DASHBOARD</h1>
          <p className="text-muted-foreground">
            Welcome, {driver.name}. Accept new deliveries and manage your active trips.
          </p>
        </div>

        {activeJob && (
          <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  Active Job Summary
                </p>
                <h2 className="text-2xl font-semibold text-foreground">
                  Order #{activeJob.id.slice(0, 8).toUpperCase()}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {getFlowLabel(activeJob)} · {activeJob.customer_name} · {formatCurrency(activeJob.total)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {getStatusBadge(activeJob.status)}
                {isCashPaymentMethod(activeJob.payment_method) ? (
                  <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                    Cash Order
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                    Card Paid
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="mb-1 text-xs text-muted-foreground">Customer</p>
                <p className="font-medium text-foreground">{activeJob.customer_name}</p>
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <p className="mb-1 text-xs text-muted-foreground">Phone</p>
                <p className="font-medium text-foreground">{activeJob.customer_phone}</p>
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <p className="mb-1 text-xs text-muted-foreground">Distance</p>
                <p className="font-medium text-foreground">
                  {activeJob.driver_distance_km != null ? `${activeJob.driver_distance_km} km` : "—"}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <p className="mb-1 text-xs text-muted-foreground">ETA</p>
                <p className="font-medium text-foreground">{formatTime(activeJob.estimated_delivery_time)}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl text-foreground">AVAILABLE ORDERS</h2>
                <p className="text-sm text-muted-foreground">
                  Orders ready for pickup that no driver has accepted yet.
                </p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {availableOrders.length} available
              </span>
            </div>

            <div className="space-y-4">
              {availableOrders.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-background p-6 text-center">
                  <p className="text-sm font-medium text-foreground">No available orders right now</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Stay on this page. New delivery requests will appear here automatically.
                  </p>
                </div>
              ) : (
                availableOrders.map((order) => {
                  const isNew = newOrderIds.includes(order.id);

                  return (
                    <div
                      key={order.id}
                      className={`rounded-lg border bg-background p-4 transition-all ${
                        isNew
                          ? "border-primary shadow-[0_0_0_3px_rgba(0,0,0,0.04)]"
                          : "border-border"
                      }`}
                    >
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-xl text-foreground">
                              Order #{order.id.slice(0, 8).toUpperCase()}
                            </h3>
                            {isNew && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                                <Sparkles className="h-3.5 w-3.5" />
                                New
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDateTime(order.created_at)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {getStatusBadge(order.status)}
                          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 capitalize">
                            {order.payment_method || "unknown"}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                        <div>
                          <p className="mb-1 text-muted-foreground">Customer</p>
                          <p className="font-medium text-foreground">{order.customer_name}</p>
                          <p className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            {order.customer_phone}
                          </p>
                        </div>

                        <div>
                          <p className="mb-1 text-muted-foreground">Address</p>
                          <p className="flex items-start gap-1 font-medium text-foreground">
                            <MapPin className="mt-0.5 h-4 w-4" />
                            {order.delivery_address}
                          </p>
                        </div>

                        <div>
                          <p className="mb-1 text-muted-foreground">Order</p>
                          <p className="text-foreground">Total: {formatCurrency(order.total)}</p>
                          <p className="text-foreground">
                            Payment: {isCashPaymentMethod(order.payment_method) ? "Cash on delivery" : "Card"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => acceptOrder(order.id)}
                          disabled={actionOrderId === order.id}
                          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          {actionOrderId === order.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <PackageCheck className="h-4 w-4" />
                          )}
                          Accept Order
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl text-foreground">MY ACTIVE DELIVERIES</h2>
                <p className="text-sm text-muted-foreground">
                  Orders you accepted and are currently handling.
                </p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {myOrders.length} active
              </span>
            </div>

            <div className="space-y-4">
              {myOrders.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-background p-6 text-center">
                  <p className="text-sm font-medium text-foreground">You have no active deliveries</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Accept a ready order from the left side to start working on a delivery.
                  </p>
                </div>
              ) : (
                myOrders.map((order) => {
                  const canStart = order.status === "ready_for_delivery";
                  const canArrive = order.status === "on_the_way";
                  const canCollectCash =
                    order.status === "arrived" &&
                    isCashPaymentMethod(order.payment_method) &&
                    !order.cash_collected;
                  const canComplete =
                    order.status === "arrived" &&
                    (isCardPaymentMethod(order.payment_method) || order.cash_collected);
                  const deliveryCodeValue = deliveryCodes[order.id] || "";

                  return (
                    <div key={order.id} className="rounded-lg border border-border bg-background p-4">
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-display text-xl text-foreground">
                            Order #{order.id.slice(0, 8).toUpperCase()}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Accepted: {formatDateTime(order.accepted_at)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {getStatusBadge(order.status)}
                          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 capitalize">
                            {order.payment_method || "unknown"}
                          </span>
                        </div>
                      </div>

                      <div className="mb-4 rounded-xl border border-border bg-card p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">Delivery Flow</p>
                          <span className="text-xs font-medium text-primary">
                            {getFlowLabel(order)}
                          </span>
                        </div>

                        <DeliveryProgressTracker
                          status={getTrackerStatus(order)}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                        <div>
                          <p className="mb-1 text-muted-foreground">Customer</p>
                          <p className="font-medium text-foreground">{order.customer_name}</p>
                          <p className="flex items-center gap-1 text-muted-foreground">
                            <UserRound className="h-4 w-4" />
                            {order.customer_phone}
                          </p>
                          {order.customer_email && (
                            <p className="text-muted-foreground">{order.customer_email}</p>
                          )}
                        </div>

                        <div>
                          <p className="mb-1 text-muted-foreground">Address</p>
                          <p className="flex items-start gap-1 font-medium text-foreground">
                            <MapPin className="mt-0.5 h-4 w-4" />
                            {order.delivery_address}
                          </p>
                        </div>

                        <div>
                          <p className="mb-1 text-muted-foreground">Live Delivery Info</p>
                          <p className="text-foreground">
                            ETA: {formatTime(order.estimated_delivery_time)}
                          </p>
                          <p className="text-foreground">
                            Distance: {order.driver_distance_km != null ? `${order.driver_distance_km} km` : "—"}
                          </p>
                          <p className="text-foreground">Total: {formatCurrency(order.total)}</p>
                          <p className="text-xs text-muted-foreground">
                            Last updated: {formatDateTime(order.driver_last_updated)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg border border-border bg-card p-4">
                        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                          <p className="text-foreground">
                            Started trip: {formatDateTime(order.started_delivery_at)}
                          </p>
                          <p className="text-foreground">
                            Arrived: {formatDateTime(order.arrived_at)}
                          </p>
                          <p className="text-foreground">
                            Cash collected: {order.cash_collected ? "Yes" : "No"}
                          </p>
                          <p className="text-foreground">
                            Cash time: {formatDateTime(order.cash_collected_at)}
                          </p>
                        </div>

                        {order.status === "ready_for_delivery" && (
                          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                            Start delivery when you are ready to leave with the order.
                          </div>
                        )}

                        {order.status === "on_the_way" && (
                          <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                            Keep live tracking active while travelling to the customer.
                          </div>
                        )}

                        {order.status === "arrived" && isCashPaymentMethod(order.payment_method) && !order.cash_collected && (
                          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            This is a cash order. Collect payment first, then enter the delivery PIN on the final completion step.
                          </div>
                        )}

                        {isCardPaymentMethod(order.payment_method) && (
                          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                            Card payment already handled online. No cash collection needed.
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        {canStart && (
                          <button
                            type="button"
                            onClick={() => startDelivery(order.id)}
                            disabled={actionOrderId === order.id}
                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            {actionOrderId === order.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                            Start Delivery
                          </button>
                        )}

                        {order.status === "on_the_way" &&
                          (trackingOrderId === order.id ? (
                            <button
                              type="button"
                              onClick={stopLiveTracking}
                              className="inline-flex items-center gap-2 rounded-lg bg-destructive px-5 py-2.5 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90"
                            >
                              <Square className="h-4 w-4" />
                              Stop Tracking
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startLiveTracking(order.id)}
                              className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                            >
                              <Truck className="h-4 w-4" />
                              Resume Tracking
                            </button>
                          ))}

                        {canArrive && (
                          <button
                            type="button"
                            onClick={() => markArrived(order.id)}
                            disabled={actionOrderId === order.id}
                            className="inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-2.5 text-sm font-medium text-secondary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            {actionOrderId === order.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MapPin className="h-4 w-4" />
                            )}
                            Mark Arrived
                          </button>
                        )}

                        {canCollectCash && (
                          <button
                            type="button"
                            onClick={() => collectCash(order.id)}
                            disabled={actionOrderId === order.id}
                            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            {actionOrderId === order.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <HandCoins className="h-4 w-4" />
                            )}
                            Collect Cash
                          </button>
                        )}

                        {canComplete && (
                          <button
                            type="button"
                            onClick={() => setConfirmingOrderId(order.id)}
                            disabled={actionOrderId === order.id}
                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            {actionOrderId === order.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            Complete Delivery
                          </button>
                        )}
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      {confirmingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-card">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Confirm delivery handoff
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                Order #{confirmingOrder.id.slice(0, 8).toUpperCase()}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Ask the customer for their 4-digit PIN, then confirm the delivery only when the handoff is complete.
              </p>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Delivery confirmation
              </p>
              <p className="mt-2 text-sm text-foreground">
                Enter the customer PIN only when you are ready to complete this delivery.
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-background p-4">
              <InputOTP
                maxLength={DELIVERY_CONFIRMATION_CODE_LENGTH}
                value={deliveryCodes[confirmingOrder.id] || ""}
                onChange={(value) =>
                  setDeliveryCodes((prev) => ({
                    ...prev,
                    [confirmingOrder.id]: normalizeDeliveryConfirmationCode(value),
                  }))
                }
                containerClassName="justify-center"
              >
                <InputOTPGroup>
                  {Array.from({ length: DELIVERY_CONFIRMATION_CODE_LENGTH }, (_, index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmingOrderId(null)}
                className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => completeDelivery(confirmingOrder.id)}
                disabled={
                  actionOrderId === confirmingOrder.id ||
                  !isDeliveryConfirmationCodeComplete(deliveryCodes[confirmingOrder.id] || "")
                }
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {actionOrderId === confirmingOrder.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Confirm Delivery
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
