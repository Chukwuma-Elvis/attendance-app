import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Validates that a PIN is strictly 6 digits.
 */
export function isValidPinFormat(pin: string): boolean {
  return typeof pin === "string" && /^\d{6}$/.test(pin.trim());
}

/**
 * Hashes a 6-digit PIN with a random salt using scrypt.
 * Format: "salt:derivedKey"
 */
export function hashPin(pin: string): string {
  const cleanPin = pin.trim();
  if (!isValidPinFormat(cleanPin)) {
    throw new Error("PIN must be exactly 6 digits.");
  }
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(cleanPin, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

/**
 * Securely verifies a submitted PIN against the stored salt:derivedKey hash.
 */
export function verifyPin(pin: string, storedHash: string | null | undefined): boolean {
  if (!pin || !storedHash) return false;
  const cleanPin = pin.trim();
  if (!isValidPinFormat(cleanPin)) return false;

  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;

  const [salt, expectedKeyHex] = parts;
  try {
    const derivedKey = scryptSync(cleanPin, salt, 64);
    const expectedKey = Buffer.from(expectedKeyHex, "hex");
    if (derivedKey.length !== expectedKey.length) return false;
    return timingSafeEqual(derivedKey, expectedKey);
  } catch {
    return false;
  }
}
