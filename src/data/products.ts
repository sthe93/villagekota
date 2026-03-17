import { supabase } from "@/integrations/supabase/client";

export type Category = "Kota" | "Bunny Chow" | "Sides" | "Drinks" | "Combos";
export type SpiceLevel = "Mild" | "Medium" | "Hot" | "Extra Hot";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: Category;
  image: string;
  spiceLevel: SpiceLevel;
  isPopular: boolean;
  isFeatured: boolean;
  inStock: boolean;
  rating: number;
  reviewCount: number;
}

export const categories: Category[] = ["Kota", "Bunny Chow", "Sides", "Drinks", "Combos"];

const mapCategory = (name: string | null): Category => {
  switch (name) {
    case "Kota":
      return "Kota";
    case "Bunny Chow":
      return "Bunny Chow";
    case "Sides":
      return "Sides";
    case "Drinks":
      return "Drinks";
    case "Combos":
      return "Combos";
    default:
      return "Bunny Chow";
  }
};

const mapSpice = (level: number | null): SpiceLevel => {
  if (!level || level <= 1) return "Mild";
  if (level <= 3) return "Medium";
  if (level === 4) return "Hot";
  return "Extra Hot";
};

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(`
      id,
      name,
      description,
      price,
      image_url,
      spice_level,
      is_available,
      is_featured,
      is_popular,
      rating,
      review_count,
      categories(name)
    `)
    .eq("is_available", true)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    description: item.description || "",
    price: Number(item.price),
    category: mapCategory(item.categories?.name ?? null),
    image: item.image_url || "",
    spiceLevel: mapSpice(item.spice_level),
    isPopular: Boolean(item.is_popular),
    isFeatured: Boolean(item.is_featured),
    inStock: Boolean(item.is_available),
    rating: Number(item.rating ?? 0),
    reviewCount: Number(item.review_count ?? 0),
  }));
}