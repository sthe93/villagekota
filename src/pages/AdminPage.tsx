import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
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
  Loader2,
  Search,
  RefreshCw,
  MapPin,
  Mail,
  Phone,
  Clock3,
  Truck,
  Navigation,
  CheckCircle2,
  UserCheck,
  ChevronRight,
} from "lucide-react";
import Footer from "@/components/Footer";
import MapView, { Layer, Marker, NavigationControl, Source } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { getMapTilerStyleUrl } from "@/lib/maps";

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
  auth_user_id: string | null;
}

interface DeliveryZoneSettings {
  id: string;
  zone_name: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  address_pattern: string;
  out_of_zone_message: string;
  is_active: boolean;
  polygon_coordinates: Array<[number, number]> | null;
}

type GeoJsonLike =
  | {
      type?: "FeatureCollection";
      features?: Array<{
        type?: "Feature";
        geometry?: {
          type?: string;
          coordinates?: unknown;
        } | null;
      }>;
    }
  | {
      type?: "Feature";
      geometry?: {
        type?: string;
        coordinates?: unknown;
      } | null;
    }
  | {
      type?: string;
      coordinates?: unknown;
    };

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
}

interface UserRoleRow {
  user_id: string;
  role: "admin" | "user";
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

interface ManagedUser {
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string | null;
  isAdmin: boolean;
  assignedDriver: Driver | null;
}

type AdminTab =
  | "dashboard"
  | "orders"
  | "products"
  | "categories"
  | "vouchers"
  | "customers"
  | "drivers"
  | "delivery_zone";

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  confirmed: "bg-blue-100 text-blue-700 border-blue-200",
  preparing: "bg-purple-100 text-purple-700 border-purple-200",
  ready_for_delivery: "bg-orange-100 text-orange-700 border-orange-200",
  on_the_way: "bg-indigo-100 text-indigo-700 border-indigo-200",
  arrived: "bg-cyan-100 text-cyan-700 border-cyan-200",
  delivered: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

const paymentStatusColors: Record<string, string> = {
  paid: "bg-green-100 text-green-700 border-green-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  failed: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
};

const currency = (value: number) => `R${Number(value || 0).toFixed(2)}`;

const formatDayLabel = (date: Date) =>
  date.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });

const formatStatusLabel = (value: string) => value.replace(/_/g, " ");

const formatOrderId = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;

const inputClassName =
  "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

const textareaClassName =
  "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary resize-none";

const selectClassName =
  "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary";

const DELIVERY_ZONE_MAP_STYLE = getMapTilerStyleUrl();

