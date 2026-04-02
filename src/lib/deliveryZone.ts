const STAR_VILLAGE_ADDRESS_PATTERN = /\bstar\s+village\b/i;
const STAR_VILLAGE_CENTER = { lat: -26.3004, lng: 27.8429 };
const STAR_VILLAGE_RADIUS_METERS = 2200;

type DestinationCoords = {
  lat: number | null;
  lng: number | null;
};

export function isStarVillageAddress(address: string): boolean {
  return STAR_VILLAGE_ADDRESS_PATTERN.test(address.trim());
}

export const STAR_VILLAGE_DELIVERY_MESSAGE =
  "We currently deliver only to addresses inside Star Village.";

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
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

export function isWithinStarVillageGeofence(destination: { lat: number; lng: number }) {
  return haversineDistanceMeters(STAR_VILLAGE_CENTER, destination) <= STAR_VILLAGE_RADIUS_METERS;
}

export function getStarVillageDeliveryError(
  address: string,
  destination: DestinationCoords
): string | null {
  const trimmedAddress = address.trim();
  if (!trimmedAddress) {
    return "Delivery address is required.";
  }

  const hasGeocodedDestination = destination.lat != null && destination.lng != null;
  const isOutsideZone = hasGeocodedDestination
    ? !isWithinStarVillageGeofence({ lat: destination.lat, lng: destination.lng })
    : !isStarVillageAddress(trimmedAddress);

  return isOutsideZone ? STAR_VILLAGE_DELIVERY_MESSAGE : null;
}
