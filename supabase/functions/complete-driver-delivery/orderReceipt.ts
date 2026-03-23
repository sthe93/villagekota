import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type OrderRow = {
  id: string;
  user_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  delivery_address: string;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number | null;
  total: number;
  payment_method: string | null;
  payment_status: string | null;
  payment_reference: string | null;
  status: string;
  created_at: string;
  delivered_at: string | null;
  receipt_emailed_at: string | null;
};

export type OrderItemRow = {
  id: string;
  product_name: string;
  quantity: number;
  final_unit_price: number | null;
  unit_price: number;
  total_price: number;
  item_note: string | null;
};

export type OrderItemOptionRow = {
  order_item_id: string;
  option_group_name: string;
  option_item_name: string;
};

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const currencyFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export type ReceiptResult =
  | { status: "sent" }
  | { status: "already_sent"; receiptEmailedAt: string }
  | { status: "missing_customer_email" }
  | { status: "failed"; error: string };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(value: number | null | undefined) {
  return currencyFormatter.format(Number(value || 0));
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPaymentMethod(value: string | null) {
  switch ((value || "").toLowerCase()) {
    case "card":
      return "Card / PayFast";
    case "eft":
      return "EFT";
    case "voucher":
      return "Voucher";
    default:
      return "Cash on delivery";
  }
}

function buildReceiptMarkup(order: OrderRow, items: Array<OrderItemRow & { optionSummary: string }>) {
  const orderCode = order.id.slice(0, 8).toUpperCase();
  const paymentReference = order.payment_reference || order.id;
  const deliveredAt = formatDateTime(order.delivered_at);
  const discountAmount = Number(order.discount_amount || 0);

  const itemRowsHtml = items
    .map((item) => {
      const optionLine = item.optionSummary
        ? `<div style="margin-top:4px;color:#6b7280;font-size:13px;">${escapeHtml(item.optionSummary)}</div>`
        : "";
      const noteLine = item.item_note
        ? `<div style="margin-top:4px;color:#6b7280;font-size:13px;">Note: ${escapeHtml(item.item_note)}</div>`
        : "";

      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;">
            <div style="font-weight:600;color:#111827;">${item.quantity}× ${escapeHtml(item.product_name)}</div>
            ${optionLine}
            ${noteLine}
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;vertical-align:top;color:#111827;font-weight:600;">
            ${formatCurrency(item.total_price)}
          </td>
        </tr>`;
    })
    .join("");

  const itemRowsText = items
    .map((item) => {
      const optionLine = item.optionSummary ? `\n  ${item.optionSummary}` : "";
      const noteLine = item.item_note ? `\n  Note: ${item.item_note}` : "";
      return `${item.quantity}x ${item.product_name} — ${formatCurrency(item.total_price)}${optionLine}${noteLine}`;
    })
    .join("\n");

  const html = `
    <div style="background:#f8fafc;padding:32px 16px;font-family:Arial,sans-serif;color:#111827;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:24px;overflow:hidden;">
        <div style="background:#111827;padding:28px 32px;color:#ffffff;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.8;">Village Eats Receipt</p>
          <h1 style="margin:0;font-size:28px;">Thank you for your order, ${escapeHtml(order.customer_name)}!</h1>
          <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#e5e7eb;">Your order has been completed and delivered. We hope you enjoyed every bite.</p>
        </div>
        <div style="padding:28px 32px;">
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:24px;">
            <div style="padding:16px;border:1px solid #e5e7eb;border-radius:16px;">
              <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;">Order</div>
              <div style="margin-top:6px;font-size:18px;font-weight:700;">#${orderCode}</div>
              <div style="margin-top:4px;color:#6b7280;font-size:14px;">Delivered ${escapeHtml(deliveredAt)}</div>
            </div>
            <div style="padding:16px;border:1px solid #e5e7eb;border-radius:16px;">
              <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;">Payment</div>
              <div style="margin-top:6px;font-size:18px;font-weight:700;">${escapeHtml(formatPaymentMethod(order.payment_method))}</div>
              <div style="margin-top:4px;color:#6b7280;font-size:14px;">Ref: ${escapeHtml(paymentReference)}</div>
            </div>
          </div>
          <div style="margin-bottom:24px;padding:16px;border:1px solid #e5e7eb;border-radius:16px;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;">Delivery address</div>
            <div style="margin-top:8px;font-size:15px;line-height:1.6;">${escapeHtml(order.delivery_address)}</div>
          </div>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th style="padding-bottom:12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;">Items</th>
                <th style="padding-bottom:12px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;">Total</th>
              </tr>
            </thead>
            <tbody>${itemRowsHtml}</tbody>
          </table>
          <div style="margin-top:24px;padding:20px;border:1px solid #e5e7eb;border-radius:16px;background:#f8fafc;">
            <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;color:#4b5563;"><span>Subtotal</span><strong style="color:#111827;">${formatCurrency(order.subtotal)}</strong></div>
            <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;color:#4b5563;"><span>Delivery fee</span><strong style="color:#111827;">${formatCurrency(order.delivery_fee)}</strong></div>
            <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;color:#4b5563;"><span>Discount</span><strong style="color:#111827;">-${formatCurrency(discountAmount)}</strong></div>
            <div style="display:flex;justify-content:space-between;gap:12px;padding-top:12px;border-top:1px solid #d1d5db;font-size:18px;"><span style="font-weight:700;color:#111827;">Total paid</span><strong style="color:#111827;">${formatCurrency(order.total)}</strong></div>
          </div>
          <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">Thank you for choosing Village Eats. We appreciate your support and look forward to serving you again soon.</p>
        </div>
      </div>
    </div>`;

  const text = `Village Eats Receipt\n\nThank you for your order, ${order.customer_name}!\nYour order has been completed and delivered.\n\nOrder: #${orderCode}\nDelivered: ${deliveredAt}\nPayment method: ${formatPaymentMethod(order.payment_method)}\nPayment reference: ${paymentReference}\nDelivery address: ${order.delivery_address}\n\nItems:\n${itemRowsText}\n\nSubtotal: ${formatCurrency(order.subtotal)}\nDelivery fee: ${formatCurrency(order.delivery_fee)}\nDiscount: -${formatCurrency(discountAmount)}\nTotal paid: ${formatCurrency(order.total)}\n\nThank you for choosing Village Eats.`;

  return { html, text, subject: `Your Village Eats receipt for order #${orderCode}` };
}

async function sendReceiptEmail(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : typeof payload?.error?.message === "string"
          ? payload.error.message
          : "Failed to send receipt email";

    throw new Error(message);
  }

  return payload;
}

export async function sendOrderReceiptForOrder(params: {
  supabaseAdmin: SupabaseClient;
  orderId: string;
  resendApiKey: string;
  fromEmail: string;
}): Promise<ReceiptResult> {
  const { supabaseAdmin, orderId, resendApiKey, fromEmail } = params;

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select(
      "id, user_id, customer_name, customer_email, customer_phone, delivery_address, subtotal, delivery_fee, discount_amount, total, payment_method, payment_status, payment_reference, status, created_at, delivered_at, receipt_emailed_at"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return { status: "failed", error: orderError?.message || "Order not found" };
  }

  if (order.status !== "delivered") {
    return { status: "failed", error: "Receipts can only be sent for delivered orders" };
  }

  const customerEmail = order.customer_email?.trim();
  if (!customerEmail) {
    return { status: "missing_customer_email" };
  }

  if (order.receipt_emailed_at) {
    return { status: "already_sent", receiptEmailedAt: order.receipt_emailed_at };
  }

  const { data: orderItems, error: orderItemsError } = await supabaseAdmin
    .from("order_items")
    .select("id, product_name, quantity, final_unit_price, unit_price, total_price, item_note")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (orderItemsError) {
    return { status: "failed", error: orderItemsError.message };
  }

  const itemIds = ((orderItems || []) as OrderItemRow[]).map((item) => item.id);
  const optionsByItemId = new Map<string, string[]>();

  if (itemIds.length > 0) {
    const { data: optionRows } = await supabaseAdmin
      .from("order_item_options")
      .select("order_item_id, option_group_name, option_item_name")
      .in("order_item_id", itemIds)
      .order("created_at", { ascending: true });

    ((optionRows || []) as OrderItemOptionRow[]).forEach((option) => {
      const current = optionsByItemId.get(option.order_item_id) || [];
      current.push(`${option.option_group_name}: ${option.option_item_name}`);
      optionsByItemId.set(option.order_item_id, current);
    });
  }

  const receiptItems = ((orderItems || []) as OrderItemRow[]).map((item) => ({
    ...item,
    optionSummary: (optionsByItemId.get(item.id) || []).join(", "),
  }));

  const receipt = buildReceiptMarkup(order as OrderRow, receiptItems);

  try {
    await sendReceiptEmail({
      apiKey: resendApiKey,
      from: fromEmail,
      to: customerEmail,
      subject: receipt.subject,
      html: receipt.html,
      text: receipt.text,
    });

    await supabaseAdmin
      .from("orders")
      .update({
        receipt_emailed_at: new Date().toISOString(),
        receipt_email_error: null,
      })
      .eq("id", orderId)
      .is("receipt_emailed_at", null);

    return { status: "sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send receipt email";

    await supabaseAdmin
      .from("orders")
      .update({ receipt_email_error: message })
      .eq("id", orderId);

    return { status: "failed", error: message };
  }
}
