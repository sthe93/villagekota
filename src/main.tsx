import { createRoot } from "react-dom/client";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import App from "./App.tsx";
import "./index.css";

if (Capacitor.isNativePlatform()) {
  const nativeAuthScheme =
    import.meta.env.VITE_NATIVE_AUTH_SCHEME?.trim().replace("://", "") || "co.villagekota.app";

  void CapacitorApp.addListener("appUrlOpen", ({ url }) => {
    if (!url) return;

    const expectedPrefix = `${nativeAuthScheme}://auth`;
    if (!url.startsWith(expectedPrefix)) return;

    const callbackUrl = new URL(url);
    const targetUrl = `${window.location.origin}/auth${callbackUrl.search}${callbackUrl.hash}`;

    void Browser.close();
    window.location.href = targetUrl;
  });
}

createRoot(document.getElementById("root")!).render(<App />);
