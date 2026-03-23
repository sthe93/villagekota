import { describe, expect, it } from "vitest";
import { buildReorderPlan } from "@/lib/reorder";
import type { Product } from "@/data/products";

const products: Product[] = [
  {
    id: "product-1",
    name: "Full Kota",
    description: "desc",
    price: 60,
    category: "Kota",
    image: "",
    spiceLevel: null,
    isPopular: false,
    isFeatured: false,
    inStock: true,
    rating: 0,
    reviewCount: 0,
    hasOptions: false,
    optionGroupCount: 0,
  },
  {
    id: "product-2",
    name: "Russian Bunny",
    description: "desc",
    price: 75,
    category: "Bunny Chow",
    image: "",
    spiceLevel: null,
    isPopular: false,
    isFeatured: false,
    inStock: false,
    rating: 0,
    reviewCount: 0,
    hasOptions: false,
    optionGroupCount: 0,
  },
];

describe("buildReorderPlan", () => {
  it("restores matching available products by id or name", () => {
    const plan = buildReorderPlan(
      [
        {
          product_id: "product-1",
          product_name: "Full Kota",
          quantity: 2,
          item_note: "extra sauce",
          options_total: 5,
          final_unit_price: 65,
          unit_price: 60,
          selectedOptions: [
            {
              id: "opt-1",
              option_group_name: "Sauce",
              option_item_name: "Chilli",
              price_delta: 5,
            },
          ],
        },
        {
          product_id: null,
          product_name: " full   kota ",
          quantity: 1,
          item_note: null,
          options_total: 0,
          final_unit_price: 60,
          unit_price: 60,
          selectedOptions: [],
        },
      ],
      products
    );

    expect(plan.restoredCount).toBe(3);
    expect(plan.skippedCount).toBe(0);
    expect(plan.lines).toHaveLength(2);
    expect(plan.lines[0].selectedOptions[0].itemName).toBe("Chilli");
  });

  it("skips unavailable products", () => {
    const plan = buildReorderPlan(
      [
        {
          product_id: "product-2",
          product_name: "Russian Bunny",
          quantity: 2,
          item_note: null,
          options_total: 0,
          final_unit_price: 75,
          unit_price: 75,
          selectedOptions: [],
        },
      ],
      products
    );

    expect(plan.restoredCount).toBe(0);
    expect(plan.skippedCount).toBe(2);
    expect(plan.lines).toHaveLength(0);
  });
});
