import { useEffect, useMemo, useState } from "react";
import {
  X,
  Minus,
  Plus,
  ShoppingBag,
  Flame,
  Star,
  ImageOff,
  Sparkles,
  Loader2,
} from "lucide-react";
import {
  getProducts,
  type Product,
  type Category,
} from "@/data/products";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";

const priceFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function getRecommendedCategories(category: Category): Category[] {
  switch (category) {
    case "Kota":
    case "Bunny Chow":
      return ["Drinks", "Sides"];
    case "Sides":
      return ["Drinks"];
    case "Drinks":
      return ["Kota", "Bunny Chow", "Combos"];
    case "Combos":
      return ["Drinks", "Sides"];
    default:
      return ["Drinks", "Sides"];
  }
}

function getRecommendationTitle(category: Category) {
  switch (category) {
    case "Kota":
    case "Bunny Chow":
      return "Complete your meal";
    case "Sides":
      return "Add a drink";
    case "Drinks":
      return "Pair it with something filling";
    case "Combos":
      return "Add a little extra";
    default:
      return "You may also like";
  }
}

export default function ProductQuickAddSheet({
  product,
  open,
  onOpenChange,
}: {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  useEffect(() => {
    if (!open) return;

    setQuantity(1);
    setNote("");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange, product.id]);

  useEffect(() => {
    if (!open) return;

    let isMounted = true;

    const loadRecommendations = async () => {
      setLoadingRecommendations(true);

      try {
        const data = await getProducts();
        if (isMounted) {
          setAllProducts(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setAllProducts([]);
        }
      } finally {
        if (isMounted) {
          setLoadingRecommendations(false);
        }
      }
    };

    loadRecommendations();

    return () => {
      isMounted = false;
    };
  }, [open, product.id]);

  const total = useMemo(() => product.price * quantity, [product.price, quantity]);
  const hasReviews = product.reviewCount > 0 && product.rating > 0;
  const hasImage = Boolean(product.image?.trim());

  const recommendations = useMemo(() => {
    const preferredCategories = getRecommendedCategories(product.category);

    return allProducts
      .filter((item) => item.id !== product.id)
      .filter((item) => item.inStock)
      .filter((item) => preferredCategories.includes(item.category))
      .sort((a, b) => {
        const aCategoryRank = preferredCategories.indexOf(a.category);
        const bCategoryRank = preferredCategories.indexOf(b.category);

        if (aCategoryRank !== bCategoryRank) {
          return aCategoryRank - bCategoryRank;
        }

        if (a.isPopular !== b.isPopular) {
          return a.isPopular ? -1 : 1;
        }

        if (a.isFeatured !== b.isFeatured) {
          return a.isFeatured ? -1 : 1;
        }

        if (a.reviewCount !== b.reviewCount) {
          return b.reviewCount - a.reviewCount;
        }

        return a.price - b.price;
      })
      .slice(0, 4);
  }, [allProducts, product.category, product.id]);

  const handleAdd = () => {
    addItem(product, {
      quantity,
      note,
    });

    toast.success(
      `${quantity} ${product.name}${quantity > 1 ? "s" : ""} added to cart`
    );
    onOpenChange(false);
  };

  const handleQuickAddSuggestion = (suggestedProduct: Product) => {
    addItem(suggestedProduct);
    toast.success(`${suggestedProduct.name} added to cart`);
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-secondary/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      <div className="fixed inset-x-0 bottom-0 z-[71] mx-auto w-full max-w-2xl overflow-hidden rounded-t-[28px] border border-border bg-card shadow-2xl md:inset-0 md:m-auto md:max-h-[88vh] md:rounded-[28px]">
        <div
          className="flex max-h-[88vh] flex-col"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-display text-2xl text-foreground">Customize Item</h2>
              <p className="text-sm text-muted-foreground">
                Review quantity and add special instructions
              </p>
            </div>

            <button
              onClick={() => onOpenChange(false)}
              className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid gap-5 md:grid-cols-[0.95fr_1.05fr]">
              <div className="overflow-hidden rounded-[24px] border border-border bg-muted">
                {hasImage ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="aspect-[4/3] h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <ImageOff className="mx-auto h-8 w-8" />
                      <p className="mt-2 text-sm font-medium">No image available</p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
                    {product.category}
                  </span>

                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
                    <Flame className="h-3 w-3 text-primary" />
                    {product.spiceLevel}
                  </span>

                  {product.isPopular && (
                    <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-foreground">
                      Popular
                    </span>
                  )}
                </div>

                <h3 className="mt-4 font-display text-4xl leading-none text-foreground">
                  {product.name}
                </h3>

                <div className="mt-3 flex items-center gap-3">
                  <p className="text-3xl font-bold text-primary">
                    {priceFormatter.format(product.price)}
                  </p>

                  {hasReviews && (
                    <div className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm font-semibold text-foreground">
                      <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                      {product.rating.toFixed(1)}
                      <span className="text-xs font-medium text-muted-foreground">
                        ({product.reviewCount})
                      </span>
                    </div>
                  )}
                </div>

                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {product.description}
                </p>

                <div className="mt-5 rounded-2xl border border-border bg-background p-4">
                  <label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Quantity
                  </label>

                  <div className="mt-3 inline-flex items-center rounded-xl border border-border bg-card">
                    <button
                      onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-l-xl text-foreground transition-colors hover:bg-muted"
                    >
                      <Minus className="h-4 w-4" />
                    </button>

                    <span className="inline-flex min-w-12 items-center justify-center text-base font-semibold text-foreground">
                      {quantity}
                    </span>

                    <button
                      onClick={() => setQuantity((prev) => prev + 1)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-r-xl text-foreground transition-colors hover:bg-muted"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-border bg-background p-4">
                  <label
                    htmlFor={`note-${product.id}`}
                    className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Special instructions
                  </label>

                  <textarea
                    id={`note-${product.id}`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={4}
                    maxLength={180}
                    placeholder="Example: no onions, extra sauce, cut in half"
                    className="mt-3 w-full resize-none rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                  />

                  <div className="mt-2 text-right text-xs text-muted-foreground">
                    {note.length}/180
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[24px] border border-border bg-background p-4">
              <div className="mb-4 flex items-start gap-3">
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>

                <div>
                  <h4 className="text-base font-semibold text-foreground">
                    {getRecommendationTitle(product.category)}
                  </h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add a quick extra without leaving this item.
                  </p>
                </div>
              </div>

              {loadingRecommendations ? (
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading suggestions...
                </div>
              ) : recommendations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                  No recommendations available right now.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {recommendations.map((item) => {
                    const suggestionHasImage = Boolean(item.image?.trim());
                    const suggestionHasReviews =
                      item.reviewCount > 0 && item.rating > 0;

                    return (
                      <div
                        key={item.id}
                        className="overflow-hidden rounded-2xl border border-border bg-card"
                      >
                        <div className="flex gap-3 p-3">
                          {suggestionHasImage ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="h-20 w-20 rounded-xl object-cover"
                            />
                          ) : (
                            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                              <ImageOff className="h-5 w-5" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-foreground">
                                  {item.name}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-primary">
                                  {priceFormatter.format(item.price)}
                                </p>
                              </div>

                              <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                {item.category}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {suggestionHasReviews ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                                  <Star className="h-3 w-3 fill-accent text-accent" />
                                  {item.rating.toFixed(1)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                  New
                                </span>
                              )}

                              {item.isPopular && (
                                <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-foreground">
                                  Popular
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => handleQuickAddSuggestion(item)}
                              className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Total
                </p>
                <p className="text-3xl font-bold text-foreground">
                  {priceFormatter.format(total)}
                </p>
              </div>

              <div className="text-right text-sm text-muted-foreground">
                {quantity} × {priceFormatter.format(product.price)}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[0.9fr_1.1fr]">
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>

              <button
                onClick={handleAdd}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <ShoppingBag className="h-4 w-4" />
                Add to cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}