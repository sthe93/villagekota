import { ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";

export default function CartFAB() {
  const { toggleCart, itemCount, total } = useCart();

  if (itemCount === 0) return null;

  return (
    <button
      onClick={toggleCart}
      className="fixed bottom-6 right-6 z-40 bg-primary text-primary-foreground rounded-2xl px-5 py-3.5 shadow-fab flex items-center gap-3 hover:opacity-90 transition-all animate-scale-in md:hidden"
    >
      <ShoppingBag className="w-5 h-5" />
      <span className="font-medium text-sm">{itemCount} items</span>
      <span className="font-display text-lg">R{total}</span>
    </button>
  );
}
