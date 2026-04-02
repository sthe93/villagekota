import { useEffect, useRef, useState } from "react";
import {
  Flame,
  Plus,
  ShoppingBag,
  Sparkles,
  Star,
  ImageOff,
  SlidersHorizontal,
} from "lucide-react";
import type { Product } from "@/data/products";
import ProductQuickAddSheet from "@/components/ProductQuickAddSheet";
import { useCart } from "@/context/CartContext";

const priceFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const spiceConfig: Record<
  string,
  {
    text: string;
    bg: string;
    border: string;
  }
> = {
  Mild: {
    text: "text-success",
    bg: "bg-success/10",
    border: "border-success/20",
  },
  Medium: {
    text: "text-accent-foreground",
    bg: "bg-accent/25",
    border: "border-accent/40",
  },
  Hot: {
    text: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
  },
  "Extra Hot": {
    text: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
  },
};

export default function ProductCard({ product }: { product: Product }) {
  const { itemCount } = useCart();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState(false);
  const previousItemCountRef = useRef(itemCount);
  const previousQuickAddOpenRef = useRef(quickAddOpen);
  const addFeedbackTimerRef = useRef<number | null>(null);

  const spiceStyle = product.spiceLevel
    ? spiceConfig[product.spiceLevel] ?? {
        text: "text-muted-foreground",
        bg: "bg-muted",
        border: "border-border",
      }
    : null;

  const hasReviews = product.reviewCount > 0 && product.rating > 0;
  const hasImage = Boolean(product.image?.trim());
  const hasCustomisation = product.hasOptions;

  const openQuickAdd = () => {
    if (!product.inStock) return;
    setQuickAddOpen(true);
  };

  useEffect(() => {
    const didCloseSheet = previousQuickAddOpenRef.current && !quickAddOpen;
    const cartIncreased = itemCount > previousItemCountRef.current;

    if (didCloseSheet && cartIncreased) {
      setRecentlyAdded(true);
      window.dispatchEvent(new CustomEvent("cart:add-feedback"));
      if (addFeedbackTimerRef.current) {
        window.clearTimeout(addFeedbackTimerRef.current);
      }
      addFeedbackTimerRef.current = window.setTimeout(() => {
        setRecentlyAdded(false);
        addFeedbackTimerRef.current = null;
      }, 1200);
    }

    previousQuickAddOpenRef.current = quickAddOpen;
    previousItemCountRef.current = itemCount;
  }, [quickAddOpen, itemCount]);

  useEffect(() => {
    return () => {
      if (addFeedbackTimerRef.current) {
        window.clearTimeout(addFeedbackTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <article
        onClick={openQuickAdd}
        onKeyDown={(event) => {
          if (!product.inStock) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openQuickAdd();
          }
        }}
        role={product.inStock ? "button" : undefined}
        tabIndex={product.inStock ? 0 : -1}
        className={`group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-card transition-all duration-300 animate-fade-in ${
          product.inStock
            ? "cursor-pointer hover:-translate-y-1 hover:shadow-card-hover"
            : "cursor-default"
        }`}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {hasImage ? (
            <img
              src={product.image}
              alt={product.name}
              className={`h-full w-full object-cover transition-transform duration-500 ${
                product.inStock ? "group-hover:scale-105" : "opacity-70 grayscale-[0.15]"
              }`}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
              <div className="text-center">
                <ImageOff className="mx-auto h-8 w-8" />
                <p className="mt-2 text-sm font-medium">No image available</p>
              </div>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-secondary/45 via-secondary/10 to-transparent" />

          <div className="absolute left-3 top-3 flex max-w-[72%] flex-wrap gap-2">
            <span className="rounded-full bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground shadow-md">
              {product.category}
            </span>

            {hasCustomisation && (
              <span className="inline-flex items-center gap-1 rounded-full bg-background/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground shadow-md">
                <SlidersHorizontal className="h-3 w-3" />
                Customisable
              </span>
            )}

            {product.isPopular && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-foreground shadow-md">
                <Sparkles className="h-3 w-3" />
                Popular
              </span>
            )}

            {!product.isPopular && product.isFeatured && (
              <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-foreground shadow-md">
                Featured
              </span>
            )}
          </div>

          <div className="absolute right-3 top-3">
            <div className="rounded-2xl bg-primary px-4 py-2 shadow-md">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-primary-foreground/80">
                {hasCustomisation ? "From" : "Price"}
              </p>
              <p className="text-xl font-bold leading-none text-primary-foreground">
                {priceFormatter.format(product.price)}
              </p>
            </div>
          </div>

          {!product.inStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-secondary/65 backdrop-blur-[2px]">
              <div className="rounded-2xl border border-white/10 bg-background/92 px-5 py-3 text-center shadow-lg">
                <p className="font-display text-2xl tracking-wide text-foreground">Sold Out</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Available again soon
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h3 className="font-display text-[1.45rem] leading-tight text-foreground">
            {product.name}
          </h3>

          {hasCustomisation && (
            <div className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary">
              <SlidersHorizontal className="h-4 w-4" />
              Choose options, extras, or meal preferences
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm font-semibold text-foreground">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
              {hasReviews ? product.rating.toFixed(1) : "New"}
              {hasReviews && (
                <span className="text-xs font-medium text-muted-foreground">
                  ({product.reviewCount})
                </span>
              )}
            </div>

            {product.spiceLevel && spiceStyle && (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${spiceStyle.bg} ${spiceStyle.border} ${spiceStyle.text}`}
              >
                <Flame className="h-3 w-3" />
                {product.spiceLevel}
              </span>
            )}

            {hasReviews && product.reviewCount >= 20 && !product.isPopular && (
              <span className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Customer favourite
              </span>
            )}
          </div>

          <p className="mt-4 line-clamp-3 min-h-[72px] text-sm leading-6 text-muted-foreground font-body">
            {product.description}
          </p>

          <div className="mt-auto pt-5">
            <button
              onClick={(event) => {
                event.stopPropagation();
                openQuickAdd();
              }}
              disabled={!product.inStock}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              {product.inStock ? (
                <>
                  {hasCustomisation ? (
                    <SlidersHorizontal className="h-4 w-4" />
                  ) : (
                    <ShoppingBag className="h-4 w-4" />
                  )}
                  {recentlyAdded
                    ? "Added +1"
                    : hasCustomisation
                      ? "Customise & add"
                      : "Add to cart"}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Unavailable
                </>
              )}
            </button>
          </div>
        </div>
      </article>

      <ProductQuickAddSheet
        product={product}
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
      />
    </>
  );
}
