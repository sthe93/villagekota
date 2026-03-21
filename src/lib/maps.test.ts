import { describe, expect, it } from "vitest";

import { parseAddressSuggestions } from "./maps";

describe("parseAddressSuggestions", () => {
  it("returns normalized address suggestions with lat/lng", () => {
    const suggestions = parseAddressSuggestions({
      features: [
        {
          id: "abc123",
          place_name: "123 Main Rd, Johannesburg, South Africa",
          center: [28.0473, -26.2041],
        },
      ],
    });

    expect(suggestions).toEqual([
      {
        id: "abc123",
        place_name: "123 Main Rd, Johannesburg, South Africa",
        lng: 28.0473,
        lat: -26.2041,
      },
    ]);
  });

  it("filters invalid features safely", () => {
    const suggestions = parseAddressSuggestions({
      features: [
        { id: "missing-center", place_name: "No coordinates" },
        { center: [28.1, -26.1] },
        { id: "ok", place_name: "Valid", center: [28.11, -26.11] },
      ],
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.id).toBe("ok");
  });
});
