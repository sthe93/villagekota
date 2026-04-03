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

const FALLBACK_MAPTILER_KEY = "DmsSAjl2LMkCsIQLtEEd";
const PLACEHOLDER_MAPTILER_KEYS = new Set(["your-maptiler-key", "example-maptiler-key"]);

export function getMapTilerKey() {
  const configuredKey = import.meta.env.VITE_MAPTILER_KEY?.trim();

  if (!configuredKey) {
    return FALLBACK_MAPTILER_KEY;
  }

  if (PLACEHOLDER_MAPTILER_KEYS.has(configuredKey.toLowerCase())) {
    return FALLBACK_MAPTILER_KEY;
  }

  return configuredKey;
}

export function getMapTilerStyleUrl() {
  const key = getMapTilerKey();
  return key ? `https://api.maptiler.com/maps/streets/style.json?key=${key}` : "";
}

export function normalizeSouthAfricaAddressQuery(query: string) {
  return query.replace(/\s+/g, " ").trim();
}

const STAR_VILLAGE_HINT = "Star Village, Soweto";
const STAR_VILLAGE_PROXIMITY = "27.8585,-26.3188";

function getAddressQueryVariants(query: string) {
  const normalizedQuery = normalizeSouthAfricaAddressQuery(query);

  if (!normalizedQuery) {
    return [];
  }

  const lowerQuery = normalizedQuery.toLowerCase();
  const includesStarVillageHint =
    lowerQuery.includes("star village") ||
    lowerQuery.includes("soweto") ||
    lowerQuery.includes("johannesburg");

  if (includesStarVillageHint) {
    return [normalizedQuery];
  }

  return [normalizedQuery, `${normalizedQuery}, ${STAR_VILLAGE_HINT}`];
}

function buildMapTilerUrl(query: string, limit: number) {
  const key = getMapTilerKey();
  const normalizedQuery = normalizeSouthAfricaAddressQuery(query);

  if (!key || !normalizedQuery) {
    return null;
  }

  return `https://api.maptiler.com/geocoding/${encodeURIComponent(
    normalizedQuery
  )}.json?limit=${limit}&country=za&proximity=${STAR_VILLAGE_PROXIMITY}&key=${key}`;
}

function rankAddressSuggestion(placeName: string, inputTokens: string[]) {
  const normalizedPlaceName = placeName.toLowerCase();

  const matchedTokenCount = inputTokens.reduce(
    (count, token) => (normalizedPlaceName.includes(token) ? count + 1 : count),
    0
  );
  const includesHouseNumber = inputTokens.some((token) => /^\d{3,}$/.test(token));
  const includesHouseNumberMatch =
    includesHouseNumber &&
    inputTokens.some((token) => /^\d{3,}$/.test(token) && normalizedPlaceName.includes(token));
  const includesStarVillageArea =
    normalizedPlaceName.includes("star village") ||
    normalizedPlaceName.includes("protea") ||
    normalizedPlaceName.includes("soweto");

  let score = matchedTokenCount;
  if (includesHouseNumberMatch) score += 4;
  if (includesStarVillageArea) score += 2;

  return score;
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
  const queryVariants = getAddressQueryVariants(query);
  if (queryVariants.length === 0) return [];

  const inputTokens = normalizeSouthAfricaAddressQuery(query)
    .toLowerCase()
    .split(" ")
    .filter((token) => token.length > 1);

  const responses = await Promise.all(
    queryVariants.map(async (variant) => {
      const url = buildMapTilerUrl(variant, 6);
      if (!url) return [] as AddressSuggestion[];

      const response = await fetch(url, { signal });
      if (!response.ok) return [] as AddressSuggestion[];

      const payload: unknown = await response.json();
      return parseAddressSuggestions(payload);
    })
  );

  const uniqueSuggestions = new Map<string, AddressSuggestion>();

  responses.flat().forEach((suggestion) => {
    const dedupeKey = suggestion.place_name.toLowerCase();
    if (!uniqueSuggestions.has(dedupeKey)) {
      uniqueSuggestions.set(dedupeKey, suggestion);
    }
  });

  return Array.from(uniqueSuggestions.values())
    .sort(
      (a, b) =>
        rankAddressSuggestion(b.place_name, inputTokens) -
        rankAddressSuggestion(a.place_name, inputTokens)
    )
    .slice(0, 6);
}

export async function geocodeSouthAfricaAddress(
  address: string,
  signal?: AbortSignal
) {
  const queryVariants = getAddressQueryVariants(address);

  for (const variant of queryVariants) {
    const url = buildMapTilerUrl(variant, 1);
    if (!url) continue;

    const response = await fetch(url, { signal });
    if (!response.ok) continue;

    const payload: unknown = await response.json();
    const [first] = parseAddressSuggestions(payload);

    if (first) {
      return {
        lat: first.lat,
        lng: first.lng,
      };
    }
  }

  return null;
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
