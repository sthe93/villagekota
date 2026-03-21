import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import CryptoJS from "npm:crypto-js";

type Payload = {
  orderId: string;
  total: number;
  customerName: string;
  customerEmail: string;
  itemName: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function sanitizeValue(value: string) {
  return value.replace(/\+/g, " ").trim();
}

function buildPayfastSignature(data: Record<string, string>, passphrase?: string) {
  const filteredEntries = Object.entries(data).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
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

function normalizeBaseUrl(value?: string | null) {
  if (!value) return null;

  try {
    const normalized = new URL(value);
    normalized.pathname = "";
    normalized.search = "";
    normalized.hash = "";
    return normalized.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID");
    const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY");
    const merchantEmail = (Deno.env.get("PAYFAST_MERCHANT_EMAIL") || "").trim().toLowerCase();
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || "";
    const isSandbox = Deno.env.get("PAYFAST_SANDBOX") === "true";
    const configuredAppBaseUrl = normalizeBaseUrl(Deno.env.get("APP_BASE_URL"));

    if (!supabaseUrl || !serviceRoleKey || !merchantId || !merchantKey) {
      return new Response(
        JSON.stringify({ error: "Missing environment configuration" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const requestOrigin = normalizeBaseUrl(req.headers.get("origin"));
    const appBaseUrl = requestOrigin || configuredAppBaseUrl;

    if (!appBaseUrl) {
      return new Response(
        JSON.stringify({
          error: "APP_BASE_URL is not configured and no valid request origin was provided",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const body = (await req.json()) as Payload;

    if (!body.orderId || !body.total || !body.customerEmail || !body.itemName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (
      isSandbox &&
      merchantEmail &&
      body.customerEmail.trim().toLowerCase() === merchantEmail
    ) {
      return new Response(
        JSON.stringify({
          error:
            "PayFast sandbox cannot process payments when the customer email matches the merchant account. Use a separate buyer sandbox account/email to test checkout.",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const amount = Number(body.total).toFixed(2);

    const returnUrl = `${appBaseUrl}/payment/success?orderId=${encodeURIComponent(body.orderId)}`;
    const cancelUrl = `${appBaseUrl}/payment/cancel?orderId=${encodeURIComponent(body.orderId)}`;
    const notifyUrl = `${supabaseUrl}/functions/v1/payfast-notify`;

    const paymentData: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,
      name_first: body.customerName,
      email_address: body.customerEmail,
      m_payment_id: body.orderId,
      amount,
      item_name: body.itemName,
    };

    const signature = buildPayfastSignature(paymentData, passphrase);

    const paymentUrlBase = isSandbox
      ? "https://sandbox.payfast.co.za/eng/process"
      : "https://www.payfast.co.za/eng/process";

    const paymentUrl = `${paymentUrlBase}?${new URLSearchParams({
      ...paymentData,
      signature,
    }).toString()}`;

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_provider: "payfast",
        payment_status: "pending",
        payment_reference: body.orderId,
      })
      .eq("id", body.orderId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ url: paymentUrl }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
