import { describe, expect, it } from "vitest";
import { canReviewOrder, getReviewableProducts } from "@/lib/reviews";
import type { OrderItemRecord, OrderRecord } from "@/features/order-tracking/types";

function createItem(partial: Partial<OrderItemRecord>): OrderItemRecord {
  return {
    id: "item-1",
    product_id: null,
    product_name: "Sample",
    quantity: 1,
    unit_price: 10,
    final_unit_price: 10,
    options_total: 0,
    total_price: 10,
    item_note: null,
    selectedOptions: [],
    ...partial,
  };
}

function createOrder(status: OrderRecord["status"]): OrderRecord {
  return {
    id: "order-1",
    user_id: "user-1",
    customer_name: "Test",
    customer_phone: null,
    customer_email: null,
    delivery_address: null,
    notes: null,
    payment_method: null,
    payment_provider: null,
    payment_reference: null,
    payment_status: null,
    status,
    subtotal: 10,
    delivery_fee: 5,
    discount_amount: 0,
    total: 15,
    created_at: new Date().toISOString(),
    estimated_delivery_time: null,
    driver_distance_km: null,
    driver_lat: null,
    driver_lng: null,
    driver_last_updated: null,
    driver_id: null,
    accepted_at: null,
    started_delivery_at: null,
    arrived_at: null,
    delivered_at: null,
    delivery_confirmation_code: null,
    delivery_confirmation_verified_at: null,
    cash_collected: null,
    cash_collected_amount: null,
    cash_collected_at: null,
    destination_lat: null,
    destination_lng: null,
  };
}

describe("getReviewableProducts", () => {
  it("deduplicates products and skips non-product order items", () => {
    const result = getReviewableProducts([
      createItem({ id: "a", product_id: "prod-1", product_name: "Kota" }),
      createItem({ id: "b", product_id: "prod-1", product_name: "Kota" }),
      createItem({ id: "c", product_id: null, product_name: "Manual item" }),
      createItem({ id: "d", product_id: "prod-2", product_name: "Chips" }),
    ]);

    expect(result).toEqual([
      { productId: "prod-1", productName: "Kota" },
      { productId: "prod-2", productName: "Chips" },
    ]);
  });
});

describe("canReviewOrder", () => {
  it("allows delivered orders", () => {
    expect(canReviewOrder(createOrder("delivered"))).toBe(true);
  });

  it("blocks non-delivered orders", () => {
    expect(canReviewOrder(createOrder("on_the_way"))).toBe(false);
  });
});
