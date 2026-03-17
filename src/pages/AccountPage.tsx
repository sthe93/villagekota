import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { User, Package, Heart, LogOut, Shield } from "lucide-react";
import Footer from "@/components/Footer";

interface Order {
  id: string;
  status: string;
  total: number;
  created_at: string;
  customer_name: string;
}

interface Favorite {
  id: string;
  product_id: string;
  products: { name: string; price: number; image_url: string } | null;
}

export default function AccountPage() {
  const { user, profile, signOut, refreshProfile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"profile" | "orders" | "favorites">("profile");
  const [orders, setOrders] = useState<Order[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [editForm, setEditForm] = useState({ display_name: "", phone: "", default_address: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    if (profile) {
      setEditForm({
        display_name: profile.display_name || "",
        phone: profile.phone || "",
        default_address: profile.default_address || "",
      });
    }
  }, [user, profile]);

  useEffect(() => {
    if (!user) return;
    if (tab === "orders") {
      supabase.from("orders").select("id, status, total, created_at, customer_name")
        .eq("user_id", user.id).order("created_at", { ascending: false })
        .then(({ data }) => setOrders(data || []));
    }
    if (tab === "favorites") {
      supabase.from("favorites").select("id, product_id, products:product_id(name, price, image_url)")
        .eq("user_id", user.id)
        .then(({ data }) => setFavorites((data as any) || []));
    }
  }, [tab, user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(editForm).eq("user_id", user.id);
    if (error) toast.error("Failed to save");
    else { toast.success("Profile updated"); await refreshProfile(); }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
    toast.success("Signed out");
  };

  const statusColors: Record<string, string> = {
    pending: "bg-accent/20 text-accent-foreground",
    confirmed: "bg-primary/10 text-primary",
    preparing: "bg-primary/20 text-primary",
    out_for_delivery: "bg-success/20 text-success",
    delivered: "bg-success/10 text-success",
    cancelled: "bg-destructive/10 text-destructive",
  };

  if (!user) return null;

  return (
    <div>
      <div className="container py-8 max-w-3xl">
        <h1 className="font-display text-5xl text-foreground text-center mb-8">MY ACCOUNT</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 justify-center">
          {([
            { key: "profile", label: "Profile", icon: User },
            { key: "orders", label: "Orders", icon: Package },
            { key: "favorites", label: "Favorites", icon: Heart },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-border"
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <div className="bg-card rounded-lg border border-border p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Display Name</label>
              <input type="text" value={editForm.display_name} onChange={(e) => setEditForm(f => ({ ...f, display_name: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-body" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Phone</label>
              <input type="tel" value={editForm.phone} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-body" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Default Delivery Address</label>
              <textarea value={editForm.default_address} onChange={(e) => setEditForm(f => ({ ...f, default_address: e.target.value }))}
                rows={2} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-body resize-none" />
            </div>
           <div className="flex gap-3 flex-wrap">
  <button
    onClick={handleSaveProfile}
    disabled={saving}
    className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
  >
    {saving ? "Saving..." : "Save Profile"}
  </button>

  {isAdmin && (
    <button
      onClick={() => navigate("/admin/orders")}
      className="flex items-center gap-2 px-6 py-2.5 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
    >
      <Shield className="w-4 h-4" />
      Admin Orders
    </button>
  )}

  <button
    onClick={handleSignOut}
    className="flex items-center gap-2 px-6 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
  >
    <LogOut className="w-4 h-4" /> Sign Out
  </button>
</div>
          </div>
        )}

        {tab === "orders" && (
          <div className="space-y-3">
            {orders.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No orders yet</p>
              </div>
            ) : orders.map((o) => (
              <div key={o.id} onClick={() => navigate(`/order-tracking/${o.id}`)}
                className="bg-card rounded-lg border border-border p-4 flex items-center justify-between cursor-pointer hover:border-primary/30 transition-colors">
                <div>
                  <p className="font-medium text-foreground text-sm">{o.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize ${statusColors[o.status] || "bg-muted text-muted-foreground"}`}>
                    {o.status.replace("_", " ")}
                  </span>
                  <span className="font-display text-lg text-primary">R{o.total}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "favorites" && (
          <div className="space-y-3">
            {favorites.length === 0 ? (
              <div className="text-center py-16">
                <Heart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No favorites yet</p>
              </div>
            ) : favorites.map((f) => (
              <div key={f.id} className="bg-card rounded-lg border border-border p-4 flex items-center justify-between">
                <p className="font-medium text-foreground text-sm">{f.products?.name || "Unknown"}</p>
                <span className="font-display text-lg text-primary">R{f.products?.price || 0}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
