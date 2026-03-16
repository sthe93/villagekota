import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import Footer from "@/components/Footer";

export default function CheckoutPage() {
  const { items, subtotal, deliveryFee, total, clearCart } = useCart();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: profile?.display_name || "",
    phone: profile?.phone || "",
    email: profile?.email || user?.email || "",
    address: profile?.default_address || "",
    notes: "",
    payment: "cash",
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

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
        total,
      }).select("id").single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      setSubmitted(true);
      clearCart();
    } catch (err: any) {
      toast.error(err.message || "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center max-w-md px-6 animate-fade-in">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h1 className="font-display text-4xl text-foreground mb-2">ORDER PLACED!</h1>
          <p className="text-muted-foreground font-body mb-6">
            Thank you, {form.name}! Your order has been placed and will be delivered to your address shortly.
          </p>
          <button
            onClick={() => navigate("/")}
            className="bg-primary text-primary-foreground px-8 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

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
            <button
              onClick={() => navigate("/menu")}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
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
                      {m === "eft" ? "EFT" : m}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={submitting || !user}
                className="w-full bg-primary text-primary-foreground py-3.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity mt-4 disabled:opacity-50">
                {submitting ? "Placing Order..." : `Place Order — R${total}`}
              </button>
            </form>

            <div className="lg:col-span-2">
              <div className="bg-card rounded-lg border border-border p-5 sticky top-24">
                <h3 className="font-display text-xl text-foreground mb-4">ORDER SUMMARY</h3>
                <div className="space-y-3 mb-4">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.product.name} × {item.quantity}</span>
                      <span className="font-medium text-foreground">R{item.product.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">R{subtotal}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery</span>
                    <span className="text-foreground">R{deliveryFee}</span>
                  </div>
                  <div className="flex justify-between font-display text-lg pt-2 border-t border-border">
                    <span className="text-foreground">TOTAL</span>
                    <span className="text-primary">R{total}</span>
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
