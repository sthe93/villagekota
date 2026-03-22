import { supabase } from "@/integrations/supabase/client";
import type {
  DriverInfo,
  OrderItemOptionRecord,
  OrderItemRecord,
  OrderRecord,
  TrackingSnapshotState,
} from "./types";
import { normalize, normalizeOrderStatus, toNumberOrNull } from "./utils";

const ORDER_TRACKING_SELECT = `
  id,
  user_id,
  customer_name,
  customer_phone,
  customer_email,
  delivery_address,
  notes,
  payment_method,
  payment_provider,
  payment_reference,
  payment_status,
  status,
  subtotal,
  delivery_fee,
  discount_amount,
  total,
  created_at,
  estimated_delivery_time,
  driver_distance_km,
  driver_lat,
  driver_lng,
  driver_last_updated,
  driver_id,
  accepted_at,
  started_delivery_at,
  arrived_at,
  delivered_at,
  cash_collected,
  cash_collected_amount,
  cash_collected_at,
  destination_lat,
  destination_lng
`;

const ORDER_TRACKING_LEGACY_SELECT = `
  id,
  user_id,
  customer_name,
  customer_phone,
  customer_email,
  delivery_address,
  notes,
  payment_method,
  status,
  subtotal,
  delivery_fee,
  total,
  created_at
`;

const ORDER_ITEMS_SELECT = `
  id,
  product_name,
  quantity,
  unit_price,
  final_unit_price,
  options_total,
  total_price,
  item_note
`;

const ORDER_ITEMS_LEGACY_SELECT = `
  id,
  product_name,
  quantity,
  unit_price,
  total_price
`;

interface OrderRow {
  id: string;
  user_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  delivery_address: string | null;
  notes: string | null;
  payment_method: string | null;
  payment_provider: string | null;
  payment_reference: string | null;
  payment_status: string | null;
  status: string | null;
  subtotal: number | null;
  delivery_fee: number | null;
  discount_amount: number | null;
  total: number | null;
  created_at: string;
  estimated_delivery_time: string | null;
  driver_distance_km: number | null;
  driver_lat: number | null;
  driver_lng: number | null;
  driver_last_updated: string | null;
  driver_id: string | null;
  accepted_at: string | null;
  started_delivery_at: string | null;
  arrived_at: string | null;
  delivered_at: string | null;
  delivery_confirmation_code: string | null;
  delivery_confirmation_verified_at: string | null;
  cash_collected: boolean | null;
  cash_collected_amount: number | null;
  cash_collected_at: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
}

interface OrderItemRow {
  id: string;
  product_name: string;
  quantity: number | null;
  unit_price: number | null;
  final_unit_price: number | null;
  options_total: number | null;
  total_price: number | null;
  item_note: string | null;
}

interface OrderItemOptionRow {
  id: string;
  order_item_id: string;
  option_group_name: string;
  option_item_name: string;
  price_delta: number | null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

function isSchemaCompatibilityError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("schema cache") ||
    message.includes("could not find the") ||
    (message.includes("column") && message.includes("does not exist")) ||
    message.includes("pgrst204") ||
    message.includes("pgrst205")
  );
}

function normalizeOrder(row: OrderRow): OrderRecord {
  return {
    id: String(row.id),
    user_id: row.user_id ?? null,
    customer_name: row.customer_name ?? "",
    customer_phone: row.customer_phone ?? null,
    customer_email: row.customer_email ?? null,
    delivery_address: row.delivery_address ?? null,
    notes: row.notes ?? null,
    payment_method: row.payment_method ?? null,
    payment_provider: row.payment_provider ?? null,
    payment_reference: row.payment_reference ?? null,
    payment_status: row.payment_status ?? null,
    status: normalizeOrderStatus(row.status),
    subtotal: toNumberOrNull(row.subtotal),
    delivery_fee: toNumberOrNull(row.delivery_fee),
    discount_amount: toNumberOrNull(row.discount_amount),
    total: toNumberOrNull(row.total),
    created_at: row.created_at,
    estimated_delivery_time: row.estimated_delivery_time ?? null,
    driver_distance_km: toNumberOrNull(row.driver_distance_km),
    driver_lat: toNumberOrNull(row.driver_lat),
    driver_lng: toNumberOrNull(row.driver_lng),
    driver_last_updated: row.driver_last_updated ?? null,
    driver_id: row.driver_id ?? null,
    accepted_at: row.accepted_at ?? null,
    started_delivery_at: row.started_delivery_at ?? null,
    arrived_at: row.arrived_at ?? null,
    delivered_at: row.delivered_at ?? null,
    delivery_confirmation_code: row.delivery_confirmation_code ?? null,
    delivery_confirmation_verified_at: row.delivery_confirmation_verified_at ?? null,
    cash_collected: row.cash_collected ?? null,
    cash_collected_amount: toNumberOrNull(row.cash_collected_amount),
    cash_collected_at: row.cash_collected_at ?? null,
    destination_lat: toNumberOrNull(row.destination_lat),
    destination_lng: toNumberOrNull(row.destination_lng),
  };
}

