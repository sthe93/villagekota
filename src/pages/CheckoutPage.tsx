import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Tag, Loader2 } from "lucide-react";
import Footer from "@/components/Footer";

interface VoucherInfo {
  id: string;
  code: string;
  type: string;
  value: number;
  balance: number;
  discountAmount: number;
}

export default function CheckoutPage() {
  const { items, subtotal, deliveryFee, total, clearCart } = useCart();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherInfo, setVoucherInfo] = useState<VoucherInfo | null>(null);
  const [applyingVoucher, setApplyingVoucher] = useState(false);
  const [form, setForm] = useState({
    name: profile?.display_name || "",
    phone: profile?.phone || "",
    email: profile?.email || user?.email || "",
    address: profile?.default_address || "",
    notes: "",
    payment: "cash",
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const discountAmount = voucherInfo?.discountAmount || 0;
  const adjustedTotal = Math.max(0, total - discountAmount);

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

      if (error || !data) { toast.error("Invalid voucher code"); setApplyingVoucher(false); return; }

      // Check expiry
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        toast.error("This voucher has expired"); setApplyingVoucher(false); return;
      }
      // Check max uses
      if (data.max_uses && data.used_count >= data.max_uses) {
        toast.error("This voucher has been fully redeemed"); setApplyingVoucher(false); return;
      }
      // Check min order
      if (data.min_order && subtotal < Number(data.min_order)) {
        toast.error(`Minimum order of R${data.min_order} required`); setApplyingVoucher(false); return;
      }

      let disc = 0;
      if (data.type === "discount_percentage") disc = Math.round(subtotal * (Number(data.value) / 100));
      else if (data.type === "discount_fixed") disc = Math.min(Number(data.value), total);
      else if (data.type === "prepaid") disc = Math.min(Number(data.balance), total);

      setVoucherInfo({ id: data.id, code: data.code, type: data.type, value: Number(data.value), balance: Number(data.balance), discountAmount: disc });
      toast.success(`Voucher applied: -R${disc}`);
    } catch { toast.error("Failed to apply voucher"); }
    setApplyingVoucher(false);
  };

  const removeVoucher = () => { setVoucherInfo(null); setVoucherCode(""); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { toast.error("Your cart is empty"); return; }
    if (!form.name || !form.phone || !form.address) { toast.error("Please fill in all required fields"); return; }
    if (!user) { toast.error("Please sign in to place an order"); navigate("/auth"); return; }

    setSubmitting(true);
    try {
      // Create order
      const { data: order, error: orderError } = await supabase.from("orders").insert({
        user_id: user.id,
        customer_name: form.name,
        customer_phone: form.phone,
        customer_email: form.email || null,
        delivery_address: form.address,
        notes: form.notes || null,
        payment_method: form.payment,
        subtotal,
        delivery_fee: deliveryFee,
        discount_amount: discountAmount,
        voucher_code: voucherInfo?.code || null,
        total: adjustedTotal,
      }).select("id").single();

      if (orderError) throw orderError;

      // Create order items
     // Create order items
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const orderItems = items.map((item) => ({
  order_id: order.id,
  product_id: isUuid(item.product.id) ? item.product.id : null,
  product_name: item.product.name,
  quantity: item.quantity,
  unit_price: item.product.price,
  total_price: item.product.price * item.quantity,
}));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      // Record voucher redemption
      if (voucherInfo) {
        await supabase.from("voucher_redemptions").insert({
          voucher_id: voucherInfo.id,
          order_id: order.id,
          user_id: user.id,
          amount: discountAmount,
        });
        // Update voucher used_count / balance
        if (voucherInfo.type === "prepaid") {
          await supabase.from("vouchers").update({
            balance: voucherInfo.balance - discountAmount,
            used_count: (voucherInfo as any).used_count ? (voucherInfo as any).used_count + 1 : 1,
          }).eq("id", voucherInfo.id);
        } else {
          await supabase.from("vouchers").update({
            used_count: (voucherInfo as any).used_count ? (voucherInfo as any).used_count + 1 : 1,
          }).eq("id", voucherInfo.id);
        }
      }

      // For card payment, redirect to Stripe
      if (form.payment === "card") {
        const lineItems = items.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price - (discountAmount > 0 ? (discountAmount / items.reduce((s, i) => s + i.quantity, 0)) / item.quantity : 0),
        }));

        const { data: stripeData, error: stripeError } = await supabase.functions.invoke("create-checkout", {
          body: {
            orderId: order.id,
            items: items.map((item) => ({
              name: item.product.name,
              quantity: item.quantity,
              price: item.product.price,
            })),
            total: adjustedTotal,
            customerEmail: form.email || user.email,
          },
        });

        if (stripeError || !stripeData?.url) {
          toast.error("Failed to start card payment. Your order has been saved — please try again or choose another payment method.");
          navigate(`/order-tracking/${order.id}`);
        } else {
          clearCart();
          window.location.href = stripeData.url;
          return;
        }
      } else {
        clearCart();
        navigate(`/order-tracking/${order.id}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="container py-8">
        <h1 className="font-display text-5xl text-foreground text-center mb-8">CHECKOUT</h1>

        {!user && (
          <div className="max-w-md mx-auto bg-accent/10 border border-accent/30 rounded-lg p-4 mb-6 text-center">
            <p className="text-sm text-foreground font-medium mb-2">Sign in to place your order</p>
            <button onClick={() => navigate("/auth")}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              Sign In
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg font-medium mb-4">Your cart is empty</p>
            <button onClick={() => navigate("/menu")}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              Browse Menu
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 max-w-5xl mx-auto">
            <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Full Name *</label>
                <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-body" required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Phone *</label>
                  <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-body" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-body" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Delivery Address *</label>
                <textarea value={form.address} onChange={(e) => update("address", e.target.value)} rows={2}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-body resize-none" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Order Notes</label>
                <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} placeholder="e.g. Extra hot sauce, no onions..."
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-body resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Payment Method</label>
                <div className="flex gap-3">
                  {["cash", "card", "eft"].map((m) => (
                    <button key={m} type="button" onClick={() => update("payment", m)}
                      className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors capitalize ${
                        form.payment === m ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted"
                      }`}>
                      {m === "eft" ? "EFT" : m === "card" ? "Card 💳" : m}
                    </button>
                  ))}
                </div>
                {form.payment === "card" && (
                  <p className="text-xs text-muted-foreground mt-1.5">You'll be redirected to Stripe for secure card payment.</p>
                )}
              </div>
              <button type="submit" disabled={submitting || !user}
                className="w-full bg-primary text-primary-foreground py-3.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity mt-4 disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? "Placing Order..." : `Place Order — R${adjustedTotal}`}
              </button>
            </form>

            <div className="lg:col-span-2">
              <div className="bg-card rounded-lg border border-border p-5 sticky top-24 space-y-4">
                <h3 className="font-display text-xl text-foreground">ORDER SUMMARY</h3>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.product.name} × {item.quantity}</span>
                      <span className="font-medium text-foreground">R{item.product.price * item.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* Voucher input */}
                <div className="border-t border-border pt-3">
                  <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Voucher / Gift Card</label>
                  {voucherInfo ? (
                    <div className="flex items-center justify-between bg-success/10 border border-success/30 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-success" />
                        <span className="text-sm font-medium text-success">{voucherInfo.code} (-R{voucherInfo.discountAmount})</span>
                      </div>
                      <button type="button" onClick={removeVoucher} className="text-xs text-destructive hover:underline">Remove</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                        placeholder="Enter code"
                        className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-body"
                      />
                      <button
                        type="button"
                        onClick={handleApplyVoucher}
                        disabled={applyingVoucher || !voucherCode.trim()}
                        className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
                      >
                        {applyingVoucher ? "..." : "Apply"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-3 space-y-2">
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
                  <div className="flex justify-between font-display text-lg pt-2 border-t border-border">
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
