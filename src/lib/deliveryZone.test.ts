import { describe, expect, it } from "vitest";
import { isStarVillageAddress, isWithinStarVillageGeofence } from "./deliveryZone";

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
