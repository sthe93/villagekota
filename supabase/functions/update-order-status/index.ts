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

type MobilePushDevice = {
  token: string;
  platform: "ios" | "android";
};

type PushQueueRow = {
  id: string;
  user_id: string;
  order_id: string;
  status: OrderStatus;
  attempt_count: number;
  max_attempts: number;
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

function optionalEnv(name: string) {
  return Deno.env.get(name)?.trim() || "";
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

function getOrderStatusNotification(status: OrderStatus) {
  const map: Record<OrderStatus, { title: string; body: string }> = {
    pending: {
      title: "Order received",
      body: "We received your order and will confirm it shortly.",
    },
    confirmed: {
      title: "Order confirmed",
      body: "The kitchen has confirmed your order.",
    },
    preparing: {
      title: "Preparing your meal",
      body: "Your order is being freshly prepared.",
    },
    ready_for_delivery: {
      title: "Order ready for delivery",
      body: "Your order is packed and waiting for a driver.",
    },
    on_the_way: {
      title: "Driver on the way",
      body: "Your driver is on the way with your order.",
    },
    arrived: {
      title: "Driver arrived",
      body: "Your driver has arrived with your order.",
    },
    delivered: {
      title: "Order delivered",
      body: "Your order was marked as delivered. Enjoy your meal!",
    },
    cancelled: {
      title: "Order cancelled",
      body: "Your order status changed to cancelled.",
    },
  };

  return map[status];
}

function toBase64Url(input: string | Uint8Array) {
  const raw = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let out = "";
  for (let index = 0; index < raw.length; index += 1) {
    out += String.fromCharCode(raw[index]);
  }
  return btoa(out).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createApnsJwtToken(params: {
  teamId: string;
  keyId: string;
  privateKey: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: params.keyId };
  const payload = { iss: params.teamId, iat: now };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const toSign = `${encodedHeader}.${encodedPayload}`;

  const normalizedKey = params.privateKey.includes("\\n")
    ? params.privateKey.replace(/\\n/g, "\n")
    : params.privateKey;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(normalizedKey),
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    false,
    ["sign"]
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      {
        name: "ECDSA",
        hash: "SHA-256",
      },
      cryptoKey,
      new TextEncoder().encode(toSign)
    )
  );

  return `${toSign}.${toBase64Url(signature)}`;
}

function pemToArrayBuffer(pem: string) {
  const normalized = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");

  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

async function sendFcmPush(params: {
  token: string;
  title: string;
  body: string;
  url: string;
  fcmServerKey: string;
}) {
  const response = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${params.fcmServerKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: params.token,
      priority: "high",
      notification: {
        title: params.title,
        body: params.body,
      },
      data: {
        url: params.url,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`FCM push failed with status ${response.status}`);
  }
}

async function sendApnsPush(params: {
  token: string;
  title: string;
  body: string;
  url: string;
  teamId: string;
  keyId: string;
  privateKey: string;
  bundleId: string;
  useSandbox: boolean;
}) {
  const jwtToken = await createApnsJwtToken({
    teamId: params.teamId,
    keyId: params.keyId,
    privateKey: params.privateKey,
  });

  const host = params.useSandbox ? "api.sandbox.push.apple.com" : "api.push.apple.com";

  const response = await fetch(`https://${host}/3/device/${params.token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwtToken}`,
      "apns-topic": params.bundleId,
      "apns-push-type": "alert",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: {
          title: params.title,
          body: params.body,
        },
        sound: "default",
      },
      url: params.url,
    }),
  });

  if (!response.ok) {
    throw new Error(`APNs push failed with status ${response.status}`);
  }
}

