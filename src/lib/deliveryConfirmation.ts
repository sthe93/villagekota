export const DELIVERY_CONFIRMATION_CODE_LENGTH = 4;

export function generateDeliveryConfirmationCode() {
  return Array.from({ length: DELIVERY_CONFIRMATION_CODE_LENGTH }, () => Math.floor(Math.random() * 10)).join("");
}

export function deriveDeliveryConfirmationCode(seed: string | null | undefined) {
  const normalizedSeed = (seed || "").trim();

  if (!normalizedSeed) {
    return "0000";
  }

  let hash = 0;

  for (let index = 0; index < normalizedSeed.length; index += 1) {
    hash = (hash * 31 + normalizedSeed.charCodeAt(index)) % 10000;
  }

  return String(hash).padStart(DELIVERY_CONFIRMATION_CODE_LENGTH, "0");
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
