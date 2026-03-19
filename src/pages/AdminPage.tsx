import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Package,
  ShoppingBag,
  Plus,
  Pencil,
  Trash2,
  X,
  LayoutDashboard,
  Tags,
  TicketPercent,
  Users,
  Bike,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import Footer from "@/components/Footer";

interface DbProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string | null;
  image_url: string | null;
  spice_level: number;
  is_available: boolean;
  is_featured: boolean;
  is_popular: boolean;
  rating: number;
  review_count: number;
}

interface DbOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_address: string;
  status: string;
  total: number;
  payment_method: string;
  payment_status: string | null;
  payment_provider: string | null;
  created_at: string;
  notes: string | null;
}

interface Category {
  id: string;
  name: string;
  sort_order?: number | null;
}

interface Voucher {
  id: string;
  code: string;
  type: string;
  value: number;
  balance: number | null;
  min_order: number | null;
  max_uses: number | null;
  used_count: number | null;
  expires_at: string | null;
  is_active: boolean;
}

interface Driver {
  id: string;
  name: string;
  phone: string | null;
  is_active: boolean;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  total_price: number;
  created_at?: string | null;
}

interface CustomerSummary {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string;
}

interface SalesPoint {
  label: string;
  revenue: number;
  orders: number;
}

interface TopItem {
  name: string;
  qty: number;
  revenue: number;
}

type AdminTab =
  | "dashboard"
  | "orders"
  | "products"
  | "categories"
  | "vouchers"
  | "customers"
  | "drivers";

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "on_the_way",
  "delivered",
  "cancelled",
];

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  preparing: "bg-purple-100 text-purple-700",
  on_the_way: "bg-indigo-100 text-indigo-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const currency = (value: number) => `R${Number(value || 0).toFixed(2)}`;

const formatDayLabel = (date: Date) =>
  date.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });

