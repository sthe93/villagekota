import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Package, ShoppingBag, Plus, Pencil, Trash2, X } from "lucide-react";
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
  created_at: string;
  notes: string | null;
}

interface Category {
  id: string;
  name: string;
}

const ORDER_STATUSES = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"];

export default function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"products" | "orders">("orders");
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingProduct, setEditingProduct] = useState<Partial<DbProduct> | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/");
      toast.error("Admin access required");
    }
  }, [user, isAdmin, loading]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchProducts();
    fetchOrders();
    fetchCategories();
  }, [isAdmin]);

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("name");
    setProducts(data || []);
  };

  const fetchOrders = async () => {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders(data || []);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("id, name").order("sort_order");
    setCategories(data || []);
  };

  const handleSaveProduct = async () => {
    if (!editingProduct?.name || !editingProduct?.price) {
      toast.error("Name and price required");
      return;
    }
    const payload = {
      name: editingProduct.name,
      description: editingProduct.description || null,
      price: editingProduct.price,
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
    setShowForm(false);
    setEditingProduct(null);
    fetchProducts();
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); fetchProducts(); }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) toast.error(error.message);
    else { toast.success("Status updated"); fetchOrders(); }
  };

  const statusColors: Record<string, string> = {
    pending: "bg-accent/20 text-accent-foreground",
    confirmed: "bg-primary/10 text-primary",
    preparing: "bg-primary/20 text-primary",
    out_for_delivery: "bg-success/20 text-success",
    delivered: "bg-success/10 text-success",
    cancelled: "bg-destructive/10 text-destructive",
  };

  if (loading || !isAdmin) return null;

  return (
    <div>
      <div className="container py-8">
        <h1 className="font-display text-5xl text-foreground text-center mb-8">ADMIN DASHBOARD</h1>

        <div className="flex gap-2 mb-8 justify-center">
          {([
            { key: "orders", label: "Orders", icon: ShoppingBag },
            { key: "products", label: "Products", icon: Package },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-border"
              }`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* Orders Tab */}
        {tab === "orders" && (
          <div className="space-y-3 max-w-4xl mx-auto">
            {orders.length === 0 ? (
              <p className="text-center text-muted-foreground py-16">No orders yet</p>
            ) : orders.map((o) => (
              <div key={o.id} className="bg-card rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-medium text-foreground">{o.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{o.customer_phone} · {o.customer_email || "—"}</p>
                    <p className="text-xs text-muted-foreground mt-1">{o.delivery_address}</p>
                    {o.notes && <p className="text-xs text-muted-foreground italic mt-1">Note: {o.notes}</p>}
                  </div>
                  <div className="text-right">
                    <span className="font-display text-xl text-primary">R{o.total}</span>
                    <p className="text-xs text-muted-foreground">{o.payment_method} · {new Date(o.created_at).toLocaleDateString("en-ZA")}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ORDER_STATUSES.map((s) => (
                    <button key={s} onClick={() => handleUpdateOrderStatus(o.id, s)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                        o.status === s ? statusColors[s] : "bg-muted text-muted-foreground hover:bg-border"
                      }`}>
                      {s.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Products Tab */}
        {tab === "products" && (
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-end mb-4">
              <button onClick={() => { setEditingProduct({}); setShowForm(true); }}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                <Plus className="w-4 h-4" /> Add Product
              </button>
            </div>

            {/* Product Form Modal */}
            {showForm && editingProduct && (
              <div className="fixed inset-0 bg-secondary/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-card rounded-lg border border-border p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-2xl text-foreground">{editingProduct.id ? "EDIT PRODUCT" : "NEW PRODUCT"}</h3>
                    <button onClick={() => { setShowForm(false); setEditingProduct(null); }}><X className="w-5 h-5 text-muted-foreground" /></button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Name *</label>
                    <input type="text" value={editingProduct.name || ""} onChange={(e) => setEditingProduct(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-body" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Description</label>
                    <textarea value={editingProduct.description || ""} onChange={(e) => setEditingProduct(p => ({ ...p, description: e.target.value }))}
                      rows={2} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-body resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Price (R) *</label>
                      <input type="number" value={editingProduct.price || ""} onChange={(e) => setEditingProduct(p => ({ ...p, price: parseFloat(e.target.value) }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-body" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Category</label>
                      <select value={editingProduct.category_id || ""} onChange={(e) => setEditingProduct(p => ({ ...p, category_id: e.target.value || null }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-body">
                        <option value="">None</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Spice Level (0-5)</label>
                      <input type="number" min={0} max={5} value={editingProduct.spice_level ?? 0} onChange={(e) => setEditingProduct(p => ({ ...p, spice_level: parseInt(e.target.value) }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-body" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Image URL</label>
                      <input type="text" value={editingProduct.image_url || ""} onChange={(e) => setEditingProduct(p => ({ ...p, image_url: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-body" />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    {[
                      { key: "is_available", label: "Available" },
                      { key: "is_featured", label: "Featured" },
                      { key: "is_popular", label: "Popular" },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-foreground">
                        <input type="checkbox" checked={(editingProduct as any)[key] ?? (key === "is_available")}
                          onChange={(e) => setEditingProduct(p => ({ ...p, [key]: e.target.checked }))}
                          className="rounded border-border" />
                        {label}
                      </label>
                    ))}
                  </div>
                  <button onClick={handleSaveProduct}
                    className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity">
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
                      {!p.is_available && <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">Unavailable</span>}
                      {p.is_featured && <span className="text-xs bg-accent/20 text-accent-foreground px-2 py-0.5 rounded">Featured</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="font-display text-lg text-primary">R{p.price}</span>
                    <button onClick={() => { setEditingProduct(p); setShowForm(true); }}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                    <button onClick={() => handleDeleteProduct(p.id)}
                      className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"><Trash2 className="w-4 h-4 text-destructive" /></button>
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