function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize ${className}`}
    >
      {children}
    </span>
  );
}

function StatCard({
  title,
  value,
  icon,
  valueClassName = "text-foreground",
}: {
  title: string;
  value: ReactNode;
  icon: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {title}
          </p>
          <p className={`font-display text-3xl ${valueClassName}`}>{value}</p>
        </div>
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">{icon}</div>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <div className="mb-3 inline-flex rounded-2xl bg-muted p-3 text-muted-foreground">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function AdminModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="font-display text-2xl text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(90vh-81px)] overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<AdminTab>("dashboard");

  const [products, setProducts] = useState<DbProduct[]>([]);
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [deliveryZoneSettings, setDeliveryZoneSettings] = useState<DeliveryZoneSettings | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([]);

  const [editingProduct, setEditingProduct] = useState<Partial<DbProduct> | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [editingVoucher, setEditingVoucher] = useState<Partial<Voucher> | null>(null);
  const [editingDriver, setEditingDriver] = useState<Partial<Driver> | null>(null);

  const [showProductForm, setShowProductForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showVoucherForm, setShowVoucherForm] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);

  const [paymentFilter, setPaymentFilter] = useState<
    "all" | "paid" | "pending" | "failed" | "cancelled"
  >("all");
  const [orderSearch, setOrderSearch] = useState("");

  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [customerSearch, setCustomerSearch] = useState("");
  const [voucherSearch, setVoucherSearch] = useState("");
  const [driverSearch, setDriverSearch] = useState("");
  const [savingDeliveryZone, setSavingDeliveryZone] = useState(false);
  const [geoJsonInput, setGeoJsonInput] = useState("");
  const [deliveryZoneMapView, setDeliveryZoneMapView] = useState({
    longitude: 27.7594,
    latitude: -26.2856,
    zoom: 12,
  });

  const [pageLoading, setPageLoading] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!isAdmin) {
      setPageLoading(false);
      return;
    }

    fetchAll();
  }, [loading, isAdmin]);

  const fetchAll = async () => {
    try {
      setPageLoading(true);

      await Promise.all([
        fetchProducts(),
        fetchOrders(),
        fetchCategories(),
        fetchVouchers(),
        fetchDrivers(),
        fetchDeliveryZoneSettings(),
        fetchProfiles(),
        fetchUserRoles(),
        fetchOrderItems(),
      ]);
    } finally {
      setPageLoading(false);
    }
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
      .select("id, name, phone, is_active, auth_user_id")
      .order("name");
    if (error) toast.error(error.message);
    setDrivers((data || []) as Driver[]);
  };

  const fetchDeliveryZoneSettings = async () => {
    const { data, error } = await supabase
      .from("delivery_zone_settings")
      .select(
        "id, zone_name, center_lat, center_lng, radius_meters, address_pattern, out_of_zone_message, is_active, polygon_coordinates"
      )
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      toast.error(error.message);
      return;
    }

    const nextSettings = (data as DeliveryZoneSettings | null) ?? {
      id: "",
      zone_name: "Star Village",
      center_lat: -26.2856,
      center_lng: 27.7594,
      radius_meters: 2200,
      address_pattern: "\\bstar\\s+village\\b",
      out_of_zone_message: "We currently deliver only to addresses inside Star Village.",
      is_active: true,
      polygon_coordinates: null,
    };

    setDeliveryZoneSettings(nextSettings);
  };

  useEffect(() => {
    if (!deliveryZoneSettings) return;

    setDeliveryZoneMapView((prev) => ({
      ...prev,
      latitude: Number(deliveryZoneSettings.center_lat) || prev.latitude,
      longitude: Number(deliveryZoneSettings.center_lng) || prev.longitude,
    }));
  }, [deliveryZoneSettings]);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, display_name, email, phone, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setProfiles((data || []) as UserProfile[]);
  };

  const fetchUserRoles = async () => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("user_id, role");
    if (error) toast.error(error.message);
    setUserRoles((data || []) as UserRoleRow[]);
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
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", editingProduct.id);
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
      const { error } = await supabase
        .from("categories")
        .update(payload)
        .eq("id", editingCategory.id);
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
      const { error } = await supabase
        .from("vouchers")
        .update(payload)
        .eq("id", editingVoucher.id);
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
      const { error } = await supabase
        .from("drivers")
        .update(payload)
        .eq("id", editingDriver.id);
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

  const handleSaveDeliveryZone = async () => {
    if (!deliveryZoneSettings) {
      toast.error("Delivery zone settings are not loaded yet.");
      return;
    }

    if (!deliveryZoneSettings.zone_name?.trim()) {
      toast.error("Zone name is required.");
      return;
    }

    if (!deliveryZoneSettings.address_pattern?.trim()) {
      toast.error("Address regex pattern is required.");
      return;
    }

    if (Number(deliveryZoneSettings.radius_meters) <= 0) {
      toast.error("Radius must be greater than 0 meters.");
      return;
    }

    setSavingDeliveryZone(true);

    try {
      const polygonCoordinates =
        deliveryZoneSettings.polygon_coordinates && deliveryZoneSettings.polygon_coordinates.length > 0
          ? deliveryZoneSettings.polygon_coordinates
          : null;

      if (polygonCoordinates && polygonCoordinates.length < 3) {
        toast.error("Polygon requires at least 3 points.");
        return;
      }

      const payload = {
        zone_name: deliveryZoneSettings.zone_name.trim(),
        center_lat: Number(deliveryZoneSettings.center_lat),
        center_lng: Number(deliveryZoneSettings.center_lng),
        radius_meters: Math.round(Number(deliveryZoneSettings.radius_meters)),
        address_pattern: deliveryZoneSettings.address_pattern.trim(),
        out_of_zone_message:
          deliveryZoneSettings.out_of_zone_message.trim() ||
          "We currently deliver only to addresses inside Star Village.",
        polygon_coordinates: polygonCoordinates,
        is_active: true,
        updated_by: user?.id ?? null,
      };

      if (deliveryZoneSettings.id) {
        const { error } = await supabase
          .from("delivery_zone_settings")
          .update(payload)
          .eq("id", deliveryZoneSettings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("delivery_zone_settings").insert(payload);
        if (error) throw error;
      }

      toast.success("Delivery zone settings updated.");
      await fetchDeliveryZoneSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save delivery zone settings.");
    } finally {
      setSavingDeliveryZone(false);
    }
  };

  const handleConvertGeoJsonToPolygon = () => {
    if (!geoJsonInput.trim()) {
      toast.error("Paste GeoJSON first.");
      return;
    }

    try {
      const parsed = JSON.parse(geoJsonInput) as GeoJsonLike;

      const resolveGeometry = () => {
        if (parsed?.type === "FeatureCollection" && Array.isArray(parsed.features)) {
          return parsed.features.find((feature) => feature?.geometry)?.geometry || null;
        }

        if (parsed?.type === "Feature" && parsed.geometry) {
          return parsed.geometry;
        }

        if ("coordinates" in parsed) {
          return parsed as { type?: string; coordinates?: unknown };
        }

        return null;
      };

      const geometry = resolveGeometry();

      if (!geometry || !Array.isArray(geometry.coordinates)) {
        toast.error("GeoJSON does not include polygon coordinates.");
        return;
      }

      const toLatLngPolygon = (coordinates: unknown): Array<[number, number]> | null => {
        if (!Array.isArray(coordinates) || coordinates.length === 0) return null;

        if (geometry.type === "Polygon") {
          const ring = coordinates[0];
          if (!Array.isArray(ring)) return null;

          const points = ring
            .map((point) => {
              if (!Array.isArray(point) || point.length < 2) return null;
              const lng = Number(point[0]);
              const lat = Number(point[1]);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
              return [lat, lng] as [number, number];
            })
            .filter((point): point is [number, number] => Boolean(point));

          return points.length >= 3 ? points : null;
        }

        if (geometry.type === "MultiPolygon") {
          const firstPolygon = coordinates[0];
          if (!Array.isArray(firstPolygon) || firstPolygon.length === 0) return null;
          const firstRing = firstPolygon[0];
          if (!Array.isArray(firstRing)) return null;

          const points = firstRing
            .map((point) => {
              if (!Array.isArray(point) || point.length < 2) return null;
              const lng = Number(point[0]);
              const lat = Number(point[1]);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
              return [lat, lng] as [number, number];
            })
            .filter((point): point is [number, number] => Boolean(point));

          return points.length >= 3 ? points : null;
        }

        return null;
      };

      const converted = toLatLngPolygon(geometry.coordinates);

      if (!converted) {
        toast.error("Only Polygon/MultiPolygon GeoJSON with valid points is supported.");
        return;
      }

      setDeliveryZoneSettings((prev) =>
        prev
          ? {
              ...prev,
              polygon_coordinates: converted,
            }
          : prev
      );
      toast.success("GeoJSON converted to polygon coordinates.");
    } catch {
      toast.error("Invalid GeoJSON JSON.");
    }
  };

  const handleToggleAdminRole = async (userId: string, makeAdmin: boolean) => {
    if (makeAdmin) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      if (error) {
        toast.error(error.message || "Failed to grant admin role");
        return;
      }
      toast.success("Admin role assigned");
    } else {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (error) {
        toast.error(error.message || "Failed to remove admin role");
        return;
      }
      toast.success("Admin role removed");
    }

    fetchUserRoles();
  };

  const handleAssignDriverToUser = async (userId: string, driverId: string | null) => {
    const { error: clearExistingForUserError } = await supabase
      .from("drivers")
      .update({ auth_user_id: null })
      .eq("auth_user_id", userId);

    if (clearExistingForUserError) {
      toast.error(clearExistingForUserError.message || "Failed to clear driver assignment");
      return;
    }

    if (driverId) {
      const { error: assignError } = await supabase
        .from("drivers")
        .update({ auth_user_id: userId })
        .eq("id", driverId);

      if (assignError) {
        toast.error(assignError.message || "Failed to assign driver profile");
        return;
      }

      toast.success("Driver profile assigned");
    } else {
      toast.success("Driver profile removed");
    }

    fetchDrivers();
  };

  const filteredAdminOrders = useMemo(() => {
    return orders.filter((o) => {
      const searchTerm = orderSearch.trim().toLowerCase();

      const matchesSearch =
        !searchTerm ||
        o.customer_name.toLowerCase().includes(searchTerm) ||
        o.customer_phone.toLowerCase().includes(searchTerm) ||
        (o.customer_email || "").toLowerCase().includes(searchTerm) ||
        o.id.toLowerCase().includes(searchTerm);

      const paymentStatus = (o.payment_status || "pending").toLowerCase();
      const matchesPayment = paymentFilter === "all" || paymentStatus === paymentFilter;

      return matchesSearch && matchesPayment;
    });
  }, [orders, orderSearch, paymentFilter]);

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

  const adminUserIds = useMemo(() => {
    return new Set(userRoles.filter((role) => role.role === "admin").map((role) => role.user_id));
  }, [userRoles]);

  const driverByUserId = useMemo(() => {
    const map = new Map<string, Driver>();
    drivers.forEach((driver) => {
      if (driver.auth_user_id) {
        map.set(driver.auth_user_id, driver);
      }
    });
    return map;
  }, [drivers]);

  const managedUsers = useMemo<ManagedUser[]>(() => {
    const customerByKey = new Map<string, CustomerSummary>();

    customers.forEach((customer) => {
      if (customer.email) customerByKey.set(`email:${customer.email.toLowerCase()}`, customer);
      if (customer.phone) customerByKey.set(`phone:${customer.phone}`, customer);
    });

    return profiles.map((profile) => {
      const customerMatch =
        (profile.email && customerByKey.get(`email:${profile.email.toLowerCase()}`)) ||
        (profile.phone && customerByKey.get(`phone:${profile.phone}`)) ||
        null;

      return {
        user_id: profile.user_id,
        name: profile.display_name || profile.email || profile.phone || "Unnamed user",
        email: profile.email,
        phone: profile.phone,
        created_at: profile.created_at,
        totalOrders: customerMatch?.totalOrders || 0,
        totalSpent: customerMatch?.totalSpent || 0,
        lastOrderAt: customerMatch?.lastOrderAt || null,
        isAdmin: adminUserIds.has(profile.user_id),
        assignedDriver: driverByUserId.get(profile.user_id) || null,
      };
    });
  }, [adminUserIds, customers, driverByUserId, profiles]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();

    return products.filter((p) => {
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (p.description || "").toLowerCase().includes(term);

      const matchesCategory =
        productCategoryFilter === "all" || p.category_id === productCategoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [products, productSearch, productCategoryFilter]);

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();

    return managedUsers.filter((c) => {
      return (
        !term ||
        c.name.toLowerCase().includes(term) ||
        (c.email || "").toLowerCase().includes(term) ||
        (c.phone || "").toLowerCase().includes(term)
      );
    });
  }, [managedUsers, customerSearch]);

  const filteredVouchers = useMemo(() => {
    const term = voucherSearch.trim().toLowerCase();

    return vouchers.filter((v) => {
      return !term || v.code.toLowerCase().includes(term) || v.type.toLowerCase().includes(term);
    });
  }, [vouchers, voucherSearch]);

  const filteredDrivers = useMemo(() => {
    const term = driverSearch.trim().toLowerCase();

    return drivers.filter((d) => {
      return (
        !term ||
        d.name.toLowerCase().includes(term) ||
        (d.phone || "").toLowerCase().includes(term)
      );
    });
  }, [drivers, driverSearch]);

  const paidOrdersCount = useMemo(
    () => orders.filter((o) => (o.payment_status || "pending").toLowerCase() === "paid").length,
    [orders]
  );

  const pendingPaymentCount = useMemo(
    () => orders.filter((o) => (o.payment_status || "pending").toLowerCase() === "pending").length,
    [orders]
  );

  const failedPaymentCount = useMemo(
    () => orders.filter((o) => (o.payment_status || "pending").toLowerCase() === "failed").length,
    [orders]
  );

  const cancelledPaymentCount = useMemo(
    () =>
      orders.filter((o) => (o.payment_status || "pending").toLowerCase() === "cancelled").length,
    [orders]
  );

  const dispatchSummary = useMemo(() => {
    const waitingForDriver = orders.filter(
      (o) => o.status === "ready_for_delivery" && !("driver_id" in o)
    ).length;

    return {
      waitingForDriver:
        waitingForDriver ||
        orders.filter((o) => o.status === "ready_for_delivery").length,
      onTheWay: orders.filter((o) => o.status === "on_the_way").length,
      arrived: orders.filter((o) => o.status === "arrived").length,
      delivered: orders.filter((o) => o.status === "delivered").length,
    };
  }, [orders]);

  const maxRevenue = Math.max(...salesData.map((s) => s.revenue), 1);

  const deliveryZonePolygonFeature = useMemo(() => {
    const polygon = deliveryZoneSettings?.polygon_coordinates || [];
    if (polygon.length < 3) return null;

    const ring = polygon.map(([lat, lng]) => [lng, lat]);
    const [firstLng, firstLat] = ring[0];
    const [lastLng, lastLat] = ring[ring.length - 1];

    const closedRing =
      firstLng === lastLng && firstLat === lastLat ? ring : [...ring, [firstLng, firstLat]];

    return {
      type: "Feature" as const,
      geometry: {
        type: "Polygon" as const,
        coordinates: [closedRing],
      },
      properties: {},
    };
  }, [deliveryZoneSettings?.polygon_coordinates]);

  const tabs = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "orders", label: "Orders", icon: ShoppingBag },
    { key: "products", label: "Products", icon: Package },
    { key: "categories", label: "Categories", icon: Tags },
    { key: "vouchers", label: "Vouchers", icon: TicketPercent },
    { key: "customers", label: "Users", icon: Users },
    { key: "drivers", label: "Drivers", icon: Bike },
    { key: "delivery_zone", label: "Delivery Zone", icon: MapPin },
  ] as const;

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="space-y-3 text-center">
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
            <div>
              <p className="font-medium text-foreground">Loading admin dashboard...</p>
              <p className="text-sm text-muted-foreground">
                Fetching products, orders, vouchers, drivers, and users
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl py-6 md:py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-3xl text-foreground md:text-5xl">
              Admin Dashboard
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage orders, products, categories, vouchers, users, and drivers.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchAll}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Data
          </button>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Orders Today"
            value={dashboardStats.totalOrdersToday}
            icon={<ShoppingBag className="h-5 w-5" />}
          />
          <StatCard
            title="Revenue Today"
            value={currency(dashboardStats.revenueToday)}
            valueClassName="text-primary"
            icon={<CreditCard className="h-5 w-5" />}
          />
          <StatCard
            title="Active Drivers"
            value={dashboardStats.activeDrivers}
            icon={<Bike className="h-5 w-5" />}
          />
          <StatCard
            title="Pending Orders"
            value={dashboardStats.pendingOrders}
            icon={<Clock3 className="h-5 w-5" />}
          />
        </div>

        <div className="sticky top-0 z-20 mb-8 bg-background/90 pb-2 pt-1 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2 shadow-sm">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  tab === key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "dashboard" && (
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
                <div className="mb-5 flex items-center gap-2">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl text-foreground">Sales Overview</h2>
                    <p className="text-sm text-muted-foreground">Last 7 days revenue and orders</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {salesData.map((point) => (
                    <div key={point.label} className="rounded-2xl border border-border bg-background/50 p-4">
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-foreground">{point.label}</span>
                        <span className="text-muted-foreground">
                          {currency(point.revenue)} · {point.orders} orders
                        </span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${(point.revenue / maxRevenue) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-5">
                  <h2 className="font-display text-2xl text-foreground">Top-Selling Items</h2>
                  <p className="text-sm text-muted-foreground">Best performing menu items</p>
                </div>

                <div className="space-y-3">
                  {topSellingItems.length === 0 ? (
                    <EmptyState
                      icon={<Package className="h-5 w-5" />}
                      title="No sales data yet"
                      description="Top-selling items will appear after orders are placed."
                    />
                  ) : (
                    topSellingItems.map((item, index) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/50 p-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {index + 1}. {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{item.qty} sold</p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-primary">
                          {currency(item.revenue)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-2xl text-foreground">Recent Orders</h2>
                  <p className="text-sm text-muted-foreground">Latest customer activity</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTab("orders")}
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  View Orders Summary
                </button>
              </div>

              {orders.length === 0 ? (
                <EmptyState
                  icon={<ShoppingBag className="h-5 w-5" />}
                  title="No orders yet"
                  description="New orders will appear here as customers start ordering."
                />
              ) : (
                <div className="space-y-3">
                  {orders.slice(0, 6).map((o) => {
                    const paymentStatus = (o.payment_status || "pending").toLowerCase();

                    return (
                      <div
                        key={o.id}
                        className="rounded-2xl border border-border bg-background/50 p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{o.customer_name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatOrderId(o.id)} ·{" "}
                              {new Date(o.created_at).toLocaleString("en-ZA")}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              className={
                                statusColors[o.status] || "border-border bg-muted text-muted-foreground"
                              }
                            >
                              {formatStatusLabel(o.status)}
                            </Badge>
                            <Badge
                              className={
                                paymentStatusColors[paymentStatus] ||
                                "border-border bg-muted text-muted-foreground"
                              }
                            >
                              Payment: {paymentStatus}
                            </Badge>
                            <Badge className="border-border bg-muted text-foreground">
                              {currency(o.total)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "orders" && (
          <div className="mx-auto max-w-6xl space-y-4">
            <div className="sticky top-[84px] z-10 rounded-3xl border border-border bg-card p-4 shadow-sm backdrop-blur">
              <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="font-display text-2xl text-foreground">Orders Summary</h2>
                  <p className="text-sm text-muted-foreground">
                    Read-only overview for finance and support. Use Dispatch Manager for kitchen and delivery actions.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/admin/orders")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Navigation className="h-4 w-4" />
                  Open Dispatch Manager
                </button>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-border bg-background/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Ready / Waiting
                  </p>
                  <p className="mt-1 font-display text-2xl text-orange-700">
                    {dispatchSummary.waitingForDriver}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-background/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    On The Way
                  </p>
                  <p className="mt-1 font-display text-2xl text-indigo-700">
                    {dispatchSummary.onTheWay}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-background/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Arrived
                  </p>
                  <p className="mt-1 font-display text-2xl text-cyan-700">
                    {dispatchSummary.arrived}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-background/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Delivered
                  </p>
                  <p className="mt-1 font-display text-2xl text-green-700">
                    {dispatchSummary.delivered}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                <div className="relative lg:col-span-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by customer, phone, email, or order ID"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className={`${inputClassName} pl-10`}
                  />
                </div>

                <select
                  value={paymentFilter}
                  onChange={(e) =>
                    setPaymentFilter(
                      e.target.value as "all" | "paid" | "pending" | "failed" | "cancelled"
                    )
                  }
                  className={selectClassName}
                >
                  <option value="all">All payment statuses</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <div className="flex items-center justify-start rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground lg:justify-center">
                  {filteredAdminOrders.length} order{filteredAdminOrders.length === 1 ? "" : "s"} found
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge className="border-border bg-muted text-foreground">
                  All: {orders.length}
                </Badge>
                <Badge className="bg-green-100 text-green-700 border-green-200">
                  Paid: {paidOrdersCount}
                </Badge>
                <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                  Pending: {pendingPaymentCount}
                </Badge>
                <Badge className="bg-red-100 text-red-700 border-red-200">
                  Failed: {failedPaymentCount}
                </Badge>
                <Badge className="bg-slate-100 text-slate-700 border-slate-200">
                  Cancelled: {cancelledPaymentCount}
                </Badge>
              </div>
            </div>

            {filteredAdminOrders.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag className="h-5 w-5" />}
                title="No orders found"
                description="Try changing the search term or payment status filter."
              />
            ) : (
              filteredAdminOrders.map((o) => {
                const itemsForOrder = orderItemsByOrderId[o.id] || [];
                const paymentStatus = (o.payment_status || "pending").toLowerCase();

                return (
                  <div
                    key={o.id}
                    className="rounded-3xl border border-border bg-card p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 space-y-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold text-foreground">
                              {o.customer_name}
                            </p>
                            <Badge
                              className={
                                statusColors[o.status] ||
                                "border-border bg-muted text-muted-foreground"
                              }
                            >
                              {formatStatusLabel(o.status)}
                            </Badge>
                            <Badge
                              className={
                                paymentStatusColors[paymentStatus] ||
                                "border-border bg-muted text-muted-foreground"
                              }
                            >
                              Payment: {paymentStatus}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatOrderId(o.id)} ·{" "}
                            {new Date(o.created_at).toLocaleString("en-ZA")}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <div className="rounded-2xl border border-border bg-background/50 p-3">
                            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                              Contact
                            </p>
                            <div className="space-y-1.5 text-sm text-foreground">
                              <p className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="break-all">{o.customer_phone}</span>
                              </p>
                              <p className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span className="break-all">{o.customer_email || "—"}</span>
                              </p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border bg-background/50 p-3 md:col-span-2">
                            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                              Delivery Address
                            </p>
                            <p className="flex items-start gap-2 text-sm text-foreground">
                              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                              <span>{o.delivery_address}</span>
                            </p>
                            {o.notes && (
                              <p className="mt-2 text-xs italic text-muted-foreground">
                                Note: {o.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="w-full max-w-sm space-y-3 xl:w-[320px]">
                        <div className="rounded-2xl border border-border bg-background/50 p-4">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Total
                          </p>
                          <p className="mt-1 font-display text-3xl text-primary">
                            {currency(o.total)}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {o.payment_method} · {o.payment_provider || "No provider"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-border bg-background/50 p-4">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Dispatch Actions
                              </p>
                              <p className="mt-1 text-sm text-foreground">
                                Kitchen and delivery updates happen in the dedicated manager.
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => navigate("/admin/orders")}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            <Truck className="h-4 w-4" />
                            Open Dispatch Manager
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 border-t border-border pt-5 lg:grid-cols-3">
                      <div className="rounded-2xl border border-border bg-background/50 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <h3 className="text-sm font-semibold text-foreground">Order Items</h3>
                        </div>

                        {itemsForOrder.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No order items found.</p>
                        ) : (
                          <div className="space-y-2">
                            {itemsForOrder.slice(0, 4).map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-foreground">
                                    {item.product_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Qty: {item.quantity}
                                  </p>
                                </div>
                                <p className="shrink-0 text-sm font-semibold text-primary">
                                  {currency(item.total_price)}
                                </p>
                              </div>
                            ))}

                            {itemsForOrder.length > 4 && (
                              <p className="text-xs text-muted-foreground">
                                + {itemsForOrder.length - 4} more item{itemsForOrder.length - 4 === 1 ? "" : "s"}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-border bg-background/50 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <h3 className="text-sm font-semibold text-foreground">Payment Summary</h3>
                        </div>

                        <div className="space-y-2 text-sm">
                          <p className="text-foreground">
                            Method: <span className="capitalize text-muted-foreground">{o.payment_method}</span>
                          </p>
                          <p className="text-foreground">
                            Provider: <span className="text-muted-foreground">{o.payment_provider || "N/A"}</span>
                          </p>
                          <p className="text-foreground">
                            Status: <span className="capitalize text-muted-foreground">{paymentStatus}</span>
                          </p>
                          <p className="text-foreground">
                            Total: <span className="font-medium text-primary">{currency(o.total)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-background/50 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-muted-foreground" />
                          <h3 className="text-sm font-semibold text-foreground">Admin Shortcut</h3>
                        </div>

                        <p className="mb-4 text-sm text-muted-foreground">
                          Open the dispatch manager to move kitchen stages, monitor driver progress, and review live delivery information.
                        </p>

                        <button
                          type="button"
                          onClick={() => navigate("/admin/orders")}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                        >
                          <Navigation className="h-4 w-4" />
                          Manage This in Dispatch
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "products" && (
          <div className="mx-auto max-w-6xl space-y-4">
            <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                <div className="relative lg:col-span-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search products"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className={`${inputClassName} pl-10`}
                  />
                </div>

                <select
                  value={productCategoryFilter}
                  onChange={(e) => setProductCategoryFilter(e.target.value)}
                  className={selectClassName}
                >
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct({
                      is_available: true,
                      is_featured: false,
                      is_popular: false,
                      spice_level: 0,
                    });
                    setShowProductForm(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Add Product
                </button>
              </div>
            </div>

            {showProductForm && editingProduct && (
              <AdminModal
                title={editingProduct.id ? "Edit Product" : "New Product"}
                onClose={() => {
                  setShowProductForm(false);
                  setEditingProduct(null);
                }}
              >
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={editingProduct.name || ""}
                      onChange={(e) =>
                        setEditingProduct((p) => ({ ...p, name: e.target.value }))
                      }
                      className={inputClassName}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Description
                    </label>
                    <textarea
                      value={editingProduct.description || ""}
                      onChange={(e) =>
                        setEditingProduct((p) => ({ ...p, description: e.target.value }))
                      }
                      rows={3}
                      className={textareaClassName}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Price *
                      </label>
                      <input
                        type="number"
                        value={editingProduct.price ?? ""}
                        onChange={(e) =>
                          setEditingProduct((p) => ({
                            ...p,
                            price: e.target.value === "" ? undefined : parseFloat(e.target.value),
                          }))
                        }
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Category
                      </label>
                      <select
                        value={editingProduct.category_id || ""}
                        onChange={(e) =>
                          setEditingProduct((p) => ({
                            ...p,
                            category_id: e.target.value || null,
                          }))
                        }
                        className={selectClassName}
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

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Spice Level
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={5}
                        value={editingProduct.spice_level ?? 0}
                        onChange={(e) =>
                          setEditingProduct((p) => ({
                            ...p,
                            spice_level: parseInt(e.target.value || "0"),
                          }))
                        }
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Image URL
                      </label>
                      <input
                        type="text"
                        value={editingProduct.image_url || ""}
                        onChange={(e) =>
                          setEditingProduct((p) => ({ ...p, image_url: e.target.value }))
                        }
                        className={inputClassName}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                      { key: "is_available", label: "Available" },
                      { key: "is_featured", label: "Featured" },
                      { key: "is_popular", label: "Popular" },
                    ].map(({ key, label }) => (
                      <label
                        key={key}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-background/50 p-4 text-sm text-foreground"
                      >
                        <input
                          type="checkbox"
                          checked={(editingProduct as any)[key] ?? (key === "is_available")}
                          onChange={(e) =>
                            setEditingProduct((p) => ({ ...p, [key]: e.target.checked }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProductForm(false);
                        setEditingProduct(null);
                      }}
                      className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProduct}
                      className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      {editingProduct.id ? "Update Product" : "Add Product"}
                    </button>
                  </div>
                </div>
              </AdminModal>
            )}

            {filteredProducts.length === 0 ? (
              <EmptyState
                icon={<Package className="h-5 w-5" />}
                title="No products found"
                description="Try changing the search term or selected category."
              />
            ) : (
              <div className="space-y-3">
                {filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-3xl border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <img
                          src={p.image_url || "/placeholder.svg"}
                          alt={p.name}
                          className="h-16 w-16 shrink-0 rounded-2xl border border-border object-cover"
                        />

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-base font-semibold text-foreground">
                              {p.name}
                            </p>
                            {!p.is_available && (
                              <Badge className="bg-red-100 text-red-700 border-red-200">
                                Unavailable
                              </Badge>
                            )}
                            {p.is_featured && (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                Featured
                              </Badge>
                            )}
                            {p.is_popular && (
                              <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                                Popular
                              </Badge>
                            )}
                          </div>

                          <p className="mt-1 text-sm text-muted-foreground">
                            {p.description || "No description"}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="rounded-full bg-muted px-2.5 py-1">
                              {categoryNameById.get(p.category_id || "") || "No category"}
                            </span>
                            <span className="rounded-full bg-muted px-2.5 py-1">
                              Spice level: {p.spice_level ?? 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <span className="font-display text-2xl text-primary">
                          {currency(p.price)}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(p);
                              setShowProductForm(true);
                            }}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p.id)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 text-destructive transition-colors hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "categories" && (
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setEditingCategory({});
                  setShowCategoryForm(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Add Category
              </button>
            </div>

            {showCategoryForm && editingCategory && (
              <AdminModal
                title={editingCategory.id ? "Edit Category" : "New Category"}
                onClose={() => {
                  setShowCategoryForm(false);
                  setEditingCategory(null);
                }}
              >
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      placeholder="Category name"
                      value={editingCategory.name || ""}
                      onChange={(e) =>
                        setEditingCategory((p) => ({ ...p, name: e.target.value }))
                      }
                      className={inputClassName}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      placeholder="Sort order"
                      value={editingCategory.sort_order || 0}
                      onChange={(e) =>
                        setEditingCategory((p) => ({
                          ...p,
                          sort_order: Number(e.target.value),
                        }))
                      }
                      className={inputClassName}
                    />
                  </div>

                  <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCategoryForm(false);
                        setEditingCategory(null);
                      }}
                      className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCategory}
                      className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      {editingCategory.id ? "Update Category" : "Add Category"}
                    </button>
                  </div>
                </div>
              </AdminModal>
            )}

            {categories.length === 0 ? (
              <EmptyState
                icon={<Tags className="h-5 w-5" />}
                title="No categories yet"
                description="Create categories to organize your products better."
              />
            ) : (
              <div className="space-y-3">
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{c.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Sort order: {c.sort_order ?? 0}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategory(c);
                          setShowCategoryForm(true);
                        }}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(c.id)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "vouchers" && (
          <div className="mx-auto max-w-6xl space-y-4">
            <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search vouchers by code or type"
                    value={voucherSearch}
                    onChange={(e) => setVoucherSearch(e.target.value)}
                    className={`${inputClassName} pl-10`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingVoucher({ type: "discount_fixed", is_active: true });
                    setShowVoucherForm(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Add Voucher
                </button>
              </div>
            </div>

            {showVoucherForm && editingVoucher && (
              <AdminModal
                title={editingVoucher.id ? "Edit Voucher" : "New Voucher"}
                onClose={() => {
                  setShowVoucherForm(false);
                  setEditingVoucher(null);
                }}
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Code *
                      </label>
                      <input
                        type="text"
                        placeholder="Code"
                        value={editingVoucher.code || ""}
                        onChange={(e) =>
                          setEditingVoucher((p) => ({
                            ...p,
                            code: e.target.value.toUpperCase(),
                          }))
                        }
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Type *
                      </label>
                      <select
                        value={editingVoucher.type || "discount_fixed"}
                        onChange={(e) =>
                          setEditingVoucher((p) => ({ ...p, type: e.target.value }))
                        }
                        className={selectClassName}
                      >
                        <option value="discount_fixed">Fixed Discount</option>
                        <option value="discount_percentage">Percentage Discount</option>
                        <option value="prepaid">Prepaid</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Value
                      </label>
                      <input
                        type="number"
                        placeholder="Value"
                        value={editingVoucher.value ?? ""}
                        onChange={(e) =>
                          setEditingVoucher((p) => ({
                            ...p,
                            value: e.target.value === "" ? undefined : Number(e.target.value),
                          }))
                        }
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Balance
                      </label>
                      <input
                        type="number"
                        placeholder="Balance"
                        value={editingVoucher.balance ?? ""}
                        onChange={(e) =>
                          setEditingVoucher((p) => ({
                            ...p,
                            balance: e.target.value === "" ? null : Number(e.target.value),
                          }))
                        }
                        className={inputClassName}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Minimum Order
                      </label>
                      <input
                        type="number"
                        placeholder="Minimum order"
                        value={editingVoucher.min_order ?? ""}
                        onChange={(e) =>
                          setEditingVoucher((p) => ({
                            ...p,
                            min_order: e.target.value === "" ? null : Number(e.target.value),
                          }))
                        }
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Max Uses
                      </label>
                      <input
                        type="number"
                        placeholder="Max uses"
                        value={editingVoucher.max_uses ?? ""}
                        onChange={(e) =>
                          setEditingVoucher((p) => ({
                            ...p,
                            max_uses: e.target.value === "" ? null : Number(e.target.value),
                          }))
                        }
                        className={inputClassName}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Expiry Date
                    </label>
                    <input
                      type="datetime-local"
                      value={
                        editingVoucher.expires_at
                          ? new Date(editingVoucher.expires_at).toISOString().slice(0, 16)
                          : ""
                      }
                      onChange={(e) =>
                        setEditingVoucher((p) => ({
                          ...p,
                          expires_at: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : null,
                        }))
                      }
                      className={inputClassName}
                    />
                  </div>

                  <label className="flex items-center gap-3 rounded-2xl border border-border bg-background/50 p-4 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={editingVoucher.is_active ?? true}
                      onChange={(e) =>
                        setEditingVoucher((p) => ({ ...p, is_active: e.target.checked }))
                      }
                    />
                    Active
                  </label>

                  <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowVoucherForm(false);
                        setEditingVoucher(null);
                      }}
                      className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveVoucher}
                      className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      {editingVoucher.id ? "Update Voucher" : "Add Voucher"}
                    </button>
                  </div>
                </div>
              </AdminModal>
            )}

            {filteredVouchers.length === 0 ? (
              <EmptyState
                icon={<TicketPercent className="h-5 w-5" />}
                title="No vouchers found"
                description="Create a voucher or adjust the search term."
              />
            ) : (
              <div className="space-y-3">
                {filteredVouchers.map((v) => (
                  <div
                    key={v.id}
                    className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{v.code}</p>
                        {v.is_active ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200">
                            Active
                          </Badge>
                        ) : (
                          <Badge className="border-border bg-muted text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {v.type} · Value: {v.value} · Used: {v.used_count ?? 0}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-muted px-2.5 py-1">
                          Balance: {v.balance ?? 0}
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-1">
                          Min order: {v.min_order != null ? currency(v.min_order) : "None"}
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-1">
                          Expires:{" "}
                          {v.expires_at
                            ? new Date(v.expires_at).toLocaleString("en-ZA")
                            : "No expiry"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVoucher(v);
                          setShowVoucherForm(true);
                        }}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVoucher(v.id)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "customers" && (
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search users by name, email, or phone"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className={`${inputClassName} pl-10`}
                />
              </div>
            </div>

            {filteredCustomers.length === 0 ? (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="No users found"
                description="Users will appear here after they sign in for the first time."
              />
            ) : (
              <div className="space-y-3">
                {filteredCustomers.map((c) => (
                  <div
                    key={c.user_id}
                    className="rounded-3xl border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-foreground">{c.name}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {c.isAdmin ? (
                            <Badge className="border-blue-200 bg-blue-50 text-blue-700">Admin</Badge>
                          ) : (
                            <Badge className="border-border bg-muted text-muted-foreground">User</Badge>
                          )}
                          {c.assignedDriver ? (
                            <Badge className="border-orange-200 bg-orange-50 text-orange-700">
                              Driver · {c.assignedDriver.name}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          <p className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>{c.phone || "—"}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <span className="break-all">{c.email || "—"}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <Clock3 className="h-4 w-4" />
                            <span>
                              Last order: {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleString("en-ZA") : "No orders yet"}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3 sm:min-w-[320px]">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-border bg-background/50 p-4 text-center">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Orders
                            </p>
                            <p className="mt-1 font-display text-2xl text-foreground">
                              {c.totalOrders}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-border bg-background/50 p-4 text-center">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Spent
                            </p>
                            <p className="mt-1 font-display text-2xl text-primary">
                              {currency(c.totalSpent)}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border bg-background/50 p-4">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Admin Access
                          </p>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {c.isAdmin ? "Administrator" : "Standard user"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Toggle admin access for this user account.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleAdminRole(c.user_id, !c.isAdmin)}
                              className={`inline-flex min-w-28 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                                c.isAdmin
                                  ? "bg-blue-600 text-white hover:bg-blue-700"
                                  : "border border-border bg-background text-foreground hover:bg-muted"
                              }`}
                            >
                              {c.isAdmin ? "Remove Admin" : "Make Admin"}
                            </button>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border bg-background/50 p-4">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Driver Profile
                          </p>
                          <div className="mt-3 space-y-2">
                            <select
                              value={c.assignedDriver?.id || ""}
                              onChange={(e) => handleAssignDriverToUser(c.user_id, e.target.value || null)}
                              className={selectClassName}
                            >
                              <option value="">No driver profile</option>
                              {drivers.map((driver) => {
                                const isAssignedElsewhere =
                                  !!driver.auth_user_id && driver.auth_user_id !== c.user_id;

                                return (
                                  <option key={driver.id} value={driver.id} disabled={isAssignedElsewhere}>
                                    {driver.name}
                                    {isAssignedElsewhere ? " — linked to another user" : ""}
                                  </option>
                                );
                              })}
                            </select>
                            <p className="text-xs text-muted-foreground">
                              Link this user account to a driver profile so they can access the driver page.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "drivers" && (
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search drivers by name or phone"
                    value={driverSearch}
                    onChange={(e) => setDriverSearch(e.target.value)}
                    className={`${inputClassName} pl-10`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingDriver({ is_active: true });
                    setShowDriverForm(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Add Driver
                </button>
              </div>
            </div>

            {showDriverForm && editingDriver && (
              <AdminModal
                title={editingDriver.id ? "Edit Driver" : "New Driver"}
                onClose={() => {
                  setShowDriverForm(false);
                  setEditingDriver(null);
                }}
              >
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Driver Name *
                    </label>
                    <input
                      type="text"
                      placeholder="Driver name"
                      value={editingDriver.name || ""}
                      onChange={(e) =>
                        setEditingDriver((p) => ({ ...p, name: e.target.value }))
                      }
                      className={inputClassName}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Phone
                    </label>
                    <input
                      type="text"
                      placeholder="Phone"
                      value={editingDriver.phone || ""}
                      onChange={(e) =>
                        setEditingDriver((p) => ({ ...p, phone: e.target.value }))
                      }
                      className={inputClassName}
                    />
                  </div>

                  <label className="flex items-center gap-3 rounded-2xl border border-border bg-background/50 p-4 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={editingDriver.is_active ?? true}
                      onChange={(e) =>
                        setEditingDriver((p) => ({ ...p, is_active: e.target.checked }))
                      }
                    />
                    Active
                  </label>

                  <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDriverForm(false);
                        setEditingDriver(null);
                      }}
                      className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDriver}
                      className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      {editingDriver.id ? "Update Driver" : "Add Driver"}
                    </button>
                  </div>
                </div>
              </AdminModal>
            )}

            {filteredDrivers.length === 0 ? (
              <EmptyState
                icon={<Bike className="h-5 w-5" />}
                title="No drivers found"
                description="Add drivers to manage delivery operations."
              />
            ) : (
              <div className="space-y-3">
                {filteredDrivers.map((d) => (
                  <div
                    key={d.id}
                    className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{d.name}</p>
                        {d.is_active ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200">
                            Active
                          </Badge>
                        ) : (
                          <Badge className="border-border bg-muted text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{d.phone || "—"}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDriver(d);
                          setShowDriverForm(true);
                        }}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDriver(d.id)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "delivery_zone" && (
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="font-display text-2xl text-foreground">Delivery Geofencing</h2>
                <p className="text-sm text-muted-foreground">
                  Configure the center point, radius, and address pattern that define where delivery is allowed.
                </p>
              </div>

              {!deliveryZoneSettings ? (
                <p className="text-sm text-muted-foreground">Loading active delivery zone settings...</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Zone Name
                    </label>
                    <input
                      type="text"
                      value={deliveryZoneSettings.zone_name}
                      onChange={(e) =>
                        setDeliveryZoneSettings((prev) =>
                          prev ? { ...prev, zone_name: e.target.value } : prev
                        )
                      }
                      className={inputClassName}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Center Latitude
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={deliveryZoneSettings.center_lat}
                        onChange={(e) =>
                          setDeliveryZoneSettings((prev) =>
                            prev ? { ...prev, center_lat: Number(e.target.value) } : prev
                          )
                        }
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Center Longitude
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={deliveryZoneSettings.center_lng}
                        onChange={(e) =>
                          setDeliveryZoneSettings((prev) =>
                            prev ? { ...prev, center_lng: Number(e.target.value) } : prev
                          )
                        }
                        className={inputClassName}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Radius (meters)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={deliveryZoneSettings.radius_meters}
                      onChange={(e) =>
                        setDeliveryZoneSettings((prev) =>
                          prev ? { ...prev, radius_meters: Number(e.target.value) } : prev
                        )
                      }
                      className={inputClassName}
                    />
                  </div>

                  <div className="rounded-2xl border border-border bg-background p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Draw delivery zone on map
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setDeliveryZoneSettings((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    polygon_coordinates: (prev.polygon_coordinates || []).slice(0, -1),
                                  }
                                : prev
                            )
                          }
                          className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:bg-muted"
                        >
                          Undo Point
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeliveryZoneSettings((prev) =>
                              prev ? { ...prev, polygon_coordinates: [] } : prev
                            )
                          }
                          className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:bg-muted"
                        >
                          Clear Polygon
                        </button>
                      </div>
                    </div>

                    <MapView
                      {...deliveryZoneMapView}
                      onMove={(evt) => setDeliveryZoneMapView(evt.viewState)}
                      onClick={(evt) => {
                        const lat = Number(evt.lngLat.lat.toFixed(6));
                        const lng = Number(evt.lngLat.lng.toFixed(6));

                        setDeliveryZoneSettings((prev) =>
                          prev
                            ? {
                                ...prev,
                                polygon_coordinates: [...(prev.polygon_coordinates || []), [lat, lng]],
                              }
                            : prev
                        );
                      }}
                      mapStyle={DELIVERY_ZONE_MAP_STYLE}
                      reuseMaps
                      style={{ width: "100%", height: 320 }}
                    >
                      <NavigationControl position="top-right" />

                      {deliveryZonePolygonFeature && (
                        <Source id="delivery-zone-polygon" type="geojson" data={deliveryZonePolygonFeature}>
                          <Layer
                            id="delivery-zone-fill"
                            type="fill"
                            paint={{
                              "fill-color": "#ef4444",
                              "fill-opacity": 0.25,
                            }}
                          />
                          <Layer
                            id="delivery-zone-line"
                            type="line"
                            paint={{
                              "line-color": "#b91c1c",
                              "line-width": 2.5,
                            }}
                          />
                        </Source>
                      )}

                      {(deliveryZoneSettings.polygon_coordinates || []).map(([lat, lng], index) => (
                        <Marker key={`${lat}-${lng}-${index}`} longitude={lng} latitude={lat} anchor="center">
                          <div className="h-3 w-3 rounded-full border border-white bg-red-600 shadow" />
                        </Marker>
                      ))}
                    </MapView>

                    <p className="mt-2 text-xs text-muted-foreground">
                      Click map to add polygon points in order. Use at least 3 points, then save settings.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Polygon Coordinates (optional)
                    </label>
                    <textarea
                      rows={4}
                      value={JSON.stringify(deliveryZoneSettings.polygon_coordinates || [], null, 2)}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value) as Array<[number, number]>;
                          setDeliveryZoneSettings((prev) =>
                            prev ? { ...prev, polygon_coordinates: Array.isArray(parsed) ? parsed : [] } : prev
                          );
                        } catch {
                          // keep current state until valid JSON is provided
                        }
                      }}
                      className={textareaClassName}
                      placeholder='[[ -26.30, 27.75 ], [ -26.31, 27.77 ], [ -26.29, 27.78 ]]'
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add polygon points as JSON in <code>[lat, lng]</code> format. When provided, polygon overrides radius checks.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      GeoJSON (optional)
                    </label>
                    <textarea
                      rows={4}
                      value={geoJsonInput}
                      onChange={(e) => setGeoJsonInput(e.target.value)}
                      className={textareaClassName}
                      placeholder='Paste GeoJSON Feature, FeatureCollection, Polygon, or MultiPolygon here...'
                    />
                    <button
                      type="button"
                      onClick={handleConvertGeoJsonToPolygon}
                      className="mt-2 inline-flex items-center justify-center rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Convert GeoJSON → Polygon
                    </button>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Address Pattern (Regex)
                    </label>
                    <input
                      type="text"
                      value={deliveryZoneSettings.address_pattern}
                      onChange={(e) =>
                        setDeliveryZoneSettings((prev) =>
                          prev ? { ...prev, address_pattern: e.target.value } : prev
                        )
                      }
                      className={inputClassName}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Example: <code>\\bstar\\s+village\\b</code>
                    </p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Out-of-zone Message
                    </label>
                    <textarea
                      rows={3}
                      value={deliveryZoneSettings.out_of_zone_message}
                      onChange={(e) =>
                        setDeliveryZoneSettings((prev) =>
                          prev ? { ...prev, out_of_zone_message: e.target.value } : prev
                        )
                      }
                      className={textareaClassName}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveDeliveryZone}
                    disabled={savingDeliveryZone}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {savingDeliveryZone ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save Delivery Zone
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
