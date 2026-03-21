import { describe, expect, it } from "vitest";

import {
  getOrderStatusSummary,
  getPaymentLabel,
  getStatusColorClass,
  getStatusLabel,
  normalizeValue,
} from "./orderMeta";

describe("orderMeta", () => {
  describe("normalizeValue", () => {
    it("normalizes whitespace and casing", () => {
      expect(normalizeValue("  Pending ")).toBe("pending");
    });

    it("returns an empty string for nullish input", () => {
      expect(normalizeValue(undefined)).toBe("");
      expect(normalizeValue(null)).toBe("");
    });
  });

  describe("getStatusLabel", () => {
    it("returns friendly labels for delivery statuses", () => {
      expect(getStatusLabel("ready_for_delivery")).toBe("Ready for Delivery");
      expect(getStatusLabel("on_the_way")).toBe("On the Way");
      expect(getStatusLabel("arrived")).toBe("Arrived");
    });
  });

  describe("getStatusColorClass", () => {
    it("returns the cancelled style for cancelled orders", () => {
      expect(getStatusColorClass("cancelled")).toContain("bg-red-100");
    });

    it("falls back to a neutral style for unknown statuses", () => {
      expect(getStatusColorClass("mystery-status")).toBe(
        "border-border bg-muted text-muted-foreground"
      );
    });
  });

  describe("getPaymentLabel", () => {
    it("labels cash orders as cash on delivery when unpaid", () => {
      expect(getPaymentLabel("pending", "cash")).toBe("Cash on delivery");
    });

    it("labels pending card payments correctly", () => {
      expect(getPaymentLabel("pending", "card")).toBe("Awaiting card payment");
      expect(getPaymentLabel("", "card")).toBe("Awaiting card payment");
    });

    it("labels failed and cancelled payments as failed", () => {
      expect(getPaymentLabel("failed", "card")).toBe("Payment failed");
      expect(getPaymentLabel("cancelled", "eft")).toBe("Payment failed");
    });

    it("labels paid orders as paid regardless of method", () => {
      expect(getPaymentLabel("paid", "card")).toBe("Paid");
      expect(getPaymentLabel("paid", "cash")).toBe("Paid");
    });
  });

  describe("getOrderStatusSummary", () => {
    it("returns the driver handoff summary", () => {
      expect(getOrderStatusSummary("ready_for_delivery")).toBe(
        "Ready and waiting for a driver."
      );
    });

    it("returns a fallback message for unknown statuses", () => {
      expect(getOrderStatusSummary("unknown")).toBe("Status updating.");
    });
  });
});