async function dispatchQueuedPushJob(params: {
  supabaseAdmin: ReturnType<typeof createClient>;
  job: PushQueueRow;
}) {
  const { job } = params;

  const { data: devices, error: devicesError } = await params.supabaseAdmin
    .from("mobile_push_devices")
    .select("token, platform")
    .eq("user_id", job.user_id)
    .eq("role", "customer")
    .eq("enabled", true);

  if (devicesError || !devices?.length) {
    if (devicesError) {
      console.error("Failed to load push devices", devicesError.message);
    }
    return;
  }

  const notification = getOrderStatusNotification(job.status);
  const url = `/order-tracking/${job.order_id}`;

  const fcmServerKey = optionalEnv("FCM_SERVER_KEY");
  const apnsTeamId = optionalEnv("APNS_TEAM_ID");
  const apnsKeyId = optionalEnv("APNS_KEY_ID");
  const apnsPrivateKey = optionalEnv("APNS_PRIVATE_KEY");
  const apnsBundleId = optionalEnv("APNS_BUNDLE_ID");
  const apnsUseSandbox = optionalEnv("APNS_USE_SANDBOX") === "true";

  const invalidTokens: string[] = [];
  let jobErrorMessage = "";

  await Promise.all(
    (devices as MobilePushDevice[]).map(async (device) => {
      try {
        if (device.platform === "android") {
          if (!fcmServerKey) {
            console.warn("Skipping Android push send: FCM_SERVER_KEY is not configured");
            return;
          }

          await sendFcmPush({
            token: device.token,
            title: notification.title,
            body: notification.body,
            url,
            fcmServerKey,
          });
          return;
        }

        if (!apnsTeamId || !apnsKeyId || !apnsPrivateKey || !apnsBundleId) {
          console.warn("Skipping iOS push send: APNS credentials are not fully configured");
          return;
        }

        await sendApnsPush({
          token: device.token,
          title: notification.title,
          body: notification.body,
          url,
          teamId: apnsTeamId,
          keyId: apnsKeyId,
          privateKey: apnsPrivateKey,
          bundleId: apnsBundleId,
          useSandbox: apnsUseSandbox,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        jobErrorMessage = message;
        console.error(`Failed to send push for token ${device.token.slice(0, 8)}…`, message);

        if (message.includes("410") || message.includes("404") || message.includes("NotRegistered")) {
          invalidTokens.push(device.token);
        }
      }
    })
  );

  if (invalidTokens.length > 0) {
    const { error: deactivateError } = await params.supabaseAdmin
      .from("mobile_push_devices")
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .in("token", invalidTokens);

    if (deactivateError) {
      console.error("Failed to disable inactive push tokens", deactivateError.message);
    }
  }

  const hadFailures = !!jobErrorMessage;

  if (!hadFailures) {
    await params.supabaseAdmin
      .from("push_dispatch_queue")
      .update({
        state: "sent",
        sent_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return;
  }

  const nextAttemptCount = job.attempt_count + 1;
  const shouldGiveUp = nextAttemptCount >= job.max_attempts;
  const retryDelayMs = Math.min(15 * 60_000, 15_000 * 2 ** Math.min(nextAttemptCount, 6));
  const nextAttemptAt = new Date(Date.now() + retryDelayMs).toISOString();

  await params.supabaseAdmin
    .from("push_dispatch_queue")
    .update({
      state: shouldGiveUp ? "failed" : "pending",
      attempt_count: nextAttemptCount,
      next_attempt_at: shouldGiveUp ? null : nextAttemptAt,
      last_error: jobErrorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
}

async function processQueuedPushes(params: {
  supabaseAdmin: ReturnType<typeof createClient>;
  limit?: number;
}) {
  const nowIso = new Date().toISOString();
  const limit = params.limit ?? 20;

  const { data: jobs, error: jobsError } = await params.supabaseAdmin
    .from("push_dispatch_queue")
    .select("id, user_id, order_id, status, attempt_count, max_attempts")
    .eq("state", "pending")
    .lte("next_attempt_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (jobsError || !jobs?.length) {
    if (jobsError) {
      console.error("Failed to read push queue", jobsError.message);
    }
    return;
  }

  for (const job of jobs as PushQueueRow[]) {
    const { error: lockError } = await params.supabaseAdmin
      .from("push_dispatch_queue")
      .update({
        state: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("state", "pending");

    if (lockError) {
      console.error("Failed to claim push queue job", lockError.message);
      continue;
    }

    await dispatchQueuedPushJob({
      supabaseAdmin: params.supabaseAdmin,
      job,
    });
  }
}

async function enqueueOrderStatusPush(params: {
  supabaseAdmin: ReturnType<typeof createClient>;
  userId: string | null;
  orderId: string;
  status: OrderStatus;
}) {
  if (!params.userId) return;

  const { error } = await params.supabaseAdmin.from("push_dispatch_queue").insert({
    user_id: params.userId,
    order_id: params.orderId,
    status: params.status,
    payload: {
      url: `/order-tracking/${params.orderId}`,
    },
    state: "pending",
    attempt_count: 0,
    max_attempts: 5,
    next_attempt_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Failed to enqueue order status push", error.message);
  }
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
          .select("id, user_id, status, payment_method, payment_status")
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

    await enqueueOrderStatusPush({
      supabaseAdmin,
      userId: order.user_id,
      orderId,
      status: nextStatus,
    });

    void processQueuedPushes({
      supabaseAdmin,
    });

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
