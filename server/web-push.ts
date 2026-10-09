// Web Push (RFC 8030) with VAPID (RFC 8292) and message encryption (RFC 8291, aes128gcm),
// built on node:crypto so no extra package has to be installed on the server.
import crypto from "node:crypto";

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string; // browser public key, base64url (65 bytes, uncompressed)
  auth: string;   // browser auth secret, base64url (16 bytes)
}

export interface VapidConfig {
  publicKey: string;  // base64url, 65 bytes uncompressed point
  privateKey: string; // base64url, 32 bytes
  subject: string;    // mailto: or https: contact
}

const b64url = (b: Buffer) => b.toString("base64url");
const fromB64url = (s: string) => Buffer.from(s, "base64url");

export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pub = publicKey.export({ format: "jwk" });
  const priv = privateKey.export({ format: "jwk" });
  const raw = Buffer.concat([Buffer.from([0x04]), fromB64url(pub.x!), fromB64url(pub.y!)]);
  return { publicKey: b64url(raw), privateKey: priv.d! };
}

function privateKeyObject(config: VapidConfig) {
  const pub = fromB64url(config.publicKey);
  return crypto.createPrivateKey({
    key: { kty: "EC", crv: "P-256", x: b64url(pub.subarray(1, 33)), y: b64url(pub.subarray(33, 65)), d: config.privateKey },
    format: "jwk",
  });
}

// Reads the server's VAPID keys; push stays switched off until they are set
export function vapidFromEnv(env: NodeJS.ProcessEnv = process.env): VapidConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  const contact = env.VAPID_SUBJECT?.trim() || env.COMPANY_EMAIL?.trim();
  return { publicKey, privateKey, subject: contact ? (/^(mailto:|https:)/.test(contact) ? contact : `mailto:${contact}`) : "mailto:admin@localhost" };
}

export function vapidAuthorization(endpoint: string, config: VapidConfig, now: Date = new Date()): string {
  const audience = new URL(endpoint).origin;
  const header = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(Buffer.from(JSON.stringify({ aud: audience, exp: Math.floor(now.getTime() / 1000) + 12 * 60 * 60, sub: config.subject })));
  const signature = crypto.sign("sha256", Buffer.from(`${header}.${claims}`), { key: privateKeyObject(config), dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${config.publicKey}`;
}

export interface EncryptOptions {
  salt?: Buffer;                                   // fixed only in tests
  ephemeral?: { publicKey: Buffer; privateKeyJwk: crypto.JsonWebKey }; // fixed only in tests
  recordSize?: number;
}

// RFC 8291 section 3: one record, so the whole payload (at most 4078 bytes) is encrypted at once
export function encryptPayload(payload: Buffer, sub: Pick<PushSubscriptionKeys, "p256dh" | "auth">, options: EncryptOptions = {}): Buffer {
  const uaPublic = fromB64url(sub.p256dh);
  const authSecret = fromB64url(sub.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) throw new Error("Invalid subscription public key");
  if (authSecret.length !== 16) throw new Error("Invalid subscription auth secret");
  if (payload.length > 4078) throw new Error("Push payload too large");

  let asPublic: Buffer;
  let asPrivate: crypto.KeyObject;
  if (options.ephemeral) {
    asPublic = options.ephemeral.publicKey;
    asPrivate = crypto.createPrivateKey({ key: options.ephemeral.privateKeyJwk, format: "jwk" });
  } else {
    const pair = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const jwk = pair.publicKey.export({ format: "jwk" });
    asPublic = Buffer.concat([Buffer.from([0x04]), fromB64url(jwk.x!), fromB64url(jwk.y!)]);
    asPrivate = pair.privateKey;
  }

  const uaKey = crypto.createPublicKey({
    key: { kty: "EC", crv: "P-256", x: b64url(uaPublic.subarray(1, 33)), y: b64url(uaPublic.subarray(33, 65)) },
    format: "jwk",
  });
  const ecdhSecret = crypto.diffieHellman({ privateKey: asPrivate, publicKey: uaKey });

  const salt = options.salt ?? crypto.randomBytes(16);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", ecdhSecret, authSecret, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));

  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([0x02])])), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(16 + 4 + 1);
  salt.copy(header, 0);
  header.writeUInt32BE(options.recordSize ?? 4096, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, encrypted]);
}

export type PushResult = "sent" | "gone" | "failed";

export interface PushOptions {
  ttlSeconds?: number;
  urgency?: "very-low" | "low" | "normal" | "high";
  fetchImpl?: typeof fetch;
}

export async function sendPush(sub: PushSubscriptionKeys, payload: object, config: VapidConfig, options: PushOptions = {}): Promise<PushResult> {
  const body = encryptPayload(Buffer.from(JSON.stringify(payload)), sub);
  const doFetch = options.fetchImpl ?? fetch;
  try {
    const res = await doFetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuthorization(sub.endpoint, config),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        "Content-Length": String(body.length),
        TTL: String(options.ttlSeconds ?? 60 * 60 * 24),
        Urgency: options.urgency ?? "normal",
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404 || res.status === 410) return "gone"; // the browser dropped the subscription
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
