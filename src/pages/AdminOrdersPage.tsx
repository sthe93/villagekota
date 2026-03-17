import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, RefreshCw, Save, Crosshair, Play, Square } from "lucide-react";
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

interface Driver {
  id: string;
  name: string;
  phone: string | null;
}

interface AdminOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_address: string;
  payment_method: string;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number | null;
  total: number;
  status: OrderStatus;
  created_at: string;
  notes: string | null;
  voucher_code: string | null;
  driver_id: string | null;
  estimated_delivery_time: string | null;
  driver_distance_km: number | null;
  driver_lat: number | null;
  driver_lng: number | null;
  driver_last_updated: string | null;
}

const statusOptions: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const statusLabel: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function AdminOrdersPage() {
  const { user, isAdmin, loading } = useAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [locationInputs, setLocationInputs] = useState<Record<string, { lat: string; lng: string }>>({});
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
const [watchId, setWatchId] = useState<number | null>(null);

  const loadOrders = async () => {
    setPageLoading(true);

    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        customer_name,
        customer_phone,
        customer_email,
        delivery_address,
        payment_method,
        subtotal,
        delivery_fee,
        discount_amount,
        total,
        status,
        created_at,
        notes,
        voucher_code,
        driver_id,
        estimated_delivery_time,
        driver_distance_km,
        driver_lat,
        driver_lng,
        driver_last_updated
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message || "Failed to load orders");
    } else {
      const nextOrders = (data || []) as AdminOrder[];
      setOrders(nextOrders);

      const nextInputs: Record<string, { lat: string; lng: string }> = {};
      nextOrders.forEach((order) => {
        nextInputs[order.id] = {
          lat: order.driver_lat != null ? String(order.driver_lat) : "",
          lng: order.driver_lng != null ? String(order.driver_lng) : "",
        };
      });
      setLocationInputs(nextInputs);
    }

    setPageLoading(false);
  };

  const loadDrivers = async () => {
    const { data, error } = await supabase
      .from("drivers")
      .select("id, name, phone")
      .eq("is_active", true)
      .order("name");

    if (error) {
      toast.error(error.message || "Failed to load drivers");
    } else {
      setDrivers((data || []) as Driver[]);
    }
  };

  useEffect(() => {
    if (!loading && isAdmin) {
      loadOrders();
      loadDrivers();
    }
  }, [loading, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel("admin-orders-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => loadOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  useEffect(() => {
  return () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }
  };
}, [watchId]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesFilter = filter === "all" || order.status === filter;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        order.customer_name.toLowerCase().includes(q) ||
        order.customer_phone.toLowerCase().includes(q) ||
        order.id.toLowerCase().includes(q) ||
        (order.customer_email || "").toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [orders, filter, search]);

 const updateStatus = async (orderId: string, status: OrderStatus) => {
  setSavingId(orderId);

  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) {
    toast.error(error.message || "Failed to update status");
    setSavingId(null);
    return;
  }

  setOrders((prev) =>
    prev.map((o) => (o.id === orderId ? { ...o, status } : o))
  );

  toast.success(`Order marked as ${statusLabel[status]}`);
  setSavingId(null);

  if (status === "out_for_delivery") {
    startLiveTracking(orderId);
  }

  if (status === "delivered" || status === "cancelled") {
    if (trackingOrderId === orderId) {
      stopLiveTracking();
    }
  }
};

  const updateDriver = async (orderId: string, driverId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ driver_id: driverId || null })
      .eq("id", orderId);

    if (error) {
      toast.error(error.message || "Failed to assign driver");
    } else {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, driver_id: driverId || null } : o))
      );
      toast.success("Driver assigned");
    }
  };

  const updateEta = async (orderId: string, eta: string) => {
    const value = eta ? new Date(eta).toISOString() : null;

    const { error } = await supabase
      .from("orders")
      .update({ estimated_delivery_time: value })
      .eq("id", orderId);

    if (error) {
      toast.error(error.message || "Failed to update ETA");
    } else {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, estimated_delivery_time: value } : o))
      );
      toast.success("ETA updated");
    }
  };

  const updateDistance = async (orderId: string, distance: string) => {
    const value = distance ? Number(distance) : null;

    const { error } = await supabase
      .from("orders")
      .update({ driver_distance_km: value })
      .eq("id", orderId);

    if (error) {
      toast.error(error.message || "Failed to update distance");
    } else {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, driver_distance_km: value } : o))
      );
      toast.success("Distance updated");
    }
  };

  const handleLocationInputChange = (orderId: string, field: "lat" | "lng", value: string) => {
    setLocationInputs((prev) => ({
      ...prev,
      [orderId]: {
        lat: prev[orderId]?.lat ?? "",
        lng: prev[orderId]?.lng ?? "",
        [field]: value,
      },
    }));
  };
