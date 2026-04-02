import { describe, expect, it } from "vitest";
import {
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
    expect(isWithinStarVillageGeofence({ lat: -26.3003, lng: 27.8436 })).toBe(true);
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
        lat: -26.3003,
        lng: 27.8436,
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
});
