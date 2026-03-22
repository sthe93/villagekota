import {
  DELIVERY_CONFIRMATION_CODE_LENGTH,
  deriveDeliveryConfirmationCode,
  formatDeliveryConfirmationCode,
  generateDeliveryConfirmationCode,
  isDeliveryConfirmationCodeComplete,
  normalizeDeliveryConfirmationCode,
} from "./deliveryConfirmation";

describe("deliveryConfirmation", () => {
  it("generates a numeric code with the expected length", () => {
    const code = generateDeliveryConfirmationCode();

    expect(code).toMatch(/^\d+$/);
    expect(code).toHaveLength(DELIVERY_CONFIRMATION_CODE_LENGTH);
  });

  it("normalizes user input to the expected numeric code", () => {
    expect(normalizeDeliveryConfirmationCode(" 12a3-45 ")).toBe("1234");
  });

  it("formats a code for customer-friendly display", () => {
    expect(formatDeliveryConfirmationCode("1234")).toBe("1 2 3 4");
  });

  it("derives a stable code from the same seed", () => {
    expect(deriveDeliveryConfirmationCode("order-123")).toBe(deriveDeliveryConfirmationCode("order-123"));
    expect(deriveDeliveryConfirmationCode("order-123")).not.toBe(deriveDeliveryConfirmationCode("order-456"));
  });

  it("detects when a code is complete", () => {
    expect(isDeliveryConfirmationCodeComplete("1234")).toBe(true);
    expect(isDeliveryConfirmationCodeComplete("12")).toBe(false);
  });
});
