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
    errors.name = "Full name is required.";
  }

  if (!phoneDigits) {
    errors.phone = "Cell phone number is required.";
  } else if (!SOUTH_AFRICAN_PHONE_REGEX.test(phoneDigits)) {
    errors.phone = "Enter a valid South African cell phone number (10 digits).";
  }

  const deliveryAddressError = getStarVillageDeliveryError(trimmedAddress, destination);
  if (deliveryAddressError) {
    errors.address = deliveryAddressError;
  }

  if (fields.payment === "card" && !trimmedEmail) {
    errors.email = "Email is required for card payments.";
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
  if (fieldErrors.phone) messages.push(fieldErrors.phone.replace("(10 digits)", "with 10 digits"));
  if (fieldErrors.address) messages.push(fieldErrors.address);
  if (fieldErrors.email) messages.push(fieldErrors.email);

  return messages;
}
