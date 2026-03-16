import { Plus, Star, Flame } from "lucide-react";
import type { Product } from "@/data/products";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";

const spiceColors: Record<string, string> = {
  Mild: "text-success",
  Medium: "text-accent",
  Hot: "text-primary",
  "Extra Hot": "text-destructive",
};

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();

  const handleAdd = () => {
    addItem(product);
    toast.success(`${product.name} added to cart`);
  };

  return (
    <div className="group relative bg-card rounded-lg overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 animate-fade-in">
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        {/* Price badge */}
        <span className="absolute top-3 right-3 bg-success text-success-foreground font-bold text-sm px-3 py-1 rounded-md">
          R{product.price}
        </span>
        {/* Popular badge */}
        {product.isPopular && (
          <span className="absolute top-3 left-3 bg-accent text-accent-foreground text-xs font-bold px-2.5 py-1 rounded-md">
            ⭐ Most Popular
          </span>
        )}
        {!product.inStock && (
          <div className="absolute inset-0 bg-secondary/70 flex items-center justify-center">
            <span className="text-secondary-foreground font-display text-xl">SOLD OUT</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-display text-xl text-foreground leading-tight">{product.name}</h3>
          <div className="flex items-center gap-0.5 shrink-0">
            <Flame className={`w-3.5 h-3.5 ${spiceColors[product.spiceLevel]}`} />
            <span className="text-xs text-muted-foreground">{product.spiceLevel}</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-3 line-clamp-2 font-body">
          {product.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-accent text-accent" />
            <span className="text-xs font-medium text-foreground">{product.rating}</span>
            <span className="text-xs text-muted-foreground">({product.reviewCount})</span>
          </div>

          <button
            onClick={handleAdd}
            disabled={!product.inStock}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
