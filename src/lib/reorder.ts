import type { SelectedOption } from "@/data/productOptions";
import type { Product } from "@/data/products";

interface ReorderSourceOption {
  id: string;
  option_group_name: string;
  option_item_name: string;
  price_delta: number;
}

export interface ReorderSourceItem {
  product_id: string | null;
  product_name: string;
  quantity: number;
  item_note: string | null;
  options_total: number;
  final_unit_price: number;
  unit_price: number;
  selectedOptions: ReorderSourceOption[];
}

export interface ReorderCartLine {
  product: Product;
  quantity: number;
  note?: string;
  selectedOptions: SelectedOption[];
  optionsTotal: number;
  finalUnitPrice: number;
}

function normalizeProductName(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function buildReorderPlan(items: ReorderSourceItem[], products: Product[]) {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const productsByName = new Map(
    products.map((product) => [normalizeProductName(product.name), product])
  );

  const lines: ReorderCartLine[] = [];
  let restoredCount = 0;
  let skippedCount = 0;

  items.forEach((item) => {
    const matchedProduct =
      (item.product_id ? productsById.get(item.product_id) : undefined) ||
      productsByName.get(normalizeProductName(item.product_name));

    if (!matchedProduct || !matchedProduct.inStock) {
      skippedCount += item.quantity;
      return;
    }

    lines.push({
      product: matchedProduct,
      quantity: item.quantity,
      note: item.item_note || undefined,
      selectedOptions: item.selectedOptions.map((option) => ({
        groupId: option.option_group_name,
        groupName: option.option_group_name,
        itemId: option.id,
        itemName: option.option_item_name,
        priceDelta: option.price_delta,
      })),
      optionsTotal: item.options_total,
      finalUnitPrice: item.final_unit_price || item.unit_price,
    });

    restoredCount += item.quantity;
  });

  return {
    lines,
    restoredCount,
    skippedCount,
  };
}
