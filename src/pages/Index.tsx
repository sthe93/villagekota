import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, Star, Truck, Clock, Shield } from "lucide-react";
import { getProducts, type Product } from "@/data/products";
import ProductCard from "@/components/ProductCard";
import Footer from "@/components/Footer";
import { toast } from "@/components/ui/sonner";
import heroBg from "@/assets/hero-bunny-chow.jpg";

const testimonials = [
  { name: "Thabo M.", text: "Best kota in Joburg! The flavours are incredible and delivery is fast.", rating: 5 },
  { name: "Naledi S.", text: "The Chicken Bunny Chow is to die for. Ordering every weekend now!", rating: 5 },
  { name: "James P.", text: "Finally, a premium kota experience. Quality you can taste in every bite.", rating: 5 },
];

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

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

  const featured = products.filter((p) => p.isFeatured);

  return (
    <div>
      <section className="relative min-h-[70vh] flex items-center">
        <div className="absolute inset-0">
          <img src={heroBg} alt="Bunny Chow" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-secondary/90 via-secondary/70 to-secondary/30" />
        </div>
        <div className="container relative z-10 py-20">
          <div className="max-w-xl">
            <span className="inline-block bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-md mb-4 font-body uppercase tracking-wider">
              🔥 Now Delivering in Joburg
            </span>
            <h1 className="font-display text-5xl sm:text-7xl text-primary-foreground leading-none mb-4">
  SOUTH AFRICA'S <br />
  <span className="text-primary">FINEST</span>
</h1>
            <p className="text-primary-foreground/70 text-lg mb-8 font-body max-w-md">
              Premium Bunny Chow & Kota delivered to your door. Authentic street food, crafted with soul.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/menu"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 rounded-lg font-medium hover:opacity-90 transition-opacity text-sm"
              >
                Order Now <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#featured"
                className="inline-flex items-center gap-2 bg-primary-foreground/10 text-primary-foreground border border-primary-foreground/20 px-8 py-3.5 rounded-lg font-medium hover:bg-primary-foreground/20 transition-colors text-sm"
              >
                View Menu
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-card border-b border-border">
        <div className="container py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Truck, text: "Free delivery over R150" },
            { icon: Clock, text: "30 min delivery" },
            { icon: Shield, text: "Quality guaranteed" },
            { icon: Star, text: "4.9★ average rating" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 justify-center text-sm text-muted-foreground">
              <Icon className="w-5 h-5 text-primary shrink-0" />
              <span className="font-medium">{text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-primary">
        <div className="container py-4 text-center">
          <p className="font-display text-xl text-primary-foreground tracking-wider">
            🎉 USE CODE <span className="text-accent">KOTA20</span> FOR 20% OFF YOUR FIRST ORDER
          </p>
        </div>
      </section>

      <section id="featured" className="container py-16">
        <div className="text-center mb-10">
          <h2 className="font-display text-4xl sm:text-5xl text-foreground mb-2">FEATURED MEALS</h2>
          <p className="text-muted-foreground font-body">Our most loved creations, handpicked for you</p>
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
          <h2 className="font-display text-4xl text-center text-foreground mb-10">WHAT OUR CUSTOMERS SAY</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        </div>
      </section>

      <section className="container py-16 text-center">
        <h2 className="font-display text-4xl sm:text-5xl text-foreground mb-4">HUNGRY YET?</h2>
        <p className="text-muted-foreground mb-8 font-body max-w-md mx-auto">
          Order now and get your favourite Kota or Bunny Chow delivered hot to your door.
        </p>
        <Link
          to="/menu"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-10 py-4 rounded-lg font-medium text-lg hover:opacity-90 transition-opacity"
        >
          Order Now <ArrowRight className="w-5 h-5" />
        </Link>
      </section>

      <Footer />
    </div>
  );
}