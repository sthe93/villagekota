export type Coordinates = {
  lat: number;
  lng: number;
};

export type DestinationCoords = {
  lat: number | null;
  lng: number | null;
};

export type DeliveryZoneConfig = {
  addressPattern: RegExp;
  center: Coordinates;
  radiusMeters: number;
  outOfZoneMessage: string;
  polygon?: Coordinates[] | null;
};

export type DeliveryZoneSettingsRow = {
  id: string;
  zone_name: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  address_pattern: string;
  out_of_zone_message: string;
  is_active: boolean;
  polygon_coordinates?: unknown;
};

export type DeliveryZoneSettingsRow = {
  id: string;
  zone_name: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  address_pattern: string;
  out_of_zone_message: string;
  is_active: boolean;
};

const DEFAULT_CONFIG: DeliveryZoneConfig = {
  addressPattern: /\bstar\s+village\b/i,
  center: { lat: -26.2856, lng: 27.7594 },
  radiusMeters: 2200,
  outOfZoneMessage: "We currently deliver only to addresses inside Star Village.",
};

let activeConfig: DeliveryZoneConfig = DEFAULT_CONFIG;

export const STAR_VILLAGE_DELIVERY_MESSAGE = DEFAULT_CONFIG.outOfZoneMessage;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceMeters(a: Coordinates, b: Coordinates) {
  const earthRadiusMeters = 6371000;
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const inner =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const arc = 2 * Math.atan2(Math.sqrt(inner), Math.sqrt(1 - inner));
  return earthRadiusMeters * arc;
}

function isInsidePolygon(point: Coordinates, polygon: Coordinates[]) {
  if (polygon.length < 3) return false;

  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

function parsePolygonCoordinates(value: unknown): Coordinates[] | null {
  if (!Array.isArray(value)) return null;

  const parsed = value
    .map((entry) => {
      if (!Array.isArray(entry) || entry.length < 2) return null;
      const lat = Number(entry[0]);
      const lng = Number(entry[1]);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      return { lat, lng };
    })
    .filter((entry): entry is Coordinates => Boolean(entry));

  return parsed.length >= 3 ? parsed : null;
}

export function createDeliveryZonePolicy(config: DeliveryZoneConfig) {
  const isAddressInZone = (address: string) => config.addressPattern.test(address.trim());
  const isCoordinatesInZone = (destination: Coordinates) =>
    config.polygon && config.polygon.length >= 3
      ? isInsidePolygon(destination, config.polygon)
      : haversineDistanceMeters(config.center, destination) <= config.radiusMeters;

  const getDeliveryAddressError = (address: string, destination: DestinationCoords) => {
    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      return "Delivery address is required.";
    }

    const hasGeocodedDestination = destination.lat != null && destination.lng != null;
    const isOutsideZone = hasGeocodedDestination
      ? !isCoordinatesInZone({ lat: destination.lat, lng: destination.lng })
      : !isAddressInZone(trimmedAddress);

    return isOutsideZone ? config.outOfZoneMessage : null;
  };

  return {
    isAddressInZone,
    isCoordinatesInZone,
    getDeliveryAddressError,
  };
}

function buildPolicy() {
  return createDeliveryZonePolicy(activeConfig);
}

export function applyDeliveryZoneSettings(settings: DeliveryZoneSettingsRow | null | undefined) {
  if (!settings || !settings.is_active) {
    activeConfig = DEFAULT_CONFIG;
    return;
  }

  const nextPattern = settings.address_pattern?.trim();
  const radius = Number(settings.radius_meters || 0);
  const lat = Number(settings.center_lat);
  const lng = Number(settings.center_lng);

  if (!nextPattern || !Number.isFinite(radius) || radius <= 0 || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    activeConfig = DEFAULT_CONFIG;
    return;
  }

  activeConfig = {
    addressPattern: new RegExp(nextPattern, "i"),
    center: { lat, lng },
    radiusMeters: radius,
    outOfZoneMessage: settings.out_of_zone_message?.trim() || DEFAULT_CONFIG.outOfZoneMessage,
    polygon: parsePolygonCoordinates(settings.polygon_coordinates),
  };
}

export function isStarVillageAddress(address: string): boolean {
  return buildPolicy().isAddressInZone(address);
}

export function isWithinStarVillageGeofence(destination: Coordinates) {
  return buildPolicy().isCoordinatesInZone(destination);
}

export function getStarVillageDeliveryError(
  address: string,
  destination: DestinationCoords
): string | null {
  return buildPolicy().getDeliveryAddressError(address, destination);
}
