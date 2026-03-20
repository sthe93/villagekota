import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  Clock3,
  ChefHat,
  PackageCheck,
  XCircle,
  CreditCard,
  Truck,
  UserCheck,
  MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import Footer from "@/components/Footer";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready_for_delivery"
  | "on_the_way"
  | "arrived"
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
  payment_provider: string | null;
  payment_reference: string | null;
  payment_status: string | null;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number | null;
  total: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  notes: string | null;
  voucher_code: string | null;
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
}

const adminStatusOptions: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready_for_delivery",
  "cancelled",
];

const statusLabel: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready_for_delivery: "Ready for Delivery",
  on_the_way: "On The Way",
  arrived: "Arrived",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function normalizeValue(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function isCardPaymentMethod(value?: string | null) {
  return normalizeValue(value) === "card";
}

function isCashPaymentMethod(value?: string | null) {
  return normalizeValue(value) === "cash";
}

function isPaidPaymentStatus(value?: string | null) {
  return normalizeValue(value) === "paid";
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

function getPaymentLabel(paymentStatus?: string | null, paymentMethod?: string | null) {
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

function canAdminMoveOrderToStatus(
  order: {
    payment_method?: string | null;
    payment_status?: string | null;
    status?: string | null;
  },
  nextStatus: OrderStatus
) {
  const currentStatus = normalizeValue(order.status);
  const isCard = isCardPaymentMethod(order.payment_method);
  const isPaid = isPaidPaymentStatus(order.payment_status);

  if (["on_the_way", "arrived", "delivered"].includes(nextStatus)) {
    return {
      allowed: false,
      message: "Driver controls On The Way, Arrived, and Delivered statuses.",
    };
  }

  if (
    isCard &&
    !isPaid &&
    ["confirmed", "preparing", "ready_for_delivery"].includes(nextStatus)
  ) {
    return {
      allowed: false,
      message:
        "Card payment must be paid before the order can move to Confirmed, Preparing, or Ready for Delivery.",
    };
  }

  if (nextStatus === "cancelled" && currentStatus === "delivered") {
    return {
      allowed: false,
      message: "Delivered orders cannot be cancelled.",
    };
  }

  return { allowed: true, message: "" };
}

function canRetryPayment(order: {
  payment_method?: string | null;
  payment_status?: string | null;
  status?: string | null;
}) {
  const method = normalizeValue(order.payment_method);
  const paymentStatus = normalizeValue(order.payment_status);
  const orderStatus = normalizeValue(order.status);

  return (
    method === "card" &&
    ["pending", "failed", "cancelled", ""].includes(paymentStatus) &&
    ["pending", "cancelled"].includes(orderStatus)
  );
}

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
        payment_provider,
        payment_reference,
        payment_status,
        subtotal,
        delivery_fee,
        discount_amount,
        total,
        status,
        created_at,
        updated_at,
        notes,
        voucher_code,
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
        cash_collected_at
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
      .channel("admin-orders-live-dispatch")
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
        (order.customer_email || "").toLowerCase().includes(q) ||
        order.delivery_address.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [orders, filter, search]);

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    const order = orders.find((o) => o.id === orderId);

    if (!order) {
      toast.error("Order not found");
      return;
    }

    const guard = canAdminMoveOrderToStatus(order, status);

    if (!guard.allowed) {
      toast.error(guard.message);
      return;
    }

    setSavingId(orderId);

    const { error } = await supabase
      .from("orders")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      toast.error(error.message || "Failed to update status");
      setSavingId(null);
      return;
    }

    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    toast.success(`Order marked as ${statusLabel[status]}`);
    setSavingId(null);
  };

  const driverNameMap = useMemo(() => {
    return new Map(drivers.map((driver) => [driver.id, driver]));
  }, [drivers]);

  const getStatusBadge = (status: OrderStatus) => {
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
      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${map[status]}`}>
        {statusLabel[status]}
      </span>
    );
  };

  const getPaymentBadge = (paymentStatus: string | null, paymentMethod?: string | null) => {
    const status = normalizeValue(paymentStatus);
    const method = normalizeValue(paymentMethod);
    const label = getPaymentLabel(paymentStatus, paymentMethod);

    if (status === "paid") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {label}
        </span>
      );
    }

    if (method === "cash") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          <Clock3 className="h-3.5 w-3.5" />
          {label}
        </span>
      );
    }

    if (status === "failed" || status === "cancelled") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
          <XCircle className="h-3.5 w-3.5" />
          {label}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
        <Clock3 className="h-3.5 w-3.5" />
        {label}
      </span>
    );
  };

  const QuickKitchenButtons = ({ order }: { order: AdminOrder }) => {
    const buttons = [
      {
        status: "confirmed" as OrderStatus,
        label: "Confirm",
        icon: CheckCircle2,
        className: "bg-blue-600 text-white hover:opacity-90",
      },
      {
        status: "preparing" as OrderStatus,
        label: "Preparing",
        icon: ChefHat,
        className: "bg-purple-600 text-white hover:opacity-90",
      },
      {
        status: "ready_for_delivery" as OrderStatus,
        label: "Ready for Delivery",
        icon: PackageCheck,
        className: "bg-orange-600 text-white hover:opacity-90",
      },
      {
        status: "cancelled" as OrderStatus,
        label: "Cancel",
        icon: XCircle,
        className: "bg-red-600 text-white hover:opacity-90",
      },
    ];

    return (
      <div className="flex flex-wrap gap-2">
        {buttons.map((btn) => {
          const Icon = btn.icon;
          const active = order.status === btn.status;
          const guard = canAdminMoveOrderToStatus(order, btn.status);
          const blocked = !guard.allowed;

          return (
            <button
              key={btn.status}
              type="button"
              onClick={() => updateStatus(order.id, btn.status)}
              disabled={savingId === order.id || active || blocked}
              title={blocked ? guard.message : ""}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-opacity disabled:opacity-50 ${
                active
                  ? "border border-border bg-muted text-muted-foreground"
                  : blocked
                  ? "cursor-not-allowed border border-border bg-muted text-muted-foreground"
                  : btn.className
              }`}
            >
              {savingId === order.id && !active ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              {btn.label}
            </button>
          );
        })}
      </div>
    );
  };

  if (loading || pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
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
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-2 font-display text-5xl text-foreground">ADMIN ORDERS</h1>
            <p className="text-muted-foreground">
              Kitchen controls, dispatch visibility, and live delivery progress.
            </p>
          </div>

          <button
            onClick={loadOrders}
            className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-secondary-foreground transition-opacity hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-3">
          <input
            type="text"
            placeholder="Search by customer, phone, email, address or order ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as OrderStatus | "all")}
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All statuses</option>
            {[
              "pending",
              "confirmed",
              "preparing",
              "ready_for_delivery",
              "on_the_way",
              "arrived",
              "delivered",
              "cancelled",
            ].map((status) => (
              <option key={status} value={status}>
                {statusLabel[status as OrderStatus]}
              </option>
            ))}
          </select>

          <div className="flex items-center text-sm text-muted-foreground">
            {filteredOrders.length} order{filteredOrders.length === 1 ? "" : "s"} found
          </div>
        </div>

        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-10 text-center text-muted-foreground">
              No orders found.
            </div>
          ) : (
            filteredOrders.map((order) => {
              const assignedDriver = order.driver_id ? driverNameMap.get(order.driver_id) : null;

              const paymentGuardMessage =
                isCardPaymentMethod(order.payment_method) &&
                !isPaidPaymentStatus(order.payment_status)
                  ? "Card payment is not yet paid, so kitchen progress beyond Pending is blocked."
                  : null;

              return (
                <div key={order.id} className="rounded-lg border border-border bg-card p-5">
                  <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="font-display text-2xl text-foreground">
                        Order #{order.id.slice(0, 8).toUpperCase()}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(order.created_at)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {getStatusBadge(order.status)}
                      {getPaymentBadge(order.payment_status, order.payment_method)}
                    </div>
                  </div>

                  {paymentGuardMessage && (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {paymentGuardMessage}
                    </div>
                  )}

                  <div className="mb-4">
                    <QuickKitchenButtons order={order} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 xl:grid-cols-5">
                    <div>
                      <p className="mb-1 text-muted-foreground">Customer</p>
                      <p className="font-medium text-foreground">{order.customer_name}</p>
                      <p className="text-muted-foreground">{order.customer_phone}</p>
                      {order.customer_email && (
                        <p className="text-muted-foreground">{order.customer_email}</p>
                      )}
                    </div>

                    <div>
                      <p className="mb-1 text-muted-foreground">Address</p>
                      <p className="font-medium text-foreground">{order.delivery_address}</p>
                    </div>

                    <div>
                      <p className="mb-1 text-muted-foreground">Payment</p>
                      <p className="font-medium capitalize text-foreground">{order.payment_method}</p>
                      <p className="text-muted-foreground">Provider: {order.payment_provider || "N/A"}</p>
                      <p className="break-all text-muted-foreground">
                        Ref: {order.payment_reference || "N/A"}
                      </p>
                      {order.voucher_code && (
                        <p className="text-muted-foreground">Voucher: {order.voucher_code}</p>
                      )}
                    </div>

                    <div>
                      <p className="mb-1 text-muted-foreground">Totals</p>
                      <p className="text-foreground">Subtotal: {formatCurrency(order.subtotal)}</p>
                      <p className="text-foreground">Delivery: {formatCurrency(order.delivery_fee)}</p>
                      {!!order.discount_amount && order.discount_amount > 0 && (
                        <p className="text-green-700">Discount: -{formatCurrency(order.discount_amount)}</p>
                      )}
                      <p className="font-bold text-primary">Total: {formatCurrency(order.total)}</p>
                    </div>

                    <div>
                      <p className="mb-1 text-muted-foreground">Payment State</p>
                      <div className="mb-2">{getPaymentBadge(order.payment_status, order.payment_method)}</div>

                      {canRetryPayment(order) && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              if (!order.customer_email) {
                                toast.error("Customer email is required to restart payment.");
                                return;
                              }

                              const { data, error } = await supabase.functions.invoke(
                                "create-payfast-checkout",
                                {
                                  body: {
                                    orderId: order.id,
                                    total: order.total || 0,
                                    customerName: order.customer_name,
                                    customerEmail: order.customer_email,
                                    itemName: `Village Eats Order #${order.id.slice(0, 8).toUpperCase()}`,
                                  },
                                }
                              );

                              if (error || !data?.url) {
                                toast.error("Failed to restart payment");
                                return;
                              }

                              window.open(data.url, "_blank");
                            } catch (err: any) {
                              toast.error(err.message || "Failed to restart payment");
                            }
                          }}
                          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          Retry Payment
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border pt-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border border-border bg-background p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-foreground">Driver Assignment</p>
                      </div>

                      {assignedDriver ? (
                        <>
                          <p className="text-sm text-foreground">{assignedDriver.name}</p>
                          <p className="text-sm text-muted-foreground">{assignedDriver.phone || "No phone"}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Accepted: {formatDateTime(order.accepted_at)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Waiting for a driver to accept this delivery.
                        </p>
                      )}
                    </div>

                    <div className="rounded-lg border border-border bg-background p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-foreground">Delivery Progress</p>
                      </div>
                      <p className="text-sm text-foreground">Started: {formatDateTime(order.started_delivery_at)}</p>
                      <p className="text-sm text-foreground">Arrived: {formatDateTime(order.arrived_at)}</p>
                      <p className="text-sm text-foreground">Delivered: {formatDateTime(order.delivered_at)}</p>
                    </div>

                    <div className="rounded-lg border border-border bg-background p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-foreground">Live Delivery Info</p>
                      </div>
                      <p className="text-sm text-foreground">ETA: {formatTime(order.estimated_delivery_time)}</p>
                      <p className="text-sm text-foreground">
                        Distance: {order.driver_distance_km != null ? `${order.driver_distance_km} km` : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last updated: {formatDateTime(order.driver_last_updated)}
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-background p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-foreground">Cash Collection</p>
                      </div>
                      {isCashPaymentMethod(order.payment_method) ? (
                        <>
                          <p className="text-sm text-foreground">Collected: {order.cash_collected ? "Yes" : "No"}</p>
                          <p className="text-sm text-foreground">
                            Amount: {order.cash_collected_amount != null ? formatCurrency(order.cash_collected_amount) : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Time: {formatDateTime(order.cash_collected_at)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not applicable for card payments.</p>
                      )}
                    </div>
                  </div>

                  {order.notes && (
                    <div className="mt-4 border-t border-border pt-4">
                      <p className="mb-1 text-sm text-muted-foreground">Notes</p>
                      <p className="text-sm text-foreground">{order.notes}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}