import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
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
  Phone,
  Navigation,
  Search,
  ArrowUpRight,
  ShieldAlert,
  ReceiptText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
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

interface AdminOrderItemOption {
  id: string;
  order_item_id: string;
  option_group_name: string;
  option_item_name: string;
  price_delta: number;
}

interface AdminOrderItem {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  final_unit_price: number;
  options_total: number;
  total_price: number;
  item_note: string | null;
  selectedOptions: AdminOrderItemOption[];
}

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

function formatRelativeTime(value?: string | null) {
  if (!value) return "—";

  const now = new Date().getTime();
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

function formatDistance(value?: number | null) {
  if (value == null) return "—";
  return `${Number(value).toFixed(1)} km`;
}

function getPaymentLabel(paymentStatus?: string | null, paymentMethod?: string | null) {
  const status = normalizeValue(paymentStatus);
  const method = normalizeValue(paymentMethod);

  if (status === "paid") return "Paid";
  if (method === "cash") return "Cash on delivery";
  if (method === "card" && (status === "pending" || status === "")) return "Awaiting card payment";
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

function getDispatchState(order: AdminOrder) {
  if (order.status === "cancelled") {
    return {
      label: "Cancelled",
      tone: "bg-rose-50 border-rose-200 text-rose-700",
      description: "This order has been cancelled.",
    };
  }

  if (order.status === "delivered") {
    return {
      label: "Delivered",
      tone: "bg-emerald-50 border-emerald-200 text-emerald-700",
      description: "The delivery has been completed.",
    };
  }

  if (order.status === "arrived") {
    return {
      label: "Arrived",
      tone: "bg-cyan-50 border-cyan-200 text-cyan-700",
      description: "The driver has arrived at the customer location.",
    };
  }

  if (order.status === "on_the_way") {
    return {
      label: "On The Way",
      tone: "bg-indigo-50 border-indigo-200 text-indigo-700",
      description: "The driver is currently delivering this order.",
    };
  }

  if (order.status === "ready_for_delivery" && order.driver_id) {
    return {
      label: "Driver Assigned",
      tone: "bg-sky-50 border-sky-200 text-sky-700",
      description: "A driver accepted this order and is expected to start shortly.",
    };
  }

  if (order.status === "ready_for_delivery" && !order.driver_id) {
    return {
      label: "Waiting for Driver",
      tone: "bg-orange-50 border-orange-200 text-orange-700",
      description: "The order is ready and waiting for a driver to accept it.",
    };
  }

  if (order.status === "preparing") {
    return {
      label: "Kitchen Preparing",
      tone: "bg-violet-50 border-violet-200 text-violet-700",
      description: "The kitchen is still preparing this order.",
    };
  }

  if (order.status === "confirmed") {
    return {
      label: "Confirmed",
      tone: "bg-blue-50 border-blue-200 text-blue-700",
      description: "The order has been confirmed and will move to the kitchen.",
    };
  }

  return {
    label: "Pending",
    tone: "bg-amber-50 border-amber-200 text-amber-700",
    description: "The order is waiting for confirmation.",
  };
}

function getTrackerStatus(order: AdminOrder): DeliveryStatus {
  if (order.status === "cancelled") return "cancelled";
  if (order.status === "delivered") return "delivered";
  if (order.status === "arrived") return "arrived";
  if (order.status === "on_the_way") return "on_the_way";
  if (order.status === "ready_for_delivery") return "ready_for_delivery";
  if (order.status === "preparing") return "preparing";
  if (order.status === "confirmed") return "confirmed";
  return "pending";
}

export default function AdminOrdersPage() {
  const { user, isAdmin, loading } = useAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [orderItemsByOrderId, setOrderItemsByOrderId] = useState<Record<string, AdminOrderItem[]>>({});
  const [pageLoading, setPageLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");

  const loadOrders = useCallback(async () => {
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
      setPageLoading(false);
      return;
    }

    const nextOrders = (data || []) as AdminOrder[];
    setOrders(nextOrders);

    if (nextOrders.length === 0) {
      setOrderItemsByOrderId({});
      setPageLoading(false);
      return;
    }

    try {
      const orderIds = nextOrders.map((order) => order.id);

      const { data: orderItemsData, error: orderItemsError } = await (supabase as any)
        .from("order_items")
        .select(`
          id,
          order_id,
          product_name,
          quantity,
          unit_price,
          final_unit_price,
          options_total,
          total_price,
          item_note
        `)
        .in("order_id", orderIds)
        .order("created_at", { ascending: true });

      if (orderItemsError) throw orderItemsError;

      const normalizedOrderItems: AdminOrderItem[] = ((orderItemsData || []) as any[]).map((item) => ({
        id: String(item.id),
        order_id: String(item.order_id),
        product_name: item.product_name,
        quantity: Number(item.quantity ?? 1),
        unit_price: Number(item.unit_price ?? 0),
        final_unit_price: Number(item.final_unit_price ?? item.unit_price ?? 0),
        options_total: Number(item.options_total ?? 0),
        total_price: Number(item.total_price ?? 0),
        item_note: item.item_note || null,
        selectedOptions: [],
      }));

      if (normalizedOrderItems.length > 0) {
        const orderItemIds = normalizedOrderItems.map((item) => item.id);

        const { data: orderItemOptionsData, error: orderItemOptionsError } = await (supabase as any)
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

        if (orderItemOptionsError) throw orderItemOptionsError;

        const optionsByOrderItemId = new Map<string, AdminOrderItemOption[]>();

        ((orderItemOptionsData || []) as any[]).forEach((option) => {
          const normalizedOption: AdminOrderItemOption = {
            id: String(option.id),
            order_item_id: String(option.order_item_id),
            option_group_name: option.option_group_name,
            option_item_name: option.option_item_name,
            price_delta: Number(option.price_delta ?? 0),
          };

          const existing = optionsByOrderItemId.get(normalizedOption.order_item_id) || [];
          existing.push(normalizedOption);
          optionsByOrderItemId.set(normalizedOption.order_item_id, existing);
        });

        normalizedOrderItems.forEach((item) => {
          item.selectedOptions = optionsByOrderItemId.get(item.id) || [];
        });
      }

      const grouped = normalizedOrderItems.reduce<Record<string, AdminOrderItem[]>>((acc, item) => {
        if (!acc[item.order_id]) acc[item.order_id] = [];
        acc[item.order_id].push(item);
        return acc;
      }, {});

      setOrderItemsByOrderId(grouped);
    } catch (err: any) {
      toast.error(err.message || "Failed to load order items");
      setOrderItemsByOrderId({});
    } finally {
      setPageLoading(false);
    }
  }, []);

  const loadDrivers = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (!loading && isAdmin) {
      void loadOrders();
      void loadDrivers();
    }
  }, [loading, isAdmin, loadOrders, loadDrivers]);

  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel("admin-orders-live-dispatch-v4")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          void loadOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, loadOrders]);

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

  const stats = useMemo(() => {
    const awaitingAttention = orders.filter(
      (order) =>
        order.status === "pending" ||
        (isCardPaymentMethod(order.payment_method) &&
          !isPaidPaymentStatus(order.payment_status) &&
          ["pending", "confirmed", "preparing", "ready_for_delivery"].includes(order.status))
    ).length;

    const kitchenActive = orders.filter((order) =>
      ["confirmed", "preparing"].includes(order.status)
    ).length;

    const dispatchActive = orders.filter((order) =>
      ["ready_for_delivery", "on_the_way", "arrived"].includes(order.status)
    ).length;

    const deliveredCount = orders.filter((order) => order.status === "delivered").length;

    return {
      awaitingAttention,
      kitchenActive,
      dispatchActive,
      deliveredCount,
    };
  }, [orders]);

  const driverMap = useMemo(() => {
    return new Map(drivers.map((driver) => [driver.id, driver]));
  }, [drivers]);

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

  const getStatusBadge = (status: OrderStatus) => {
    const map: Record<OrderStatus, string> = {
      pending: "bg-amber-100 text-amber-700",
      confirmed: "bg-blue-100 text-blue-700",
      preparing: "bg-violet-100 text-violet-700",
      ready_for_delivery: "bg-orange-100 text-orange-700",
      on_the_way: "bg-indigo-100 text-indigo-700",
      arrived: "bg-cyan-100 text-cyan-700",
      delivered: "bg-emerald-100 text-emerald-700",
      cancelled: "bg-rose-100 text-rose-700",
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
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
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
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">
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
        className: "bg-violet-600 text-white hover:opacity-90",
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
        className: "bg-rose-600 text-white hover:opacity-90",
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
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-opacity disabled:opacity-50 ${
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
      <div className="flex min-h-screen items-center justify-center bg-background">
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
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl py-8 md:py-10">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <Truck className="h-3.5 w-3.5 text-primary" />
              Kitchen controls · Dispatch visibility · Live delivery state
            </div>

            <h1 className="font-display text-4xl text-foreground sm:text-5xl md:text-6xl">
              Admin Orders
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Manage kitchen progress, monitor dispatch, and handle payment exceptions.
            </p>
          </div>

          <button
            onClick={() => void loadOrders()}
            className="inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh orders
          </button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Awaiting Attention
            </p>
            <p className="mt-2 text-3xl font-semibold text-foreground">
              {stats.awaitingAttention}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Kitchen Active
            </p>
            <p className="mt-2 text-3xl font-semibold text-foreground">
              {stats.kitchenActive}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Dispatch Active
            </p>
            <p className="mt-2 text-3xl font-semibold text-foreground">
              {stats.dispatchActive}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Delivered
            </p>
            <p className="mt-2 text-3xl font-semibold text-foreground">
              {stats.deliveredCount}
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-[28px] border border-border bg-card p-4 shadow-card md:p-5">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search customer, phone, email, address or order ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-border bg-background py-3 pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            <div className="flex items-center rounded-2xl border border-border bg-background px-4 text-sm font-medium text-muted-foreground">
              {filteredOrders.length} order{filteredOrders.length === 1 ? "" : "s"} found
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {(["all", "pending", "confirmed", "preparing", "ready_for_delivery", "on_the_way", "arrived", "delivered", "cancelled"] as const).map(
              (status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilter(status)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                    filter === status
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {status === "all" ? "All" : statusLabel[status]}
                </button>
              )
            )}
          </div>
        </div>

        <div className="space-y-5">
          {filteredOrders.length === 0 ? (
            <div className="rounded-[28px] border border-border bg-card p-10 text-center shadow-card">
              <p className="text-lg font-semibold text-foreground">No orders found</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a different search term or change the active filter.
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const assignedDriver = order.driver_id ? driverMap.get(order.driver_id) : null;
              const dispatch = getDispatchState(order);
              const orderItems = orderItemsByOrderId[order.id] || [];

              const paymentGuardMessage =
                isCardPaymentMethod(order.payment_method) &&
                !isPaidPaymentStatus(order.payment_status)
                  ? "Card payment is not yet paid, so kitchen progress beyond Pending is blocked."
                  : null;

              return (
                <article
                  key={order.id}
                  className="rounded-[28px] border border-border bg-card p-5 shadow-card md:p-6"
                >
                  <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-2xl text-foreground">
                          Order #{order.id.slice(0, 8).toUpperCase()}
                        </h2>
                        {getStatusBadge(order.status)}
                        {getPaymentBadge(order.payment_status, order.payment_method)}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span>Created {formatDateTime(order.created_at)}</span>
                        <span>•</span>
                        <span>{formatRelativeTime(order.created_at)}</span>
                        {order.estimated_delivery_time && (
                          <>
                            <span>•</span>
                            <span>ETA {formatTime(order.estimated_delivery_time)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/order-tracking/${order.id}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                      >
                        Open Tracking
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>

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
                                    itemName: `Village Eats Order #${order.id
                                      .slice(0, 8)
                                      .toUpperCase()}`,
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
                          className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                        >
                          <CreditCard className="h-4 w-4" />
                          Retry Payment
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={`mb-5 rounded-2xl border px-4 py-4 ${dispatch.tone}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold">{dispatch.label}</p>
                        <p className="text-sm opacity-90">{dispatch.description}</p>
                      </div>

                      {assignedDriver && (
                        <div className="text-sm font-medium">
                          Driver: {assignedDriver.name}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-5 rounded-2xl border border-border bg-background p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">Delivery Flow</p>
                      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                        {dispatch.label}
                      </span>
                    </div>

                    <DeliveryProgressTracker status={getTrackerStatus(order)} />
                  </div>

                  {paymentGuardMessage && (
                    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{paymentGuardMessage}</span>
                    </div>
                  )}

                  <div className="mb-5">
                    <p className="mb-3 text-sm font-semibold text-foreground">Kitchen Actions</p>
                    <QuickKitchenButtons order={order} />
                  </div>

                  <div className="mb-5 rounded-2xl border border-border bg-background p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">Items for Kitchen</p>
                      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {orderItems.length} line item{orderItems.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {orderItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No order items found.</p>
                    ) : (
                      <div className="space-y-3">
                        {orderItems.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-border bg-card p-4 text-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground">
                                  {item.quantity} × {item.product_name}
                                </p>
                                <p className="mt-1 text-muted-foreground">
                                  {formatCurrency(item.final_unit_price || item.unit_price)} each
                                </p>
                              </div>

                              <p className="shrink-0 font-semibold text-foreground">
                                {formatCurrency(item.total_price)}
                              </p>
                            </div>

                            {item.selectedOptions.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {item.selectedOptions.map((option) => (
                                  <span
                                    key={option.id}
                                    className="rounded-full bg-background px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
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
                              <p className="mt-2 rounded-lg bg-background px-2.5 py-2 text-xs text-muted-foreground">
                                Note: {item.item_note}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
                    <div className="rounded-2xl border border-border bg-background p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">Customer</p>
                      </div>

                      <div className="space-y-1 text-sm">
                        <p className="font-medium text-foreground">{order.customer_name}</p>
                        <p className="text-muted-foreground">{order.customer_phone}</p>
                        {order.customer_email && (
                          <p className="break-all text-muted-foreground">{order.customer_email}</p>
                        )}
                        <p className="pt-2 text-foreground">{order.delivery_address}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-background p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <ReceiptText className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">Payment</p>
                      </div>

                      <div className="space-y-1 text-sm">
                        <p className="font-medium capitalize text-foreground">
                          {order.payment_method}
                        </p>
                        <p className="text-muted-foreground">
                          Provider: {order.payment_provider || "N/A"}
                        </p>
                        <p className="break-all text-muted-foreground">
                          Ref: {order.payment_reference || "N/A"}
                        </p>
                        {order.voucher_code && (
                          <p className="text-muted-foreground">
                            Voucher: {order.voucher_code}
                          </p>
                        )}
                        <div className="pt-2">
                          {getPaymentBadge(order.payment_status, order.payment_method)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-background p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">Totals</p>
                      </div>

                      <div className="space-y-1 text-sm">
                        <p className="text-foreground">
                          Subtotal:{" "}
                          <span className="text-muted-foreground">
                            {formatCurrency(order.subtotal)}
                          </span>
                        </p>
                        <p className="text-foreground">
                          Delivery:{" "}
                          <span className="text-muted-foreground">
                            {formatCurrency(order.delivery_fee)}
                          </span>
                        </p>
                        {!!order.discount_amount && order.discount_amount > 0 && (
                          <p className="text-emerald-700">
                            Discount: -{formatCurrency(order.discount_amount)}
                          </p>
                        )}
                        <p className="pt-2 text-base font-bold text-primary">
                          Total: {formatCurrency(order.total)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-background p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">Dispatch Snapshot</p>
                      </div>

                      <div className="space-y-1 text-sm">
                        <p className="text-foreground">
                          Driver:{" "}
                          <span className="text-muted-foreground">
                            {assignedDriver?.name || "Unassigned"}
                          </span>
                        </p>
                        <p className="text-foreground">
                          ETA:{" "}
                          <span className="text-muted-foreground">
                            {formatTime(order.estimated_delivery_time)}
                          </span>
                        </p>
                        <p className="text-foreground">
                          Distance:{" "}
                          <span className="text-muted-foreground">
                            {formatDistance(order.driver_distance_km)}
                          </span>
                        </p>
                        <p className="text-foreground">
                          Last update:{" "}
                          <span className="text-muted-foreground">
                            {formatDateTime(order.driver_last_updated)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-4">
                    <div className="rounded-2xl border border-border bg-background p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">Driver Assignment</p>
                      </div>

                      {assignedDriver ? (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">
                            {assignedDriver.name}
                          </p>
                          <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            {assignedDriver.phone || "No phone"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Accepted: {formatDateTime(order.accepted_at)}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">Unassigned</p>
                          <p className="text-sm text-muted-foreground">
                            Waiting for a driver to accept this delivery.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-border bg-background p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">Trip Milestones</p>
                      </div>

                      <div className="space-y-1 text-sm">
                        <p className="text-foreground">
                          Started:{" "}
                          <span className="text-muted-foreground">
                            {formatDateTime(order.started_delivery_at)}
                          </span>
                        </p>
                        <p className="text-foreground">
                          Arrived:{" "}
                          <span className="text-muted-foreground">
                            {formatDateTime(order.arrived_at)}
                          </span>
                        </p>
                        <p className="text-foreground">
                          Delivered:{" "}
                          <span className="text-muted-foreground">
                            {formatDateTime(order.delivered_at)}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-background p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Navigation className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">Live Delivery Info</p>
                      </div>

                      <div className="space-y-1 text-sm">
                        <p className="text-foreground">
                          ETA:{" "}
                          <span className="text-muted-foreground">
                            {formatTime(order.estimated_delivery_time)}
                          </span>
                        </p>
                        <p className="text-foreground">
                          Distance:{" "}
                          <span className="text-muted-foreground">
                            {formatDistance(order.driver_distance_km)}
                          </span>
                        </p>
                        <p className="text-foreground">
                          Last updated:{" "}
                          <span className="text-muted-foreground">
                            {formatDateTime(order.driver_last_updated)}
                          </span>
                        </p>
                      </div>

                      {order.driver_lat != null && order.driver_lng != null && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          Live location available
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-border bg-background p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">Cash Collection</p>
                      </div>

                      {isCashPaymentMethod(order.payment_method) ? (
                        <div className="space-y-1 text-sm">
                          <p className="text-foreground">
                            Collected:{" "}
                            <span
                              className={
                                order.cash_collected
                                  ? "font-medium text-emerald-700"
                                  : "text-muted-foreground"
                              }
                            >
                              {order.cash_collected ? "Yes" : "No"}
                            </span>
                          </p>
                          <p className="text-foreground">
                            Amount:{" "}
                            <span className="text-muted-foreground">
                              {order.cash_collected_amount != null
                                ? formatCurrency(order.cash_collected_amount)
                                : "—"}
                            </span>
                          </p>
                          <p className="text-foreground">
                            Time:{" "}
                            <span className="text-muted-foreground">
                              {formatDateTime(order.cash_collected_at)}
                            </span>
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Not applicable for card or EFT payments.
                        </p>
                      )}
                    </div>
                  </div>

                  {order.notes && (
                    <div className="mt-5 border-t border-border pt-5">
                      <p className="mb-2 text-sm font-semibold text-foreground">Notes</p>
                      <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
                        {order.notes}
                      </p>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}