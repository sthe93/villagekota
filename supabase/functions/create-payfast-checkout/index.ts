import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import md5 from "npm:crypto-js/md5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  orderId: string;
  total: number;
  customerName: string;
  customerEmail: string;
  itemName: string;
};

function sanitizeValue(value: string) {
  return value.replace(/\+/g, " ").trim();
}

function buildPayfastSignature(data: Record<string, string>, passphrase?: string) {
  const filteredEntries = Object.entries(data).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );

  const queryString = filteredEntries
    .map(([key, value]) => `${key}=${encodeURIComponent(sanitizeValue(String(value))).replace(/%20/g, "+")}`)
    .join("&");

  const signatureBase = passphrase
    ? `${queryString}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, "+")}`
    : queryString;

  return md5(signatureBase).toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = (await req.json()) as Payload;

    if (!body.orderId || !body.total || !body.customerEmail || !body.itemName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID");
    const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY");
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || "";
    const isSandbox = Deno.env.get("PAYFAST_SANDBOX") === "true";
    const siteUrl = Deno.env.get("SITE_URL");

    if (!merchantId || !merchantKey || !siteUrl) {
      return new Response(
        JSON.stringify({ error: "Missing PayFast configuration" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const amount = Number(body.total).toFixed(2);

    const returnUrl = `${siteUrl}/payment/success?orderId=${encodeURIComponent(body.orderId)}`;
    const cancelUrl = `${siteUrl}/payment/cancel?orderId=${encodeURIComponent(body.orderId)}`;
    const notifyUrl = `${siteUrl}/functions/v1/payfast-notify`;

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
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ url: paymentUrl }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});