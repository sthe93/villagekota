import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  X,
  Flame,
  ArrowUpDown,
  RefreshCw,
  Sparkles,
  ChefHat,
  Tag,
} from "lucide-react";
import { type Category, type SpiceLevel } from "@/data/products";
import ProductCard from "@/components/ProductCard";
import Footer from "@/components/Footer";
import { toast } from "@/components/ui/sonner";
import { useProducts } from "@/hooks/use-products";
import { trackEvent } from "@/lib/analytics";

const sortOptions = [
  { value: "default", label: "Best Rated" },
  { value: "popular", label: "Most Ordered" },
  { value: "price-asc", label: "Price: Low to High" },
] as const;

type SortOption = (typeof sortOptions)[number]["value"];
type FilterSpiceLevel = NonNullable<SpiceLevel>;
type QuickFilter = "all" | "popular" | "under50" | "spicy" | "veg" | "combos";
type IntentPreset = "none" | "fastest" | "value" | "most_ordered" | "spicy";

const RECENT_SEARCHES_KEY = "villagekota.recentMenuSearches";
const MAX_RECENT_SEARCHES = 5;

const preferredCategoryOrder = ["Kota", "Bunny Chow", "Sides", "Drinks", "Combos"];

function sortCategories(categories: string[]) {
  return [...categories].sort((a, b) => {
    const aRank = preferredCategoryOrder.indexOf(a);
    const bRank = preferredCategoryOrder.indexOf(b);

    if (aRank !== -1 || bRank !== -1) {
      return (aRank === -1 ? 999 : aRank) - (bRank === -1 ? 999 : bRank);
    }

    return a.localeCompare(b);
  });
}

function levenshteinDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function isVegetarianLike(text: string) {
  const normalized = text.toLowerCase();
  return ["veg", "veggie", "vegetarian", "plant", "bean", "salad"].some((term) =>
    normalized.includes(term)
  );
}

