import { useState, useMemo, useEffect } from "react";
import {
  Search,
  SlidersHorizontal,
  X,
  Flame,
  ArrowUpDown,
  RefreshCw,
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

export default function MenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | "All">("All");
  const [activeSpice, setActiveSpice] = useState<SpiceLevel | "All">("All");
  const [sortBy, setSortBy] = useState<
    "default" | "price-asc" | "price-desc" | "popular"
  >("default");
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

  const filtered = useMemo(() => {
    const result = products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase());

      const matchesCat =
        activeCategory === "All" || p.category === activeCategory;

      const matchesSpice =
        activeSpice === "All" || p.spiceLevel === activeSpice;

      return matchesSearch && matchesCat && matchesSpice;
    });

    switch (sortBy) {
      case "price-asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "popular":
        result.sort((a, b) => b.reviewCount - a.reviewCount);
        break;
    }

    return result;
  }, [products, search, activeCategory, activeSpice, sortBy]);

  const activeFilterCount =
    (activeCategory !== "All" ? 1 : 0) +
    (activeSpice !== "All" ? 1 : 0) +
    (sortBy !== "default" ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setActiveCategory("All");
    setActiveSpice("All");
    setSortBy("default");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl py-6 md:py-8">
        <div className="mx-auto mb-8 max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground mb-4">
            Freshly made · Delivered fast
          </div>

          <h1 className="font-display text-4xl text-foreground sm:text-5xl md:text-6xl mb-3">
            Our Menu
          </h1>

          <p className="font-body text-sm text-muted-foreground sm:text-base">
            Explore our full range of Kotas, Bunny Chows, snacks, and flavour-packed
            favourites.
          </p>
        </div>

        <div className="sticky top-0 z-20 mb-6 bg-background/90 pb-3 pt-1 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by item name or description"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <button
                onClick={() => setShowFilters((prev) => !prev)}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                  showFilters
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted"
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-black/10 px-1.5 py-0.5 text-[11px] font-semibold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {loading ? "Loading menu..." : `${filtered.length} item${filtered.length === 1 ? "" : "s"} found`}
              </span>

              {activeCategory !== "All" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground">
                  Category: {activeCategory}
                </span>
              )}

              {activeSpice !== "All" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground">
                  Spice: {activeSpice}
                </span>
              )}

              {sortBy !== "default" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground">
                  Sort:{" "}
                  {sortBy === "price-asc"
                    ? "Price Low to High"
                    : sortBy === "price-desc"
                    ? "Price High to Low"
                    : "Most Popular"}
                </span>
              )}

              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Clear all
                </button>
              )}
            </div>

            {showFilters && (
              <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border border-border bg-background/60 p-4 lg:grid-cols-2">
                <div>
                  <label className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    <Flame className="h-3.5 w-3.5" />
                    Spice level
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {["All", ...spiceLevels].map((s) => (
                      <button
                        key={s}
                        onClick={() => setActiveSpice(s as SpiceLevel | "All")}
                        className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                          activeSpice === s
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-border hover:text-foreground"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    Sort by
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "default", label: "Default" },
                      { value: "price-asc", label: "Price: Low → High" },
                      { value: "price-desc", label: "Price: High → Low" },
                      { value: "popular", label: "Most Popular" },
                    ].map((s) => (
                      <button
                        key={s.value}
                        onClick={() =>
                          setSortBy(
                            s.value as
                              | "default"
                              | "price-asc"
                              | "price-desc"
                              | "popular"
                          )
                        }
                        className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                          sortBy === s.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-border hover:text-foreground"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-2 flex justify-end">
                  <button
                    onClick={() => setShowFilters(false)}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                    Close filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mb-8">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {["All", ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat as Category | "All")}
                className={`shrink-0 whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card text-muted-foreground border border-border hover:bg-muted hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-border bg-card p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
            <p className="text-lg font-medium text-foreground">Loading menu...</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Please wait while we fetch today’s items.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Search className="h-6 w-6" />
            </div>
            <p className="text-lg font-medium text-foreground">No items found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your search or clearing some filters.
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
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}