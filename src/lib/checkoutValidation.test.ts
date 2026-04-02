import { describe, expect, it } from "vitest";
import { buildCheckoutFieldErrors, buildCheckoutValidationMessages, getPhoneDigits } from "./checkoutValidation";

describe("checkoutValidation", () => {
  it("normalizes phone digits", () => {
    expect(getPhoneDigits("+27 82 123 4567")).toBe("27821234567");
  });

  it("returns validation errors for missing required fields", () => {
    const errors = buildCheckoutFieldErrors(
      {
        name: "",
        phone: "",
        email: "",
        address: "",
        payment: "card",
      },
      { lat: null, lng: null }
    );

    expect(errors.name).toBe("Full name is required.");
    expect(errors.phone).toBe("Cell phone number is required.");
    expect(errors.address).toBe("Delivery address is required.");
    expect(errors.email).toBe("Email is required for card payments.");
  });

  it("builds blocking messages including sign-in state", () => {
    const messages = buildCheckoutValidationMessages({
      isSignedIn: false,
      fields: {
        name: "A",
        phone: "0712345678",
        email: "",
        address: "12 Palm Road, Star Village",
        payment: "cash",
      },
      destination: { lat: null, lng: null },
    });

    expect(messages).toContain("Please sign in before placing your order.");
  });

  it("uses summary-friendly invalid phone wording", () => {
    const messages = buildCheckoutValidationMessages({
      isSignedIn: true,
      fields: {
        name: "A",
        phone: "123",
        email: "",
        address: "12 Palm Road, Star Village",
        payment: "cash",
      },
      destination: { lat: null, lng: null },
    });

    expect(messages).toContain("Enter a valid South African cell phone number with 10 digits.");
  });
});
