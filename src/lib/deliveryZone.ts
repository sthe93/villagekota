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
};

const DEFAULT_CONFIG: DeliveryZoneConfig = {
  addressPattern: /\bstar\s+village\b/i,
  center: { lat: -26.3004, lng: 27.8429 },
  radiusMeters: 2200,
  outOfZoneMessage: "We currently deliver only to addresses inside Star Village.",
};

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

export function createDeliveryZonePolicy(config: DeliveryZoneConfig) {
  return {
    isAddressInZone(address: string) {
      return config.addressPattern.test(address.trim());
    },
    isCoordinatesInZone(destination: Coordinates) {
      return haversineDistanceMeters(config.center, destination) <= config.radiusMeters;
    },
    getDeliveryAddressError(address: string, destination: DestinationCoords) {
      const trimmedAddress = address.trim();
      if (!trimmedAddress) {
        return "Delivery address is required.";
      }

      const hasGeocodedDestination = destination.lat != null && destination.lng != null;
      const isOutsideZone = hasGeocodedDestination
        ? !this.isCoordinatesInZone({ lat: destination.lat, lng: destination.lng })
        : !this.isAddressInZone(trimmedAddress);

      return isOutsideZone ? config.outOfZoneMessage : null;
    },
  };
}

const starVillagePolicy = createDeliveryZonePolicy(DEFAULT_CONFIG);

export function isStarVillageAddress(address: string): boolean {
  return starVillagePolicy.isAddressInZone(address);
}

export function isWithinStarVillageGeofence(destination: Coordinates) {
  return starVillagePolicy.isCoordinatesInZone(destination);
}

export function getStarVillageDeliveryError(
  address: string,
  destination: DestinationCoords
): string | null {
  return starVillagePolicy.getDeliveryAddressError(address, destination);
}