function normalizeOrderItems(rows: OrderItemRow[]): OrderItemRecord[] {
  return rows.map((item) => ({
    id: String(item.id),
    product_name: item.product_name,
    quantity: Number(item.quantity ?? 1),
    unit_price: Number(item.unit_price ?? 0),
    final_unit_price: Number(item.final_unit_price ?? item.unit_price ?? 0),
    options_total: Number(item.options_total ?? 0),
    total_price: Number(item.total_price ?? 0),
    item_note: item.item_note || null,
    selectedOptions: [],
  }));
}

export async function fetchOrderTrackingSnapshot(orderId: string) {
  let orderResult = await supabase
    .from("orders")
    .select(`
      id,
      user_id,
      customer_name,
      customer_phone,
      customer_email,
      delivery_address,
      notes,
      payment_method,
      payment_provider,
      payment_reference,
      payment_status,
      status,
      subtotal,
      delivery_fee,
      discount_amount,
      total,
      created_at,
      estimated_delivery_time,
      driver_distance_km,
      driver_lat,
      driver_lng,
      driver_last_updated,
      driver_id,
      accepted_at,
      started_delivery_at,
      arrived_at,
      delivered_at,
      delivery_confirmation_code,
      delivery_confirmation_verified_at,
      cash_collected,
      cash_collected_amount,
      cash_collected_at,
      destination_lat,
      destination_lng
    `)
    .eq("id", orderId)
    .single();

  if (orderResult.error && isSchemaCompatibilityError(orderResult.error)) {
    orderResult = await supabase
      .from("orders")
      .select(ORDER_TRACKING_LEGACY_SELECT)
      .eq("id", orderId)
      .single();
  }

  const { data: orderData, error: orderError } = orderResult;

  if (orderError) throw orderError;

  let itemResult = await supabase
    .from("order_items")
    .select(ORDER_ITEMS_SELECT)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (itemResult.error && isSchemaCompatibilityError(itemResult.error)) {
    itemResult = await supabase
      .from("order_items")
      .select(ORDER_ITEMS_LEGACY_SELECT)
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
  }

  const { data: itemData, error: itemsError } = itemResult;

  if (itemsError) throw itemsError;

  const normalizedItems = normalizeOrderItems((itemData || []) as OrderItemRow[]);

  if (normalizedItems.length > 0) {
    const orderItemIds = normalizedItems.map((item) => item.id);

    const { data: optionData, error: optionsError } = await supabase
      .from("order_item_options")
      .select(`
        id,
        order_item_id,
        option_group_name,
        option_item_name,
        price_delta
      `)
      .in("order_item_id", orderItemIds)
      .order("created_at", { ascending: true });

    if (optionsError && !isSchemaCompatibilityError(optionsError)) throw optionsError;

    const optionsByItemId = new Map<string, OrderItemOptionRecord[]>();

    ((optionData || []) as OrderItemOptionRow[]).forEach((option) => {
      const row: OrderItemOptionRecord = {
        id: String(option.id),
        order_item_id: String(option.order_item_id),
        option_group_name: option.option_group_name,
        option_item_name: option.option_item_name,
        price_delta: Number(option.price_delta ?? 0),
      };

      const existing = optionsByItemId.get(row.order_item_id) || [];
      existing.push(row);
      optionsByItemId.set(row.order_item_id, existing);
    });

    normalizedItems.forEach((item) => {
      item.selectedOptions = optionsByItemId.get(item.id) || [];
    });
  }

  const order = normalizeOrder(orderData as OrderRow);
  let driver: DriverInfo | null = null;

  if (order.driver_id) {
    const { data: driverData, error: driverError } = await supabase
      .from("drivers")
      .select("id, name, phone")
      .eq("id", order.driver_id)
      .maybeSingle();

    if (!driverError) {
      driver = (driverData as DriverInfo | null) || null;
    }
  }

  const snapshot: TrackingSnapshotState = {
    status: order.status,
    paymentStatus: normalize(order.payment_status),
    driverId: order.driver_id,
  };

  return {
    order,
    items: normalizedItems,
    driver,
    snapshot,
  };
}
