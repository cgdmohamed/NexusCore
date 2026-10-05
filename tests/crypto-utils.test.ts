import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, validateVaultKey } from "../server/crypto-utils";

const ORIGINAL_KEY = process.env.VAULT_ENCRYPTION_KEY;

afterEach(() => {
  process.env.VAULT_ENCRYPTION_KEY = ORIGINAL_KEY;
});

describe("crypto-utils", () => {
  it("round-trips a secret", () => {
    const encrypted = encryptSecret("p@ssw0rd-ع");
    expect(encrypted).not.toContain("p@ssw0rd");
    expect(decryptSecret(encrypted)).toBe("p@ssw0rd-ع");
  });

  it("uses a fresh IV for every encryption", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("rejects tampered ciphertext", () => {
    const buf = Buffer.from(encryptSecret("secret"), "base64");
    buf[buf.length - 1] ^= 0xff;
    expect(() => decryptSecret(buf.toString("base64"))).toThrow();
  });

  it("fails to decrypt with a different key", () => {
    const encrypted = encryptSecret("secret");
    process.env.VAULT_ENCRYPTION_KEY = "f".repeat(64);
    expect(() => decryptSecret(encrypted)).toThrow();
  });

  it("validates the key format", () => {
    delete process.env.VAULT_ENCRYPTION_KEY;
    expect(() => validateVaultKey()).toThrow(/not set/);
    process.env.VAULT_ENCRYPTION_KEY = "too-short";
    expect(() => validateVaultKey()).toThrow(/64 hexadecimal/);
    process.env.VAULT_ENCRYPTION_KEY = ORIGINAL_KEY;
    expect(() => validateVaultKey()).not.toThrow();
  });
});
