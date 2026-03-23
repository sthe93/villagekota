import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready_for_delivery"
  | "on_the_way"
  | "arrived"
  | "delivered"
  | "cancelled";

type UpdateOrderStatusRequest = {
  orderId?: string;
  status?: OrderStatus;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function getEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function normalize(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function isCardPaymentMethod(value?: string | null) {
  return normalize(value) === "card";
}

function isPaidPaymentStatus(value?: string | null) {
  return normalize(value) === "paid";
}

function validateAdminTransition(order: {
  payment_method?: string | null;
  payment_status?: string | null;
  status?: string | null;
}, nextStatus: OrderStatus) {
  const currentStatus = normalize(order.status);
  const isCard = isCardPaymentMethod(order.payment_method);
  const isPaid = isPaidPaymentStatus(order.payment_status);

  if (["on_the_way", "arrived", "delivered"].includes(nextStatus)) {
    return {
      allowed: false,
      message: "Driver controls On The Way, Arrived, and Delivered statuses.",
    };
  }

  if (
    isCard &&
    !isPaid &&
    ["confirmed", "preparing", "ready_for_delivery"].includes(nextStatus)
  ) {
    return {
      allowed: false,
      message:
        "Card payment must be paid before the order can move to Confirmed, Preparing, or Ready for Delivery.",
    };
  }

  if (nextStatus === "cancelled" && currentStatus === "delivered") {
    return {
      allowed: false,
      message: "Delivered orders cannot be cancelled.",
    };
  }

  return { allowed: true, message: "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: corsHeaders,
      });
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
      return new Response(JSON.stringify({ error: authError?.message || "Not authenticated" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const body = (await req.json().catch(() => ({}))) as UpdateOrderStatusRequest;
    const orderId = body.orderId?.trim();
    const nextStatus = body.status;

    if (!orderId || !nextStatus) {
      return new Response(JSON.stringify({ error: "orderId and status are required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const [{ data: adminRole, error: adminRoleError }, { data: order, error: orderError }] =
      await Promise.all([
        supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle(),
        supabaseAdmin
          .from("orders")
          .select("id, status, payment_method, payment_status")
          .eq("id", orderId)
          .maybeSingle(),
      ]);

    if (adminRoleError) {
      return new Response(JSON.stringify({ error: adminRoleError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
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

    const guard = validateAdminTransition(order, nextStatus);
    if (!guard.allowed) {
      return new Response(JSON.stringify({ error: guard.message }), {
        status: 409,
        headers: corsHeaders,
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ success: true, status: nextStatus }), {
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
