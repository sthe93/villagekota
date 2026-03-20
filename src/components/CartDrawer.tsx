import { useEffect, useMemo, useState } from "react";
import {
  X,
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  ImageOff,
  Sparkles,
  Star,
  Loader2,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Link } from "react-router-dom";
import { getProducts, type Category, type Product } from "@/data/products";
import { toast } from "sonner";

const priceFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function getDrawerRecommendationCategories(categoriesInCart: Category[]): Category[] {
  const hasMain = categoriesInCart.some((category) =>
    ["Kota", "Bunny Chow", "Combos"].includes(category)
  );
  const hasSides = categoriesInCart.includes("Sides");
  const hasDrinks = categoriesInCart.includes("Drinks");

  if (hasMain && !hasDrinks) return ["Drinks", "Sides"];
  if (hasMain && hasDrinks) return ["Sides"];
  if (hasSides && !hasDrinks) return ["Drinks"];
  if (hasDrinks && !hasMain) return ["Kota", "Bunny Chow", "Combos"];
  return ["Kota", "Bunny Chow", "Sides", "Drinks", "Combos"];
}

function getDrawerRecommendationTitle(categoriesInCart: Category[]) {
  const hasMain = categoriesInCart.some((category) =>
    ["Kota", "Bunny Chow", "Combos"].includes(category)
  );
  const hasDrinks = categoriesInCart.includes("Drinks");

  if (hasMain && !hasDrinks) return "Add a drink or side";
  if (hasMain && hasDrinks) return "Complete your meal";
  if (hasDrinks) return "Pair it with something filling";
  return "You may also like";
}

