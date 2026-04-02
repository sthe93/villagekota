import { useEffect, useRef, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";

const priceFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export default function CartFAB() {
  const { toggleCart, itemCount, total } = useCart();
  const [pulse, setPulse] = useState(false);
  const pulseTimeoutRef = useRef<number | null>(null);
  const itemLabel = itemCount === 1 ? "item" : "items";

  useEffect(() => {
    const handlePulse = () => {
      setPulse(true);
      if (pulseTimeoutRef.current) {
        window.clearTimeout(pulseTimeoutRef.current);
      }
      pulseTimeoutRef.current = window.setTimeout(() => {
        setPulse(false);
        pulseTimeoutRef.current = null;
      }, 800);
    };

    window.addEventListener("cart:add-feedback", handlePulse as EventListener);
    return () => {
      window.removeEventListener("cart:add-feedback", handlePulse as EventListener);
      if (pulseTimeoutRef.current) {
        window.clearTimeout(pulseTimeoutRef.current);
      }
    };
  }, []);

  if (itemCount === 0) return null;

  return (
    <button
      onClick={toggleCart}
      aria-label={`Open cart with ${itemCount} ${itemLabel}, total ${priceFormatter.format(total)}`}
      className={`fixed bottom-6 right-6 z-40 bg-primary text-primary-foreground rounded-2xl px-5 py-3.5 shadow-fab flex items-center gap-3 hover:opacity-90 transition-all animate-scale-in md:hidden ${pulse ? "scale-110" : ""}`}
    >
      <ShoppingBag className="w-5 h-5" />
      <span className="font-medium text-sm">
        {itemCount} {itemLabel}
      </span>
      <span className="font-display text-lg">{priceFormatter.format(total)}</span>
    </button>
  );
}
