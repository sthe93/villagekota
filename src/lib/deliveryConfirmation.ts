export const DELIVERY_CONFIRMATION_CODE_LENGTH = 4;

export function generateDeliveryConfirmationCode() {
  return Array.from({ length: DELIVERY_CONFIRMATION_CODE_LENGTH }, () => Math.floor(Math.random() * 10)).join("");
}

export function normalizeDeliveryConfirmationCode(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "").slice(0, DELIVERY_CONFIRMATION_CODE_LENGTH);
}

export function formatDeliveryConfirmationCode(value: string | null | undefined) {
  const normalized = normalizeDeliveryConfirmationCode(value);
  return normalized ? normalized.split("").join(" ") : "";
}

export function isDeliveryConfirmationCodeComplete(value: string | null | undefined) {
  return normalizeDeliveryConfirmationCode(value).length === DELIVERY_CONFIRMATION_CODE_LENGTH;
}
