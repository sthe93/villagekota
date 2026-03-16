import { X, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Link } from "react-router-dom";

export default function CartDrawer() {
  const { items, isOpen, setOpen, removeItem, updateQuantity, clearCart, subtotal, deliveryFee, total, itemCount } =
    useCart();

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-secondary/50 z-50" onClick={() => setOpen(false)} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card z-50 shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-display text-2xl text-foreground">YOUR CART ({itemCount})</h2>
          <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
            <ShoppingBag className="w-16 h-16 text-muted-foreground/30" />
            <p className="text-muted-foreground font-medium">Your cart is empty</p>
            <button
              onClick={() => setOpen(false)}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Browse Menu
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.map((item) => (
                <div key={item.product.id} className="flex gap-3 bg-muted rounded-lg p-3">
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="w-20 h-20 object-cover rounded-md"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-display text-lg text-foreground leading-tight truncate">
                      {item.product.name}
                    </h4>
                    <p className="text-sm font-semibold text-success mt-0.5">R{item.product.price}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="w-7 h-7 rounded-md bg-card flex items-center justify-center hover:bg-border transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="w-7 h-7 rounded-md bg-card flex items-center justify-center hover:bg-border transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeItem(item.product.id)}
                        className="ml-auto p-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-border p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium text-foreground">R{subtotal}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery</span>
                <span className="font-medium text-foreground">R{deliveryFee}</span>
              </div>
              <div className="flex justify-between text-lg font-display">
                <span className="text-foreground">TOTAL</span>
                <span className="text-primary">R{total}</span>
              </div>

              <Link
                to="/checkout"
                onClick={() => setOpen(false)}
                className="block w-full text-center bg-primary text-primary-foreground py-3 rounded-md font-medium hover:opacity-90 transition-opacity"
              >
                Checkout
              </Link>
              <button
                onClick={clearCart}
                className="w-full text-center text-sm text-muted-foreground hover:text-destructive transition-colors py-1"
              >
                Clear Cart
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
