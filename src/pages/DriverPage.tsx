import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, MapPin, Play, Square, Phone, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import Footer from "@/components/Footer";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
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
  delivery_address: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  estimated_delivery_time: string | null;
  driver_distance_km: number | null;
  driver_lat: number | null;
  driver_lng: number | null;
  driver_last_updated: string | null;
}

export default function DriverPage() {
  const { user, loading } = useAuth();
  const [driver, setDriver] = useState<DriverRecord | null>(null);
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  const activeOrders = useMemo(
    () =>
      orders.filter(
        (o) => o.status !== "delivered" && o.status !== "cancelled"
      ),
    [orders]
  );

  const loadDriverAndOrders = async () => {
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
        delivery_address,
        status,
        total,
        created_at,
        estimated_delivery_time,
        driver_distance_km,
        driver_lat,
        driver_lng,
        driver_last_updated
      `)
      .eq("driver_id", driverData.id)
      .order("created_at", { ascending: false });

    if (ordersError) {
      toast.error(ordersError.message || "Failed to load assigned orders");
    } else {
      setOrders((orderData || []) as DriverOrder[]);
    }

    setPageLoading(false);
  };

  const geocodeAddress = async (address: string) => {
    const key = import.meta.env.VITE_MAPTILER_KEY;
    const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(address)}.json?limit=1&country=za&key=${key}`;

    const res = await fetch(url);
    const json = await res.json();
    const first = json?.features?.[0];

    if (!first?.center) return null;

    return {
      lng: first.center[0],
      lat: first.center[1],
    };
  };

  const fetchRouteMeta = async (
    driverLat: number,
    driverLng: number,
    destLat: number,
    destLng: number
  ) => {
    const url = `https://router.project-osrm.org/route/v1/driving/${driverLng},${driverLat};${destLng},${destLat}?overview=false`;

    const res = await fetch(url);
    const json = await res.json();
    const route = json?.routes?.[0];

    if (!route) return null;

    return {
      durationMinutes: Math.round((route.duration || 0) / 60),
      distanceKm: Number(((route.distance || 0) / 1000).toFixed(1)),
    };
  };

  const pushLiveLocationUpdate = async (orderId: string, lat: number, lng: number) => {
    const order = orders.find((o) => o.id === orderId);
    const timestamp = new Date().toISOString();

    let driver_distance_km: number | null = null;
    let estimated_delivery_time: string | null = null;

    if (order?.delivery_address) {
      const dest = await geocodeAddress(order.delivery_address);
      if (dest) {
        const route = await fetchRouteMeta(lat, lng, dest.lat, dest.lng);
        if (route) {
          driver_distance_km = route.distanceKm;
          estimated_delivery_time = new Date(
            Date.now() + route.durationMinutes * 60000
          ).toISOString();
        }
      }
    }

    const { error } = await supabase
      .from("orders")
      .update({
        status: "out_for_delivery",
        driver_lat: lat,
        driver_lng: lng,
        driver_last_updated: timestamp,
        driver_distance_km,
        estimated_delivery_time,
      })
      .eq("id", orderId);

    if (!error) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: "out_for_delivery",
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
        await pushLiveLocationUpdate(
          orderId,
          position.coords.latitude,
          position.coords.longitude
        );
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

  const markDelivered = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "delivered" })
      .eq("id", orderId);

    if (error) {
      toast.error(error.message || "Failed to mark delivered");
      return;
    }

    if (trackingOrderId === orderId) {
      stopLiveTracking();
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "delivered" } : o))
    );

    toast.success("Order marked as delivered");
  };

  useEffect(() => {
    if (!loading && user) {
      loadDriverAndOrders();
    }
  }, [loading, user]);

  useEffect(() => {
    if (!driver) return;

    const channel = supabase
      .channel("driver-orders-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => loadDriverAndOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driver]);

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
          <h1 className="font-display text-4xl text-foreground mb-4">DRIVER PAGE</h1>
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
          <h1 className="font-display text-5xl text-foreground mb-2">DRIVER DASHBOARD</h1>
          <p className="text-muted-foreground">
            Welcome, {driver.name}. Manage only your assigned deliveries.
          </p>
        </div>

        <div className="space-y-4">
          {activeOrders.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground">
              No active deliveries assigned to you.
            </div>
          ) : (
            activeOrders.map((order) => (
              <div key={order.id} className="bg-card border border-border rounded-lg p-5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                  <div>
                    <h2 className="font-display text-2xl text-foreground">
                      Order #{order.id.slice(0, 8).toUpperCase()}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>

                  <span className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-sm font-medium capitalize">
                    {order.status.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-muted-foreground mb-1">Customer</p>
                    <p className="font-medium text-foreground">{order.customer_name}</p>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {order.customer_phone}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground mb-1">Address</p>
                    <p className="font-medium text-foreground flex items-start gap-1">
                      <MapPin className="w-4 h-4 mt-0.5" />
                      {order.delivery_address}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground mb-1">Live Delivery Info</p>
                    <p className="text-foreground">
                      ETA: {order.estimated_delivery_time
                        ? new Date(order.estimated_delivery_time).toLocaleTimeString("en-ZA", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </p>
                    <p className="text-foreground">
                      Distance: {order.driver_distance_km != null ? `${order.driver_distance_km} km` : "—"}
                    </p>
                    <p className="text-foreground">Total: R{order.total}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {trackingOrderId === order.id ? (
                    <button
                      type="button"
                      onClick={stopLiveTracking}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      <Square className="w-4 h-4" />
                      Stop Tracking
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startLiveTracking(order.id)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      <Play className="w-4 h-4" />
                      Start Tracking
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => markDelivered(order.id)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <Clock className="w-4 h-4" />
                    Mark Delivered
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}