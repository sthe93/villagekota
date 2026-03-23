import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, sendOrderReceiptForOrder } from "../_shared/orderReceipt.ts";

type CompleteDeliveryRequest = {
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
    const supabaseServiceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = getEnv("RESEND_API_KEY");
    const fromEmail = getEnv("ORDER_RECEIPT_FROM_EMAIL");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: userError?.message || "Not authenticated" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const body = (await req.json().catch(() => ({}))) as CompleteDeliveryRequest;
    const orderId = body.orderId?.trim();

    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId is required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const [{ data: driver, error: driverError }, { data: order, error: orderError }] = await Promise.all([
      supabaseAdmin
        .from("drivers")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle(),
      supabaseAdmin
        .from("orders")
        .select("id, driver_id, status, payment_method, cash_collected")
        .eq("id", orderId)
        .maybeSingle(),
    ]);

    if (driverError) {
      return new Response(JSON.stringify({ error: driverError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (!driver?.id) {
      return new Response(JSON.stringify({ error: "Driver profile not found" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: orderError?.message || "Order not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    if (order.driver_id !== driver.id) {
      return new Response(JSON.stringify({ error: "You are not assigned to this order" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    if (order.status !== "arrived") {
      return new Response(JSON.stringify({ error: "This delivery is no longer in the arrival step." }), {
        status: 409,
        headers: corsHeaders,
      });
    }

    if ((order.payment_method || "").trim().toLowerCase() === "cash" && !order.cash_collected) {
      return new Response(JSON.stringify({ error: "Collect cash before completing this delivery." }), {
        status: 409,
        headers: corsHeaders,
      });
    }

    const { data: completed, error: completeError } = await supabase.rpc("complete_delivery_order", {
      p_order_id: orderId,
      p_driver_id: driver.id,
    });

    if (completeError) {
      return new Response(JSON.stringify({ error: completeError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (!completed) {
      return new Response(JSON.stringify({ error: "This delivery cannot be completed yet." }), {
        status: 409,
        headers: corsHeaders,
      });
    }

    const receipt = await sendOrderReceiptForOrder({
      supabaseAdmin,
      orderId,
      resendApiKey,
      fromEmail,
    });

    return new Response(JSON.stringify({ success: true, receipt }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});