export default function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<AdminTab>("dashboard");

  const [products, setProducts] = useState<DbProduct[]>([]);
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([]);

  const [editingProduct, setEditingProduct] = useState<Partial<DbProduct> | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [editingVoucher, setEditingVoucher] = useState<Partial<Voucher> | null>(null);
  const [editingDriver, setEditingDriver] = useState<Partial<Driver> | null>(null);

  const [showProductForm, setShowProductForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showVoucherForm, setShowVoucherForm] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);

  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/");
      toast.error("Admin access required");
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchAll();
  }, [isAdmin]);

  const fetchAll = async () => {
    setPageLoading(true);
    await Promise.all([
      fetchProducts(),
      fetchOrders(),
      fetchCategories(),
      fetchVouchers(),
      fetchDrivers(),
      fetchOrderItems(),
    ]);
    setPageLoading(false);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase.from("products").select("*").order("name");
    if (error) toast.error(error.message);
    setProducts((data || []) as DbProduct[]);
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setOrders((data || []) as DbOrder[]);
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    setCategories((data || []) as Category[]);
  };

  const fetchVouchers = async () => {
    const { data, error } = await supabase
      .from("vouchers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setVouchers((data || []) as Voucher[]);
  };

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from("drivers")
      .select("id, name, phone, is_active")
      .order("name");
    if (error) toast.error(error.message);
    setDrivers((data || []) as Driver[]);
  };

  const fetchOrderItems = async () => {
    const { data, error } = await supabase
      .from("order_items")
      .select("id, order_id, product_name, quantity, total_price, created_at");
    if (error) toast.error(error.message);
    setOrderItems((data || []) as OrderItemRow[]);
  };

  const handleSaveProduct = async () => {
    if (!editingProduct?.name || editingProduct.price == null) {
      toast.error("Name and price required");
      return;
    }

    const payload = {
      name: editingProduct.name,
      description: editingProduct.description || null,
      price: Number(editingProduct.price),
      category_id: editingProduct.category_id || null,
      image_url: editingProduct.image_url || "/placeholder.svg",
      spice_level: editingProduct.spice_level || 0,
      is_available: editingProduct.is_available ?? true,
      is_featured: editingProduct.is_featured ?? false,
      is_popular: editingProduct.is_popular ?? false,
    };

    if (editingProduct.id) {
      const { error } = await supabase.from("products").update(payload).eq("id", editingProduct.id);
      if (error) toast.error(error.message);
      else toast.success("Product updated");
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) toast.error(error.message);
      else toast.success("Product added");
    }

    setShowProductForm(false);
    setEditingProduct(null);
    fetchProducts();
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Product deleted");
      fetchProducts();
    }
  };

  const handleSaveCategory = async () => {
    if (!editingCategory?.name) {
      toast.error("Category name required");
      return;
    }

    const payload = {
      name: editingCategory.name,
      sort_order: Number(editingCategory.sort_order || 0),
    };

    if (editingCategory.id) {
      const { error } = await supabase.from("categories").update(payload).eq("id", editingCategory.id);
      if (error) toast.error(error.message);
      else toast.success("Category updated");
    } else {
      const { error } = await supabase.from("categories").insert(payload);
      if (error) toast.error(error.message);
      else toast.success("Category added");
    }

    setShowCategoryForm(false);
    setEditingCategory(null);
    fetchCategories();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Category deleted");
      fetchCategories();
    }
  };

  const handleSaveVoucher = async () => {
    if (!editingVoucher?.code || !editingVoucher?.type || editingVoucher.value == null) {
      toast.error("Code, type and value are required");
      return;
    }

    const payload = {
      code: editingVoucher.code.toUpperCase(),
      type: editingVoucher.type,
      value: Number(editingVoucher.value),
      balance: editingVoucher.balance != null ? Number(editingVoucher.balance) : 0,
      min_order: editingVoucher.min_order != null ? Number(editingVoucher.min_order) : null,
      max_uses: editingVoucher.max_uses != null ? Number(editingVoucher.max_uses) : null,
      expires_at: editingVoucher.expires_at || null,
      is_active: editingVoucher.is_active ?? true,
    };

    if (editingVoucher.id) {
      const { error } = await supabase.from("vouchers").update(payload).eq("id", editingVoucher.id);
      if (error) toast.error(error.message);
      else toast.success("Voucher updated");
    } else {
      const { error } = await supabase.from("vouchers").insert(payload);
      if (error) toast.error(error.message);
      else toast.success("Voucher created");
    }

    setShowVoucherForm(false);
    setEditingVoucher(null);
    fetchVouchers();
  };

  const handleDeleteVoucher = async (id: string) => {
    if (!confirm("Delete this voucher?")) return;
    const { error } = await supabase.from("vouchers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Voucher deleted");
      fetchVouchers();
    }
  };

  const handleSaveDriver = async () => {
    if (!editingDriver?.name) {
      toast.error("Driver name required");
      return;
    }

    const payload = {
      name: editingDriver.name,
      phone: editingDriver.phone || null,
      is_active: editingDriver.is_active ?? true,
    };

    if (editingDriver.id) {
      const { error } = await supabase.from("drivers").update(payload).eq("id", editingDriver.id);
      if (error) toast.error(error.message);
      else toast.success("Driver updated");
    } else {
      const { error } = await supabase.from("drivers").insert(payload);
      if (error) toast.error(error.message);
      else toast.success("Driver added");
    }

    setShowDriverForm(false);
    setEditingDriver(null);
    fetchDrivers();
  };

  const handleDeleteDriver = async (id: string) => {
    if (!confirm("Delete this driver?")) return;
    const { error } = await supabase.from("drivers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Driver deleted");
      fetchDrivers();
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) toast.error(error.message);
    else {
      toast.success("Status updated");
      fetchOrders();
    }
  };

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);

  const dashboardStats = useMemo(() => {
    const todayOrders = orders.filter((o) => o.created_at.slice(0, 10) === todayKey);
    const totalOrdersToday = todayOrders.length;
    const pendingOrders = orders.filter((o) => o.status === "pending").length;
    const activeDrivers = drivers.filter((d) => d.is_active).length;

    const revenueToday = todayOrders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    return {
      totalOrdersToday,
      revenueToday,
      activeDrivers,
      pendingOrders,
    };
  }, [orders, drivers, todayKey]);

  const salesData = useMemo<SalesPoint[]>(() => {
    const points: SalesPoint[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);

      const dayOrders = orders.filter(
        (o) => o.created_at.slice(0, 10) === key && o.status !== "cancelled"
      );

      points.push({
        label: formatDayLabel(d),
        orders: dayOrders.length,
        revenue: dayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0),
      });
    }

    return points;
  }, [orders]);

  const orderItemsByOrderId = useMemo(() => {
  const grouped: Record<string, OrderItemRow[]> = {};

  orderItems.forEach((item) => {
    if (!grouped[item.order_id]) {
      grouped[item.order_id] = [];
    }
    grouped[item.order_id].push(item);
  });

  return grouped;
}, [orderItems]);

  const topSellingItems = useMemo<TopItem[]>(() => {
    const map = new Map<string, TopItem>();

    orderItems.forEach((item) => {
      const existing = map.get(item.product_name);
      if (existing) {
        existing.qty += Number(item.quantity || 0);
        existing.revenue += Number(item.total_price || 0);
      } else {
        map.set(item.product_name, {
          name: item.product_name,
          qty: Number(item.quantity || 0),
          revenue: Number(item.total_price || 0),
        });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);
  }, [orderItems]);

  const customers = useMemo<CustomerSummary[]>(() => {
    const map = new Map<string, CustomerSummary>();

    orders.forEach((o) => {
      const key = o.customer_email || o.customer_phone || o.id;
      const existing = map.get(key);

      if (existing) {
        existing.totalOrders += 1;
        existing.totalSpent += Number(o.total || 0);
        if (new Date(o.created_at) > new Date(existing.lastOrderAt)) {
          existing.lastOrderAt = o.created_at;
        }
      } else {
        map.set(key, {
          key,
          name: o.customer_name,
          email: o.customer_email,
          phone: o.customer_phone,
          totalOrders: 1,
          totalSpent: Number(o.total || 0),
          lastOrderAt: o.created_at,
        });
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime()
    );
  }, [orders]);

  const maxRevenue = Math.max(...salesData.map((s) => s.revenue), 1);

  if (loading || pageLoading || !isAdmin) return null;

  return (
    <div>
      <div className="container py-8">
        <h1 className="font-display text-5xl text-foreground text-center mb-8">ADMIN DASHBOARD</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-lg p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Total Orders Today</p>
            <p className="font-display text-3xl text-foreground">{dashboardStats.totalOrdersToday}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Revenue Today</p>
            <p className="font-display text-3xl text-primary">{currency(dashboardStats.revenueToday)}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Active Drivers</p>
            <p className="font-display text-3xl text-foreground">{dashboardStats.activeDrivers}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Pending Orders</p>
            <p className="font-display text-3xl text-foreground">{dashboardStats.pendingOrders}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {([
            { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { key: "orders", label: "Orders", icon: ShoppingBag },
            { key: "products", label: "Products", icon: Package },
            { key: "categories", label: "Categories", icon: Tags },
            { key: "vouchers", label: "Vouchers", icon: TicketPercent },
            { key: "customers", label: "Customers", icon: Users },
            { key: "drivers", label: "Drivers", icon: Bike },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-border"
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {tab === "dashboard" && (
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h2 className="font-display text-2xl text-foreground">Sales Chart</h2>
                </div>

                <div className="space-y-4">
                  {salesData.map((point) => (
                    <div key={point.label}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-foreground">{point.label}</span>
                        <span className="text-muted-foreground">
                          {currency(point.revenue)} · {point.orders} orders
                        </span>
                      </div>
                      <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(point.revenue / maxRevenue) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-5">
                <h2 className="font-display text-2xl text-foreground mb-4">Top-Selling Items</h2>
                <div className="space-y-3">
                  {topSellingItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sales data yet.</p>
                  ) : (
                    topSellingItems.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {index + 1}. {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{item.qty} sold</p>
                        </div>
                        <span className="text-sm font-medium text-primary">{currency(item.revenue)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <h2 className="font-display text-2xl text-foreground mb-4">Recent Orders</h2>
              <div className="space-y-3">
                {orders.slice(0, 6).map((o) => (
                  <div key={o.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border border-border rounded-lg p-4">
                    <div>
                      <p className="font-medium text-foreground">{o.customer_name}</p>
                      <p className="text-xs text-muted-foreground">
                        #{o.id.slice(0, 8).toUpperCase()} · {new Date(o.created_at).toLocaleString("en-ZA")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${statusColors[o.status] || "bg-muted text-muted-foreground"}`}>
                        {o.status.replace("_", " ")}
                      </span>
                      <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                        {currency(o.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "orders" && (
  <div className="space-y-3 max-w-5xl mx-auto">
    {orders.length === 0 ? (
      <p className="text-center text-muted-foreground py-16">No orders yet</p>
    ) : (
      orders.map((o) => {
        const itemsForOrder = orderItemsByOrderId[o.id] || [];

        return (
          <div key={o.id} className="bg-card rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-medium text-foreground">{o.customer_name}</p>
                <p className="text-xs text-muted-foreground">
                  {o.customer_phone} · {o.customer_email || "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{o.delivery_address}</p>
                {o.notes && (
                  <p className="text-xs text-muted-foreground italic mt-1">
                    Note: {o.notes}
                  </p>
                )}
              </div>

              <div className="text-right">
                <span className="font-display text-xl text-primary">{currency(o.total)}</span>
                <p className="text-xs text-muted-foreground">
                  {o.payment_method} · {o.payment_status || "pending"} ·{" "}
                  {new Date(o.created_at).toLocaleDateString("en-ZA")}
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-lg border border-border bg-background/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Order Items</h3>
                <span className="text-xs text-muted-foreground">
                  {itemsForOrder.length} item{itemsForOrder.length === 1 ? "" : "s"}
                </span>
              </div>

              {itemsForOrder.length === 0 ? (
                <p className="text-sm text-muted-foreground">No order items found.</p>
              ) : (
                <div className="space-y-2">
                  {itemsForOrder.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {item.product_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Qty: {item.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-primary whitespace-nowrap">
                        {currency(item.total_price)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {ORDER_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleUpdateOrderStatus(o.id, s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                    o.status === s
                      ? statusColors[s]
                      : "bg-muted text-muted-foreground hover:bg-border"
                  }`}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
        );
      })
    )}
  </div>
)}

        {tab === "products" && (
          <div className="max-w-5xl mx-auto">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => {
                  setEditingProduct({});
                  setShowProductForm(true);
                }}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" /> Add Product
              </button>
            </div>

            {showProductForm && editingProduct && (
              <div className="fixed inset-0 bg-secondary/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-card rounded-lg border border-border p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-2xl text-foreground">
                      {editingProduct.id ? "EDIT PRODUCT" : "NEW PRODUCT"}
                    </h3>
                    <button
                      onClick={() => {
                        setShowProductForm(false);
                        setEditingProduct(null);
                      }}
                    >
                      <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Name *</label>
                    <input
                      type="text"
                      value={editingProduct.name || ""}
                      onChange={(e) => setEditingProduct((p) => ({ ...p, name: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Description</label>
                    <textarea
                      value={editingProduct.description || ""}
                      onChange={(e) => setEditingProduct((p) => ({ ...p, description: e.target.value }))}
                      rows={2}
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Price *</label>
                      <input
                        type="number"
                        value={editingProduct.price || ""}
                        onChange={(e) => setEditingProduct((p) => ({ ...p, price: parseFloat(e.target.value) }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Category</label>
                      <select
                        value={editingProduct.category_id || ""}
                        onChange={(e) => setEditingProduct((p) => ({ ...p, category_id: e.target.value || null }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
                      >
                        <option value="">None</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Spice Level</label>
                      <input
                        type="number"
                        min={0}
                        max={5}
                        value={editingProduct.spice_level ?? 0}
                        onChange={(e) => setEditingProduct((p) => ({ ...p, spice_level: parseInt(e.target.value) }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Image URL</label>
                      <input
                        type="text"
                        value={editingProduct.image_url || ""}
                        onChange={(e) => setEditingProduct((p) => ({ ...p, image_url: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    {[
                      { key: "is_available", label: "Available" },
                      { key: "is_featured", label: "Featured" },
                      { key: "is_popular", label: "Popular" },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={(editingProduct as any)[key] ?? (key === "is_available")}
                          onChange={(e) => setEditingProduct((p) => ({ ...p, [key]: e.target.checked }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>

                  <button
                    onClick={handleSaveProduct}
                    className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
                  >
                    {editingProduct.id ? "Update Product" : "Add Product"}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {products.map((p) => (
                <div key={p.id} className="bg-card rounded-lg border border-border p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground text-sm truncate">{p.name}</p>
                      {!p.is_available && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Unavailable</span>
                      )}
                      {p.is_featured && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Featured</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="font-display text-lg text-primary">{currency(p.price)}</span>
                    <button
                      onClick={() => {
                        setEditingProduct(p);
                        setShowProductForm(true);
                      }}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(p.id)}
                      className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "categories" && (
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => {
                  setEditingCategory({});
                  setShowCategoryForm(true);
                }}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" /> Add Category
              </button>
            </div>

            {showCategoryForm && editingCategory && (
              <div className="fixed inset-0 bg-secondary/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-card rounded-lg border border-border p-6 w-full max-w-md space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-2xl text-foreground">
                      {editingCategory.id ? "EDIT CATEGORY" : "NEW CATEGORY"}
                    </h3>
                    <button
                      onClick={() => {
                        setShowCategoryForm(false);
                        setEditingCategory(null);
                      }}
                    >
                      <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Category name"
                    value={editingCategory.name || ""}
                    onChange={(e) => setEditingCategory((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
                  />

                  <input
                    type="number"
                    placeholder="Sort order"
                    value={editingCategory.sort_order || 0}
                    onChange={(e) => setEditingCategory((p) => ({ ...p, sort_order: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
                  />

                  <button
                    onClick={handleSaveCategory}
                    className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
                  >
                    {editingCategory.id ? "Update Category" : "Add Category"}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {categories.map((c) => (
                <div key={c.id} className="bg-card rounded-lg border border-border p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">Sort: {c.sort_order ?? 0}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingCategory(c);
                        setShowCategoryForm(true);
                      }}
                      className="p-2 rounded-lg hover:bg-muted"
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(c.id)}
                      className="p-2 rounded-lg hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "vouchers" && (
          <div className="max-w-5xl mx-auto">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => {
                  setEditingVoucher({ type: "discount_fixed", is_active: true });
                  setShowVoucherForm(true);
                }}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" /> Add Voucher
              </button>
            </div>

            {showVoucherForm && editingVoucher && (
              <div className="fixed inset-0 bg-secondary/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-card rounded-lg border border-border p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-2xl text-foreground">
                      {editingVoucher.id ? "EDIT VOUCHER" : "NEW VOUCHER"}
                    </h3>
                    <button
                      onClick={() => {
                        setShowVoucherForm(false);
                        setEditingVoucher(null);
                      }}
                    >
                      <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Code"
                      value={editingVoucher.code || ""}
                      onChange={(e) => setEditingVoucher((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
                    />
                    <select
                      value={editingVoucher.type || "discount_fixed"}
                      onChange={(e) => setEditingVoucher((p) => ({ ...p, type: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
                    >
                      <option value="discount_fixed">Fixed Discount</option>
                      <option value="discount_percentage">Percentage Discount</option>
                      <option value="prepaid">Prepaid</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="number"
                      placeholder="Value"
                      value={editingVoucher.value || ""}
                      onChange={(e) => setEditingVoucher((p) => ({ ...p, value: Number(e.target.value) }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Balance"
                      value={editingVoucher.balance || ""}
                      onChange={(e) => setEditingVoucher((p) => ({ ...p, balance: Number(e.target.value) }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="number"
                      placeholder="Minimum order"
                      value={editingVoucher.min_order || ""}
                      onChange={(e) => setEditingVoucher((p) => ({ ...p, min_order: Number(e.target.value) }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Max uses"
                      value={editingVoucher.max_uses || ""}
                      onChange={(e) => setEditingVoucher((p) => ({ ...p, max_uses: Number(e.target.value) }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
                    />
                  </div>

                  <input
                    type="datetime-local"
                    value={editingVoucher.expires_at ? new Date(editingVoucher.expires_at).toISOString().slice(0, 16) : ""}
                    onChange={(e) => setEditingVoucher((p) => ({ ...p, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
                  />

                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={editingVoucher.is_active ?? true}
                      onChange={(e) => setEditingVoucher((p) => ({ ...p, is_active: e.target.checked }))}
                    />
                    Active
                  </label>

                  <button
                    onClick={handleSaveVoucher}
                    className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
                  >
                    {editingVoucher.id ? "Update Voucher" : "Add Voucher"}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {vouchers.map((v) => (
                <div key={v.id} className="bg-card rounded-lg border border-border p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground">{v.code}</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${v.is_active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                        {v.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {v.type} · Value: {v.value} · Used: {v.used_count ?? 0}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingVoucher(v);
                        setShowVoucherForm(true);
                      }}
                      className="p-2 rounded-lg hover:bg-muted"
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleDeleteVoucher(v.id)}
                      className="p-2 rounded-lg hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "customers" && (
          <div className="max-w-5xl mx-auto space-y-2">
            {customers.length === 0 ? (
              <div className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground">
                No customers yet
              </div>
            ) : (
              customers.map((c) => (
                <div key={c.key} className="bg-card rounded-lg border border-border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.phone || "—"} · {c.email || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      Last order: {new Date(c.lastOrderAt).toLocaleString("en-ZA")}
                    </p>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div>
                      <p className="text-muted-foreground">Orders</p>
                      <p className="font-medium text-foreground">{c.totalOrders}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Spent</p>
                      <p className="font-medium text-primary">{currency(c.totalSpent)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "drivers" && (
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => {
                  setEditingDriver({ is_active: true });
                  setShowDriverForm(true);
                }}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" /> Add Driver
              </button>
            </div>

            {showDriverForm && editingDriver && (
              <div className="fixed inset-0 bg-secondary/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-card rounded-lg border border-border p-6 w-full max-w-md space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-2xl text-foreground">
                      {editingDriver.id ? "EDIT DRIVER" : "NEW DRIVER"}
                    </h3>
                    <button
                      onClick={() => {
                        setShowDriverForm(false);
                        setEditingDriver(null);
                      }}
                    >
                      <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Driver name"
                    value={editingDriver.name || ""}
                    onChange={(e) => setEditingDriver((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
                  />

                  <input
                    type="text"
                    placeholder="Phone"
                    value={editingDriver.phone || ""}
                    onChange={(e) => setEditingDriver((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm"
                  />

                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={editingDriver.is_active ?? true}
                      onChange={(e) => setEditingDriver((p) => ({ ...p, is_active: e.target.checked }))}
                    />
                    Active
                  </label>

                  <button
                    onClick={handleSaveDriver}
                    className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
                  >
                    {editingDriver.id ? "Update Driver" : "Add Driver"}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {drivers.map((d) => (
                <div key={d.id} className="bg-card rounded-lg border border-border p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{d.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${d.is_active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                        {d.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{d.phone || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingDriver(d);
                        setShowDriverForm(true);
                      }}
                      className="p-2 rounded-lg hover:bg-muted"
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleDeleteDriver(d.id)}
                      className="p-2 rounded-lg hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}