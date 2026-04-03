import { describe, expect, it } from "vitest";
import {
  applyDeliveryZoneSettings,
  createDeliveryZonePolicy,
  getStarVillageDeliveryError,
  isStarVillageAddress,
  isWithinStarVillageGeofence,
} from "./deliveryZone";

describe("isStarVillageAddress", () => {
  it("returns true for Star Village addresses", () => {
    expect(isStarVillageAddress("12 Palm Road, Star Village")).toBe(true);
    expect(isStarVillageAddress("star   village, house 9")).toBe(true);
  });

  it("returns false for non Star Village addresses", () => {
    expect(isStarVillageAddress("123 Durban Road, Johannesburg")).toBe(false);
  });
});

describe("isWithinStarVillageGeofence", () => {
  it("returns true for coordinates inside Star Village geofence", () => {
    expect(isWithinStarVillageGeofence({ lat: -26.2854, lng: 27.7598 })).toBe(true);
  });

  it("returns false for coordinates outside Star Village geofence", () => {
    expect(isWithinStarVillageGeofence({ lat: -26.2501, lng: 27.9202 })).toBe(false);
  });
});

describe("getStarVillageDeliveryError", () => {
  it("returns required-address message when empty", () => {
    expect(getStarVillageDeliveryError("   ", { lat: null, lng: null })).toBe(
      "Delivery address is required."
    );
  });

  it("uses geofence when destination coordinates are available", () => {
    expect(
      getStarVillageDeliveryError("Random address", {
        lat: -26.2854,
        lng: 27.7598,
      })
    ).toBeNull();

    expect(
      getStarVillageDeliveryError("Star Village somewhere", {
        lat: -26.2501,
        lng: 27.9202,
      })
    ).toBe("We currently deliver only to addresses inside Star Village.");
  });
});

describe("createDeliveryZonePolicy", () => {
  it("supports custom zone policies", () => {
    const policy = createDeliveryZonePolicy({
      addressPattern: /custom zone/i,
      center: { lat: 0, lng: 0 },
      radiusMeters: 500,
      outOfZoneMessage: "Outside custom zone",
    });

    expect(policy.isAddressInZone("123 Custom Zone")).toBe(true);
    expect(policy.isCoordinatesInZone({ lat: 0.001, lng: 0.001 })).toBe(true);
    expect(policy.getDeliveryAddressError("Unknown", { lat: 1, lng: 1 })).toBe(
      "Outside custom zone"
    );
  });

  it("supports destructuring policy methods without losing behavior", () => {
    const policy = createDeliveryZonePolicy({
      addressPattern: /custom zone/i,
      center: { lat: 0, lng: 0 },
      radiusMeters: 500,
      outOfZoneMessage: "Outside custom zone",
    });

    const { getDeliveryAddressError } = policy;
    expect(getDeliveryAddressError("Unknown", { lat: 1, lng: 1 })).toBe("Outside custom zone");
  });
});

describe("applyDeliveryZoneSettings", () => {
  it("applies active delivery zone settings and can reset to defaults", () => {
    applyDeliveryZoneSettings({
      id: "zone-1",
      zone_name: "Custom Zone",
      center_lat: 0,
      center_lng: 0,
      radius_meters: 1000,
      address_pattern: "custom\\s+zone",
      out_of_zone_message: "Outside custom zone",
      is_active: true,
    });

    expect(isStarVillageAddress("15 Custom Zone")).toBe(true);
    expect(isWithinStarVillageGeofence({ lat: 0.001, lng: 0.001 })).toBe(true);

    applyDeliveryZoneSettings(null);
    expect(isStarVillageAddress("123 Durban Road, Johannesburg")).toBe(false);
  });

  it("uses polygon coordinates when provided", () => {
    applyDeliveryZoneSettings({
      id: "zone-2",
      zone_name: "Polygon Zone",
      center_lat: -26.3,
      center_lng: 27.75,
      radius_meters: 100,
      address_pattern: "polygon\\s+zone",
      out_of_zone_message: "Outside polygon zone",
      is_active: true,
      polygon_coordinates: [
        [-26.30, 27.75],
        [-26.30, 27.78],
        [-26.28, 27.78],
        [-26.28, 27.75],
      ],
    });

    expect(isWithinStarVillageGeofence({ lat: -26.29, lng: 27.76 })).toBe(true);
    expect(isWithinStarVillageGeofence({ lat: -26.35, lng: 27.9 })).toBe(false);

    applyDeliveryZoneSettings(null);
  });
});
