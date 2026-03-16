import { useState, useMemo } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { products, categories, type Category, type SpiceLevel } from "@/data/products";
import ProductCard from "@/components/ProductCard";
import Footer from "@/components/Footer";

const spiceLevels: SpiceLevel[] = ["Mild", "Medium", "Hot", "Extra Hot"];

export default function MenuPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | "All">("All");
  const [activeSpice, setActiveSpice] = useState<SpiceLevel | "All">("All");
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc" | "popular">("default");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let result = products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
      const matchesCat = activeCategory === "All" || p.category === activeCategory;
      const matchesSpice = activeSpice === "All" || p.spiceLevel === activeSpice;
      return matchesSearch && matchesCat && matchesSpice;
    });

    switch (sortBy) {
      case "price-asc": result.sort((a, b) => a.price - b.price); break;
      case "price-desc": result.sort((a, b) => b.price - a.price); break;
      case "popular": result.sort((a, b) => b.reviewCount - a.reviewCount); break;
    }
    return result;
  }, [search, activeCategory, activeSpice, sortBy]);

  return (
    <div>
      <div className="container py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-5xl sm:text-6xl text-foreground mb-2">OUR MENU</h1>
          <p className="text-muted-foreground font-body">Explore our full range of Kotas, Bunny Chows & more</p>
        </div>

        {/* Search */}
        <div className="flex gap-3 mb-6 max-w-xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search menu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow font-body"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="max-w-xl mx-auto mb-6 bg-card rounded-lg border border-border p-4 animate-fade-in space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block uppercase tracking-wider">Spice Level</label>
              <div className="flex flex-wrap gap-2">
                {["All", ...spiceLevels].map((s) => (
                  <button
                    key={s}
                    onClick={() => setActiveSpice(s as SpiceLevel | "All")}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeSpice === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-border"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block uppercase tracking-wider">Sort By</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "default", label: "Default" },
                  { value: "price-asc", label: "Price: Low → High" },
                  { value: "price-desc", label: "Price: High → Low" },
                  { value: "popular", label: "Most Popular" },
                ].map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSortBy(s.value as typeof sortBy)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      sortBy === s.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-border"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-hide">
          {["All", ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat as Category | "All")}
              className={`whitespace-nowrap px-5 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-border"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground font-medium text-lg">No items found</p>
            <p className="text-muted-foreground text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
