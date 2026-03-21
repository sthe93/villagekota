const BIOMETRIC_CREDENTIAL_KEY = "village-eats-biometric-credential-id";
const BIOMETRIC_ENROLLED_AT_KEY = "village-eats-biometric-enrolled-at";

type StoredBiometricCredential = {
  credentialId: string;
  enrolledAt: string;
};

function randomBytes(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toBase64Url(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export async function isBiometricPlatformAvailable() {
  if (
    typeof window === "undefined" ||
    !window.isSecureContext ||
    typeof PublicKeyCredential === "undefined" ||
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function"
  ) {
    return false;
  }

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function getStoredBiometricCredential(): StoredBiometricCredential | null {
  if (typeof window === "undefined") return null;

  const credentialId = window.localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
  const enrolledAt = window.localStorage.getItem(BIOMETRIC_ENROLLED_AT_KEY);

  if (!credentialId || !enrolledAt) return null;

  return { credentialId, enrolledAt };
}

export async function enrollBiometricCredential() {
  const supported = await isBiometricPlatformAvailable();
  if (!supported) {
    throw new Error("Biometric sign-in is not available on this device.");
  }

  const credential = await navigator.credentials.create({
    publicKey: {
      rp: {
        id: window.location.hostname,
        name: "Village Eats",
      },
      user: {
        id: new TextEncoder().encode("village-eats-device-user"),
        name: "Village Eats User",
        displayName: "Village Eats User",
      },
      challenge: randomBytes(),
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred",
        userVerification: "required",
      },
      timeout: 60_000,
      attestation: "none",
    },
  });

  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("Unable to create a biometric credential on this device.");
  }

  const credentialId = toBase64Url(credential.rawId);
  const enrolledAt = new Date().toISOString();

  window.localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, credentialId);
  window.localStorage.setItem(BIOMETRIC_ENROLLED_AT_KEY, enrolledAt);

  return { credentialId, enrolledAt };
}

export async function verifyBiometricCredential() {
  const stored = getStoredBiometricCredential();

  if (!stored) {
    throw new Error("Set up biometric sign-in on this device first.");
  }

  const supported = await isBiometricPlatformAvailable();
  if (!supported) {
    throw new Error("Biometric sign-in is not available on this device.");
  }

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(),
      timeout: 60_000,
      userVerification: "required",
      allowCredentials: [
        {
          id: fromBase64Url(stored.credentialId),
          type: "public-key",
          transports: ["internal"],
        },
      ],
    },
  });

  if (!(assertion instanceof PublicKeyCredential)) {
    throw new Error("Biometric verification could not be completed.");
  }

  return stored;
}
