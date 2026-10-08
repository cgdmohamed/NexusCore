import crypto from "crypto";
import fs from "fs";
import path from "path";
import { resolveUploadPath, uploadsRoot } from "./uploads";

const MAX_BYTES = 5 * 1024 * 1024;

// Declared type -> extension and the bytes a genuine file starts with
const TYPES: Record<string, { ext: string; matches: (head: Buffer) => boolean }> = {
  "image/png": { ext: ".png", matches: (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/jpeg": { ext: ".jpg", matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/gif": { ext: ".gif", matches: (b) => b.length >= 6 && ["GIF87a", "GIF89a"].includes(b.subarray(0, 6).toString("latin1")) },
  "image/webp": { ext: ".webp", matches: (b) => b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
};

const DATA_URI = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/;
const OWN_PATH = /^\/uploads\/profiles\/[\w.-]+$/;

export class ProfileImageError extends Error {}

export const isDataUri = (value: unknown): value is string => typeof value === "string" && value.startsWith("data:");
export const isProfileImagePath = (value: unknown): value is string => typeof value === "string" && OWN_PATH.test(value);

/**
 * Turns a profile picture sent by the client into what gets stored in the database.
 *  - `undefined`            -> `undefined` (field not being changed)
 *  - `null` / `""`          -> `null` (picture removed)
 *  - base64 data URI        -> validated, written to uploads/profiles, returns its `/uploads/...` URL
 *  - already one of our URLs -> kept as is
 * Anything else (external URLs, `javascript:`, wrong or oversized files) throws ProfileImageError.
 * `current` is the value already stored: an unchanged value is always accepted.
 */
export function storeProfileImage(value: unknown, current?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new ProfileImageError("Invalid profile image.");
  if (value === current && !isDataUri(value)) return value;
  if (isProfileImagePath(value)) return value;

  const match = DATA_URI.exec(value);
  if (!match) throw new ProfileImageError("Profile image must be an uploaded image.");
  const type = TYPES[match[1].toLowerCase()];
  if (!type) throw new ProfileImageError("Profile image must be a PNG, JPEG, GIF or WebP file.");
  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new ProfileImageError("Profile image must be smaller than 5MB.");
  if (!type.matches(bytes)) throw new ProfileImageError("The file content does not match its image type.");

  const dir = path.join(uploadsRoot(), "profiles");
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${type.ext}`;
  fs.writeFileSync(path.join(dir, filename), bytes);
  return `/uploads/profiles/${filename}`;
}

/** Deletes a stored profile picture file (no-op for legacy base64 values and foreign paths). */
export function removeProfileImageFile(stored: string | null | undefined) {
  if (!isProfileImagePath(stored)) return;
  const full = resolveUploadPath(stored);
  if (full) fs.rmSync(full, { force: true });
}
