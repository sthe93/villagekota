import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { SupabaseClient } from "@supabase/supabase-js";

function redactUrl(value: string) {
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return "invalid-url";
  }
}

export function registerNativeRuntimeHandlers(supabase: SupabaseClient) {
  if (!Capacitor.isNativePlatform()) return;

  const nativeAuthScheme =
    import.meta.env.VITE_NATIVE_AUTH_SCHEME?.trim().replace("://", "") || "co.villagekota.app";
  const authDebugEnabled = import.meta.env.VITE_AUTH_DEBUG_REDIRECT === "true";

  void CapacitorApp.addListener("appUrlOpen", async ({ url }) => {
    if (!url) return;

    if (authDebugEnabled) {
      console.info("[auth] appUrlOpen received", { url: redactUrl(url) });
    }

    const callbackUrl = new URL(url);
    if (callbackUrl.protocol !== `${nativeAuthScheme}:` || callbackUrl.hostname !== "auth") {
      return;
    }

    const code = callbackUrl.searchParams.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (authDebugEnabled) {
        console.info("[auth] exchangeCodeForSession", { hasCode: true, error: error?.message ?? null });
      }
    } else {
      const hashParams = new URLSearchParams(callbackUrl.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (authDebugEnabled) {
          console.info("[auth] setSession from hash", {
            hasAccessToken: true,
            hasRefreshToken: true,
            error: error?.message ?? null,
          });
        }
      }
    }

    const safeQuery = new URLSearchParams();
    const allowedQueryParams = ["error", "error_code", "error_description"];
    allowedQueryParams.forEach((key) => {
      const value = callbackUrl.searchParams.get(key);
      if (value) safeQuery.set(key, value);
    });

    const targetUrl = `${window.location.origin}/auth${safeQuery.size ? `?${safeQuery.toString()}` : ""}`;
    if (authDebugEnabled) {
      console.info("[auth] appUrlOpen targetUrl", { targetUrl: redactUrl(targetUrl) });
    }

    window.location.href = targetUrl;
  });

  void LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
    const url = event.notification?.extra?.url;
    if (typeof url !== "string") return;

    try {
      const parsedUrl = new URL(url, window.location.origin);
      if (parsedUrl.origin === window.location.origin) {
        window.location.href = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
      }
    } catch {
      // Ignore malformed URLs.
    }
  });
}
