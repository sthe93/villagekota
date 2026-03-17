import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
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
        driver_distance_km
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message || "Failed to load orders");
    } else {
      setOrders((data || []) as AdminOrder[]);
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
    } else {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
      toast.success(`Order marked as ${statusLabel[status]}`);
    }

    setSavingId(null);
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