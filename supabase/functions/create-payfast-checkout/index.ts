import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import CryptoJS from "npm:crypto-js";

type Payload = {
  orderId: string;
};

const corsHeadersBase = {
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

function getAllowedOrigins(configuredAppBaseUrl: string | null) {
  const configuredOrigins = (Deno.env.get("ALLOWED_APP_ORIGINS") || "")
    .split(",")
    .map((value) => normalizeBaseUrl(value))
    .filter((value): value is string => Boolean(value));

  const fallbackOrigins = [
    configuredAppBaseUrl,
    "http://localhost:8080",
    "http://localhost:5173",
  ].filter((value): value is string => Boolean(value));

  return new Set([...configuredOrigins, ...fallbackOrigins]);
}

function buildCorsHeaders(origin: string | null, allowedOrigins: Set<string>) {
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : [...allowedOrigins][0] || "null";
  return {
    ...corsHeadersBase,
    "Access-Control-Allow-Origin": allowedOrigin,
  };
}

Deno.serve(async (req) => {
  const configuredAppBaseUrl = normalizeBaseUrl(Deno.env.get("APP_BASE_URL"));
  const requestOrigin = normalizeBaseUrl(req.headers.get("origin"));
  const allowedOrigins = getAllowedOrigins(configuredAppBaseUrl);
  const corsHeaders = buildCorsHeaders(requestOrigin, allowedOrigins);

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID");
    const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY");
    const merchantEmail = (Deno.env.get("PAYFAST_MERCHANT_EMAIL") || "").trim().toLowerCase();
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || "";
    const isSandbox = Deno.env.get("PAYFAST_SANDBOX") === "true";

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !merchantId || !merchantKey) {
      return new Response(
        JSON.stringify({ error: "Missing environment configuration" }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (requestOrigin && !allowedOrigins.has(requestOrigin)) {
      return new Response(
        JSON.stringify({ error: "Origin is not allowed to call this endpoint" }),
        { status: 403, headers: corsHeaders }
      );
    }

    const appBaseUrl = requestOrigin || configuredAppBaseUrl;

    if (!appBaseUrl) {
      return new Response(
        JSON.stringify({
          error: "APP_BASE_URL is not configured and no valid request origin was provided",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: authError?.message || "Not authenticated" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const body = (await req.json()) as Payload;

    if (!body.orderId) {
      return new Response(
        JSON.stringify({ error: "orderId is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const [{ data: order, error: orderError }, { data: adminRole, error: adminRoleError }] =
      await Promise.all([
        supabaseAdmin
          .from("orders")
          .select("id, user_id, customer_name, customer_email, total, payment_method")
          .eq("id", body.orderId)
          .maybeSingle(),
        supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle(),
      ]);

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: orderError?.message || "Order not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    if (adminRoleError) {
      return new Response(
        JSON.stringify({ error: adminRoleError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    const isAdmin = !!adminRole;
    if (order.user_id !== user.id && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "You do not have access to this order" }),
        { status: 403, headers: corsHeaders }
      );
    }

    const customerEmail = order.customer_email?.trim() || "";
    if (!customerEmail) {
      return new Response(
        JSON.stringify({ error: "This order does not have a customer email" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (String(order.payment_method || "").toLowerCase() !== "card") {
      return new Response(
        JSON.stringify({ error: "Only card orders can start PayFast checkout" }),
        { status: 409, headers: corsHeaders }
      );
    }

    if (
      isSandbox &&
      merchantEmail &&
      customerEmail.toLowerCase() === merchantEmail
    ) {
      return new Response(
        JSON.stringify({
          error:
            "PayFast sandbox cannot process payments when the customer email matches the merchant account. Use a separate buyer sandbox account/email to test checkout.",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const amount = Number(order.total || 0).toFixed(2);

    const returnUrl = `${appBaseUrl}/payment/success?orderId=${encodeURIComponent(body.orderId)}`;
    const cancelUrl = `${appBaseUrl}/payment/cancel?orderId=${encodeURIComponent(body.orderId)}`;
    const notifyUrl = `${supabaseUrl}/functions/v1/payfast-notify`;
    const itemName = `Village Eats Order #${body.orderId.slice(0, 8).toUpperCase()}`;

    const paymentData: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,
      name_first: order.customer_name,
      email_address: customerEmail,
      m_payment_id: body.orderId,
      amount,
      item_name: itemName,
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
