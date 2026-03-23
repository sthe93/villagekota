import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
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
  Loader2,
  Bell,
  BellOff,
  Star,
  Home,
  Plus,
  RotateCcw,
  Trash2,
  Pencil,
  X,
} from "lucide-react";
import Footer from "@/components/Footer";
import AddressAutocompleteField from "@/components/AddressAutocompleteField";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchOrderTrackingSnapshot } from "@/features/order-tracking/api";
import OrderReviewDialog from "@/components/OrderReviewDialog";
import type { DriverInfo, OrderItemRecord, OrderRecord } from "@/features/order-tracking/types";
import { formatCurrency } from "@/features/order-tracking/utils";
import { useProducts } from "@/hooks/use-products";
import {
  getAccountOrderStatusClass,
  getOrderStatusSummary,
  formatStatusLabel,
} from "@/lib/orderMeta";
import {
  disablePushNotifications,
  getPushNotificationPermissionState,
  requestPushNotificationPermission,
} from "@/lib/pushNotifications";
import { geocodeSouthAfricaAddress } from "@/lib/maps";
import { buildReorderPlan } from "@/lib/reorder";
import {
  findDuplicateSavedAddress,
  getNextDefaultSavedAddress,
  normalizeSavedAddressLabel,
  normalizeSavedAddressText,
  sortSavedAddresses,
  type SavedAddressRecord,
} from "@/lib/savedAddresses";

interface Order {
  id: string;
  status: string;
  total: number;
  created_at: string;
  customer_name: string;
  payment_method: string | null;
  payment_status: string | null;
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
type OrderFilter = "all" | "active" | "completed" | "cancelled";

const inputClassName =
  "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 font-body";

export default function AccountPage() {
  const { user, profile, signOut, refreshProfile, isAdmin } = useAuth();
  const { addItem, setOpen } = useCart();
  const navigate = useNavigate();
  const { data: products = [], isLoading: loadingProducts } = useProducts();

  const [tab, setTab] = useState<AccountTab>("profile");
  const [orders, setOrders] = useState<Order[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [checkingDriver, setCheckingDriver] = useState(true);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddressRecord[]>([]);
  const [loadingSavedAddresses, setLoadingSavedAddresses] = useState(true);
  const [savingAddress, setSavingAddress] = useState(false);
  const [removingAddressId, setRemovingAddressId] = useState<string | null>(null);
  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(null);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    display_name: "",
    phone: "",
    default_address: "",
  });

  const [saving, setSaving] = useState(false);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItemRecord[]>([]);
  const [selectedOrderDriver, setSelectedOrderDriver] = useState<DriverInfo | null>(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [notificationsState, setNotificationsState] = useState(() => getPushNotificationPermissionState());
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState({
    label: "",
    address_text: "",
    is_default: false,
  });
  const [editingAddressForm, setEditingAddressForm] = useState({
    label: "",
    address_text: "",
  });

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
    setNotificationsState(getPushNotificationPermissionState());

    const onFocus = () => setNotificationsState(getPushNotificationPermissionState());
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, []);

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
    const loadSavedAddresses = async () => {
      if (!user) {
        setSavedAddresses([]);
        setLoadingSavedAddresses(false);
        return;
      }

      setLoadingSavedAddresses(true);

      const { data, error } = await supabase
        .from("saved_addresses")
        .select("id, label, address_text, destination_lat, destination_lng, is_default")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) {
        toast.error(error.message || "Failed to load saved addresses");
        setSavedAddresses([]);
      } else {
        setSavedAddresses(sortSavedAddresses((data as SavedAddressRecord[]) || []));
      }

