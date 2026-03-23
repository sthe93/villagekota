import { describe, expect, it } from "vitest";
import {
  findDuplicateSavedAddress,
  getNextDefaultSavedAddress,
  normalizeSavedAddressLabel,
  normalizeSavedAddressText,
  sortSavedAddresses,
  type SavedAddressRecord,
} from "@/lib/savedAddresses";

const addresses: SavedAddressRecord[] = [
  {
    id: "2",
    label: "Work",
    address_text: "45 Office Park, Durban",
    destination_lat: null,
    destination_lng: null,
    is_default: false,
  },
  {
    id: "1",
    label: "Home",
    address_text: "12 Main Road\nKwaMashu",
    destination_lat: null,
    destination_lng: null,
    is_default: true,
  },
];

describe("savedAddresses helpers", () => {
  it("normalizes labels and addresses", () => {
    expect(normalizeSavedAddressLabel("  My   Place  ")).toBe("My Place");
    expect(normalizeSavedAddressText(" 12 Main Road\nKwaMashu ")).toBe("12 Main Road KwaMashu");
  });

  it("sorts default addresses first", () => {
    expect(sortSavedAddresses(addresses).map((address) => address.id)).toEqual(["1", "2"]);
  });

  it("finds duplicate saved addresses after normalization", () => {
    expect(findDuplicateSavedAddress(addresses, "12 Main Road   KwaMashu")?.id).toBe("1");
    expect(findDuplicateSavedAddress(addresses, "12 Main Road   KwaMashu", "1")).toBeNull();
  });

  it("returns the next default address when removing one", () => {
    expect(getNextDefaultSavedAddress(addresses, "1")?.id).toBe("2");
    expect(getNextDefaultSavedAddress(addresses, "2")?.id).toBe("1");
  });
});
