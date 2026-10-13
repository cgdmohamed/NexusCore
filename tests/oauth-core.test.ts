import { describe, expect, it } from "vitest";
import {
  allowedRedirectHosts, authorizationServerMetadata, baseUrlFor, challengeFor, isAllowedRedirectUri,
  protectedResourceMetadata, resourceMatches, verifyPkce,
} from "../server/oauth/core";

const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

describe("PKCE", () => {
  it("matches the RFC 7636 example", () => {
    expect(challengeFor(verifier)).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    expect(verifyPkce(verifier, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")).toBe(true);
  });
  it("rejects a wrong, short or missing verifier", () => {
    const challenge = challengeFor(verifier);
    expect(verifyPkce(verifier + "x", challenge)).toBe(false);
    expect(verifyPkce("short", challenge)).toBe(false);
    expect(verifyPkce(undefined, challenge)).toBe(false);
  });
});

describe("redirect URI policy", () => {
  it("allows the claude.ai callback and OpenAI hosts", () => {
    expect(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(isAllowedRedirectUri("https://chatgpt.com/connector_platform_oauth_redirect")).toBe(true);
    expect(isAllowedRedirectUri("https://app.claude.ai/cb")).toBe(true);
  });
  it("allows loopback http for command-line clients only", () => {
    expect(isAllowedRedirectUri("http://localhost:33418/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1:8080/cb")).toBe(true);
    expect(isAllowedRedirectUri("http://claude.ai/cb")).toBe(false);
  });
  it("rejects look-alike hosts, other schemes and fragments", () => {
    expect(isAllowedRedirectUri("https://evil.com/cb")).toBe(false);
    expect(isAllowedRedirectUri("https://claude.ai.evil.com/cb")).toBe(false);
    expect(isAllowedRedirectUri("https://notclaude.ai/cb")).toBe(false);
    expect(isAllowedRedirectUri("javascript:alert(1)")).toBe(false);
    expect(isAllowedRedirectUri("https://claude.ai/cb#x")).toBe(false);
    expect(isAllowedRedirectUri(42)).toBe(false);
  });
  it("can be extended from the environment", () => {
    expect(allowedRedirectHosts("example.org, other.io")).toContain("example.org");
    expect(isAllowedRedirectUri("https://example.org/cb", allowedRedirectHosts("example.org"))).toBe(true);
  });
});

describe("metadata", () => {
  it("advertises S256 and public clients", () => {
    const m = authorizationServerMetadata("https://nexus.example.com");
    expect(m.issuer).toBe("https://nexus.example.com");
    expect(m.code_challenge_methods_supported).toEqual(["S256"]);
    expect(m.token_endpoint_auth_methods_supported).toEqual(["none"]);
    expect(m.registration_endpoint).toBe("https://nexus.example.com/oauth/register");
    expect(protectedResourceMetadata("https://nexus.example.com").resource).toBe("https://nexus.example.com/mcp");
  });
  it("derives the public address from APP_URL or forwarded headers", () => {
    expect(baseUrlFor({ headers: {} }, "https://app.example.com/")).toBe("https://app.example.com");
    expect(baseUrlFor({ headers: { "x-forwarded-proto": "https", host: "h.example.com" } }, "")).toBe("https://h.example.com");
  });
  it("checks the resource indicator", () => {
    const base = "https://nexus.example.com";
    expect(resourceMatches(undefined, base)).toBe(true);
    expect(resourceMatches(`${base}/mcp`, base)).toBe(true);
    expect(resourceMatches("https://other.example.com/mcp", base)).toBe(false);
  });
});
