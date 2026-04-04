import { createRoot } from "react-dom/client";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { supabase } from "@/integrations/supabase/client";
import App from "./App.tsx";
import "./index.css";

if (Capacitor.isNativePlatform()) {
  const nativeAuthScheme =
    import.meta.env.VITE_NATIVE_AUTH_SCHEME?.trim().replace("://", "") || "co.villagekota.app";

  void CapacitorApp.addListener("appUrlOpen", async ({ url }) => {
    if (!url) return;

    const authDebugEnabled = import.meta.env.VITE_AUTH_DEBUG_REDIRECT === "true";
    if (authDebugEnabled) {
      console.info("[auth] appUrlOpen received", { url });
    }

    const expectedPrefix = `${nativeAuthScheme}://auth`;
    if (!url.startsWith(expectedPrefix)) return;

    const callbackUrl = new URL(url);

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

    const targetUrl = `${window.location.origin}/auth${callbackUrl.search}${callbackUrl.hash}`;
    if (authDebugEnabled) {
      console.info("[auth] appUrlOpen targetUrl", { targetUrl });
    }

    window.location.href = targetUrl;
  });

  void LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
    const url = event.notification?.extra?.url;
    if (typeof url === "string" && url.startsWith("/")) {
      window.location.href = `${window.location.origin}${url}`;
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
