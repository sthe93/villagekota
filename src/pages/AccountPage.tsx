import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import {
  User,
  Package,
  Heart,
  LogOut,
  Shield,
  Truck,
  Navigation,
  Phone,
  Clock3,
  MapPin,
  ChevronRight,
} from "lucide-react";
import Footer from "@/components/Footer";
import {
  getAccountOrderStatusClass,
  getOrderStatusSummary,
  formatStatusLabel,
} from "@/lib/orderMeta";

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

interface DriverProfile {
  id: string;
  name: string;
  phone: string | null;
  is_active: boolean;
}

type AccountTab = "profile" | "orders" | "favorites" | "driver";

const inputClassName =
  "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 font-body";

export default function AccountPage() {
  const { user, profile, signOut, refreshProfile, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<AccountTab>("profile");
  const [orders, setOrders] = useState<Order[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [checkingDriver, setCheckingDriver] = useState(true);

  const [editForm, setEditForm] = useState({
    display_name: "",
    phone: "",
    default_address: "",
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (profile) {
      setEditForm({
        display_name: profile.display_name || "",
        phone: profile.phone || "",
        default_address: profile.default_address || "",
      });
    }
  }, [user, profile, navigate]);

  useEffect(() => {
    const loadDriverProfile = async () => {
      if (!user) {
        setDriverProfile(null);
        setCheckingDriver(false);
        return;
      }

      setCheckingDriver(true);

      const { data, error } = await supabase
        .from("drivers")
        .select("id, name, phone, is_active")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        toast.error(error.message || "Failed to load driver profile");
        setDriverProfile(null);
      } else {
        setDriverProfile((data as DriverProfile | null) || null);
      }

      setCheckingDriver(false);
    };

    loadDriverProfile();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    if (tab === "orders") {
      supabase
        .from("orders")
        .select("id, status, total, created_at, customer_name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => setOrders(data || []));
    }

    if (tab === "favorites") {
      supabase
        .from("favorites")
        .select("id, product_id, products:product_id(name, price, image_url)")
        .eq("user_id", user.id)
        .then(({ data }) => setFavorites((data as any) || []));
    }
  }, [tab, user]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update(editForm)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to save");
    } else {
      toast.success("Profile updated");
      await refreshProfile();
    }

    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
    toast.success("Signed out");
  };

  const isDriver = !!driverProfile;

  const tabs: Array<{ key: AccountTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: "profile", label: "Profile", icon: User },
    { key: "orders", label: "Orders", icon: Package },
    { key: "favorites", label: "Favorites", icon: Heart },
    ...(isDriver ? [{ key: "driver" as AccountTab, label: "Driver", icon: Truck }] : []),
  ];

  const recentOrdersStats = useMemo(() => {
    return {
      total: orders.length,
      active: orders.filter((o) =>
        ["pending", "confirmed", "preparing", "ready_for_delivery", "on_the_way", "arrived"].includes(o.status)
      ).length,
      delivered: orders.filter((o) => o.status === "delivered").length,
    };
  }, [orders]);

  if (!user) return null;

  return (
    <div>
      <div className="container max-w-5xl py-8">
        <h1 className="mb-8 text-center font-display text-5xl text-foreground">
          MY ACCOUNT
        </h1>

        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              disabled={checkingDriver && key === "driver"}
              className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors ${
                tab === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-border"
              } disabled:opacity-50`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}

          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="flex items-center gap-2 rounded-lg border border-primary px-5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <Shield className="h-4 w-4" />
              Admin
            </button>
          )}
        </div>

        {tab === "profile" && (
          <div className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Display Name
              </label>
              <input
                type="text"
                value={editForm.display_name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, display_name: e.target.value }))
                }
                className={inputClassName}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Phone
              </label>
              <input
                type="tel"
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, phone: e.target.value }))
                }
                className={inputClassName}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Default Delivery Address
              </label>
              <textarea
                value={editForm.default_address}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, default_address: e.target.value }))
                }
                rows={2}
                className="w-full resize-none rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 font-body"
              />
            </div>

            {isDriver && driverProfile && (
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">Driver Profile</p>
                </div>

                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">Driver name</p>
                    <p className="font-medium text-foreground">{driverProfile.name}</p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium text-foreground">{driverProfile.phone || "—"}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => navigate("/driver")}
                    className="inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <Navigation className="h-4 w-4" />
                    Open Driver Dashboard
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>

              {isAdmin && (
                <>
                  <button
                    onClick={() => navigate("/admin")}
                    className="flex items-center gap-2 rounded-lg border border-primary px-6 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <Shield className="h-4 w-4" />
                    Admin Dashboard
                  </button>

                  <button
                    onClick={() => navigate("/admin/orders")}
                    className="flex items-center gap-2 rounded-lg border border-primary px-6 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <Shield className="h-4 w-4" />
                    Admin Orders
                  </button>
                </>
              )}

              {isDriver && (
                <button
                  onClick={() => navigate("/driver")}
                  className="flex items-center gap-2 rounded-lg border border-primary px-6 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <Truck className="h-4 w-4" />
                  Driver Dashboard
                </button>
              )}

              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        )}

        {tab === "orders" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">My Orders</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Track your order history and open live delivery updates.
                  </p>
                </div>

                <button
                  onClick={() => setTab("profile")}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <User className="h-4 w-4" />
                  Back to Profile
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Orders</p>
                  <p className="mt-1 font-display text-2xl text-foreground">{recentOrdersStats.total}</p>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Active Orders</p>
                  <p className="mt-1 font-display text-2xl text-primary">{recentOrdersStats.active}</p>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Delivered</p>
                  <p className="mt-1 font-display text-2xl text-emerald-700">{recentOrdersStats.delivered}</p>
                </div>
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="py-16 text-center">
                <Package className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
                <p className="font-medium text-muted-foreground">No orders yet</p>
              </div>
            ) : (
              orders.map((o) => (
                <div
                  key={o.id}
                  onClick={() => navigate(`/order-tracking/${o.id}`)}
                  className="cursor-pointer rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-foreground">
                          {o.customer_name}
                        </p>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getAccountOrderStatusClass(
                            o.status
                          )}`}
                        >
                          {formatStatusLabel(o.status)}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        #{o.id.slice(0, 8).toUpperCase()} ·{" "}
                        {new Date(o.created_at).toLocaleDateString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>

                      <div className="mt-3 inline-flex items-start gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{getOrderStatusSummary(o.status)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 lg:justify-end">
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                        <p className="font-display text-2xl text-primary">R{o.total}</p>
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2.5 text-sm font-medium text-primary">
                        Track Order
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "favorites" && (
          <div className="space-y-3">
            {favorites.length === 0 ? (
              <div className="py-16 text-center">
                <Heart className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
                <p className="font-medium text-muted-foreground">No favorites yet</p>
              </div>
            ) : (
              favorites.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
                >
                  <p className="text-sm font-medium text-foreground">
                    {f.products?.name || "Unknown"}
                  </p>
                  <span className="font-display text-lg text-primary">
                    R{f.products?.price || 0}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "driver" && isDriver && driverProfile && (
          <div className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Driver Access</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your account is linked to an active driver profile.
                </p>
              </div>

              <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                Active Driver
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-4">
                <p className="mb-1 text-sm text-muted-foreground">Driver name</p>
                <p className="font-medium text-foreground">{driverProfile.name}</p>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="mb-1 text-sm text-muted-foreground">Driver phone</p>
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <Phone className="h-4 w-4 text-primary" />
                  {driverProfile.phone || "No phone number"}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
              Use the driver dashboard to accept deliveries, start trips, update live location,
              mark arrival, collect cash where needed, and complete orders.
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/driver")}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Truck className="h-4 w-4" />
                Open Driver Dashboard
              </button>

              <button
                onClick={() => setTab("profile")}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <User className="h-4 w-4" />
                Back to Profile
              </button>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}