export default function MenuPage() {
  const { data: products = [], isLoading: loading, error, refetch, isFetching } = useProducts();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | "All">("All");
  const [activeSpice, setActiveSpice] = useState<FilterSpiceLevel | "All">("All");
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [intentPreset, setIntentPreset] = useState<IntentPreset>("none");
  const hasShownErrorRef = useRef(false);

  useEffect(() => {
    if (!error || hasShownErrorRef.current) return;

    hasShownErrorRef.current = true;
    toast.error(error instanceof Error ? error.message : "Failed to load products");
  }, [error]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(RECENT_SEARCHES_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as string[];
      if (Array.isArray(parsed)) {
        setRecentSearches(parsed.slice(0, MAX_RECENT_SEARCHES));
      }
    } catch {
      setRecentSearches([]);
    }
  }, []);

  const featuredCount = useMemo(
    () => products.filter((p) => p.isFeatured).length,
    [products]
  );

  const availableCount = useMemo(
    () => products.filter((p) => p.inStock).length,
    [products]
  );

  const soldOutCount = useMemo(
    () => products.filter((p) => !p.inStock).length,
    [products]
  );

  const categoryOptions = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(
        products
          .map((product) => product.category?.trim())
          .filter((category): category is string => Boolean(category))
      )
    );

    return sortCategories(uniqueCategories);
  }, [products]);

  const spiceOptions = useMemo(() => {
    const uniqueSpiceLevels = Array.from(
      new Set(
        products
          .map((product) => product.spiceLevel)
          .filter((level): level is FilterSpiceLevel => Boolean(level))
      )
    );

    const preferredSpiceOrder: FilterSpiceLevel[] = ["Mild", "Medium", "Hot", "Extra Hot"];

    return preferredSpiceOrder.filter((level) => uniqueSpiceLevels.includes(level));
  }, [products]);

  const categoryCounts = useMemo(() => {
    return products.reduce((acc, product) => {
      const key = product.category || "Other";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [products]);

  useEffect(() => {
    if (activeCategory !== "All" && !categoryOptions.includes(activeCategory)) {
      setActiveCategory("All");
    }
  }, [activeCategory, categoryOptions]);

  useEffect(() => {
    if (activeSpice !== "All" && !spiceOptions.includes(activeSpice)) {
      setActiveSpice("All");
    }
  }, [activeSpice, spiceOptions]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const searchWords = term.split(/\s+/).filter(Boolean);

    const result = products.filter((product) => {
      const haystack = `${product.name} ${product.description} ${product.category}`.toLowerCase();
      const haystackWords = haystack.split(/[^a-z0-9]+/).filter(Boolean);
      const matchesSearch =
        !term ||
        haystack.includes(term) ||
        searchWords.every((word) =>
          haystackWords.some((candidate) => levenshteinDistance(word, candidate) <= 1)
        );

      const matchesCategory =
        activeCategory === "All" || product.category === activeCategory;

      const matchesSpice =
        activeSpice === "All" || product.spiceLevel === activeSpice;

      const matchesQuickFilter =
        quickFilter === "all" ||
        (quickFilter === "popular" && product.isPopular) ||
        (quickFilter === "under50" && product.price <= 50) ||
        (quickFilter === "spicy" &&
          (product.spiceLevel === "Hot" || product.spiceLevel === "Extra Hot")) ||
        (quickFilter === "veg" &&
          isVegetarianLike(`${product.name} ${product.description} ${product.category}`)) ||
        (quickFilter === "combos" && product.category.toLowerCase().includes("combo"));

      return matchesSearch && matchesCategory && matchesSpice && matchesQuickFilter;
    });

    const sorted = [...result];

    sorted.sort((a, b) => {
      if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;

      if (intentPreset === "fastest") {
        if (a.isPopular !== b.isPopular) return a.isPopular ? -1 : 1;
        if (a.price !== b.price) return a.price - b.price;
      }

      if (intentPreset === "value") {
        if (a.price !== b.price) return a.price - b.price;
        if (a.rating !== b.rating) return b.rating - a.rating;
      }

      if (intentPreset === "most_ordered") {
        if (a.reviewCount !== b.reviewCount) return b.reviewCount - a.reviewCount;
        if (a.rating !== b.rating) return b.rating - a.rating;
      }

      if (intentPreset === "spicy") {
        const spiceRank = (value?: SpiceLevel | null) =>
          value === "Extra Hot" ? 3 : value === "Hot" ? 2 : value === "Medium" ? 1 : 0;
        const spiceDiff = spiceRank(b.spiceLevel) - spiceRank(a.spiceLevel);
        if (spiceDiff !== 0) return spiceDiff;
      }

      switch (sortBy) {
        case "price-asc":
          return a.price - b.price;
        case "popular":
          if (a.reviewCount !== b.reviewCount) return b.reviewCount - a.reviewCount;
          if (a.rating !== b.rating) return b.rating - a.rating;
          return a.price - b.price;
        case "default":
          if (a.rating !== b.rating) return b.rating - a.rating;
          if (a.reviewCount !== b.reviewCount) return b.reviewCount - a.reviewCount;
          return a.price - b.price;
        default:
          if (a.isFeatured && !b.isFeatured) return -1;
          if (!a.isFeatured && b.isFeatured) return 1;
          if (a.isPopular && !b.isPopular) return -1;
          if (!a.isPopular && b.isPopular) return 1;
          if (a.rating !== b.rating) return b.rating - a.rating;
          return b.reviewCount - a.reviewCount;
      }
    });

    return sorted;
  }, [products, search, activeCategory, activeSpice, sortBy, quickFilter, intentPreset]);

  const activeSortLabel =
    sortOptions.find((option) => option.value === sortBy)?.label || "Recommended";

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (quickFilter !== "all" ? 1 : 0) +
    (activeCategory !== "All" ? 1 : 0) +
    (activeSpice !== "All" ? 1 : 0) +
    (sortBy !== "default" ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setQuickFilter("all");
    setActiveCategory("All");
    setActiveSpice("All");
    setSortBy("default");
    setIntentPreset("none");
  };

  const intentPresetLabel: Record<Exclude<IntentPreset, "none">, string> = {
    fastest: "Fastest",
    value: "Best Value",
    most_ordered: "Most Ordered",
    spicy: "Spicy Picks",
  };

  const saveSearchTerm = (term: string) => {
    const normalized = term.trim();
    if (!normalized) return;

    const next = [normalized, ...recentSearches.filter((entry) => entry !== normalized)].slice(
      0,
      MAX_RECENT_SEARCHES
    );
    setRecentSearches(next);
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  };

  const hasActiveFilters = activeFilterCount > 0;

  useEffect(() => {
    if (intentPreset === "none") return;

    trackEvent("menu_intent_preset_selected", {
      preset: intentPreset,
      quick_filter: quickFilter,
      category: activeCategory,
    });
  }, [intentPreset, quickFilter, activeCategory]);

  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-border bg-gradient-to-b from-card/80 to-background">
        <div className="container max-w-7xl py-8 md:py-10">
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <ChefHat className="h-3.5 w-3.5 text-primary" />
                Freshly made · Delivered fast
              </div>

              <h1 className="font-display text-4xl text-foreground sm:text-5xl md:text-6xl">
                Explore Our Menu
              </h1>

              <p className="mt-3 max-w-2xl font-body text-sm text-muted-foreground sm:text-base">
                Browse premium Kota, Bunny Chow, traditional meals, sides, drinks, and
                flavour-packed favourites. Search quickly, filter with ease, and get to
                checkout faster.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Items
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {loading ? "—" : products.length}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Available
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {loading ? "—" : availableCount}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Featured
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {loading ? "—" : featuredCount}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container max-w-7xl py-6 md:py-8">
        <div className="rounded-[28px] border border-border bg-card p-4 shadow-card md:p-5">
          <div className="flex flex-col gap-3 xl:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by item name, category, or description"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => {
                  setSearchFocused(false);
                  saveSearchTerm(search);
                }}
                onFocus={() => setSearchFocused(true)}
                className="w-full rounded-2xl border border-border bg-background py-3 pl-10 pr-11 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              {search.trim() && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {searchFocused && recentSearches.length > 0 && !search.trim() && (
              <div className="xl:w-[280px]">
                <div className="rounded-2xl border border-border bg-background p-2">
                  <p className="px-2 pb-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Recent
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((item) => (
                      <button
                        key={item}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => setSearch(item)}
                        className="rounded-full border border-border px-3 py-1 text-xs text-foreground hover:bg-muted"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="relative xl:w-[240px]">
              <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full appearance-none rounded-2xl border border-border bg-background py-3 pl-10 pr-4 text-sm text-foreground transition-colors focus:border-primary focus:outline-none"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    Sort: {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowFilters((prev) => !prev)}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors md:hidden ${
                showFilters
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-black/10 px-1.5 py-0.5 text-[11px] font-semibold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          <div className="mt-4 hidden md:grid md:grid-cols-2 md:gap-4">
            <div>
              <label className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                <Flame className="h-3.5 w-3.5" />
                Spice level
              </label>

              <div className="flex flex-wrap gap-2">
                {(["All", ...spiceOptions] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setActiveSpice(level as FilterSpiceLevel | "All")}
                    className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                      activeSpice === level
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>

              {spiceOptions.length === 0 && !loading && (
                <p className="text-sm text-muted-foreground">
                  No spice filters are available for the current menu.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-background/70 p-4">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Quick ordering tip
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Use search for fast results, then narrow by category or spice level
                    only when needed.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 rounded-2xl border border-border bg-background/70 p-4 md:hidden">
              <label className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                <Flame className="h-3.5 w-3.5" />
                Spice level
              </label>

              <div className="flex flex-wrap gap-2">
                {(["All", ...spiceOptions] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setActiveSpice(level as FilterSpiceLevel | "All")}
                    className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                      activeSpice === level
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>

              {spiceOptions.length === 0 && !loading && (
                <p className="mt-3 text-sm text-muted-foreground">
                  No spice filters are available for the current menu.
                </p>
              )}

              <button
                onClick={() => setShowFilters(false)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <X className="h-4 w-4" />
                Close filters
              </button>
            </div>
          )}

          <div className="sticky top-20 z-30 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 p-2 backdrop-blur">
            {(
              [
                ["fastest", "Fastest"],
                ["value", "Best Value"],
                ["most_ordered", "Most Ordered"],
                ["spicy", "Spicy Picks"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setIntentPreset((prev) => (prev === value ? "none" : value))}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  intentPreset === value
                    ? "bg-secondary text-secondary-foreground"
                    : "border border-border bg-background text-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}

            {intentPreset !== "none" && (
              <button
                onClick={() => setIntentPreset("none")}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                Intent: {intentPresetLabel[intentPreset]}
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {([
              ["all", "All"],
              ["popular", "Popular"],
              ["under50", "Under R50"],
              ["spicy", "Spicy"],
              ["veg", "Veg"],
              ["combos", "Combos"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setQuickFilter(value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  quickFilter === value
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background text-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}

            <span className="text-sm text-muted-foreground">
              {loading
                ? "Loading menu..."
                : `Showing ${filtered.length} of ${products.length} item${
                    products.length === 1 ? "" : "s"
                  }`}
            </span>

            {!loading && soldOutCount > 0 && (
              <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                {soldOutCount} sold out {soldOutCount === 1 ? "item" : "items"} shown last
              </span>
            )}

            {search.trim() && (
              <button
                onClick={() => setSearch("")}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                Search: “{search.trim()}”
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {activeCategory !== "All" && (
              <button
                onClick={() => setActiveCategory("All")}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                Category: {activeCategory}
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {activeSpice !== "All" && (
              <button
                onClick={() => setActiveSpice("All")}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                Spice: {activeSpice}
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {sortBy !== "default" && (
              <button
                onClick={() => setSortBy("default")}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                Sort: {activeSortLabel}
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {quickFilter !== "all" && (
              <button
                onClick={() => setQuickFilter("all")}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                Quick: {quickFilter}
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {hasActiveFilters && (
              <button
                onClick={() => {
                  clearFilters();
                  void refetch();
                }}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                {isFetching ? "Refreshing..." : "Clear all"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium text-foreground">Browse by category</p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setActiveCategory("All")}
              className={`shrink-0 whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                activeCategory === "All"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              All items ({products.length})
            </button>

            {categoryOptions.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`shrink-0 whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                  activeCategory === category
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {category} ({categoryCounts[category] ?? 0})
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-3xl border border-border bg-card shadow-card"
                >
                  <div className="aspect-[4/3] animate-pulse bg-muted" />
                  <div className="space-y-3 p-5">
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="pt-2">
                      <div className="h-11 w-full animate-pulse rounded-xl bg-muted" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-border bg-card p-12 text-center shadow-card">
              <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Search className="h-6 w-6" />
              </div>

              <p className="text-xl font-semibold text-foreground">No items found</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a different keyword, switch category, or remove some filters.
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => setQuickFilter("popular")}
                  className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Show popular
                </button>
                <button
                  onClick={() => setQuickFilter("under50")}
                  className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Under R50
                </button>
                <button
                  onClick={() => setActiveSpice("All")}
                  className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Clear spice
                </button>
              </div>

              <button
                onClick={clearFilters}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <RefreshCw className="h-4 w-4" />
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
