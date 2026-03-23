import { normalizeSouthAfricaAddressQuery } from "@/lib/maps";

export interface SavedAddressRecord {
  id: string;
  label: string;
  address_text: string;
  destination_lat: number | null;
  destination_lng: number | null;
  is_default: boolean;
}

export function normalizeSavedAddressLabel(label: string) {
  return label.replace(/\s+/g, " ").trim();
}

export function normalizeSavedAddressText(address: string) {
  return normalizeSouthAfricaAddressQuery(address);
}

export function sortSavedAddresses<T extends SavedAddressRecord>(addresses: T[]) {
  return [...addresses].sort((a, b) => {
    if (a.is_default !== b.is_default) {
      return Number(b.is_default) - Number(a.is_default);
    }

    const labelCompare = a.label.localeCompare(b.label);
    if (labelCompare !== 0) return labelCompare;

    return a.address_text.localeCompare(b.address_text);
  });
}

export function findDuplicateSavedAddress<T extends SavedAddressRecord>(
  addresses: T[],
  addressText: string,
  excludeId?: string
) {
  const normalizedAddress = normalizeSavedAddressText(addressText);

  return (
    addresses.find(
      (address) =>
        address.id !== excludeId &&
        normalizeSavedAddressText(address.address_text) === normalizedAddress
    ) || null
  );
}

export function getNextDefaultSavedAddress<T extends SavedAddressRecord>(
  addresses: T[],
  removedId: string
) {
  const remainingAddresses = addresses.filter((address) => address.id !== removedId);
  return sortSavedAddresses(remainingAddresses)[0] || null;
}
