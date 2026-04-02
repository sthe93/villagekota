const STAR_VILLAGE_ADDRESS_PATTERN = /\bstar\s+village\b/i;

export function isStarVillageAddress(address: string): boolean {
  return STAR_VILLAGE_ADDRESS_PATTERN.test(address.trim());
}

export const STAR_VILLAGE_DELIVERY_MESSAGE =
  "We currently deliver only to addresses inside Star Village.";
