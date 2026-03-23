import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, sendOrderReceiptForOrder } from "./orderReceipt.ts";

type ReceiptRequest = {
  orderId?: string;
};

function getEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = getEnv("RESEND_API_KEY");
    const fromEmail = getEnv("ORDER_RECEIPT_FROM_EMAIL");
    const token = req.headers.get("Authorization")?.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing authorization token" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: authError?.message || "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const body = (await req.json()) as ReceiptRequest;
    const orderId = body.orderId?.trim();

    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId is required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const [{ data: order, error: orderError }, { data: adminRole }, { data: driverProfile }] =
      await Promise.all([
        supabaseAdmin.from("orders").select("id, user_id, driver_id").eq("id", orderId).maybeSingle(),
        supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle(),
        supabaseAdmin
          .from("drivers")
          .select("id")
          .eq("auth_user_id", user.id)
          .eq("is_active", true)
          .maybeSingle(),
      ]);

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: orderError?.message || "Order not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const isOwner = order.user_id === user.id;
    const isAdmin = !!adminRole;
    const isAssignedDriver = !!driverProfile?.id && order.driver_id === driverProfile.id;

    if (!isOwner && !isAdmin && !isAssignedDriver) {
      return new Response(JSON.stringify({ error: "You are not allowed to send this receipt" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const result = await sendOrderReceiptForOrder({
      supabaseAdmin,
      orderId,
      resendApiKey,
      fromEmail,
    });

    if (result.status === "sent") {
      return new Response(JSON.stringify({ success: true, receipt: result }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (result.status === "already_sent" || result.status === "missing_customer_email") {
      return new Response(JSON.stringify({ success: true, skipped: true, receipt: result }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ error: result.error, receipt: result }), {
      status: 500,
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
