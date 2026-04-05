import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Star, Truck, Clock, Shield, X, ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import Footer from "@/components/Footer";
import { toast } from "@/components/ui/sonner";
import heroBg from "@/assets/hero-bunny-chow.jpg";
import { useProducts } from "@/hooks/use-products";
import { usePublicAppContentSettings } from "@/lib/appContentSettings";

const testimonials = [
  { name: "Thabo M.", text: "Lekker quality every time. Big flavour, clean packaging, and smooth delivery to the gate.", rating: 5 },
  { name: "Naledi S.", text: "From kota cravings to family supper, this app just gets it. Proper Mzansi comfort food.", rating: 5 },
  { name: "James P.", text: "Premium look, kasi soul. Fast checkout and the food always arrives hot and fresh.", rating: 5 },
];

export default function HomePage() {
  const { data: products = [], isLoading: loading, error } = useProducts();
  const hasShownErrorRef = useRef(false);
  const [showOfferChip, setShowOfferChip] = useState(true);
  const [showStickyMenuCta, setShowStickyMenuCta] = useState(false);
  const [activeTestimonialIndex, setActiveTestimonialIndex] = useState(0);
  const appContent = usePublicAppContentSettings();

  useEffect(() => {
    if (!error || hasShownErrorRef.current) return;

    hasShownErrorRef.current = true;
    toast.error(error instanceof Error ? error.message : "Failed to load products");
  }, [error]);

  const featured = products.filter((p) => p.isFeatured);
  const topPicks = useMemo(
    () => products.filter((p) => p.isPopular || p.isFeatured).slice(0, 8),
    [products]
  );
  const categoryQuickJumps = [
    { label: "Meals", to: "/menu?category=meals" },
    { label: "Drinks", to: "/menu?category=drinks" },
    { label: "Sides", to: "/menu?category=sides" },
    { label: "Combos", to: "/menu?category=combos" },
  ];

  useEffect(() => {
    const onScroll = () => {
      setShowStickyMenuCta(window.scrollY > 520);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const activeTestimonial = testimonials[activeTestimonialIndex];

  const handlePrevTestimonial = () => {
    setActiveTestimonialIndex((prev) =>
      prev === 0 ? testimonials.length - 1 : prev - 1
    );
  };

  const handleNextTestimonial = () => {
    setActiveTestimonialIndex((prev) => (prev + 1) % testimonials.length);
  };

  return (
    <div>
      <section className="relative min-h-[70vh] flex items-center">
        <div className="absolute inset-0">
          <img src={heroBg} alt="Village Eats food selection" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-secondary/90 via-secondary/70 to-secondary/30" />
        </div>
        <div className="container relative z-10 py-20">
          <div className="max-w-xl">
            <span className="inline-block bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-md mb-4 font-body uppercase tracking-wider">
              {appContent.hero_badge_text}
            </span>
            <h1 className="font-display text-5xl sm:text-7xl text-primary-foreground leading-none mb-4">
              {appContent.hero_title_text}
            </h1>
            <p className="text-primary-foreground/70 text-lg mb-8 font-body max-w-md">
              {appContent.hero_subtitle_text}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/menu"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 rounded-lg font-medium hover:opacity-90 transition-opacity text-sm"
              >
                {appContent.hero_primary_cta_text} <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#featured"
                className="inline-flex items-center gap-2 bg-primary-foreground/10 text-primary-foreground border border-primary-foreground/20 px-8 py-3.5 rounded-lg font-medium hover:bg-primary-foreground/20 transition-colors text-sm"
              >
                See Menu
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-card border-b border-border">
        <div className="container py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Truck, text: appContent.trust_badge_delivery_text },
            { icon: Clock, text: appContent.trust_badge_eta_text },
            { icon: Shield, text: appContent.trust_badge_quality_text },
            { icon: Star, text: appContent.trust_badge_rating_text },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 justify-center text-sm text-muted-foreground">
              <Icon className="w-5 h-5 text-primary shrink-0" />
              <span className="font-medium">{text}</span>
            </div>
          ))}
        </div>
      </section>

      {showOfferChip && (
        <section className="bg-primary/10 border-y border-primary/20">
          <div className="container py-3">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-full bg-primary px-4 py-2 text-primary-foreground shadow-card">
              <p className="text-sm font-semibold tracking-wide">
                🎉 Use code <span className="text-accent">{appContent.offer_banner_code}</span>{" "}
                {appContent.offer_banner_text}
              </p>
              <button
                type="button"
                onClick={() => setShowOfferChip(false)}
                className="rounded-full p-1 hover:bg-primary-foreground/10"
                aria-label="Dismiss offer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="container py-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-3xl text-foreground">Top picks near you</h2>
          <Link to="/menu" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>

        {topPicks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            Top picks will appear here as soon as products are available.
          </div>
        ) : (
          <div className="flex snap-x gap-4 overflow-x-auto pb-2">
            {topPicks.map((p) => (
              <article
                key={p.id}
                className="min-w-[240px] snap-start rounded-2xl border border-border bg-card p-4 shadow-card"
              >
                <p className="line-clamp-1 font-semibold text-foreground">{p.name}</p>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary">
                    {new Intl.NumberFormat("en-ZA", {
                      style: "currency",
                      currency: "ZAR",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    }).format(p.price)}
                  </span>
                  <Link
                    to="/menu"
                    className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    Add
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="container pb-8">
        <div className="flex flex-wrap items-center gap-2">
          {categoryQuickJumps.map((category) => (
            <Link
              key={category.label}
              to={category.to}
              className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {category.label}
            </Link>
          ))}
        </div>
      </section>

      <section id="featured" className="container py-16">
        <div className="text-center mb-10">
          <h2 className="font-display text-4xl sm:text-5xl text-foreground mb-2">FEATURED MEALS</h2>
          <p className="text-muted-foreground font-body">Popular picks from across the Village Eats menu</p>
        </div>

        {loading ? (
          <div className="text-center py-10 text-muted-foreground">Loading products...</div>
        ) : featured.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">No featured products found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        <div className="text-center mt-10">
          <Link
            to="/menu"
            className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-8 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity text-sm"
          >
            View Full Menu <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <section className="bg-muted">
        <div className="container py-16">
          <h2 className="font-display text-4xl text-center text-foreground mb-10">WHAT THE KASI SAYS</h2>
          <div className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-card rounded-lg p-6 shadow-card">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mb-4 font-body italic">"{t.text}"</p>
                <p className="font-medium text-foreground text-sm">{t.name}</p>
              </div>
            ))}
          </div>

          <div className="md:hidden">
            <div className="rounded-lg bg-card p-6 shadow-card">
              <div className="mb-3 flex gap-0.5">
                {Array.from({ length: activeTestimonial.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground mb-4 font-body italic">
                "{activeTestimonial.text}"
              </p>
              <p className="text-sm font-medium text-foreground">{activeTestimonial.name}</p>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handlePrevTestimonial}
                className="rounded-full border border-border bg-background p-2 text-foreground hover:bg-muted"
                aria-label="Previous testimonial"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground">
                {activeTestimonialIndex + 1} / {testimonials.length}
              </span>
              <button
                type="button"
                onClick={handleNextTestimonial}
                className="rounded-full border border-border bg-background p-2 text-foreground hover:bg-muted"
                aria-label="Next testimonial"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-16 text-center">
        <h2 className="font-display text-4xl sm:text-5xl text-foreground mb-4">HUNGRY YET?</h2>
        <p className="text-muted-foreground mb-8 font-body max-w-md mx-auto">
          Explore the Village Eats menu and get your next meal, snack, or favourite comfort-food fix delivered hot to your door.
        </p>
        <Link
          to="/menu"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-10 py-4 rounded-lg font-medium text-lg hover:opacity-90 transition-opacity"
        >
          Order Now <ArrowRight className="w-5 h-5" />
        </Link>
      </section>

      <Footer />

      {showStickyMenuCta && (
        <div className="fixed inset-x-0 bottom-4 z-40 px-4 md:hidden">
          <Link
            to="/menu"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-2xl"
          >
            View Menu <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
