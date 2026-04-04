import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type DeviceRole = "customer" | "driver" | "admin";
type DevicePlatform = "ios" | "android";

type RegisterPushDeviceRequest = {
  token?: string;
  platform?: DevicePlatform;
  role?: DeviceRole;
  enabled?: boolean;
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

    const body = (await req.json().catch(() => ({}))) as RegisterPushDeviceRequest;
    const token = body.token?.trim();
    const role = body.role;
    const platform = body.platform;
    const enabled = body.enabled ?? true;

    if (!token || !role || !platform) {
      return new Response(JSON.stringify({ error: "token, role, and platform are required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!["customer", "driver", "admin"].includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!["ios", "android"].includes(platform)) {
      return new Response(JSON.stringify({ error: "Invalid platform" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { error: upsertError } = await supabaseAdmin.from("mobile_push_devices").upsert(
      {
        token,
        user_id: user.id,
        role,
        platform,
        enabled,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" }
    );

    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
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
