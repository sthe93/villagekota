export interface AddressSuggestion {
  id: string;
  place_name: string;
  lat: number;
  lng: number;
}

interface MapTilerFeature {
  id?: string | number;
  place_name?: string;
  center?: [number, number];
}

interface MapTilerResponse {
  features?: MapTilerFeature[];
}

interface OsrmRoute {
  duration?: number;
  distance?: number;
}

interface OsrmResponse {
  routes?: OsrmRoute[];
}

function getMapTilerKey() {
  return import.meta.env.VITE_MAPTILER_KEY?.trim() || "";
}

export function normalizeSouthAfricaAddressQuery(query: string) {
  return query.replace(/\s+/g, " ").trim();
}

function buildMapTilerUrl(query: string, limit: number) {
  const key = getMapTilerKey();
  const normalizedQuery = normalizeSouthAfricaAddressQuery(query);

  if (!key || !normalizedQuery) {
    return null;
  }

  return `https://api.maptiler.com/geocoding/${encodeURIComponent(
    normalizedQuery
  )}.json?limit=${limit}&country=za&key=${key}`;
}

export function parseAddressSuggestions(payload: unknown): AddressSuggestion[] {
  const response = payload as MapTilerResponse;
  const features = Array.isArray(response?.features) ? response.features : [];

  return features
    .filter(
      (feature): feature is Required<Pick<MapTilerFeature, "place_name" | "center">> &
        MapTilerFeature =>
        typeof feature?.place_name === "string" &&
        Array.isArray(feature.center) &&
        typeof feature.center[0] === "number" &&
        typeof feature.center[1] === "number"
    )
    .map((feature, index) => ({
      id:
        typeof feature.id === "string" || typeof feature.id === "number"
          ? String(feature.id)
          : `${feature.place_name}-${index}`,
      place_name: feature.place_name,
      lat: feature.center[1],
      lng: feature.center[0],
    }));
}

export async function searchSouthAfricaAddresses(
  query: string,
  signal?: AbortSignal
) {
  const url = buildMapTilerUrl(query, 5);
  if (!url) return [];

  const response = await fetch(url, { signal });
  if (!response.ok) return [];

  const payload: unknown = await response.json();
  return parseAddressSuggestions(payload);
}

export async function geocodeSouthAfricaAddress(
  address: string,
  signal?: AbortSignal
) {
  const url = buildMapTilerUrl(address, 1);
  if (!url) return null;

  const response = await fetch(url, { signal });
  if (!response.ok) return null;

  const payload: unknown = await response.json();
  const [first] = parseAddressSuggestions(payload);

  if (!first) return null;

  return {
    lat: first.lat,
    lng: first.lng,
  };
}

export async function getSouthAfricaDrivingRouteMeta(
  driverLat: number,
  driverLng: number,
  destLat: number,
  destLng: number,
  signal?: AbortSignal
) {
  const url = `https://router.project-osrm.org/route/v1/driving/${driverLng},${driverLat};${destLng},${destLat}?overview=false`;
  const response = await fetch(url, { signal });
  const payload = (await response.json()) as OsrmResponse;
  const route = Array.isArray(payload?.routes) ? payload.routes[0] : null;

  if (!route) return null;

  return {
    durationMinutes:
      typeof route.duration === "number" ? Math.max(Math.round(route.duration / 60), 1) : null,
    distanceKm:
      typeof route.distance === "number"
        ? Number((route.distance / 1000).toFixed(1))
        : null,
  };
}
