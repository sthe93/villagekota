import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Package, ChefHat, Truck, CheckCircle, Clock, XCircle, Phone, UserRound, MapPin } from "lucide-react";
import Footer from "@/components/Footer";
import DriverLiveMap from "@/components/DriverLiveMap";

const STEPS = [
  { key: "pending", label: "Order Placed", icon: Clock },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "out_for_delivery", label: "On the Way", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Package },
];

interface Order {
  id: string;
  status: string;
  total: number;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  customer_name: string;
  delivery_address: string;
  payment_method: string;
  created_at: string;
  voucher_code: string | null;
  driver_id: string | null;
  estimated_delivery_time: string | null;
  driver_distance_km: number | null;
  driver_lat: number | null;
  driver_lng: number | null;
  driver_last_updated: string | null;
  drivers: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
}

export default function OrderTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  });
  const [routeGeoJson, setRouteGeoJson] = useState<GeoJSON.Feature<GeoJSON.LineString> | null>(null);
  const [routeEtaMinutes, setRouteEtaMinutes] = useState<number | null>(null);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);

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

const fetchRoute = async (
  driverLat: number,
  driverLng: number,
  destLat: number,
  destLng: number
) => {
  const url = `https://router.project-osrm.org/route/v1/driving/${driverLng},${driverLat};${destLng},${destLat}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  const json = await res.json();

  const route = json?.routes?.[0];
  if (!route?.geometry) return null;

  return {
    geometry: {
      type: "Feature",
      properties: {},
      geometry: route.geometry,
    } as GeoJSON.Feature<GeoJSON.LineString>,
    durationMinutes: Math.round((route.duration || 0) / 60),
    distanceKm: Number(((route.distance || 0) / 1000).toFixed(1)),
  };
};

  useEffect(() => {
    if (!user || !orderId) {
      navigate("/auth");
      return;
    }

    const fetchOrder = async () => {
      const { data } = await supabase
        .from("orders")
        .select(`
          id,
          status,
          total,
          subtotal,
          delivery_fee,
          discount_amount,
          customer_name,
          delivery_address,
          payment_method,
          created_at,
          voucher_code,
          driver_id,
          estimated_delivery_time,
          driver_distance_km,
          driver_lat,
          driver_lng,
          driver_last_updated,
          drivers (
            id,
            name,
            phone
          )
        `)
        .eq("id", orderId)
        .eq("user_id", user.id)
        .single();

      setOrder(data as Order | null);
      setLoading(false);
    };

    fetchOrder();

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        async () => {
          const { data } = await supabase
            .from("orders")
            .select(`
              id,
              status,
              total,
              subtotal,
              delivery_fee,
              discount_amount,
              customer_name,
              delivery_address,
              payment_method,
              created_at,
              voucher_code,
              driver_id,
              estimated_delivery_time,
              driver_distance_km,
              driver_lat,
              driver_lng,
              driver_last_updated,
              drivers (
                id,
                name,
                phone
              )
            `)
            .eq("id", orderId)
            .eq("user_id", user.id)
            .single();

          setOrder(data as Order | null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, orderId, navigate]);

 useEffect(() => {
  const run = async () => {
    if (!order?.delivery_address) return;

    const dest = await geocodeAddress(order.delivery_address);
    if (!dest) return;

    setDestinationCoords(dest);

    if (order.driver_lat != null && order.driver_lng != null) {
      const route = await fetchRoute(order.driver_lat, order.driver_lng, dest.lat, dest.lng);
      if (route) {
        setRouteGeoJson(route.geometry);
        setRouteEtaMinutes(route.durationMinutes);
        setRouteDistanceKm(route.distanceKm);
      } else {
        setRouteGeoJson(null);
        setRouteEtaMinutes(null);
        setRouteDistanceKm(null);
      }
    } else {
      setRouteGeoJson(null);
      setRouteEtaMinutes(null);
      setRouteDistanceKm(null);
    }
  };

  run();
}, [order?.delivery_address, order?.driver_lat, order?.driver_lng]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading order...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Order not found</p>
          <button
            onClick={() => navigate("/account")}
            className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium"
          >
            Go to Account
          </button>
        </div>
      </div>
    );
  }

  const isCancelled = order.status === "cancelled";
  const currentStepIndex = STEPS.findIndex((s) => s.key === order.status);
  const progressPercent = isCancelled ? 0 : ((currentStepIndex + 1) / STEPS.length) * 100;

  const etaText = order.estimated_delivery_time
    ? new Date(order.estimated_delivery_time).toLocaleString("en-ZA", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div>
      <div className="container py-8 max-w-2xl">
        <h1 className="font-display text-5xl text-foreground text-center mb-2">ORDER TRACKING</h1>
        <p className="text-center text-muted-foreground text-sm mb-8">
          Order #{order.id.slice(0, 8).toUpperCase()} ·{" "}
          {new Date(order.created_at).toLocaleDateString("en-ZA", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>

        {isCancelled ? (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 text-center mb-8">
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
            <p className="font-display text-2xl text-destructive">ORDER CANCELLED</p>
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border p-6 mb-8">
            <div className="relative h-2 bg-muted rounded-full mb-8 overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex justify-between">
              {STEPS.map((step, i) => {
                const isActive = i <= currentStepIndex;
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex flex-col items-center gap-2 flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-500 ${
                        isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-xs font-medium text-center ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {order.status !== "delivered" && (
              <div className="flex items-center gap-2 justify-center mt-6">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </span>
                <span className="text-sm text-muted-foreground">Live tracking — updates automatically</span>
              </div>
            )}
          </div>
        )}

        {order.status === "out_for_delivery" && (
          <div className="space-y-4 mb-8">
            <div className="bg-card rounded-lg border border-border p-5 space-y-4">
              <h3 className="font-display text-xl text-foreground">DELIVERY LIVE INFO</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-3">
                  <UserRound className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Driver</p>
                    <p className="font-medium text-foreground">
                      {order.drivers?.name || "Driver will be assigned soon"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Driver Phone</p>
                    <p className="font-medium text-foreground">
                      {order.drivers?.phone || "Not available yet"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Estimated Arrival</p>
                    <p className="font-medium text-foreground">
                      {routeEtaMinutes != null
                        ? `${routeEtaMinutes} min away`
                        : etaText || "ETA will be updated soon"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Distance Away</p>
                    <p className="font-medium text-foreground">
                     {routeDistanceKm != null
  ? `${routeDistanceKm} km away`
  : order.driver_distance_km != null
    ? `${Number(order.driver_distance_km).toFixed(1)} km away`
    : "Distance will be updated soon"}
                    </p>
                  </div>
                </div>
              </div>

              {order.driver_last_updated && (
                <p className="text-xs text-muted-foreground">
                  Last updated:{" "}
                  {new Date(order.driver_last_updated).toLocaleString("en-ZA", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>

            <DriverLiveMap
              driverLat={order.driver_lat}
              driverLng={order.driver_lng}
              destinationLat={destinationCoords.lat}
              destinationLng={destinationCoords.lng}
              destinationLabel={order.delivery_address}
              routeGeoJson={routeGeoJson}
            />
          </div>
        )}

        <div className="bg-card rounded-lg border border-border p-5 space-y-3">
          <h3 className="font-display text-xl text-foreground">ORDER DETAILS</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Customer</span>
              <p className="font-medium text-foreground">{order.customer_name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Payment</span>
              <p className="font-medium text-foreground capitalize">
                {order.payment_method === "eft" ? "EFT" : order.payment_method}
              </p>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Delivery Address</span>
              <p className="font-medium text-foreground">{order.delivery_address}</p>
            </div>
          </div>

          <div className="border-t border-border pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>R{order.subtotal}</span>
            </div>

            {Number(order.discount_amount) > 0 && (
              <div className="flex justify-between text-success">
                <span>Discount {order.voucher_code && `(${order.voucher_code})`}</span>
                <span>-R{order.discount_amount}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery</span>
              <span>R{order.delivery_fee}</span>
            </div>

            <div className="flex justify-between font-display text-lg pt-2 border-t border-border">
              <span>TOTAL</span>
              <span className="text-primary">R{order.total}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6 justify-center">
          <button
            onClick={() => navigate("/account")}
            className="px-6 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            My Account
          </button>
          <button
            onClick={() => navigate("/menu")}
            className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Order Again
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}