export default function CartDrawer() {
  const {
    items,
    isOpen,
    setOpen,
    removeItem,
    updateQuantity,
    clearCart,
    subtotal,
    deliveryFee,
    total,
    itemCount,
    freeDeliveryThreshold,
    freeDeliveryRemaining,
    qualifiesForFreeDelivery,
    addItem,
  } = useCart();

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  useEffect(() => {
    if (!isOpen || items.length === 0) return;

    let isMounted = true;

    const loadRecommendations = async () => {
      setLoadingRecommendations(true);

      try {
        const data = await getProducts();
        if (isMounted) {
          setAllProducts(data);
        }
      } catch {
        if (isMounted) {
          setAllProducts([]);
        }
      } finally {
        if (isMounted) {
          setLoadingRecommendations(false);
        }
      }
    };

    void loadRecommendations();

    return () => {
      isMounted = false;
    };
  }, [isOpen, items.length]);

  const deliveryProgress =
    itemCount === 0
      ? 0
      : Math.min((subtotal / freeDeliveryThreshold) * 100, 100);

  const cartProductIds = useMemo(
    () => new Set(items.map((item) => item.product.id)),
    [items]
  );

  const cartCategories = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.product.category))) as Category[],
    [items]
  );

  const recommendations = useMemo(() => {
    const preferredCategories = getDrawerRecommendationCategories(cartCategories);

    return allProducts
      .filter((product) => product.inStock)
      .filter((product) => !cartProductIds.has(product.id))
      .sort((a, b) => {
        const aPreferred = preferredCategories.includes(a.category);
        const bPreferred = preferredCategories.includes(b.category);

        if (aPreferred !== bPreferred) return aPreferred ? -1 : 1;

        const aCategoryRank = preferredCategories.indexOf(a.category);
        const bCategoryRank = preferredCategories.indexOf(b.category);

        if (aCategoryRank !== bCategoryRank) {
          return (aCategoryRank === -1 ? 999 : aCategoryRank) - (bCategoryRank === -1 ? 999 : bCategoryRank);
        }

        if (a.isPopular !== b.isPopular) return a.isPopular ? -1 : 1;
        if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
        if (a.reviewCount !== b.reviewCount) return b.reviewCount - a.reviewCount;

        return a.price - b.price;
      })
      .slice(0, 3);
  }, [allProducts, cartCategories, cartProductIds]);

  const recommendationTitle = getDrawerRecommendationTitle(cartCategories);

  const handleQuickAddSuggestion = (product: Product) => {
    addItem(product);
    toast.success(`${product.name} added to cart`);
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-secondary/45 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl animate-slide-in-right">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <div>
            <h2 className="font-display text-2xl text-foreground">
              YOUR CART ({itemCount})
            </h2>
            <p className="text-sm text-muted-foreground">
              {items.length === 0
                ? "Add something delicious"
                : `${items.length} line item${items.length === 1 ? "" : "s"}`}
            </p>
          </div>

          <button
            onClick={() => setOpen(false)}
            className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ShoppingBag className="h-10 w-10" />
            </div>

            <div>
              <p className="text-lg font-semibold text-foreground">Your cart is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Browse the menu and add your favourite meals.
              </p>
            </div>

            <Link
              to="/menu"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Browse Menu
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="rounded-2xl border border-border bg-background p-3">
                <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  <span>Free delivery progress</span>
                  <span>
                    {qualifiesForFreeDelivery
                      ? "Unlocked"
                      : `${priceFormatter.format(freeDeliveryRemaining)} away`}
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${deliveryProgress}%` }}
                  />
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  {qualifiesForFreeDelivery
                    ? "You qualify for free delivery."
                    : `Add ${priceFormatter.format(
                        freeDeliveryRemaining
                      )} more to get free delivery.`}
                </p>
              </div>

              <div className="mt-4 space-y-3">
                {items.map((item) => {
                  const hasImage = Boolean(item.product.image?.trim());

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border bg-background p-3"
                    >
                      <div className="flex gap-3">
                        {hasImage ? (
                          <img
                            src={item.product.image}
                            alt={item.product.name}
                            className="h-20 w-20 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                            <ImageOff className="h-5 w-5" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="truncate font-display text-xl leading-tight text-foreground">
                                {item.product.name}
                              </h4>

                              <p className="mt-1 text-sm font-semibold text-foreground">
                                {priceFormatter.format(item.finalUnitPrice)}
                                <span className="ml-1 font-normal text-muted-foreground">
                                  each
                                </span>
                              </p>
                            </div>

                            <button
                              onClick={() => removeItem(item.id)}
                              className="rounded-lg p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          {item.selectedOptions?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {item.selectedOptions.map((option) => (
                                <span
                                  key={`${item.id}-${option.groupId}-${option.itemId}`}
                                  className="rounded-full bg-card px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
                                >
                                  {option.groupName}: {option.itemName}
                                  {option.priceDelta > 0
                                    ? ` (+${priceFormatter.format(option.priceDelta)})`
                                    : ""}
                                </span>
                              ))}
                            </div>
                          )}

                          {item.note && (
                            <p className="mt-2 rounded-lg bg-card px-2.5 py-2 text-xs text-muted-foreground">
                              Note: {item.note}
                            </p>
                          )}

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="inline-flex items-center rounded-xl border border-border bg-card">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-l-xl text-foreground transition-colors hover:bg-muted"
                              >
                                <Minus className="h-4 w-4" />
                              </button>

                              <span className="inline-flex min-w-10 items-center justify-center text-sm font-semibold text-foreground">
                                {item.quantity}
                              </span>

                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-r-xl text-foreground transition-colors hover:bg-muted"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="text-right">
                              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                                Total
                              </p>
                              <p className="text-sm font-semibold text-foreground">
                                {priceFormatter.format(
                                  item.finalUnitPrice * item.quantity
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-[24px] border border-border bg-background p-4">
                <div className="mb-4 flex items-start gap-3">
                  <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {recommendationTitle}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add one more item before checkout.
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
                  <div className="space-y-3">
                    {recommendations.map((product) => {
                      const hasImage = Boolean(product.image?.trim());
                      const hasReviews =
                        product.reviewCount > 0 && product.rating > 0;

                      return (
                        <div
                          key={product.id}
                          className="rounded-2xl border border-border bg-card p-3"
                        >
                          <div className="flex gap-3">
                            {hasImage ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="h-16 w-16 rounded-xl object-cover"
                              />
                            ) : (
                              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                                <ImageOff className="h-4 w-4" />
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-foreground">
                                    {product.name}
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-primary">
                                    {priceFormatter.format(product.price)}
                                  </p>
                                </div>

                                <button
                                  onClick={() => handleQuickAddSuggestion(product)}
                                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                                >
                                  Add
                                </button>
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                  {product.category}
                                </span>

                                {hasReviews ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                                    <Star className="h-3 w-3 fill-accent text-accent" />
                                    {product.rating.toFixed(1)}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                    New
                                  </span>
                                )}

                                {product.isPopular && (
                                  <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-foreground">
                                    Popular
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border bg-card p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium text-foreground">
                    {priceFormatter.format(subtotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="font-medium text-foreground">
                    {deliveryFee === 0 ? "Free" : priceFormatter.format(deliveryFee)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="font-display text-xl text-foreground">TOTAL</span>
                  <span className="font-display text-2xl text-primary">
                    {priceFormatter.format(total)}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Link
                  to="/checkout"
                  onClick={() => setOpen(false)}
                  className="block w-full rounded-xl bg-primary py-3 text-center text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Checkout
                </Link>

                <button
                  onClick={clearCart}
                  className="w-full py-2 text-sm text-muted-foreground transition-colors hover:text-destructive"
                >
                  Clear Cart
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}