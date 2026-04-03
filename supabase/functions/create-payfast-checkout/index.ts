import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import CryptoJS from "npm:crypto-js";

type Payload = {
  orderId?: string;
  cardSessionId?: string;
  draftAmount?: number;
  customerName?: string;
  customerEmail?: string;
};

const corsHeadersBase = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  Vary: "Origin",
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

  const fallbackOrigins = [configuredAppBaseUrl].filter(
    (value): value is string => Boolean(value)
  );

  return new Set([...configuredOrigins, ...fallbackOrigins]);
}

function buildCorsHeaders(origin: string | null, allowedOrigins: Set<string>) {
  const allowedOrigin = origin || [...allowedOrigins][0] || "*";
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

    const isDraftCardSession = Boolean(body.cardSessionId);
    const orderId = body.orderId?.trim() || null;

    let customerEmail = "";
    let customerName = "";
    let amount = "0.00";
    let paymentReference = "";

    if (!isDraftCardSession && !orderId) {
      return new Response(
        JSON.stringify({ error: "orderId or cardSessionId is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (isDraftCardSession) {
      const draftAmount = Number(body.draftAmount || 0);
      customerEmail = (body.customerEmail || "").trim();
      customerName = (body.customerName || "").trim();
      paymentReference = body.cardSessionId!.trim();

      if (!customerEmail || !customerName || !paymentReference || draftAmount <= 0) {
        return new Response(
          JSON.stringify({ error: "cardSessionId, customerEmail, customerName and draftAmount are required" }),
          { status: 400, headers: corsHeaders }
        );
      }

      amount = draftAmount.toFixed(2);
    } else {
      const [{ data: order, error: orderError }, { data: adminRole, error: adminRoleError }] =
        await Promise.all([
          supabaseAdmin
            .from("orders")
            .select("id, user_id, customer_name, customer_email, total, payment_method")
            .eq("id", orderId)
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

      customerEmail = order.customer_email?.trim() || "";
      customerName = order.customer_name?.trim() || "";
      amount = Number(order.total || 0).toFixed(2);
      paymentReference = order.id;

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

    const successParams = new URLSearchParams();
    const cancelParams = new URLSearchParams();

    if (orderId) {
      successParams.set("orderId", orderId);
      cancelParams.set("orderId", orderId);
    }

    if (body.cardSessionId) {
      successParams.set("cardSessionId", body.cardSessionId);
      cancelParams.set("cardSessionId", body.cardSessionId);
    }

    const returnUrl = `${appBaseUrl}/payment/success?${successParams.toString()}`;
    const cancelUrl = `${appBaseUrl}/payment/cancel?${cancelParams.toString()}`;
    const notifyUrl = `${supabaseUrl}/functions/v1/payfast-notify`;
    const itemName = orderId
      ? `Village Eats Order #${orderId.slice(0, 8).toUpperCase()}`
      : "Village Eats Card Checkout";

    const paymentData: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,
      name_first: customerName,
      email_address: customerEmail,
      m_payment_id: paymentReference,
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

    if (orderId) {
      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({
          payment_provider: "payfast",
          payment_status: "pending",
          payment_reference: orderId,
        })
        .eq("id", orderId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: corsHeaders }
        );
      }

      const { error: paymentLogError } = await supabaseAdmin
        .from("payment_logs")
        .insert({
          order_id: orderId,
          provider: "payfast",
          provider_payment_id: orderId,
          status: "pending",
          amount: Number(amount),
          raw_payload: { event: "checkout_created" },
        });

      if (paymentLogError) {
        return new Response(
          JSON.stringify({ error: paymentLogError.message }),
          { status: 500, headers: corsHeaders }
        );
      }
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