      setLoadingSavedAddresses(false);
    };

    void loadSavedAddresses();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    if (tab === "orders") {
      supabase
        .from("orders")
        .select("id, status, total, created_at, customer_name, payment_method, payment_status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => setOrders(data || []));
    }

    if (tab === "favorites") {
      supabase
        .from("favorites")
        .select("id, product_id, products:product_id(name, price, image_url)")
        .eq("user_id", user.id)
        .then(({ data }) => setFavorites((data as Favorite[]) || []));
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

  const refreshSavedAddresses = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("saved_addresses")
      .select("id, label, address_text, destination_lat, destination_lng, is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) throw error;
    setSavedAddresses(sortSavedAddresses((data as SavedAddressRecord[]) || []));
  };

  const handleAddSavedAddress = async () => {
    if (!user) return;

    const label = normalizeSavedAddressLabel(newAddressForm.label);
    const addressText = normalizeSavedAddressText(newAddressForm.address_text);

    if (!label || !addressText) {
      toast.error("Add both a label and an address.");
      return;
    }

    if (findDuplicateSavedAddress(savedAddresses, addressText)) {
      toast.error("That delivery address is already saved.");
      return;
    }

    setSavingAddress(true);

    try {
      const destination = await geocodeSouthAfricaAddress(addressText);
      const payload = {
        user_id: user.id,
        label,
        address_text: addressText,
        destination_lat: destination?.lat ?? null,
        destination_lng: destination?.lng ?? null,
        is_default: newAddressForm.is_default,
      };

      const { error } = await supabase.from("saved_addresses").insert(payload);
      if (error) throw error;

      if (newAddressForm.is_default) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ default_address: addressText })
          .eq("user_id", user.id);

        if (profileError) throw profileError;
      }

      setNewAddressForm({ label: "", address_text: "", is_default: false });
      await Promise.all([refreshSavedAddresses(), refreshProfile()]);
      toast.success("Saved address added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save address");
    } finally {
      setSavingAddress(false);
    }
  };

  const beginEditSavedAddress = (address: SavedAddressRecord) => {
    setEditingAddressId(address.id);
    setEditingAddressForm({
      label: address.label,
      address_text: address.address_text,
    });
  };

  const cancelEditSavedAddress = () => {
    setEditingAddressId(null);
    setEditingAddressForm({
      label: "",
      address_text: "",
    });
  };

  const handleUpdateSavedAddress = async (address: SavedAddressRecord) => {
    if (!user) return;

    const label = normalizeSavedAddressLabel(editingAddressForm.label);
    const addressText = normalizeSavedAddressText(editingAddressForm.address_text);

    if (!label || !addressText) {
      toast.error("Add both a label and an address.");
      return;
    }

    if (findDuplicateSavedAddress(savedAddresses, addressText, address.id)) {
      toast.error("That delivery address is already saved.");
      return;
    }

    setSavingAddress(true);

    try {
      const destination = await geocodeSouthAfricaAddress(addressText);
      const { error } = await supabase
        .from("saved_addresses")
        .update({
          label,
          address_text: addressText,
          destination_lat: destination?.lat ?? null,
          destination_lng: destination?.lng ?? null,
        })
        .eq("id", address.id)
        .eq("user_id", user.id);

      if (error) throw error;

      if (address.is_default) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ default_address: addressText })
          .eq("user_id", user.id);

        if (profileError) throw profileError;
      }

      await Promise.all([refreshSavedAddresses(), refreshProfile()]);
      cancelEditSavedAddress();
      toast.success("Saved address updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update saved address");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleSetDefaultAddress = async (address: SavedAddressRecord) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("saved_addresses")
        .update({ is_default: true })
        .eq("id", address.id)
        .eq("user_id", user.id);

      if (error) throw error;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ default_address: address.address_text })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      await Promise.all([refreshSavedAddresses(), refreshProfile()]);
      toast.success(`${address.label} is now your default address.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update default address");
    }
  };

  const handleDeleteSavedAddress = async (address: SavedAddressRecord) => {
    if (!user) return;

    setRemovingAddressId(address.id);

    try {
      const { error } = await supabase
        .from("saved_addresses")
        .delete()
        .eq("id", address.id)
        .eq("user_id", user.id);

      if (error) throw error;

      const nextDefaultAddress = getNextDefaultSavedAddress(savedAddresses, address.id);

      if (address.is_default) {
        if (nextDefaultAddress) {
          const { error: nextDefaultError } = await supabase
            .from("saved_addresses")
            .update({ is_default: true })
            .eq("id", nextDefaultAddress.id)
            .eq("user_id", user.id);

          if (nextDefaultError) throw nextDefaultError;
        }

        const { error: profileError } = await supabase
          .from("profiles")
          .update({ default_address: nextDefaultAddress?.address_text || "" })
          .eq("user_id", user.id);

        if (profileError) throw profileError;
      }

      await Promise.all([refreshSavedAddresses(), refreshProfile()]);
      toast.success("Saved address removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove saved address");
    } finally {
      setRemovingAddressId(null);
    }
  };

  const handleReorder = async (orderId: string) => {
    if (loadingProducts) {
      toast.error("Menu items are still loading. Please try reorder again in a moment.");
      return;
    }

    setReorderingOrderId(orderId);

    try {
      const snapshot = await fetchOrderTrackingSnapshot(orderId);
      const { lines, restoredCount, skippedCount } = buildReorderPlan(snapshot.items, products);

      lines.forEach((line) => {
        addItem(line.product, {
          quantity: line.quantity,
          note: line.note,
          selectedOptions: line.selectedOptions,
          optionsTotal: line.optionsTotal,
          finalUnitPrice: line.finalUnitPrice,
        });
      });

      if (restoredCount === 0) {
        toast.error("None of the items from this order are currently available.");
        return;
      }

      setOpen(true);
      navigate("/checkout");

      if (skippedCount > 0) {
        toast.success(`Added ${restoredCount} item(s) to your cart. ${skippedCount} item(s) were unavailable.`);
      } else {
        toast.success(`Added ${restoredCount} item(s) back to your cart.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reorder this order");
    } finally {
      setReorderingOrderId(null);
    }
  };


  const handleEnableNotifications = async () => {
    setNotificationsSaving(true);

    try {
      const nextState = await requestPushNotificationPermission();
      setNotificationsState(nextState);

      if (!nextState.supported) {
        toast.error("This browser does not support push notifications.");
      } else if (nextState.permission === "granted") {
        toast.success("Push notifications enabled for this device.");
      } else if (nextState.permission === "denied") {
        toast.error("Browser notifications are blocked. Update your browser settings to enable them.");
      }
    } finally {
      setNotificationsSaving(false);
    }
  };

  const handleDisableNotifications = () => {
    disablePushNotifications();
    setNotificationsState(getPushNotificationPermissionState());
    toast.success("Push notifications disabled for this device.");
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
      cancelled: orders.filter((o) => o.status === "cancelled").length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (orderFilter === "all") return orders;

    if (orderFilter === "active") {
      return orders.filter((o) =>
        ["pending", "confirmed", "preparing", "ready_for_delivery", "on_the_way", "arrived"].includes(o.status)
      );
    }

    if (orderFilter === "completed") {
      return orders.filter((o) => o.status === "delivered");
    }

    return orders.filter((o) => o.status === "cancelled");
  }, [orders, orderFilter]);

  const handleOpenOrderDetails = async (orderId: string) => {
    setSelectedOrderId(orderId);
    setLoadingOrderDetails(true);

    try {
      const snapshot = await fetchOrderTrackingSnapshot(orderId);
      setSelectedOrder(snapshot.order);
      setSelectedOrderItems(snapshot.items);
      setSelectedOrderDriver(snapshot.driver);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load order details");
      setSelectedOrderId(null);
      setSelectedOrder(null);
      setSelectedOrderItems([]);
      setSelectedOrderDriver(null);
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  const closeOrderDetails = () => {
    setSelectedOrderId(null);
    setSelectedOrder(null);
    setSelectedOrderItems([]);
    setSelectedOrderDriver(null);
    setLoadingOrderDetails(false);
    setReviewDialogOpen(false);
  };

  const orderFilters: Array<{ key: OrderFilter; label: string; count: number }> = [
    { key: "all", label: "All", count: orders.length },
    { key: "active", label: "Active", count: recentOrdersStats.active },
    { key: "completed", label: "Delivered", count: recentOrdersStats.delivered },
    { key: "cancelled", label: "Cancelled", count: recentOrdersStats.cancelled },
  ];

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

            <AddressAutocompleteField
              label="Default Delivery Address"
              value={editForm.default_address}
              onValueChange={(value) =>
                setEditForm((f) => ({ ...f, default_address: value }))
              }
              rows={2}
              className="relative"
              labelClassName="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
              textareaClassName="w-full resize-none rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 font-body"
              suggestionsClassName="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-card"
            />

            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Saved Addresses</p>
                  <p className="text-xs text-muted-foreground">
                    Keep multiple delivery spots ready for faster checkout.
                  </p>
                </div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {savedAddresses.length} saved
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[0.9fr_1.6fr_auto]">
                <input
                  type="text"
                  value={newAddressForm.label}
                  onChange={(e) =>
                    setNewAddressForm((prev) => ({ ...prev, label: e.target.value }))
                  }
                  placeholder="e.g. Home, Work"
                  className={inputClassName}
                />
                <AddressAutocompleteField
                  label="Address"
                  value={newAddressForm.address_text}
                  onValueChange={(value) =>
                    setNewAddressForm((prev) => ({ ...prev, address_text: value }))
                  }
                  placeholder="Street, suburb, landmarks"
                  rows={2}
                  className="relative"
                  labelClassName="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground md:hidden"
                  textareaClassName="w-full resize-none rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 font-body"
                  suggestionsClassName="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-card"
                />
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={newAddressForm.is_default}
                      onChange={(e) =>
                        setNewAddressForm((prev) => ({ ...prev, is_default: e.target.checked }))
                      }
                    />
                    Default
                  </label>
                  <button
                    onClick={() => void handleAddSavedAddress()}
                    disabled={savingAddress}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    {savingAddress ? "Saving..." : "Add"}
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {loadingSavedAddresses ? (
                  <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading saved addresses...
                  </div>
                ) : savedAddresses.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                    You have not saved any delivery addresses yet.
                  </div>
                ) : (
                  savedAddresses.map((address) => (
                    <div
                      key={address.id}
                      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:flex-row md:items-start md:justify-between"
                    >
                      {editingAddressId === address.id ? (
                        <>
                          <div className="min-w-0 flex-1 space-y-3">
                            <input
                              type="text"
                              value={editingAddressForm.label}
                              onChange={(e) =>
                                setEditingAddressForm((prev) => ({ ...prev, label: e.target.value }))
                              }
                              placeholder="Address label"
                              className={inputClassName}
                            />
                            <AddressAutocompleteField
                              label="Address"
                              value={editingAddressForm.address_text}
                              onValueChange={(value) =>
                                setEditingAddressForm((prev) => ({
                                  ...prev,
                                  address_text: value,
                                }))
                              }
                              rows={2}
                              className="relative"
                              labelClassName="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
                              textareaClassName="w-full resize-none rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 font-body"
                              suggestionsClassName="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-card"
                            />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => void handleUpdateSavedAddress(address)}
                              disabled={savingAddress}
                              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                            >
                              <Pencil className="h-4 w-4" />
                              {savingAddress ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={cancelEditSavedAddress}
                              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                            >
                              <X className="h-4 w-4" />
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">{address.label}</p>
                              {address.is_default && (
                                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">{address.address_text}</p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => void handleSetDefaultAddress(address)}
                              disabled={address.is_default}
                              className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                            >
                              <Home className="h-4 w-4" />
                              {address.is_default ? "Default" : "Make Default"}
                            </button>
                            <button
                              onClick={() => beginEditSavedAddress(address)}
                              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => void handleDeleteSavedAddress(address)}
                              disabled={removingAddressId === address.id}
                              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              {removingAddressId === address.id ? "Removing..." : "Delete"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-4">
              <div className="mb-3 flex items-center gap-2">
                {notificationsState.enabled ? (
                  <Bell className="h-4 w-4 text-primary" />
                ) : (
                  <BellOff className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">Push Notifications</p>
                  <p className="text-xs text-muted-foreground">
                    Get browser alerts for order updates, driver dispatches, and admin order activity on this device.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                {!notificationsState.supported
                  ? "This browser does not support web push notifications."
                  : notificationsState.permission === "denied"
                    ? "Notifications are blocked in the browser. Re-enable them in site settings, then come back here."
                    : notificationsState.enabled
                      ? "Notifications are enabled. We'll alert you when important order events happen."
                      : "Notifications are currently off for this device."}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => void handleEnableNotifications()}
                  disabled={notificationsSaving || !notificationsState.supported || notificationsState.enabled}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <Bell className="h-4 w-4" />
                  {notificationsSaving ? "Updating..." : notificationsState.enabled ? "Enabled" : "Enable Notifications"}
                </button>

                <button
                  onClick={handleDisableNotifications}
                  disabled={!notificationsState.supported || !notificationsState.enabled}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <BellOff className="h-4 w-4" />
                  Turn Off
                </button>
              </div>
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

            <div className="flex flex-wrap gap-2">
              {orderFilters.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setOrderFilter(filter.key)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    orderFilter === filter.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="py-16 text-center">
                <Package className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
                <p className="font-medium text-muted-foreground">No orders in this filter yet</p>
              </div>
            ) : (
              filteredOrders.map((o) => {
                const isActiveOrder = [
                  "pending",
                  "confirmed",
                  "preparing",
                  "ready_for_delivery",
                  "on_the_way",
                  "arrived",
                ].includes(o.status);

                return (
                  <div
                    key={o.id}
                    className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
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

                      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                          <p className="font-display text-2xl text-primary">{formatCurrency(o.total)}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {o.status === "delivered" && (
                            <>
                              <button
                                onClick={() => void handleReorder(o.id)}
                                disabled={reorderingOrderId === o.id || loadingProducts}
                                className="inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                              >
                                {reorderingOrderId === o.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-4 w-4" />
                                )}
                                Order Again
                              </button>

                              <button
                                onClick={() => void handleOpenOrderDetails(o.id)}
                                className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-4 py-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50"
                              >
                                <Star className="h-4 w-4" />
                                Rate order
                              </button>
                            </>
                          )}

                          {isActiveOrder && (
                            <button
                              onClick={() => navigate(`/order-tracking/${o.id}`)}
                              className="inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                            >
                              Track Live
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          )}

                          <button
                            onClick={() => void handleOpenOrderDetails(o.id)}
                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
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

      <Dialog open={!!selectedOrderId} onOpenChange={(open) => !open && closeOrderDetails()}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Order details</DialogTitle>
            <DialogDescription>
              Review this order separately from the live tracker, and jump back into tracking only when it is active.
            </DialogDescription>
          </DialogHeader>

          {loadingOrderDetails ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="ml-3 text-sm">Loading order details...</span>
            </div>
          ) : selectedOrder ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Order #{selectedOrder.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{selectedOrder.customer_name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(selectedOrder.created_at).toLocaleString("en-ZA")}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedOrder.status === "delivered" && (
                    <>
                      <button
                        onClick={() => void handleReorder(selectedOrder.id)}
                        disabled={reorderingOrderId === selectedOrder.id || loadingProducts}
                        className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                      >
                        {reorderingOrderId === selectedOrder.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                        Order again
                      </button>

                      <button
                        onClick={() => setReviewDialogOpen(true)}
                        className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50"
                      >
                        <Star className="h-4 w-4" />
                        Rate order
                      </button>
                    </>
                  )}

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${getAccountOrderStatusClass(
                      selectedOrder.status || ""
                    )}`}
                  >
                    {formatStatusLabel(selectedOrder.status || "pending")}
                  </span>

                  {selectedOrder.status &&
                    ["pending", "confirmed", "preparing", "ready_for_delivery", "on_the_way", "arrived"].includes(
                      selectedOrder.status
                    ) && (
                      <button
                        onClick={() => navigate(`/order-tracking/${selectedOrder.id}`)}
                        className="inline-flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        Track Live
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Payment</p>
                  <p className="mt-2 font-medium text-foreground">
                    {selectedOrder.payment_method || "Unknown method"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Status: {selectedOrder.payment_status || "Unknown"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Reference: {selectedOrder.payment_reference || "Not available"}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Delivery</p>
                  <p className="mt-2 font-medium text-foreground">
                    {selectedOrder.delivery_address || "No address provided"}
                  </p>
                  {selectedOrder.customer_phone && (
                    <p className="mt-1 text-sm text-muted-foreground">Phone: {selectedOrder.customer_phone}</p>
                  )}
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                  <p className="mt-2 whitespace-pre-line text-sm text-foreground">{selectedOrder.notes}</p>
                </div>
              )}

              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Items</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">Order breakdown</p>
                  </div>

                  <p className="text-lg font-semibold text-primary">{formatCurrency(selectedOrder.total)}</p>
                </div>

                <div className="space-y-3">
                  {selectedOrderItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-foreground">
                            {item.quantity}× {item.product_name}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Unit price {formatCurrency(item.final_unit_price || item.unit_price)}
                          </p>
                        </div>

                        <p className="font-medium text-foreground">{formatCurrency(item.total_price)}</p>
                      </div>

                      {item.selectedOptions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.selectedOptions.map((option) => (
                            <span
                              key={option.id}
                              className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground"
                            >
                              {option.option_group_name}: {option.option_item_name}
                            </span>
                          ))}
                        </div>
                      )}

                      {item.item_note && (
                        <p className="mt-3 text-sm text-muted-foreground">Note: {item.item_note}</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-border bg-background p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium text-foreground">{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-muted-foreground">Delivery fee</span>
                    <span className="font-medium text-foreground">{formatCurrency(selectedOrder.delivery_fee)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="font-medium text-foreground">-{formatCurrency(selectedOrder.discount_amount)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="text-lg font-semibold text-primary">{formatCurrency(selectedOrder.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <OrderReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        order={selectedOrder}
        items={selectedOrderItems}
        driver={selectedOrderDriver}
        userId={user?.id ?? null}
      />

      <Footer />
    </div>
  );
}
