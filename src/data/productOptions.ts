import { supabase } from "@/integrations/supabase/client";

export interface ProductOptionItem {
  id: string;
  name: string;
  description?: string | null;
  priceDelta: number;
  isDefault: boolean;
  isAvailable: boolean;
  sortOrder: number;
}

export interface ProductOptionGroup {
  id: string;
  productId: string;
  name: string;
  description?: string | null;
  selectionType: "single" | "multiple";
  minSelect: number;
  maxSelect: number | null;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
  items: ProductOptionItem[];
}

export interface SelectedOption {
  groupId: string;
  groupName: string;
  itemId: string;
  itemName: string;
  priceDelta: number;
}

interface ProductOptionItemRow {
  id: string;
  name: string;
  description: string | null;
  price_delta: number | null;
  is_default: boolean | null;
  is_available: boolean | null;
  sort_order: number | null;
}

interface ProductOptionGroupRow {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  selection_type: string | null;
  min_select: number | null;
  max_select: number | null;
  is_required: boolean | null;
  sort_order: number | null;
  is_active: boolean | null;
  product_option_items: ProductOptionItemRow[] | null;
}

export async function getProductOptionGroups(
  productId: string
): Promise<ProductOptionGroup[]> {
  const { data, error } = await supabase
    .from("product_option_groups")
    .select(`
      id,
      product_id,
      name,
      description,
      selection_type,
      min_select,
      max_select,
      is_required,
      sort_order,
      is_active,
      product_option_items (
        id,
        name,
        description,
        price_delta,
        is_default,
        is_available,
        sort_order
      )
    `)
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return ((data || []) as ProductOptionGroupRow[]).map((group) => ({
    id: String(group.id),
    productId: String(group.product_id),
    name: group.name,
    description: group.description || null,
    selectionType: group.selection_type === "multiple" ? "multiple" : "single",
    minSelect: Number(group.min_select ?? 0),
    maxSelect: group.max_select != null ? Number(group.max_select) : null,
    isRequired: Boolean(group.is_required),
    sortOrder: Number(group.sort_order ?? 0),
    isActive: Boolean(group.is_active),
    items: (group.product_option_items || [])
      .map((item) => ({
        id: String(item.id),
        name: item.name,
        description: item.description || null,
        priceDelta: Number(item.price_delta ?? 0),
        isDefault: Boolean(item.is_default),
        isAvailable: Boolean(item.is_available),
        sortOrder: Number(item.sort_order ?? 0),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}
