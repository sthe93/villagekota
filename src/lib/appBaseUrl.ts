export function getClientAppBaseUrl() {
  if (typeof window === "undefined") {
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
