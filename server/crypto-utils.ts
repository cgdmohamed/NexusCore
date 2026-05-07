import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const HEX_REGEX = /^[0-9a-fA-F]{64}$/;

function getEncryptionKey(): Buffer {
  const keyHex = process.env.VAULT_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("VAULT_ENCRYPTION_KEY environment variable is not set. Cannot start credential vault.");
  }
  if (!HEX_REGEX.test(keyHex)) {
    throw new Error("VAULT_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (0-9, a-f). Generate with: openssl rand -hex 32");
  }
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error("VAULT_ENCRYPTION_KEY decoded to unexpected length. Expected 32 bytes.");
  }
  return key;
}

export function validateVaultKey(): void {
  getEncryptionKey();
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(ciphertext: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(ciphertext, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
