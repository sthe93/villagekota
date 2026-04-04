import { describe, expect, it, vi } from "vitest";

import {
  geocodeSouthAfricaAddress,
  normalizeSouthAfricaAddressQuery,
  parseAddressSuggestions,
  searchSouthAfricaAddresses,
} from "./maps";

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


describe("normalizeSouthAfricaAddressQuery", () => {
  it("collapses whitespace and newlines before geocoding", () => {
    expect(normalizeSouthAfricaAddressQuery("37547 Pekwa Crescent\nProtea Glen  ")).toBe(
      "37547 Pekwa Crescent Protea Glen"
    );
  });
});

describe("searchSouthAfricaAddresses", () => {
  it("prioritizes house-number matches near Star Village", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          features: [
            {
              id: "first",
              place_name: "Pekwa Crescent, Protea Glen, Soweto, South Africa",
              center: [27.85, -26.31],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          features: [
            {
              id: "second",
              place_name: "37547 Pekwa Crescent, Star Village, Soweto, South Africa",
              center: [27.851, -26.312],
            },
          ],
        }),
      });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      const results = await searchSouthAfricaAddresses("37547 pekwa crescent");
      expect(results[0]?.place_name).toContain("37547");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });


  it("uses a delivery-zone bbox first without mutating the input query", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ features: [] }),
      });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      await searchSouthAfricaAddresses("37547 pekwa crescent soweto");

      const requestedUrls = fetchMock.mock.calls.map((args) => String(args[0]));
      expect(requestedUrls[0]).toContain("bbox=");
      expect(requestedUrls[0]).toContain("37547%20pekwa%20crescent%20soweto");
      expect(requestedUrls[1]).not.toContain("bbox=");
      expect(requestedUrls[0]).toContain("types=address%2Cstreet");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

});

describe("geocodeSouthAfricaAddress", () => {
  it("falls back from delivery-zone bbox lookup to broader lookup when needed", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ features: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          features: [
            {
              id: "fallback",
              place_name: "37547 Pekwa Crescent, Star Village, Soweto, South Africa",
              center: [27.851, -26.312],
            },
          ],
        }),
      });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      const destination = await geocodeSouthAfricaAddress("37547 pekwa crescent");
      expect(destination).toEqual({ lat: -26.312, lng: 27.851 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