const useCurrentLocationForOrder = (orderId: string) => {
  if (!navigator.geolocation) {
    toast.error("Geolocation is not supported on this device");
    return;
  }

  setSavingId(orderId);

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = String(position.coords.latitude);
      const lng = String(position.coords.longitude);

      setLocationInputs((prev) => ({
        ...prev,
        [orderId]: { lat, lng },
      }));

      setSavingId(null);
      toast.success("Current location captured");
    },
    (error) => {
      setSavingId(null);

      switch (error.code) {
        case error.PERMISSION_DENIED:
          toast.error("Location permission was denied");
          break;
        case error.POSITION_UNAVAILABLE:
          toast.error("Location information is unavailable");
          break;
        case error.TIMEOUT:
          toast.error("Location request timed out");
          break;
        default:
          toast.error("Failed to get current location");
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
};
  const updateDriverLocation = async (orderId: string) => {
    const latValue = locationInputs[orderId]?.lat?.trim() || "";
    const lngValue = locationInputs[orderId]?.lng?.trim() || "";

    const driverLat = latValue ? Number(latValue) : null;
    const driverLng = lngValue ? Number(lngValue) : null;

    if ((latValue && Number.isNaN(driverLat)) || (lngValue && Number.isNaN(driverLng))) {
      toast.error("Please enter valid latitude and longitude values");
      return;
    }

    setSavingId(orderId);

    const timestamp = driverLat != null && driverLng != null ? new Date().toISOString() : null;

    const { error } = await supabase
      .from("orders")
      .update({
        driver_lat: driverLat,
        driver_lng: driverLng,
        driver_last_updated: timestamp,
      })
      .eq("id", orderId);

    if (error) {
      toast.error(error.message || "Failed to update driver location");
    } else {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                driver_lat: driverLat,
                driver_lng: driverLng,
                driver_last_updated: timestamp,
              }
            : o
        )
      );
      toast.success("Driver location updated");
    }

    setSavingId(null);
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
    })
    .eq("id", orderId);

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
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      setLocationInputs((prev) => ({
        ...prev,
        [orderId]: {
          lat: String(lat),
          lng: String(lng),
        },
      }));

      await pushLiveLocationUpdate(orderId, lat, lng);
    },
    (error) => {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          toast.error("Location permission was denied");
          break;
        case error.POSITION_UNAVAILABLE:
          toast.error("Location information is unavailable");
          break;
        case error.TIMEOUT:
          toast.error("Live tracking request timed out");
          break;
        default:
          toast.error("Failed to start live tracking");
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

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading admin orders...
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div>
      <div className="container py-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-5xl text-foreground mb-2">ADMIN ORDERS</h1>
            <p className="text-muted-foreground">
              Manage incoming customer orders and update delivery progress.
            </p>
          </div>

          <button
            onClick={loadOrders}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Search by customer, phone, email or order ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as OrderStatus | "all")}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {statusLabel[status]}
              </option>
            ))}
          </select>

          <div className="flex items-center text-sm text-muted-foreground">
            {filteredOrders.length} order{filteredOrders.length === 1 ? "" : "s"} found
          </div>
        </div>

        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground">
              No orders found.
            </div>
          ) : (
            filteredOrders.map((order) => (
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

                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <span className="text-sm font-medium text-foreground">
                      Current: {statusLabel[order.status]}
                    </span>

                    <div className="flex items-center gap-2">
                      <select
                        value={order.status}
                        disabled={savingId === order.id}
                        onChange={(e) => updateStatus(order.id, e.target.value as OrderStatus)}
                        className="px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {statusLabel[status]}
                          </option>
                        ))}
                      </select>

                      {savingId === order.id && (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Customer</p>
                    <p className="font-medium text-foreground">{order.customer_name}</p>
                    <p className="text-muted-foreground">{order.customer_phone}</p>
                    {order.customer_email && (
                      <p className="text-muted-foreground">{order.customer_email}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-muted-foreground mb-1">Address</p>
                    <p className="font-medium text-foreground">{order.delivery_address}</p>
                  </div>

                  <div>
                    <p className="text-muted-foreground mb-1">Payment</p>
                    <p className="font-medium text-foreground capitalize">{order.payment_method}</p>
                    {order.voucher_code && (
                      <p className="text-muted-foreground">Voucher: {order.voucher_code}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-muted-foreground mb-1">Totals</p>
                    <p className="text-foreground">Subtotal: R{order.subtotal}</p>
                    <p className="text-foreground">Delivery: R{order.delivery_fee}</p>
                    {!!order.discount_amount && order.discount_amount > 0 && (
                      <p className="text-success">Discount: -R{order.discount_amount}</p>
                    )}
                    <p className="font-bold text-primary">Total: R{order.total}</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Driver</label>
                    <select
                      value={order.driver_id || ""}
                      onChange={(e) => updateDriver(order.id, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    >
                      <option value="">Unassigned</option>
                      {drivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">ETA</label>
                    <input
                      type="datetime-local"
                      defaultValue={
                        order.estimated_delivery_time
                          ? new Date(order.estimated_delivery_time).toISOString().slice(0, 16)
                          : ""
                      }
                      onBlur={(e) => updateEta(order.id, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Distance Away (km)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      defaultValue={order.driver_distance_km ?? ""}
                      onBlur={(e) => updateDistance(order.id, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4">
  <div>
    <label className="block text-xs text-muted-foreground mb-1">Driver Latitude</label>
    <input
      type="number"
      step="0.0000001"
      value={locationInputs[order.id]?.lat ?? ""}
      onChange={(e) => handleLocationInputChange(order.id, "lat", e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
      placeholder="-26.2041"
    />
  </div>

  <div>
    <label className="block text-xs text-muted-foreground mb-1">Driver Longitude</label>
    <input
      type="number"
      step="0.0000001"
      value={locationInputs[order.id]?.lng ?? ""}
      onChange={(e) => handleLocationInputChange(order.id, "lng", e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
      placeholder="28.0473"
    />
  </div>

  <div className="flex items-end">
    <button
      type="button"
      onClick={() => useCurrentLocationForOrder(order.id)}
      disabled={savingId === order.id}
      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
    >
      {savingId === order.id ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Crosshair className="w-4 h-4" />
      )}
      Use My Current Location
    </button>
  </div>

  <div className="flex items-end">
    {trackingOrderId === order.id ? (
      <button
        type="button"
        onClick={stopLiveTracking}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Square className="w-4 h-4" />
        Stop Live Tracking
      </button>
    ) : (
      <button
        type="button"
        onClick={() => startLiveTracking(order.id)}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Play className="w-4 h-4" />
        Start Live Tracking
      </button>
    )}
  </div>

  <div className="flex items-end">
    <button
      type="button"
      onClick={() => updateDriverLocation(order.id)}
      disabled={savingId === order.id}
      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
    >
      {savingId === order.id ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Save className="w-4 h-4" />
      )}
      Save Driver Location
    </button>
  </div>
</div>

                {order.driver_last_updated && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Driver location last updated:{" "}
                    {new Date(order.driver_last_updated).toLocaleString("en-ZA", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}

                {order.notes && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-muted-foreground text-sm mb-1">Notes</p>
                    <p className="text-foreground text-sm">{order.notes}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}