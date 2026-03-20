import { supabase } from "@/integrations/supabase/client";

export type Category = string;
export type SpiceLevel = "Mild" | "Medium" | "Hot" | "Extra Hot" | null;

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
  hasOptions: boolean;
  optionGroupCount: number;
}

export const categories: Category[] = [
  "Kota",
  "Bunny Chow",
  "Sides",
  "Drinks",
  "Combos",
];

function normalizeCategoryName(name: string | null): Category {
  const value = name?.trim();
  return value || "Other";
}

function mapSpice(level: number | null): SpiceLevel {
  if (level == null || level <= 0) return null;
  if (level === 1) return "Mild";
  if (level <= 3) return "Medium";
  if (level === 4) return "Hot";
  return "Extra Hot";
}

function getCategoryName(categoriesField: any): string | null {
  if (!categoriesField) return null;

  if (Array.isArray(categoriesField)) {
    return categoriesField[0]?.name ?? null;
  }

  return categoriesField.name ?? null;
}

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
      created_at,
      categories(name),
      product_option_groups(id, is_active)
    `)
    .order("is_available", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || []).map((item: any) => {
    const activeOptionGroups = Array.isArray(item.product_option_groups)
      ? item.product_option_groups.filter((group: any) => Boolean(group?.is_active))
      : [];

    const optionGroupCount = activeOptionGroups.length;

    return {
      id: String(item.id),
      name: item.name?.trim() || "Untitled Item",
      description:
        item.description?.trim() || "Freshly prepared and packed with flavour.",
      price: Number(item.price ?? 0),
      category: normalizeCategoryName(getCategoryName(item.categories)),
      image: item.image_url?.trim() || "",
      spiceLevel: mapSpice(item.spice_level),
      isPopular: Boolean(item.is_popular),
      isFeatured: Boolean(item.is_featured),
      inStock: Boolean(item.is_available),
      rating: Number(item.rating ?? 0),
      reviewCount: Number(item.review_count ?? 0),
      hasOptions: optionGroupCount > 0,
      optionGroupCount,
    };
  });
}