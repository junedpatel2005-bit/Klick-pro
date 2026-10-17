import crypto from "crypto";

/**
 * Derives a consistent 32-byte key for AES-256-GCM encryption.
 * Reads BANK_ENCRYPTION_KEY if provided, or derives from JWT_SECRET / APP_SECRET.
 */
function getEncryptionKey(): Buffer {
  const secret =
    process.env.BANK_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "klick-pro-bank-secure-encryption-key-fallback-32b";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a bank account number using AES-256-GCM.
 * Output format: `enc:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`
 */
export function encryptAccountNumber(plaintext: string): {
  encrypted: string;
  last4: string;
  masked: string;
} {
  const clean = String(plaintext).replace(/\s+/g, "").trim();

  // If already encrypted, avoid double encryption and compute real last4 from decrypted value
  if (clean.startsWith("enc:v1:")) {
    const decrypted = decryptAccountNumber(clean);
    const last4 = decrypted ? decrypted.slice(-4) : "";
    return {
      encrypted: clean,
      last4,
      masked: maskAccountNumber(last4),
    };
  }

  const last4 = clean.slice(-4) || clean;
  const masked = maskAccountNumber(clean);

  // 12-byte IV standard for AES-GCM
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);

  let encrypted = cipher.update(clean, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  const serialized = `enc:v1:${iv.toString("hex")}:${authTag}:${encrypted}`;

  return {
    encrypted: serialized,
    last4,
    masked,
  };
}

/**
 * Decrypts a bank account number encrypted with AES-256-GCM.
 * If the input is not encrypted (e.g. legacy plain text), returns it as-is for backward compatibility.
 */
export function decryptAccountNumber(data: string | null | undefined): string {
  if (!data) return "";
  const trimmed = data.trim();

  // If not encrypted with our format, return as-is
  if (!trimmed.startsWith("enc:v1:")) {
    return trimmed;
  }

  try {
    const parts = trimmed.split(":");
    if (parts.length !== 5) return "";
    const [, , ivHex, authTagHex, cipherHex] = parts;

    if (!ivHex || !authTagHex || !cipherHex) return "";

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("Failed to decrypt bank account number:", error);
    return "";
  }
}

import { maskAccountNumber, formatAccountNumberInput } from "./account-formatting";
export { maskAccountNumber, formatAccountNumberInput };
