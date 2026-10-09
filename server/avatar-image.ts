// Profile pictures are stored as a web address or as base64 text. This turns either into something
// the avatar endpoint can serve, and refuses anything that is not a plain raster image
// (an SVG opened directly could run scripts, so it is never served).

export type AvatarSource =
  | { kind: "redirect"; url: string }
  | { kind: "bytes"; mime: string; data: Buffer };

function sniffMime(b: Buffer): string | null {
  if (b.length >= 8 && b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 6 && b.subarray(0, 4).toString("latin1") === "GIF8") return "image/gif";
  if (b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

const MAX_BYTES = 2 * 1024 * 1024;

export function parseAvatar(value: string | null | undefined): AvatarSource | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (/^https:\/\//i.test(v)) {
    try {
      return { kind: "redirect", url: new URL(v).href };
    } catch {
      return null;
    }
  }
  const payload = v.startsWith("data:") ? v.slice(v.indexOf(",") + 1) : v;
  if (v.startsWith("data:") && !/^data:image\/[a-z+.-]+;base64,/i.test(v)) return null;
  if (!/^[A-Za-z0-9+/=_-]+$/.test(payload)) return null;
  const data = Buffer.from(payload, "base64");
  if (data.length === 0 || data.length > MAX_BYTES) return null;
  const mime = sniffMime(data);
  return mime ? { kind: "bytes", mime, data } : null;
}

export const avatarUrlFor = (userId: string) => `/api/avatars/${userId}`;
