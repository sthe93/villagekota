import { useEffect, useMemo, useState } from "react";
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
import {
  getProducts,
  categories,
  type Category,
  type SpiceLevel,
  type Product,
} from "@/data/products";
import ProductCard from "@/components/ProductCard";
import Footer from "@/components/Footer";
import { toast } from "sonner";

const spiceLevels: SpiceLevel[] = ["Mild", "Medium", "Hot", "Extra Hot"];

const sortOptions = [
  { value: "default", label: "Recommended" },
  { value: "popular", label: "Most Popular" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
] as const;

type SortOption = (typeof sortOptions)[number]["value"];

export default function MenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | "All">("All");
  const [activeSpice, setActiveSpice] = useState<SpiceLevel | "All">("All");
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await getProducts();
        setProducts(data);
      } catch (err: any) {
        toast.error(err.message || "Failed to load products");
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
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

  const categoryCounts = useMemo(() => {
    return categories.reduce((acc, category) => {
      acc[category] = products.filter((p) => p.category === category).length;
      return acc;
    }, {} as Record<Category, number>);
  }, [products]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    const result = products.filter((p) => {
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term);

      const matchesCategory =
        activeCategory === "All" || p.category === activeCategory;

      const matchesSpice =
        activeSpice === "All" || p.spiceLevel === activeSpice;

      return matchesSearch && matchesCategory && matchesSpice;
    });

    const sorted = [...result];

    sorted.sort((a, b) => {
      if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;

      switch (sortBy) {
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        case "popular":
          return b.reviewCount - a.reviewCount;
        default:
          if (a.isFeatured && !b.isFeatured) return -1;
          if (!a.isFeatured && b.isFeatured) return 1;
          if (a.isPopular && !b.isPopular) return -1;
          if (!a.isPopular && b.isPopular) return 1;
          return b.reviewCount - a.reviewCount;
      }
    });

    return sorted;
  }, [products, search, activeCategory, activeSpice, sortBy]);

  const activeSortLabel =
    sortOptions.find((option) => option.value === sortBy)?.label || "Recommended";

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (activeCategory !== "All" ? 1 : 0) +
    (activeSpice !== "All" ? 1 : 0) +
    (sortBy !== "default" ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setActiveCategory("All");
    setActiveSpice("All");
    setSortBy("default");
  };

  const hasActiveFilters = activeFilterCount > 0;

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
                Browse premium Kota, Bunny Chow, snacks, and flavour-packed favourites.
                Search quickly, filter with ease, and get to checkout faster.
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
                placeholder="Search by item name or description"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
                {(["All", ...spiceLevels] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setActiveSpice(level as SpiceLevel | "All")}
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
                {(["All", ...spiceLevels] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setActiveSpice(level as SpiceLevel | "All")}
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

              <button
                onClick={() => setShowFilters(false)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <X className="h-4 w-4" />
                Close filters
              </button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
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

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Clear all
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

            {categories.map((category) => (
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