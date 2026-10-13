// Pure OAuth helpers (PKCE, redirect URI policy, metadata documents), kept free of the database so they can be tested directly.
import crypto from "crypto";

export const ACCESS_PREFIX = "nxo_";
export const REFRESH_PREFIX = "nxr_";
export const ACCESS_TTL_MS = 60 * 60 * 1000;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const CODE_TTL_MS = 10 * 60 * 1000;

const DEFAULT_HOSTS = ["claude.ai", "claude.com", "chatgpt.com", "chat.openai.com", "platform.openai.com"];

export function allowedRedirectHosts(extra: string | undefined = process.env.OAUTH_ALLOWED_REDIRECT_HOSTS): string[] {
  const more = (extra ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set([...DEFAULT_HOSTS, ...more]));
}

// HTTPS on an approved host (or one of its subdomains), or plain http on the loopback for command-line clients
export function isAllowedRedirectUri(uri: unknown, hosts: string[] = allowedRedirectHosts()): boolean {
  if (typeof uri !== "string" || uri.length > 2000) return false;
  let u: URL;
  try { u = new URL(uri); } catch { return false; }
  if (u.hash) return false;
  if (u.protocol === "http:") return u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  return hosts.some((h) => host === h || host.endsWith(`.${h}`));
}

export const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

export function newSecret(prefix: string) {
  const value = prefix + crypto.randomBytes(32).toString("base64url");
  return { value, hash: sha256(value) };
}

export const challengeFor = (verifier: string) => crypto.createHash("sha256").update(verifier).digest("base64url");

// RFC 7636: the verifier is 43-128 unreserved characters and its S256 hash must equal the stored challenge
export function verifyPkce(verifier: unknown, challenge: string): boolean {
  if (typeof verifier !== "string" || !/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const a = Buffer.from(challengeFor(verifier));
  const b = Buffer.from(challenge);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const validChallenge = (c: unknown): c is string => typeof c === "string" && /^[A-Za-z0-9\-._~]{43,128}$/.test(c);

export function resourceMatches(resource: unknown, base: string): boolean {
  if (resource === undefined || resource === null || resource === "") return true;
  if (typeof resource !== "string") return false;
  const norm = (s: string) => s.replace(/\/+$/, "");
  return norm(resource) === `${norm(base)}/mcp` || norm(resource) === norm(base);
}

export function protectedResourceMetadata(base: string) {
  return {
    resource: `${base}/mcp`,
    authorization_servers: [base],
    bearer_methods_supported: ["header"],
    resource_name: "NexusCore",
  };
}

export function authorizationServerMetadata(base: string) {
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    revocation_endpoint: `${base}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scope_supported: ["mcp"],
  };
}

// Absolute public address of this server: APP_URL when configured, otherwise what the proxy forwarded
export function baseUrlFor(req: { headers: Record<string, any>; protocol?: string; get?: (h: string) => string | undefined }, env = process.env.APP_URL): string {
  if (env) return env.replace(/\/+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost").split(",")[0].trim();
  return `${proto}://${host}`;
}
