// Passwords that are far too common to accept even when they meet the length / character rules.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd", "qwerty123", "qwertyuiop",
  "12345678", "123456789", "1234567890", "11111111", "admin123", "admin1234", "administrator1", "letmein123",
  "welcome1", "welcome123", "iloveyou1", "changeme123",
]);

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Returns a message describing why the password is not acceptable, or `null` when it is.
 * `identity` values (username, email) must not appear inside the password.
 */
export function validatePassword(password: unknown, identity: Array<string | null | undefined> = []): string | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }
  if (password.length > 128) return "Password must be at most 128 characters long.";
  if (!/[A-Za-z]|[^\x00-\x7F]/.test(password) || !/\d/.test(password)) {
    return "Password must contain at least one letter and one digit.";
  }
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return "This password is too common. Choose a less predictable one.";
  for (const value of identity) {
    const part = (value ?? "").split("@")[0].toLowerCase();
    if (part.length >= 4 && lower.includes(part)) return "Password must not contain your username or email name.";
  }
  return null;
}
