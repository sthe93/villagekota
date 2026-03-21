import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type VoucherAction = "validate" | "redeem";

type Payload = {
  action: VoucherAction;
  code: string;
  amount?: number;
  orderId?: string;
  currency?: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
};

type RequestContext = {
  amount: number | null;
  code: string;
  currency: string;
  customerEmail: string;
  customerPhone: string;
  merchantReference: string;
  orderId: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function normalizeCode(code: string) {
  return code.replace(/[\s-]+/g, "").trim();
}

function parseJsonEnv<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse JSON environment variable: ${error instanceof Error ? error.message : "unknown error"}`
    );
  }
}

function getByPath(input: unknown, path?: string | null) {
  if (!path) return undefined;

  return path
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((current, segment) => {
      if (current && typeof current === "object" && segment in (current as Record<string, unknown>)) {
        return (current as Record<string, unknown>)[segment];
      }

      return undefined;
    }, input);
}

function replaceTemplateValue(value: unknown, context: RequestContext): unknown {
  if (typeof value === "string") {
    const exactMatch = value.match(/^\{\{(.+)\}\}$/);

    if (exactMatch) {
      return context[exactMatch[1].trim() as keyof RequestContext] ?? "";
    }

    return value.replace(/\{\{(.+?)\}\}/g, (_, key: string) => {
      const resolved = context[key.trim() as keyof RequestContext];
      return resolved == null ? "" : String(resolved);
    });
  }

  if (Array.isArray(value)) {
    return value.map((entry) => replaceTemplateValue(entry, context));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        replaceTemplateValue(entry, context),
      ])
    );
  }

  return value;
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "ok", "success", "valid", "approved", "paid"].includes(normalized)) return true;
    if (["false", "error", "invalid", "declined", "failed"].includes(normalized)) return false;
  }

  return null;
}

function firstDefined(input: unknown, paths: string[]) {
  for (const path of paths) {
    const value = getByPath(input, path);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return undefined;
}

function inferSuccess(action: VoucherAction, response: unknown, responseOk: boolean) {
  const explicit = firstDefined(response, [
    action === "validate" ? "success" : "success",
    action === "validate" ? "valid" : "approved",
    "status",
    "result",
  ]);

  const parsed = toBoolean(explicit);
  if (parsed !== null) return parsed;

  if (typeof explicit === "string") {
    const normalized = explicit.trim().toLowerCase();
    if (["success", "successful", "approved", "redeemed", "valid"].includes(normalized)) {
      return true;
    }

    if (["failed", "invalid", "declined", "rejected"].includes(normalized)) {
      return false;
    }
  }

  return responseOk;
}

function inferBalance(response: unknown) {
  return toNumber(
    firstDefined(response, [
      "balance",
      "remainingBalance",
      "remaining_balance",
      "availableBalance",
      "available_balance",
      "value",
      "amount",
      "data.balance",
      "data.remainingBalance",
      "data.remaining_balance",
      "data.availableBalance",
      "data.available_balance",
      "data.value",
      "data.amount",
    ])
  );
}

function inferMessage(response: unknown) {
  const value = firstDefined(response, [
    "message",
    "error",
    "detail",
    "statusMessage",
    "data.message",
    "data.error",
  ]);

  return typeof value === "string" ? value : null;
}

function inferReference(response: unknown) {
  const value = firstDefined(response, [
    "reference",
    "transactionId",
    "transaction_id",
    "redemptionId",
    "redemption_id",
    "voucherReference",
    "voucher_reference",
    "data.reference",
    "data.transactionId",
    "data.transaction_id",
    "data.redemptionId",
    "data.redemption_id",
    "data.voucherReference",
    "data.voucher_reference",
  ]);

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const supabaseAnonKey = getRequiredEnv("SUPABASE_ANON_KEY");
    const token = req.headers.get("Authorization")?.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const body = (await req.json()) as Payload;
    const action = body.action;
    const normalizedCode = normalizeCode(body.code || "");

    if (!action || !["validate", "redeem"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!normalizedCode) {
      return new Response(JSON.stringify({ error: "Voucher code is required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (action === "redeem" && (!body.orderId || !body.amount || body.amount <= 0)) {
      return new Response(JSON.stringify({ error: "Redeem requests need orderId and amount" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const apiBaseUrl = getRequiredEnv("ONEVOUCHER_API_BASE_URL").replace(/\/$/, "");
    const validatePath = Deno.env.get("ONEVOUCHER_VALIDATE_PATH") || "/vouchers/validate";
    const redeemPath = Deno.env.get("ONEVOUCHER_REDEEM_PATH") || "/vouchers/redeem";
    const validateMethod = (Deno.env.get("ONEVOUCHER_VALIDATE_METHOD") || "POST").toUpperCase();
    const redeemMethod = (Deno.env.get("ONEVOUCHER_REDEEM_METHOD") || "POST").toUpperCase();
    const timeoutMs = Number(Deno.env.get("ONEVOUCHER_TIMEOUT_MS") || "15000");

    const headersTemplate = parseJsonEnv<Record<string, unknown>>(
      Deno.env.get("ONEVOUCHER_HEADERS_TEMPLATE_JSON"),
      {
        "Content-Type": "application/json",
      }
    );

    const validateBodyTemplate = parseJsonEnv<Record<string, unknown>>(
      Deno.env.get("ONEVOUCHER_VALIDATE_BODY_TEMPLATE_JSON"),
      {
        pin: "{{code}}",
      }
    );

    const redeemBodyTemplate = parseJsonEnv<Record<string, unknown>>(
      Deno.env.get("ONEVOUCHER_REDEEM_BODY_TEMPLATE_JSON"),
      {
        pin: "{{code}}",
        amount: "{{amount}}",
        currency: "{{currency}}",
        merchantReference: "{{merchantReference}}",
      }
    );

    const context: RequestContext = {
      amount: body.amount ?? null,
      code: normalizedCode,
      currency: body.currency || "ZAR",
      customerEmail: body.customerEmail || user.email || "",
      customerPhone: body.customerPhone || "",
      merchantReference: body.orderId || normalizedCode,
      orderId: body.orderId || "",
    };

    const requestHeaders = replaceTemplateValue(headersTemplate, context) as Record<string, string>;
    const requestBody = replaceTemplateValue(
      action === "validate" ? validateBodyTemplate : redeemBodyTemplate,
      context
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${apiBaseUrl}${action === "validate" ? validatePath : redeemPath}`, {
      method: action === "validate" ? validateMethod : redeemMethod,
      headers: requestHeaders,
      body: ["GET", "HEAD"].includes(action === "validate" ? validateMethod : redeemMethod)
        ? undefined
        : JSON.stringify(requestBody),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const rawText = await response.text();
    let parsedResponse: unknown = null;

    try {
      parsedResponse = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsedResponse = { rawText };
    }

    const success = inferSuccess(action, parsedResponse, response.ok);
    const message = inferMessage(parsedResponse);
    const providerReference = inferReference(parsedResponse);
    const balance = inferBalance(parsedResponse);

    if (action === "validate" && success && (balance === null || balance <= 0)) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            message ||
            "1Voucher validation succeeded but no balance could be determined. Check ONEVOUCHER_* response mapping or provider response format.",
          rawResponse: parsedResponse,
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success,
        balance,
        message,
        providerReference,
        rawResponse: parsedResponse,
      }),
      {
        status: success ? 200 : response.status || 400,
        headers: corsHeaders,
      }
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
