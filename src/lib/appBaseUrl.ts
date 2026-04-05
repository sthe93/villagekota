import { Capacitor } from "@capacitor/core";

export function getClientAppBaseUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  const configuredAppBaseUrl = import.meta.env.VITE_APP_BASE_URL?.trim();
  if (configuredAppBaseUrl) {
    return configuredAppBaseUrl.replace(/\/+$/, "");
  }

  if (Capacitor.isNativePlatform()) {
    return "";
  }

  const configuredBasePath = (import.meta.env.VITE_ROUTER_BASENAME || import.meta.env.BASE_URL || "/")
    .trim();

  if (!configuredBasePath || configuredBasePath === "/") {
    return window.location.origin;
  }

  const normalizedBasePath = `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}`;
  return `${window.location.origin}${normalizedBasePath}`;
}
