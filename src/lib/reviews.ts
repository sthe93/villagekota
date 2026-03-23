import { supabase } from "@/integrations/supabase/client";
import { isSchemaCompatibilityError } from "@/lib/supabaseSchemaCompatibility";
import type { DriverInfo, OrderItemRecord, OrderRecord } from "@/features/order-tracking/types";

export interface ProductReviewRecord {
  id: string;
  order_id: string | null;
  product_id: string;
  rating: number;
  comment: string | null;
}

export interface DriverReviewRecord {
  id: string;
  order_id: string;
  driver_id: string;
  rating: number;
  comment: string | null;
}

export interface ReviewableProduct {
  productId: string;
  productName: string;
}

export interface OrderReviewData {
  products: ReviewableProduct[];
  productReviews: ProductReviewRecord[];
  driverReview: DriverReviewRecord | null;
}

interface ProductReviewRow {
  id: string;
  order_id: string | null;
  product_id: string;
  rating: number | null;
  comment: string | null;
}

interface DriverReviewRow {
  id: string;
  order_id: string;
  driver_id: string;
  rating: number | null;
  comment: string | null;
}

export function getReviewableProducts(items: OrderItemRecord[]): ReviewableProduct[] {
  const byProduct = new Map<string, ReviewableProduct>();

  items.forEach((item) => {
    if (!item.product_id) return;
    if (!byProduct.has(item.product_id)) {
      byProduct.set(item.product_id, {
        productId: item.product_id,
        productName: item.product_name,
      });
    }
  });

  return Array.from(byProduct.values());
}

export function canReviewOrder(order: OrderRecord | null | undefined) {
  return order?.status === "delivered";
}

export async function fetchOrderReviewData({
  orderId,
  userId,
  items,
}: {
  orderId: string;
  userId: string;
  items: OrderItemRecord[];
}): Promise<OrderReviewData> {
  const products = getReviewableProducts(items);
  const productIds = products.map((product) => product.productId);

  let productReviews: ProductReviewRecord[] = [];
  if (productIds.length > 0) {
    const reviewResultBase = supabase
      .from("reviews")
      .select("id, order_id, product_id, rating, comment")
      .eq("user_id", userId)
      .eq("order_id", orderId)
      .in("product_id", productIds);

    let reviewResult = await reviewResultBase;

    if (reviewResult.error && isSchemaCompatibilityError(reviewResult.error)) {
      reviewResult = await supabase
        .from("reviews")
        .select("id, order_id, product_id, rating, comment")
        .eq("user_id", userId)
        .in("product_id", productIds);
    }

    if (reviewResult.error) throw reviewResult.error;

    productReviews = ((reviewResult.data || []) as ProductReviewRow[]).map((row) => ({
      id: row.id,
      order_id: row.order_id,
      product_id: row.product_id,
      rating: Number(row.rating ?? 0),
      comment: row.comment,
    }));
  }

  let driverReview: DriverReviewRecord | null = null;
  const driverResult = await supabase
    .from("driver_reviews")
    .select("id, order_id, driver_id, rating, comment")
    .eq("user_id", userId)
    .eq("order_id", orderId)
    .maybeSingle();

  if (driverResult.error && !isSchemaCompatibilityError(driverResult.error)) {
    throw driverResult.error;
  }

  if (driverResult.data) {
    const row = driverResult.data as DriverReviewRow;
    driverReview = {
      id: row.id,
      order_id: row.order_id,
      driver_id: row.driver_id,
      rating: Number(row.rating ?? 0),
      comment: row.comment,
    };
  }

  return { products, productReviews, driverReview };
}

export async function saveOrderReviewData({
  order,
  userId,
  products,
  productRatings,
  driver,
  driverRating,
}: {
  order: OrderRecord;
  userId: string;
  products: ReviewableProduct[];
  productRatings: Record<string, { rating: number; comment: string }>;
  driver: Pick<DriverInfo, "id"> | null;
  driverRating: { rating: number; comment: string };
}) {
  const reviewPayload = products
    .map((product) => {
      const input = productRatings[product.productId];
      if (!input || input.rating < 1) return null;

      return {
        user_id: userId,
        order_id: order.id,
        product_id: product.productId,
        rating: input.rating,
        comment: input.comment.trim() || null,
      };
    })
    .filter(Boolean);

  if (reviewPayload.length > 0) {
    const { error } = await supabase
      .from("reviews")
      .upsert(reviewPayload, { onConflict: "user_id,order_id,product_id" });

    if (error) throw error;
  }

  if (driver?.id && driverRating.rating > 0) {
    const { error } = await supabase.from("driver_reviews").upsert(
      {
        order_id: order.id,
        driver_id: driver.id,
        user_id: userId,
        rating: driverRating.rating,
        comment: driverRating.comment.trim() || null,
      },
      { onConflict: "order_id,user_id" }
    );

    if (error) throw error;
  }
}
