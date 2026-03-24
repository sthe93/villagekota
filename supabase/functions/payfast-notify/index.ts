import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import CryptoJS from "npm:crypto-js";

const responseHeaders = {
  "Content-Type": "text/plain",
};

function getEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function sanitizeValue(value: string) {
  return value.replace(/\+/g, " ").trim();
}

function buildPayfastSignature(data: Record<string, string>, passphrase?: string) {
  const filteredEntries = Object.entries(data).filter(
    ([key, value]) => key !== "signature" && value !== undefined && value !== null && value !== ""
  );

  const queryString = filteredEntries
    .map(
      ([key, value]) =>
        `${key}=${encodeURIComponent(sanitizeValue(String(value))).replace(/%20/g, "+")}`
    )
    .join("&");

  const signatureBase = passphrase
    ? `${queryString}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, "+")}`
    : queryString;

  return CryptoJS.MD5(signatureBase).toString();
}

async function confirmWithPayFast(rawBody: string, isSandbox: boolean) {
  const validationUrl = isSandbox
    ? "https://sandbox.payfast.co.za/eng/query/validate"
    : "https://www.payfast.co.za/eng/query/validate";

  const response = await fetch(validationUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: rawBody,
  });

  const text = (await response.text()).trim().toUpperCase();
  return response.ok && text === "VALID";
}

function mapPaymentStatus(payfastStatus: string) {
  const normalized = payfastStatus.trim().toUpperCase();

  if (normalized === "COMPLETE") return "paid";
  if (normalized === "FAILED") return "failed";
  if (normalized === "CANCELLED") return "cancelled";
  return "pending";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: responseHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: responseHeaders });
  }

  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const merchantId = getEnv("PAYFAST_MERCHANT_ID");
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || "";
    const isSandbox = Deno.env.get("PAYFAST_SANDBOX") === "true";

    const rawBody = await req.text();
    const payload = Object.fromEntries(new URLSearchParams(rawBody));
    const orderId = (payload.m_payment_id || "").trim();
    const paymentStatus = (payload.payment_status || "").trim();
    const signature = (payload.signature || "").trim();

    if (!orderId || !paymentStatus || !signature) {
      return new Response("Invalid payload", { status: 400, headers: responseHeaders });
    }

    if ((payload.merchant_id || "").trim() !== merchantId) {
      return new Response("Invalid merchant", { status: 400, headers: responseHeaders });
    }

    const expectedSignature = buildPayfastSignature(
      Object.fromEntries(
        Object.entries(payload).map(([key, value]) => [key, String(value ?? "")])
      ),
      passphrase
    );

    if (expectedSignature !== signature) {
      return new Response("Invalid signature", { status: 400, headers: responseHeaders });
    }

    const serverConfirmed = await confirmWithPayFast(rawBody, isSandbox);
    if (!serverConfirmed) {
      return new Response("Server confirmation failed", { status: 400, headers: responseHeaders });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, total")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return new Response("Order not found", { status: 404, headers: responseHeaders });
    }

    const expectedAmount = Number(order.total || 0).toFixed(2);
    const receivedAmount = Number(payload.amount_gross || 0).toFixed(2);

    if (expectedAmount !== receivedAmount) {
      return new Response("Amount mismatch", { status: 400, headers: responseHeaders });
    }

    const nextPaymentStatus = mapPaymentStatus(paymentStatus);
    const paymentReference = (payload.pf_payment_id || payload.m_payment_id || "").trim() || orderId;

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_provider: "payfast",
        payment_status: nextPaymentStatus,
        payment_reference: paymentReference,
      })
      .eq("id", orderId);

    if (updateError) {
      return new Response("Failed to update order", { status: 500, headers: responseHeaders });
    }


    const { error: paymentLogError } = await supabaseAdmin
      .from("payment_logs")
      .insert({
        order_id: orderId,
        provider: "payfast",
        provider_payment_id: paymentReference,
        status: nextPaymentStatus,
        amount: Number(payload.amount_gross || 0),
        raw_payload: payload,
      });

    if (paymentLogError) {
      return new Response("Failed to write payment log", { status: 500, headers: responseHeaders });
    }

    return new Response("OK", { status: 200, headers: responseHeaders });
  } catch {
    return new Response("Unexpected error", { status: 500, headers: responseHeaders });
  }
});
