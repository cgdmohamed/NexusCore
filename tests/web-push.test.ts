import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { encryptPayload, generateVapidKeys, sendPush, vapidAuthorization, vapidFromEnv } from "../server/web-push";

const b64 = (s: string) => Buffer.from(s, "base64url");

// The browser's side of RFC 8291, used to prove our output can be opened by a real subscriber
function decrypt(body: Buffer, uaPrivateJwk: crypto.JsonWebKey, uaPublic: Buffer, auth: Buffer) {
  const salt = body.subarray(0, 16);
  const idlen = body.readUInt8(20);
  const asPublic = body.subarray(21, 21 + idlen);
  const ciphertext = body.subarray(21 + idlen);
  const asKey = crypto.createPublicKey({ key: { kty: "EC", crv: "P-256", x: asPublic.subarray(1, 33).toString("base64url"), y: asPublic.subarray(33, 65).toString("base64url") }, format: "jwk" });
  const secret = crypto.diffieHellman({ privateKey: crypto.createPrivateKey({ key: uaPrivateJwk, format: "jwk" }), publicKey: asKey });
  const ikm = Buffer.from(crypto.hkdfSync("sha256", secret, auth, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]), 32));
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const decipher = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  const plain = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
  return plain.subarray(0, plain.lastIndexOf(0x02));
}

function subscriber() {
  const pair = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pub = pair.publicKey.export({ format: "jwk" });
  const priv = pair.privateKey.export({ format: "jwk" });
  const uaPublic = Buffer.concat([Buffer.from([0x04]), b64(pub.x!), b64(pub.y!)]);
  const auth = crypto.randomBytes(16);
  return { priv, uaPublic, auth, sub: { endpoint: "https://push.example.test/send/abc", p256dh: uaPublic.toString("base64url"), auth: auth.toString("base64url") } };
}

describe("encryptPayload", () => {
  it("produces a message the subscriber can decrypt", () => {
    const s = subscriber();
    const message = JSON.stringify({ title: "مهمة جديدة", body: "Quarterly report", url: "/m/tasks" });
    const body = encryptPayload(Buffer.from(message), s.sub);
    expect(decrypt(body, s.priv, s.uaPublic, s.auth).toString()).toBe(message);
    // header: 16 byte salt, record size 4096, key id length 65
    expect(body.readUInt32BE(16)).toBe(4096);
    expect(body.readUInt8(20)).toBe(65);
  });

  it("uses a fresh salt and key each time", () => {
    const s = subscriber();
    const a = encryptPayload(Buffer.from("x"), s.sub);
    const b = encryptPayload(Buffer.from("x"), s.sub);
    expect(a.equals(b)).toBe(false);
  });

  it("matches the RFC 8291 appendix A example", () => {
    const uaPublic = "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
    const asPublic = b64("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8");
    const body = encryptPayload(Buffer.from("When I grow up, I want to be a watermelon"), { p256dh: uaPublic, auth: "BTBZMqHH6r4Tts7J_aSIgg" }, {
      salt: b64("DGv6ra1nlYgDCS1FRnbzlw"),
      ephemeral: {
        publicKey: asPublic,
        privateKeyJwk: { kty: "EC", crv: "P-256", x: asPublic.subarray(1, 33).toString("base64url"), y: asPublic.subarray(33, 65).toString("base64url"), d: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw" },
      },
    });
    expect(body.toString("base64url")).toBe(
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
    );
  });

  it("rejects malformed subscription keys and oversized payloads", () => {
    const s = subscriber();
    expect(() => encryptPayload(Buffer.from("x"), { p256dh: "AAAA", auth: s.sub.auth })).toThrow(/public key/);
    expect(() => encryptPayload(Buffer.from("x"), { p256dh: s.sub.p256dh, auth: "AAAA" })).toThrow(/auth/);
    expect(() => encryptPayload(Buffer.alloc(5000), s.sub)).toThrow(/too large/);
  });
});

describe("VAPID", () => {
  it("signs a token the public key verifies, scoped to the push service origin", () => {
    const keys = generateVapidKeys();
    const header = vapidAuthorization("https://fcm.googleapis.com/fcm/send/xyz", { ...keys, subject: "mailto:a@b.co" }, new Date("2026-10-09T00:00:00Z"));
    const [, t, k] = header.match(/^vapid t=([^,]+), k=(.+)$/)!;
    expect(k).toBe(keys.publicKey);
    const [h, c, sig] = t.split(".");
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claims).toMatchObject({ aud: "https://fcm.googleapis.com", sub: "mailto:a@b.co" });
    expect(claims.exp).toBe(Math.floor(new Date("2026-10-09T00:00:00Z").getTime() / 1000) + 43200);
    const pub = b64(keys.publicKey);
    const verifyKey = crypto.createPublicKey({ key: { kty: "EC", crv: "P-256", x: pub.subarray(1, 33).toString("base64url"), y: pub.subarray(33, 65).toString("base64url") }, format: "jwk" });
    expect(crypto.verify("sha256", Buffer.from(`${h}.${c}`), { key: verifyKey, dsaEncoding: "ieee-p1363" }, b64(sig))).toBe(true);
  });

  it("is off until both keys are set, and turns a bare address into mailto", () => {
    expect(vapidFromEnv({})).toBeNull();
    expect(vapidFromEnv({ VAPID_PUBLIC_KEY: "a" })).toBeNull();
    expect(vapidFromEnv({ VAPID_PUBLIC_KEY: "a", VAPID_PRIVATE_KEY: "b", COMPANY_EMAIL: "hi@x.eg" })?.subject).toBe("mailto:hi@x.eg");
    expect(vapidFromEnv({ VAPID_PUBLIC_KEY: "a", VAPID_PRIVATE_KEY: "b", VAPID_SUBJECT: "https://x.eg" })?.subject).toBe("https://x.eg");
  });
});

describe("sendPush", () => {
  const keys = generateVapidKeys();
  const config = { ...keys, subject: "mailto:a@b.co" };
  const s = subscriber();
  const respond = (status: number) => (async () => new Response(null, { status })) as unknown as typeof fetch;

  it("reports sent, gone and failed", async () => {
    expect(await sendPush(s.sub, { title: "x" }, config, { fetchImpl: respond(201) })).toBe("sent");
    expect(await sendPush(s.sub, { title: "x" }, config, { fetchImpl: respond(410) })).toBe("gone");
    expect(await sendPush(s.sub, { title: "x" }, config, { fetchImpl: respond(404) })).toBe("gone");
    expect(await sendPush(s.sub, { title: "x" }, config, { fetchImpl: respond(500) })).toBe("failed");
    expect(await sendPush(s.sub, { title: "x" }, config, { fetchImpl: (async () => { throw new Error("offline"); }) as unknown as typeof fetch })).toBe("failed");
  });

  it("sends the encrypted body with the push headers", async () => {
    let seen: any;
    await sendPush(s.sub, { title: "x" }, config, { urgency: "high", fetchImpl: (async (url: string, init: any) => { seen = { url, init }; return new Response(null, { status: 201 }); }) as unknown as typeof fetch });
    expect(seen.url).toBe(s.sub.endpoint);
    expect(seen.init.headers["Content-Encoding"]).toBe("aes128gcm");
    expect(seen.init.headers.Urgency).toBe("high");
    expect(seen.init.headers.Authorization).toMatch(/^vapid t=.+, k=/);
    expect(JSON.parse(decrypt(seen.init.body, s.priv, s.uaPublic, s.auth).toString())).toEqual({ title: "x" });
  });
});
