import { useEffect, useMemo, useState } from "react";
import {
  X,
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  Sparkles,
  Star,
  Loader2,
  SlidersHorizontal,
  Clock3,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Link } from "react-router-dom";
import { getProducts, type Category, type Product } from "@/data/products";
import { toast } from "@/components/ui/sonner";
import ProductQuickAddSheet from "@/components/ProductQuickAddSheet";
import ProductRowSummary from "@/components/ProductRowSummary";

const priceFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

type CategoryRole = "meal" | "drink" | "side" | "combo" | "other";

function normalizeCategory(category: string) {
  return category.trim().toLowerCase();
}

function getCategoryRole(category: Category): CategoryRole {
  const value = normalizeCategory(category);

  if (
    value.includes("drink") ||
    value.includes("beverage") ||
    value.includes("juice") ||
    value.includes("smoothie") ||
    value.includes("shake")
  ) {
    return "drink";
  }

  if (
    value.includes("side") ||
    value.includes("snack") ||
    value.includes("starter")
  ) {
    return "side";
  }

  if (value.includes("combo")) {
    return "combo";
  }

  if (
    value.includes("kota") ||
    value.includes("bunny") ||
    value.includes("pap") ||
    value.includes("rice") ||
    value.includes("plate") ||
    value.includes("meal") ||
    value.includes("traditional") ||
    value.includes("grill") ||
    value.includes("breakfast")
  ) {
    return "meal";
  }

  return "other";
}

function getDrawerRecommendationRoleOrder(categoriesInCart: Category[]): CategoryRole[] {
  const roles = new Set(categoriesInCart.map(getCategoryRole));
  const hasMeal = roles.has("meal") || roles.has("combo");
  const hasDrink = roles.has("drink");
  const hasSide = roles.has("side");

  if (hasMeal && !hasDrink) return ["drink", "side", "meal", "combo", "other"];
  if (hasMeal && hasDrink) return ["side", "drink", "meal", "combo", "other"];
  if (hasSide && !hasDrink) return ["drink", "meal", "combo", "side", "other"];
  if (hasDrink && !hasMeal) return ["meal", "combo", "side", "other", "drink"];

  return ["meal", "combo", "side", "drink", "other"];
}

function getDrawerRecommendationTitle(categoriesInCart: Category[]) {
  const roles = new Set(categoriesInCart.map(getCategoryRole));
  const hasMeal = roles.has("meal") || roles.has("combo");
  const hasDrink = roles.has("drink");
  const hasSide = roles.has("side");

  if (hasMeal && !hasDrink) return "Add a drink or side";
  if (hasMeal && hasDrink) return hasSide ? "Round out your order" : "Complete your meal";
  if (hasDrink && !hasMeal) return "Pair it with something filling";
  if (hasSide && !hasMeal) return "Add something more filling";
  return "You may also like";
}

function estimatePrepTimeMinutes(product: Product) {
  const role = getCategoryRole(product.category);
  if (role === "drink") return 2;
  if (role === "side") return 6;
  if (role === "meal") return 14;
  if (role === "combo") return 16;
  return 10;
}

