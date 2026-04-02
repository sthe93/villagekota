import { describe, expect, it } from "vitest";
import { isStarVillageAddress } from "./deliveryZone";

describe("isStarVillageAddress", () => {
  it("returns true for Star Village addresses", () => {
    expect(isStarVillageAddress("12 Palm Road, Star Village")).toBe(true);
    expect(isStarVillageAddress("star   village, house 9")).toBe(true);
  });

  it("returns false for non Star Village addresses", () => {
    expect(isStarVillageAddress("123 Durban Road, Johannesburg")).toBe(false);
  });
});
