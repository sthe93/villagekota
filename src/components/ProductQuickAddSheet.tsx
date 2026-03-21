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
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import { getProducts, type Product, type Category } from "@/data/products";
import {
  getProductOptionGroups,
  type ProductOptionGroup,
  type SelectedOption,
} from "@/data/productOptions";
import { useCart } from "@/context/CartContext";
import { toast } from "@/components/ui/sonner";

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

function getRecommendedRoleOrder(category: Category): CategoryRole[] {
  const role = getCategoryRole(category);

  switch (role) {
    case "meal":
      return ["drink", "side", "combo", "meal", "other"];
    case "combo":
      return ["drink", "side", "meal", "combo", "other"];
    case "side":
      return ["drink", "meal", "combo", "side", "other"];
    case "drink":
      return ["meal", "combo", "side", "drink", "other"];
    default:
      return ["meal", "drink", "side", "combo", "other"];
  }
}

function getRecommendationTitle(category: Category) {
  const role = getCategoryRole(category);

  switch (role) {
    case "meal":
      return "Complete your meal";
    case "combo":
      return "Add a little extra";
    case "side":
      return "Add a drink or main";
    case "drink":
      return "Pair it with something filling";
    default:
      return "You may also like";
  }
}

function getProductHelperText(product: Product) {
  const role = getCategoryRole(product.category);

  if (!product.hasOptions) {
    if (role === "drink") return "Choose quantity and add any special instructions";
    return "Choose quantity and add any special instructions";
  }

  switch (role) {
    case "meal":
      return "Choose options, extras, quantity, and special instructions";
    case "combo":
      return "Choose meal options, extras, quantity, and special instructions";
    case "drink":
      return "Choose size, add-ons, quantity, and special instructions";
    case "side":
      return "Choose extras, quantity, and special instructions";
    default:
      return "Choose options, quantity, and special instructions";
  }
}

function buildInitialSelections(groups: ProductOptionGroup[]) {
  const initial: Record<string, string[]> = {};

  groups.forEach((group) => {
    const availableItems = group.items.filter((item) => item.isAvailable);

    if (availableItems.length === 0) {
      initial[group.id] = [];
      return;
    }

    if (group.selectionType === "single") {
      const defaultItem =
        availableItems.find((item) => item.isDefault) ||
        (group.isRequired || group.minSelect > 0 ? availableItems[0] : null);

      initial[group.id] = defaultItem ? [defaultItem.id] : [];
      return;
    }

    let selected = availableItems
      .filter((item) => item.isDefault)
      .map((item) => item.id);

    const minRequired = Math.max(group.minSelect, group.isRequired ? 1 : 0);

    if (selected.length < minRequired) {
      const extras = availableItems
        .filter((item) => !selected.includes(item.id))
        .slice(0, minRequired - selected.length)
        .map((item) => item.id);

      selected = [...selected, ...extras];
    }

    if (group.maxSelect != null) {
      selected = selected.slice(0, group.maxSelect);
    }

    initial[group.id] = selected;
  });

  return initial;
}

