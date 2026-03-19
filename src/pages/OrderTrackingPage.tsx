import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Footer from "@/components/Footer";

type OrderRecord = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  delivery_address: string | null;
  notes: string | null;
  payment_method: string | null;
  payment_provider: string | null;
  payment_reference: string | null;
  payment_status: string | null;
  status: string | null;
  subtotal: number | null;
  delivery_fee: number | null;
  discount_amount: number | null;
  total: number | null;
  created_at: string;
};

type OrderItemRecord = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type TimelineStep = {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const TIMELINE_STEPS: TimelineStep[] = [
  {
    key: "pending",
    label: "Order Placed",
    description: "We received your order.",
    icon: Clock3,
  },
  {
    key: "confirmed",
    label: "Confirmed",
    description: "Your order has been confirmed.",
    icon: Store,
  },
  {
    key: "preparing",
    label: "Preparing",
    description: "Your food is being prepared.",
    icon: ChefHat,
  },
  {
    key: "on_the_way",
    label: "On The Way",
    description: "Your order is on the road.",
    icon: Truck,
  },
  {
    key: "delivered",
    label: "Delivered",
    description: "Your order has arrived.",
    icon: PackageCheck,
  },
];

export default function OrderTrackingPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [items, setItems] = useState<OrderItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const paymentIsPaid = useMemo(
    () => (order?.payment_status || "").toLowerCase() === "paid",
    [order?.payment_status]
  );

  const paymentIsPending = useMemo(
    () => (order?.payment_status || "").toLowerCase() === "pending",
    [order?.payment_status]
  );

  const paymentIsCancelled = useMemo(
    () => (order?.payment_status || "").toLowerCase() === "cancelled",
    [order?.payment_status]
  );

  const paymentIsFailed = useMemo(
    () => (order?.payment_status || "").toLowerCase() === "failed",
    [order?.payment_status]
  );

  const orderStatus = useMemo(
    () => (order?.status || "pending").toLowerCase(),
    [order?.status]
  );

  const isOrderCancelled = useMemo(
    () => orderStatus === "cancelled",
    [orderStatus]
  );

  const canRetryPayment = useMemo(() => {
    if (!order) return false;

    const method = (order.payment_method || "").toLowerCase();
    const status = (order.payment_status || "").toLowerCase();

    return method === "card" && ["pending", "failed", "cancelled", ""].includes(status);
  }, [order]);

  const currentTimelineIndex = useMemo(() => {
    const idx = TIMELINE_STEPS.findIndex((step) => step.key === orderStatus);
    return idx === -1 ? 0 : idx;
  }, [orderStatus]);

  const fetchOrder = async (showRefreshToast = false) => {
    if (!orderId) return;

    try {
      if (!loading) setRefreshing(true);

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(
          `
            id,
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
            created_at
          `
        )
        .eq("id", orderId)
        .single();

      if (orderError) throw orderError;

      const { data: itemData, error: itemsError } = await supabase
        .from("order_items")
        .select("id, product_name, quantity, unit_price, total_price")
        .eq("order_id", orderId)
        .order("id", { ascending: true });

      if (itemsError) throw itemsError;

      setOrder(orderData as OrderRecord);
      setItems((itemData || []) as OrderItemRecord[]);

      if (showRefreshToast) {
        toast.success("Order status refreshed");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to load order");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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
  }, [orderId]);

  const handleRetryPayment = async () => {
    if (!order) return;

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
        <div className="inline-flex items-center gap-2 rounded-full bg-green-100 text-green-700 px-3 py-1 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Paid
        </div>
      );
    }

    if (paymentIsFailed) {
      return (
        <div className="inline-flex items-center gap-2 rounded-full bg-red-100 text-red-700 px-3 py-1 text-sm font-medium">
          <XCircle className="w-4 h-4" />
          Failed
        </div>
      );
    }

    if (paymentIsCancelled) {
      return (
        <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 text-orange-700 px-3 py-1 text-sm font-medium">
          <XCircle className="w-4 h-4" />
          Cancelled
        </div>
      );
    }

    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-sm font-medium">
        <Clock3 className="w-4 h-4" />
        Pending
      </div>
    );
  };

  const orderBadge = () => {
    const status = (order?.status || "pending").toLowerCase();

    const map: Record<string, string> = {
      pending: "bg-amber-100 text-amber-700",
      confirmed: "bg-blue-100 text-blue-700",
      preparing: "bg-purple-100 text-purple-700",
      on_the_way: "bg-indigo-100 text-indigo-700",
      delivered: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700",
    };

    return (
      <div className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${map[status] || "bg-muted text-foreground"}`}>
        {status.replace(/_/g, " ")}
      </div>
    );
  };

  const timelineStepClasses = (index: number) => {
    if (isOrderCancelled) {
      return {
        iconWrap: "bg-muted text-muted-foreground border-border",
        title: "text-muted-foreground",
        desc: "text-muted-foreground",
        line: "bg-border",
      };
    }

    if (index < currentTimelineIndex) {
      return {
        iconWrap: "bg-green-100 text-green-700 border-green-200",
        title: "text-foreground",
        desc: "text-muted-foreground",
        line: "bg-green-500",
      };
    }

    if (index === currentTimelineIndex) {
      return {
        iconWrap: "bg-primary/15 text-primary border-primary/30",
        title: "text-foreground",
        desc: "text-muted-foreground",
        line: "bg-border",
      };
    }

    return {
      iconWrap: "bg-muted text-muted-foreground border-border",
      title: "text-muted-foreground",
      desc: "text-muted-foreground",
      line: "bg-border",
    };
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <div className="container py-16">
          <div className="max-w-xl mx-auto text-center bg-card border border-border rounded-2xl p-8">
            <h1 className="text-3xl font-bold text-foreground mb-3">Order not found</h1>
            <p className="text-muted-foreground mb-6">
              We could not find that order.
            </p>
            <button
              onClick={() => navigate("/menu")}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              Back to Menu
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <div className="container py-8 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-4xl text-foreground">Track Order</h1>
            <p className="text-muted-foreground mt-1">Order ID: {order.id}</p>
          </div>

          <button
            onClick={() => fetchOrder(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Order Status</h2>
                  <p className="text-sm text-muted-foreground">
                    Created on {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>
                {orderBadge()}
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                  Delivery Timeline
                </h3>

                {isOrderCancelled ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-700">Order Cancelled</p>
                        <p className="text-sm text-red-600 mt-1">
                          This order has been cancelled and will not continue through the delivery process.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {TIMELINE_STEPS.map((step, index) => {
                      const Icon = step.icon;
                      const styles = timelineStepClasses(index);
                      const isLast = index === TIMELINE_STEPS.length - 1;

                      return (
                        <div key={step.key} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-11 h-11 rounded-full border flex items-center justify-center ${styles.iconWrap}`}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            {!isLast && <div className={`w-0.5 flex-1 min-h-[34px] ${styles.line}`} />}
                          </div>

                          <div className="pb-8">
                            <p className={`font-medium ${styles.title}`}>{step.label}</p>
                            <p className={`text-sm mt-1 ${styles.desc}`}>{step.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-muted-foreground mb-1">Customer</p>
                  <p className="font-medium text-foreground">{order.customer_name}</p>
                  {order.customer_phone && <p className="text-foreground">{order.customer_phone}</p>}
                  {order.customer_email && <p className="text-foreground">{order.customer_email}</p>}
                </div>

                <div className="rounded-xl border border-border p-4">
                  <p className="text-muted-foreground mb-1">Delivery Address</p>
                  <div className="flex items-start gap-2">
                    <MapPinned className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="font-medium text-foreground whitespace-pre-line">
                      {order.delivery_address || "No address provided"}
                    </p>
                  </div>
                </div>
              </div>

              {order.notes && (
                <div className="mt-4 rounded-xl border border-border p-4 text-sm">
                  <p className="text-muted-foreground mb-1">Notes</p>
                  <p className="text-foreground">{order.notes}</p>
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-foreground mb-5">Payment</h2>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                {paymentBadge()}

                {canRetryPayment && !paymentIsPaid && (
                  <button
                    onClick={handleRetryPayment}
                    disabled={retryingPayment}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {retryingPayment ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4" />
                    )}
                    {retryingPayment ? "Starting payment..." : "Retry Payment"}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-muted-foreground mb-1">Payment Method</p>
                  <p className="font-medium text-foreground">{order.payment_method || "N/A"}</p>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <p className="text-muted-foreground mb-1">Payment Provider</p>
                  <p className="font-medium text-foreground">{order.payment_provider || "N/A"}</p>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <p className="text-muted-foreground mb-1">Payment Reference</p>
                  <p className="font-medium text-foreground break-all">
                    {order.payment_reference || "Not available yet"}
                  </p>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <p className="text-muted-foreground mb-1">Amount</p>
                  <p className="font-medium text-foreground">R{Number(order.total || 0).toFixed(2)}</p>
                </div>
              </div>

              {!paymentIsPaid && canRetryPayment && (
                <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                  This order is not fully paid yet. You can restart the PayFast payment using the button above.
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-2xl p-6 sticky top-24">
              <h2 className="text-xl font-semibold text-foreground mb-5">Order Summary</h2>

              <div className="space-y-3 mb-5">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items found for this order.</p>
                ) : (
                  items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium text-foreground">{item.product_name}</p>
                        <p className="text-muted-foreground">
                          {item.quantity} × R{Number(item.unit_price).toFixed(2)}
                        </p>
                      </div>
                      <p className="font-medium text-foreground">
                        R{Number(item.total_price).toFixed(2)}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-border pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">R{Number(order.subtotal || 0).toFixed(2)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="text-foreground">R{Number(order.delivery_fee || 0).toFixed(2)}</span>
                </div>

                {!!Number(order.discount_amount || 0) && (
                  <div className="flex justify-between text-green-700">
                    <span>Discount</span>
                    <span>-R{Number(order.discount_amount || 0).toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
                  <span className="text-foreground">Total</span>
                  <span className="text-primary">R{Number(order.total || 0).toFixed(2)}</span>
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