function groupSelectedOptions(
  options: Array<{
    groupName: string;
    itemName: string;
    priceDelta: number;
  }>
) {
  const grouped = new Map<string, string[]>();

  options.forEach((option) => {
    const label =
      option.priceDelta > 0
        ? `${option.itemName} (+${priceFormatter.format(option.priceDelta)})`
        : option.itemName;

    const existing = grouped.get(option.groupName) || [];
    existing.push(label);
    grouped.set(option.groupName, existing);
  });

  return Array.from(grouped.entries()).map(([groupName, values]) => ({
    groupName,
    values: values.join(", "),
  }));
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
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(false);
  const [selectedRecommendedProduct, setSelectedRecommendedProduct] =
    useState<Product | null>(null);

  const closeDrawer = () => {
    setOpen(false);
    setShowSmartSuggestions(false);
    setSelectedRecommendedProduct(null);
  };

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
    () => Array.from(new Set(items.map((item) => item.product.category))) as Category[],
    [items]
  );

  const recommendations = useMemo(() => {
    const preferredRoles = getDrawerRecommendationRoleOrder(cartCategories);

    return allProducts
      .filter((product) => product.inStock)
      .filter((product) => !cartProductIds.has(product.id))
      .sort((a, b) => {
        const aRole = getCategoryRole(a.category);
        const bRole = getCategoryRole(b.category);

        const aRoleRank =
          preferredRoles.indexOf(aRole) === -1 ? 999 : preferredRoles.indexOf(aRole);
        const bRoleRank =
          preferredRoles.indexOf(bRole) === -1 ? 999 : preferredRoles.indexOf(bRole);

        if (aRoleRank !== bRoleRank) {
          return aRoleRank - bRoleRank;
        }

        if (a.hasOptions !== b.hasOptions) return a.hasOptions ? -1 : 1;
        if (a.isPopular !== b.isPopular) return a.isPopular ? -1 : 1;
        if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
        if (a.reviewCount !== b.reviewCount) return b.reviewCount - a.reviewCount;

        return a.price - b.price;
      })
      .slice(0, 3);
  }, [allProducts, cartCategories, cartProductIds]);

  const recommendationTitle = getDrawerRecommendationTitle(cartCategories);

  const anchorCartItem = useMemo(
    () =>
      [...items].sort((a, b) => {
        const roleOrder: CategoryRole[] = ["meal", "combo", "side", "drink", "other"];
        return (
          roleOrder.indexOf(getCategoryRole(a.product.category)) -
          roleOrder.indexOf(getCategoryRole(b.product.category))
        );
      })[0] || null,
    [items]
  );

  const drinkAndSideBundle = useMemo(() => {
    const sortedByPrice = [...allProducts]
      .filter((product) => product.inStock && !cartProductIds.has(product.id))
      .sort((a, b) => a.price - b.price);

    const drink = sortedByPrice.find(
      (product) => getCategoryRole(product.category) === "drink" && !product.hasOptions
    );
    const side = sortedByPrice.find(
      (product) => getCategoryRole(product.category) === "side" && !product.hasOptions
    );

    if (!drink || !side) return null;

    return {
      drink,
      side,
      total: drink.price + side.price,
    };
  }, [allProducts, cartProductIds]);

  const handleQuickAddSuggestion = (product: Product) => {
    if (product.hasOptions) {
      setSelectedRecommendedProduct(product);
      return;
    }

    addItem(product);
    toast.success(`${product.name} added to cart`);
  };

  const handleMiniBundleAdd = () => {
    if (!drinkAndSideBundle) return;

    addItem(drinkAndSideBundle.drink);
    addItem(drinkAndSideBundle.side);
    toast.success(
      `Bundle added: ${drinkAndSideBundle.drink.name} + ${drinkAndSideBundle.side.name}`
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[80] bg-secondary/45 backdrop-blur-sm"
        onClick={closeDrawer}
      />

      <aside className="fixed right-0 top-0 z-[81] flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl animate-slide-in-right">
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
            onClick={closeDrawer}
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
              onClick={closeDrawer}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Browse Menu
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="sticky top-0 z-10 rounded-2xl border border-primary/25 bg-primary/5 p-3 backdrop-blur-sm">
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
                  const groupedOptions = groupSelectedOptions(item.selectedOptions || []);

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border bg-background p-3"
                    >
                      <ProductRowSummary
                        imageSrc={item.product.image}
                        imageAlt={item.product.name}
                        title={item.product.name}
                        subtitle={`${priceFormatter.format(item.finalUnitPrice)} each`}
                        imageClassName="h-20 w-20 rounded-xl object-cover"
                        titleClassName="truncate font-display text-xl leading-tight text-foreground"
                        subtitleClassName="mt-1 text-sm font-semibold text-foreground"
                        rightSlot={
                          <button
                            onClick={() => removeItem(item.id)}
                            className="rounded-lg p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        }
                      >

                          {groupedOptions.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              {groupedOptions.map((group) => (
                                <div
                                  key={`${item.id}-${group.groupName}`}
                                  className="rounded-lg bg-card px-2.5 py-2 text-[11px]"
                                >
                                  <span className="font-semibold text-foreground/85">
                                    {group.groupName}:
                                  </span>{" "}
                                  <span className="text-muted-foreground">
                                    {group.values}
                                  </span>
                                </div>
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
                                {priceFormatter.format(item.finalUnitPrice * item.quantity)}
                              </p>
                            </div>
                          </div>
                      </ProductRowSummary>
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
                    {recommendations
                      .slice(0, showSmartSuggestions ? recommendations.length : 1)
                      .map((product) => {
                        const hasImage = Boolean(product.image?.trim());
                        const hasReviews = product.reviewCount > 0 && product.rating > 0;
                        const prepDeltaMinutes = anchorCartItem
                          ? Math.max(
                              0,
                              estimatePrepTimeMinutes(product) -
                                estimatePrepTimeMinutes(anchorCartItem.product)
                            )
                          : null;

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
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : (
                                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                                  <ImageOff className="h-4 w-4" />
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-medium text-muted-foreground">
                                      Popular with your cart
                                    </p>
                                    <p className="truncate font-semibold text-foreground">
                                      {product.name}
                                    </p>
                                    {!showSmartSuggestions && (
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        Quick add before checkout.
                                      </p>
                                    )}
                                    <p className="mt-1 text-sm font-semibold text-primary">
                                      From {priceFormatter.format(product.price)}
                                    </p>
                                    {showSmartSuggestions && prepDeltaMinutes !== null && (
                                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                        <Clock3 className="h-3 w-3" />
                                        {prepDeltaMinutes === 0
                                          ? "No extra prep time"
                                          : `Adds ~${prepDeltaMinutes} min prep`}
                                      </p>
                                    )}
                                  </div>

                                  <button
                                    onClick={() => handleQuickAddSuggestion(product)}
                                    className="inline-flex shrink-0 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                                  >
                                    {product.hasOptions ? "Customise" : "Add"}
                                  </button>
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                    {product.category}
                                  </span>

                                  {showSmartSuggestions && product.hasOptions && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground">
                                      <SlidersHorizontal className="h-3 w-3" />
                                      Customisable
                                    </span>
                                  )}

                                  {showSmartSuggestions &&
                                    (hasReviews ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                                        <Star className="h-3 w-3 fill-accent text-accent" />
                                        {product.rating.toFixed(1)}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                        New
                                      </span>
                                    ))}

                                  {showSmartSuggestions && product.isPopular && (
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

                {!loadingRecommendations && recommendations.length > 1 && (
                  <button
                    onClick={() => setShowSmartSuggestions((current) => !current)}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary transition-opacity hover:opacity-90"
                  >
                    {showSmartSuggestions
                      ? "Hide smart suggestions"
                      : "Show smart suggestions"}
                    {showSmartSuggestions ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                )}

                {showSmartSuggestions && drinkAndSideBundle && (
                  <button
                    onClick={handleMiniBundleAdd}
                    className="mt-3 w-full rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
                  >
                    Add drink + side • {priceFormatter.format(drinkAndSideBundle.total)}
                  </button>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 z-20 border-t border-border bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-20px_hsl(var(--foreground)/0.45)]">
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
                  onClick={closeDrawer}
                  className="block w-full rounded-xl bg-primary py-3 text-center text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Continue to Pay
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

      {selectedRecommendedProduct && (
        <ProductQuickAddSheet
          product={selectedRecommendedProduct}
          open={Boolean(selectedRecommendedProduct)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedRecommendedProduct(null);
            }
          }}
        />
      )}
    </>
  );
}
