import { getStarVillageDeliveryError, type DestinationCoords } from "@/lib/deliveryZone";

export type CheckoutPaymentMethod = "cash" | "card" | "eft" | "voucher";

export interface CheckoutValidationFields {
  name: string;
  phone: string;
  email: string;
  address: string;
  payment: CheckoutPaymentMethod;
}

const SOUTH_AFRICAN_PHONE_REGEX = /^0\d{9}$/;
const PHONE_REQUIRED_MESSAGE = "Cell phone number is required.";
const PHONE_INVALID_FIELD_MESSAGE = "Enter a valid South African cell phone number (10 digits).";
const PHONE_INVALID_SUMMARY_MESSAGE = "Enter a valid South African cell phone number with 10 digits.";
const NAME_REQUIRED_MESSAGE = "Full name is required.";
const CARD_EMAIL_REQUIRED_MESSAGE = "Email is required for card payments.";

export function getPhoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function buildCheckoutFieldErrors(
  fields: CheckoutValidationFields,
  destination: DestinationCoords
): Partial<Record<keyof CheckoutValidationFields, string>> {
  const errors: Partial<Record<keyof CheckoutValidationFields, string>> = {};
  const trimmedName = fields.name.trim();
  const trimmedAddress = fields.address.trim();
  const trimmedEmail = fields.email.trim();
  const phoneDigits = getPhoneDigits(fields.phone);

  if (!trimmedName) {
    errors.name = NAME_REQUIRED_MESSAGE;
  }

  if (!phoneDigits) {
    errors.phone = PHONE_REQUIRED_MESSAGE;
  } else if (!SOUTH_AFRICAN_PHONE_REGEX.test(phoneDigits)) {
    errors.phone = PHONE_INVALID_FIELD_MESSAGE;
  }

  const deliveryAddressError = getStarVillageDeliveryError(trimmedAddress, destination);
  if (deliveryAddressError) {
    errors.address = deliveryAddressError;
  }

  if (fields.payment === "card" && !trimmedEmail) {
    errors.email = CARD_EMAIL_REQUIRED_MESSAGE;
  }

  return errors;
}

export function buildCheckoutValidationMessages(params: {
  isSignedIn: boolean;
  fields: CheckoutValidationFields;
  destination: DestinationCoords;
}): string[] {
  const messages: string[] = [];

  if (!params.isSignedIn) {
    messages.push("Please sign in before placing your order.");
  }

  const fieldErrors = buildCheckoutFieldErrors(params.fields, params.destination);
  if (fieldErrors.name) messages.push(fieldErrors.name);
  if (fieldErrors.phone) {
    messages.push(
      fieldErrors.phone === PHONE_INVALID_FIELD_MESSAGE ? PHONE_INVALID_SUMMARY_MESSAGE : fieldErrors.phone
    );
  }
  if (fieldErrors.address) messages.push(fieldErrors.address);
  if (fieldErrors.email) messages.push(fieldErrors.email);

  return messages;
}
