import { useEffect, useRef, useState } from "react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Tag, Loader2, MapPin } from "lucide-react";
import Footer from "@/components/Footer";

type PaymentMethod = "cash" | "card" | "eft";

interface VoucherInfo {
  id: string;
  code: string;
  type: string;
  value: number;
  balance: number;
  usedCount: number;
  discountAmount: number;
}

interface AddressSuggestion {
  id: string;
  place_name: string;
  lat: number;
  lng: number;
}

export default function CheckoutPage() {
  const { items, subtotal, deliveryFee, total, clearCart } = useCart();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherInfo, setVoucherInfo] = useState<VoucherInfo | null>(null);
  const [applyingVoucher, setApplyingVoucher] = useState(false);

  const [form, setForm] = useState({
    name: profile?.display_name || "",
    phone: profile?.phone || "",
    email: user?.email || "",
    address: profile?.default_address || "",
    notes: "",
    payment: "cash" as PaymentMethod,
  });

  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<{
    lat: number | null;
    lng: number | null;
  }>({
    lat: null,
    lng: null,
  });

  const addressBoxRef = useRef<HTMLDivElement | null>(null);

  const update = (field: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));

    if (field === "address") {
      setSelectedDestination({ lat: null, lng: null });
    }
  };

  const discountAmount = voucherInfo?.discountAmount || 0;
  const adjustedTotal = Math.max(0, total - discountAmount);

  const geocodeAddress = async (address: string) => {
    const key = import.meta.env.VITE_MAPTILER_KEY;
    if (!key) return null;

    const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(
      address
    )}.json?limit=1&country=za&key=${key}`;

    const res = await fetch(url);
    const json = await res.json();

    const first = json?.features?.[0];
    if (!first?.center) return null;

    return {
      lng: first.center[0],
      lat: first.center[1],
    };
  };

  const searchAddresses = async (query: string) => {
    if (query.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }

    setAddressLoading(true);

    try {
      const key = import.meta.env.VITE_MAPTILER_KEY;
      if (!key) {
        setAddressSuggestions([]);
        return;
      }

      const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(
        query
      )}.json?limit=5&country=za&key=${key}`;

      const res = await fetch(url);
      const json = await res.json();

      const suggestions: AddressSuggestion[] = (json?.features || []).map(
        (feature: any, index: number) => ({
          id: feature.id || `${feature.place_name}-${index}`,
          place_name: feature.place_name,
          lat: feature.center[1],
          lng: feature.center[0],
        })
      );

      setAddressSuggestions(suggestions);
      setShowSuggestions(true);
    } catch {
      setAddressSuggestions([]);
    } finally {
      setAddressLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (
        form.address.trim().length >= 3 &&
        selectedDestination.lat == null &&
        selectedDestination.lng == null
      ) {
        searchAddresses(form.address);
      } else if (form.address.trim().length < 3) {
        setAddressSuggestions([]);
        setShowSuggestions(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [form.address, selectedDestination.lat, selectedDestination.lng]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addressBoxRef.current && !addressBoxRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;

    setApplyingVoucher(true);

    try {
      const { data, error } = await supabase
        .from("vouchers")
        .select("*")
        .eq("code", voucherCode.trim().toUpperCase())
        .eq("is_active", true)
        .single();

      if (error || !data) {
        toast.error("Invalid voucher code");
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        toast.error("This voucher has expired");
        return;
      }

      if (data.max_uses && data.used_count >= data.max_uses) {
        toast.error("This voucher has been fully redeemed");
        return;
      }

      if (data.min_order && subtotal < Number(data.min_order)) {
        toast.error(`Minimum order of R${data.min_order} required`);
        return;
      }

      let disc = 0;

      if (data.type === "discount_percentage") {
        disc = Math.round(subtotal * (Number(data.value) / 100));
      } else if (data.type === "discount_fixed") {
        disc = Math.min(Number(data.value), total);
      } else if (data.type === "prepaid") {
        disc = Math.min(Number(data.balance), total);
      }

      setVoucherInfo({
        id: data.id,
        code: data.code,
        type: data.type,
        value: Number(data.value),
        balance: Number(data.balance || 0),
        usedCount: Number(data.used_count || 0),
        discountAmount: disc,
      });

      toast.success(`Voucher applied: -R${disc}`);
    } catch {
      toast.error("Failed to apply voucher");
    } finally {
      setApplyingVoucher(false);
    }
  };

  const removeVoucher = () => {
    setVoucherInfo(null);
    setVoucherCode("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!user) {
      toast.error("Please sign in to place an order");
      navigate("/auth");
      return;
    }

    const customerEmail = form.email.trim() || user.email || "";

    if (form.payment === "card" && !customerEmail) {
      toast.error("Email is required for card payments.");
      return;
    }

    setSubmitting(true);

    try {
      const isUuid = (value: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          value
        );

      const candidateProductIds = items
        .map((item) => item.product.id)
        .filter((id): id is string => Boolean(id) && isUuid(id));

      const { data: existingProducts, error: productsCheckError } = await supabase
        .from("products")
        .select("id")
        .in("id", candidateProductIds);

      if (productsCheckError) throw productsCheckError;

      const validProductIds = new Set((existingProducts || []).map((p) => p.id));

      const orderItems = items.map((item) => ({
        product_id: validProductIds.has(item.product.id) ? item.product.id : null,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity,
      }));

      const hasMissingProducts = orderItems.some((item) => item.product_id === null);

      if (hasMissingProducts) {
        toast.error("Some cart items are outdated. Please clear your cart and add them again.");
        throw new Error("Cart contains outdated product references");
      }

      const destination =
        selectedDestination.lat != null && selectedDestination.lng != null
          ? selectedDestination
          : await geocodeAddress(form.address);

      const paymentProvider =
        form.payment === "card" ? "payfast" : form.payment === "eft" ? "eft" : null;

      const paymentStatus = form.payment === "card" || form.payment === "eft" ? "pending" : null;

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          customer_name: form.name.trim(),
          customer_phone: form.phone.trim(),
          customer_email: customerEmail || null,
          delivery_address: form.address.trim(),
          destination_lat: destination?.lat ?? null,
          destination_lng: destination?.lng ?? null,
          notes: form.notes.trim() || null,
          payment_method: form.payment,
          payment_provider: paymentProvider,
          payment_status: paymentStatus,
          subtotal,
          delivery_fee: deliveryFee,
          discount_amount: discountAmount,
          voucher_code: voucherInfo?.code || null,
          total: adjustedTotal,
        })
        .select("id")
        .single();

      if (orderError) throw orderError;

      const orderItemsPayload = orderItems.map((item) => ({
        order_id: order.id,
        ...item,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItemsPayload);
      if (itemsError) throw itemsError;

      if (voucherInfo) {
        const { error: redemptionError } = await supabase.from("voucher_redemptions").insert({
          voucher_id: voucherInfo.id,
          order_id: order.id,
          user_id: user.id,
          amount: discountAmount,
        });

        if (redemptionError) throw redemptionError;

        const voucherUpdatePayload: {
          used_count: number;
          balance?: number;
        } = {
          used_count: voucherInfo.usedCount + 1,
        };

        if (voucherInfo.type === "prepaid") {
          voucherUpdatePayload.balance = Math.max(0, voucherInfo.balance - discountAmount);
        }

        const { error: voucherUpdateError } = await supabase
          .from("vouchers")
          .update(voucherUpdatePayload)
          .eq("id", voucherInfo.id);

        if (voucherUpdateError) throw voucherUpdateError;
      }

      if (form.payment === "card") {
        const { data: payfastData, error: payfastError } = await supabase.functions.invoke(
          "create-payfast-checkout",
          {
            body: {
              orderId: order.id,
              total: adjustedTotal,
              customerName: form.name.trim(),
              customerEmail,
              itemName: `Village Eats Order #${order.id.slice(0, 8).toUpperCase()}`,
            },
          }
        );

        if (payfastError || !payfastData?.url) {
          toast.error(
            `Failed to start payment: ${payfastError?.message || "No payment URL returned"}`
          );
          navigate(`/order-tracking/${order.id}`);
          return;
        }

        clearCart();
        window.location.href = payfastData.url;
        return;
      }

      if (form.payment === "eft") {
        clearCart();
        toast.success("Order placed. Please complete your EFT payment and keep your order reference.");
        navigate(`/order-tracking/${order.id}`);
        return;
      }

      clearCart();
      toast.success("Order placed successfully.");
      navigate(`/order-tracking/${order.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="container py-8">
        <h1 className="mb-8 text-center font-display text-5xl text-foreground">CHECKOUT</h1>

        {!user && (
          <div className="mx-auto mb-6 max-w-md rounded-lg border border-accent/30 bg-accent/10 p-4 text-center">
            <p className="mb-2 text-sm font-medium text-foreground">Sign in to place your order</p>
            <button
              onClick={() => navigate("/auth")}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Sign In
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="py-20 text-center">
            <p className="mb-4 text-lg font-medium text-muted-foreground">Your cart is empty</p>
            <button
              onClick={() => navigate("/menu")}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Browse Menu
            </button>
          </div>
        ) : (
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-5">
            <form onSubmit={handleSubmit} className="space-y-4 lg:col-span-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-4 py-2.5 font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-4 py-2.5 font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-4 py-2.5 font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div ref={addressBoxRef} className="relative">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Delivery Address *
                </label>
                <textarea
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  onFocus={() => {
                    if (addressSuggestions.length > 0) setShowSuggestions(true);
                  }}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-border bg-card px-4 py-2.5 font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />

                {addressLoading && (
                  <div className="absolute right-3 top-10 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                )}

                {showSuggestions && addressSuggestions.length > 0 && (
                  <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-border bg-card shadow-card">
                    {addressSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => {
                          setForm((f) => ({ ...f, address: suggestion.place_name }));
                          setSelectedDestination({ lat: suggestion.lat, lng: suggestion.lng });
                          setAddressSuggestions([]);
                          setShowSuggestions(false);
                        }}
                        className="w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted last:border-b-0"
                      >
                        <div className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span className="text-sm text-foreground">{suggestion.place_name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Order Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  rows={2}
                  placeholder="e.g. Extra hot sauce, no onions..."
                  className="w-full resize-none rounded-lg border border-border bg-card px-4 py-2.5 font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Payment Method
                </label>

                <div className="flex gap-3">
                  {[
                    { value: "cash" as PaymentMethod, label: "Cash" },
                    { value: "card" as PaymentMethod, label: "Card / PayFast" },
                    { value: "eft" as PaymentMethod, label: "EFT" },
                  ].map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => update("payment", m.value)}
                      className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                        form.payment === m.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {form.payment === "card" && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    You&apos;ll be redirected to PayFast for secure card payment. An email address is required.
                  </p>
                )}

                {form.payment === "eft" && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    EFT orders are created with payment pending. Dispatch and preparation should only continue after your EFT payment is confirmed manually.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || !user}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Placing Order..." : `Place Order — R${adjustedTotal}`}
              </button>
            </form>

            <div className="lg:col-span-2">
              <div className="sticky top-24 space-y-4 rounded-lg border border-border bg-card p-5">
                <h3 className="font-display text-xl text-foreground">ORDER SUMMARY</h3>

                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.product.name} × {item.quantity}
                      </span>
                      <span className="font-medium text-foreground">
                        R{item.product.price * item.quantity}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-3">
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Voucher / Gift Card
                  </label>

                  {voucherInfo ? (
                    <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success/10 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-success" />
                        <span className="text-sm font-medium text-success">
                          {voucherInfo.code} (-R{voucherInfo.discountAmount})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={removeVoucher}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                        placeholder="Enter code"
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        type="button"
                        onClick={handleApplyVoucher}
                        disabled={applyingVoucher || !voucherCode.trim()}
                        className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        {applyingVoucher ? "..." : "Apply"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2 border-t border-border pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">R{subtotal}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-success">
                      <span>Discount</span>
                      <span>-R{discountAmount}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery</span>
                    <span className="text-foreground">R{deliveryFee}</span>
                  </div>

                  <div className="flex justify-between border-t border-border pt-2 font-display text-lg">
                    <span className="text-foreground">TOTAL</span>
                    <span className="text-primary">R{adjustedTotal}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}