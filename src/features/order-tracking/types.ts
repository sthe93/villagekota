import type { LucideIcon } from "lucide-react";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready_for_delivery"
  | "on_the_way"
  | "arrived"
  | "delivered"
  | "cancelled";

export interface DriverInfo {
  id: string;
  name: string;
  phone: string | null;
  rating: number | null;
  review_count: number | null;
}

export interface OrderRecord {
  id: string;
  user_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  delivery_address: string | null;
  notes: string | null;
  payment_method: string | null;
  payment_provider: string | null;
  payment_reference: string | null;
  payment_status: string | null;
  status: OrderStatus | null;
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

export interface OrderItemOptionRecord {
  id: string;
  order_item_id: string;
  option_group_name: string;
  option_item_name: string;
  price_delta: number;
}

export interface OrderItemRecord {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  final_unit_price: number;
  options_total: number;
  total_price: number;
  item_note: string | null;
  selectedOptions: OrderItemOptionRecord[];
}

export interface PaymentBanner {
  tone: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface TrackingSnapshotState {
  status: OrderStatus | null;
  paymentStatus: string;
  driverId: string | null;
}

export interface TrackingMilestone {
  label: string;
  value: string;
  icon: LucideIcon;
}