function getSelectionHint(group: ProductOptionGroup) {
  if (group.selectionType === "single") {
    if (group.isRequired || group.minSelect > 0) return "Choose 1";
    return "Optional";
  }

  if (group.maxSelect != null && group.minSelect > 0) {
    return `Choose ${group.minSelect}–${group.maxSelect}`;
  }

  if (group.maxSelect != null) {
    return `Choose up to ${group.maxSelect}`;
  }

  if (group.minSelect > 0) {
    return `Choose at least ${group.minSelect}`;
  }

  return "Optional";
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
  const [optionGroups, setOptionGroups] = useState<ProductOptionGroup[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string[]>>({});
  const [selectedRecommendedProduct, setSelectedRecommendedProduct] =
    useState<Product | null>(null);

  useEffect(() => {
    if (!open) return;

    setQuantity(1);
    setNote("");
    setSelectedRecommendedProduct(null);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange, product.id]);

  useEffect(() => {
    if (!open) return;

    let isMounted = true;

    const loadSheetData = async () => {
      setLoadingRecommendations(true);
      setLoadingOptions(true);

      try {
        const [productsData, optionGroupsData] = await Promise.all([
          getProducts(),
          getProductOptionGroups(product.id),
        ]);

        if (!isMounted) return;

        setAllProducts(productsData);
        setOptionGroups(optionGroupsData);
        setSelectedByGroup(buildInitialSelections(optionGroupsData));
      } catch {
        if (!isMounted) return;
        setAllProducts([]);
        setOptionGroups([]);
        setSelectedByGroup({});
      } finally {
        if (!isMounted) return;
        setLoadingRecommendations(false);
        setLoadingOptions(false);
      }
    };

    void loadSheetData();

    return () => {
      isMounted = false;
    };
  }, [open, product.id]);

  const selectedOptions = useMemo<SelectedOption[]>(() => {
    return optionGroups.flatMap((group) => {
      const selectedIds = selectedByGroup[group.id] || [];

      return group.items
        .filter((item) => selectedIds.includes(item.id))
        .map((item) => ({
          groupId: group.id,
          groupName: group.name,
          itemId: item.id,
          itemName: item.name,
          priceDelta: item.priceDelta,
        }));
    });
  }, [optionGroups, selectedByGroup]);

  const optionsTotal = useMemo(
    () => selectedOptions.reduce((sum, option) => sum + option.priceDelta, 0),
    [selectedOptions]
  );

  const finalUnitPrice = useMemo(
    () => product.price + optionsTotal,
    [product.price, optionsTotal]
  );

  const total = useMemo(() => finalUnitPrice * quantity, [finalUnitPrice, quantity]);
  const hasReviews = product.reviewCount > 0 && product.rating > 0;
  const hasImage = Boolean(product.image?.trim());
  const hasCustomisation = product.hasOptions || optionGroups.length > 0;
  const preferredRoles = useMemo(
    () => getRecommendedRoleOrder(product.category),
    [product.category]
  );

  const recommendations = useMemo(() => {
    return allProducts
      .filter((item) => item.id !== product.id)
      .filter((item) => item.inStock)
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

        if (a.hasOptions !== b.hasOptions) {
          return a.hasOptions ? -1 : 1;
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
  }, [allProducts, preferredRoles, product.id]);

  const handleSingleSelect = (groupId: string, itemId: string) => {
    setSelectedByGroup((prev) => ({
      ...prev,
      [groupId]: [itemId],
    }));
  };

  const handleMultiToggle = (group: ProductOptionGroup, itemId: string) => {
    setSelectedByGroup((prev) => {
      const current = prev[group.id] || [];
      const minRequired = Math.max(group.minSelect, group.isRequired ? 1 : 0);
      const isSelected = current.includes(itemId);

      if (isSelected) {
        if (current.length <= minRequired) return prev;
        return {
          ...prev,
          [group.id]: current.filter((id) => id !== itemId),
        };
      }

      if (group.maxSelect != null && current.length >= group.maxSelect) {
        toast.error(`You can only select up to ${group.maxSelect} option(s) for ${group.name}.`);
        return prev;
      }

      return {
        ...prev,
        [group.id]: [...current, itemId],
      };
    });
  };

  const validateSelections = () => {
    for (const group of optionGroups) {
      const count = (selectedByGroup[group.id] || []).length;
      const minRequired = Math.max(group.minSelect, group.isRequired ? 1 : 0);

      if (count < minRequired) {
        toast.error(`Please complete ${group.name}.`);
        return false;
      }

      if (group.maxSelect != null && count > group.maxSelect) {
        toast.error(`Too many selections in ${group.name}.`);
        return false;
      }
    }

    return true;
  };

  const handleAdd = () => {
    if (!validateSelections()) return;

    addItem(product, {
      quantity,
      note,
      selectedOptions,
      optionsTotal,
      finalUnitPrice,
    });

    toast.success(
      `${quantity} ${product.name}${quantity > 1 ? "s" : ""} added to cart`
    );
    onOpenChange(false);
  };

  const handleQuickAddSuggestion = (suggestedProduct: Product) => {
    if (suggestedProduct.hasOptions) {
      setSelectedRecommendedProduct(suggestedProduct);
      return;
    }

    addItem(suggestedProduct);
    toast.success(`${suggestedProduct.name} added to cart`);
  };

  const closeSheet = () => {
    setSelectedRecommendedProduct(null);
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-secondary/50 backdrop-blur-sm"
        onClick={closeSheet}
      />

      <div className="fixed inset-x-0 bottom-0 z-[71] mx-auto w-full max-w-3xl overflow-hidden rounded-t-[28px] border border-border bg-card shadow-2xl md:inset-0 md:m-auto md:max-h-[90vh] md:rounded-[28px]">
        <div
          className="flex max-h-[90vh] flex-col"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-display text-2xl text-foreground">Customise Item</h2>
              <p className="text-sm text-muted-foreground">
                {getProductHelperText(product)}
              </p>
            </div>

            <button
              onClick={closeSheet}
              className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-5">
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

                <div className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
                      {product.category}
                    </span>

                    {hasCustomisation && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
                        <SlidersHorizontal className="h-3 w-3" />
                        Customisable
                      </span>
                    )}

                    {product.spiceLevel && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
                        <Flame className="h-3 w-3 text-primary" />
                        {product.spiceLevel}
                      </span>
                    )}

                    {product.isPopular && (
                      <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-foreground">
                        Popular
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 font-display text-4xl leading-none text-foreground">
                    {product.name}
                  </h3>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
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
                </div>
              </div>

              <div>
                <div className="space-y-4">
                  {loadingOptions ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading options...
                    </div>
                  ) : optionGroups.length > 0 ? (
                    optionGroups.map((group) => {
                      const selectedIds = selectedByGroup[group.id] || [];

                      return (
                        <div
                          key={group.id}
                          className="rounded-2xl border border-border bg-background p-4"
                        >
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-foreground">{group.name}</p>
                            <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              {getSelectionHint(group)}
                            </span>
                            {group.isRequired && (
                              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
                                Required
                              </span>
                            )}
                          </div>

                          {group.description && (
                            <p className="mb-3 text-sm text-muted-foreground">
                              {group.description}
                            </p>
                          )}

                          <div className="grid gap-2">
                            {group.items
                              .filter((item) => item.isAvailable)
                              .map((item) => {
                                const selected = selectedIds.includes(item.id);

                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() =>
                                      group.selectionType === "single"
                                        ? handleSingleSelect(group.id, item.id)
                                        : handleMultiToggle(group, item.id)
                                    }
                                    className={`rounded-2xl border p-3 text-left transition-colors ${
                                      selected
                                        ? "border-primary bg-primary/10"
                                        : "border-border bg-card hover:bg-muted"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          {selected && (
                                            <CheckCircle2 className="h-4 w-4 text-primary" />
                                          )}
                                          <p className="font-medium text-foreground">
                                            {item.name}
                                          </p>
                                        </div>

                                        {item.description && (
                                          <p className="mt-1 text-sm text-muted-foreground">
                                            {item.description}
                                          </p>
                                        )}
                                      </div>

                                      <div className="shrink-0 text-sm font-semibold text-foreground">
                                        {item.priceDelta > 0
                                          ? `+${priceFormatter.format(item.priceDelta)}`
                                          : item.priceDelta < 0
                                            ? `-${priceFormatter.format(Math.abs(item.priceDelta))}`
                                            : "Included"}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                      No extra options are set for this item yet. You can still adjust quantity
                      and add special instructions below.
                    </div>
                  )}

                  <div className="rounded-2xl border border-border bg-background p-4">
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

                  <div className="rounded-2xl border border-border bg-background p-4">
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
                      placeholder="Example: no onions, sauce on side, pack separately"
                      className="mt-3 w-full resize-none rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                    />

                    <div className="mt-2 text-right text-xs text-muted-foreground">
                      {note.length}/180
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-border bg-background p-4">
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
                                    {item.hasOptions && (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground">
                                        <SlidersHorizontal className="h-3 w-3" />
                                        Customisable
                                      </span>
                                    )}

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
                                    {item.hasOptions ? (
                                      <>
                                        <SlidersHorizontal className="h-3.5 w-3.5" />
                                        Customise
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="h-3.5 w-3.5" />
                                        Add
                                      </>
                                    )}
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
              </div>
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
                <div>
                  {quantity} × {priceFormatter.format(finalUnitPrice)}
                </div>
                {optionsTotal > 0 && (
                  <div className="mt-1 text-primary">
                    Includes {priceFormatter.format(optionsTotal)} in options
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[0.9fr_1.1fr]">
              <button
                onClick={closeSheet}
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

      {selectedRecommendedProduct && (
        <ProductQuickAddSheet
          product={selectedRecommendedProduct}
          open={Boolean(selectedRecommendedProduct)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setSelectedRecommendedProduct(null);
            }
          }}
        />
      )}
    </>
  );
}
