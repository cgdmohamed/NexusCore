import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startApp, TEST_DATABASE_URL } from "./helpers";

const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const redirect = "https://claude.ai/api/mcp/auth_callback";

describe.skipIf(!TEST_DATABASE_URL)("OAuth for MCP (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
    // The approving person is a real administrator in the database, as in production
    const { users, roles } = await import("../../shared/schema");
    const none = { view: true, add: true, edit: true, delete: true, approve: true };
    const [role] = await ctx.db.insert(roles).values({ name: "Admin", description: "Administrator", permissions: Object.fromEntries(["tasks", "projects", "users", "crm"].map((m) => [m, none])) } as any).returning();
    await ctx.db.update(users).set({ roleId: role.id });
  });
  afterAll(async () => { await ctx?.close(); });

  const register = async (redirect_uris = [redirect]) => {
    const res = await fetch(`${ctx.base}/oauth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "Claude", redirect_uris }) });
    return { status: res.status, body: await res.json() };
  };
  const authorizeQuery = (clientId: string, extra: Record<string, string> = {}) =>
    new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", state: "xyz", ...extra }).toString();
  const getCode = async (clientId: string, extra: Record<string, string> = {}) => {
    const res = await api("POST", "/api/oauth/authorize", { client_id: clientId, redirect_uri: redirect, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", state: "xyz", decision: "allow", ...extra });
    expect(res.status).toBe(200);
    const url = new URL(res.body.redirectUrl);
    expect(url.searchParams.get("state")).toBe("xyz");
    return url.searchParams.get("code")!;
  };
  const token = async (params: Record<string, string>) => {
    const res = await fetch(`${ctx.base}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params).toString() });
    return { status: res.status, body: await res.json(), cache: res.headers.get("cache-control") };
  };
  const rpc = async (bearer: string, method: string, params?: unknown) => {
    const res = await fetch(`${ctx.base}/mcp`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${bearer}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  it("serves discovery documents and points a 401 at them", async () => {
    const meta = await (await fetch(`${ctx.base}/.well-known/oauth-authorization-server`)).json();
    expect(meta.code_challenge_methods_supported).toEqual(["S256"]);
    expect(meta.token_endpoint).toMatch(/\/oauth\/token$/);
    const pr = await (await fetch(`${ctx.base}/.well-known/oauth-protected-resource`)).json();
    expect(pr.resource).toMatch(/\/mcp$/);
    const res = await fetch(`${ctx.base}/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain('resource_metadata="');
    expect(res.headers.get("www-authenticate")).toContain("/.well-known/oauth-protected-resource");
  });

  it("registers only clients with approved redirect hosts", async () => {
    expect((await register(["https://evil.example.com/cb"])).status).toBe(400);
    expect((await register([])).status).toBe(400);
    const ok = await register();
    expect(ok.status).toBe(201);
    expect(ok.body.client_id).toMatch(/^nxcl_/);
  });

  it("runs the full flow: authorize, exchange, call MCP as the approver, refresh, revoke", async () => {
    const { client_id } = (await register()).body;

    const info = await api("GET", `/api/oauth/authorize-info?${authorizeQuery(client_id)}`);
    expect(info.status).toBe(200);
    expect(info.body.clientName).toBe("Claude");
    expect(info.body.canApprove).toBe(true);

    const code = await getCode(client_id);
    const issued = await token({ grant_type: "authorization_code", code, redirect_uri: redirect, code_verifier: verifier, client_id });
    expect(issued.status).toBe(200);
    expect(issued.cache).toBe("no-store");
    expect(issued.body.access_token).toMatch(/^nxo_/);
    expect(issued.body.refresh_token).toMatch(/^nxr_/);

    // The code works once only
    expect((await token({ grant_type: "authorization_code", code, redirect_uri: redirect, code_verifier: verifier, client_id })).status).toBe(400);

    // Calls /mcp with the approver's identity
    const created = await rpc(issued.body.access_token, "tools/call", { name: "create_task", arguments: { title: "From claude.ai" } });
    expect(created.status).toBe(200);
    expect(created.body.result.content[0].text).toBeTruthy();
    expect(created.body.result.isError, created.body.result.content[0].text).toBeFalsy();
    const task = JSON.parse(created.body.result.content[0].text);
    expect(JSON.stringify(task)).toContain("From claude.ai");

    // The connection is listed for the administrator
    const listed = (await api("GET", "/api/settings/ai-access")).body;
    expect(listed.connections).toHaveLength(1);
    expect(listed.connections[0].clientName).toBe("Claude");

    // Refresh rotates the pair; replaying the old refresh token ends the connection
    const refreshed = await token({ grant_type: "refresh_token", refresh_token: issued.body.refresh_token, client_id });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.refresh_token).not.toBe(issued.body.refresh_token);
    expect((await rpc(refreshed.body.access_token, "ping")).status).toBe(200);
    const replay = await token({ grant_type: "refresh_token", refresh_token: issued.body.refresh_token, client_id });
    expect(replay.status).toBe(400);
    expect((await rpc(refreshed.body.access_token, "ping")).status).toBe(401);
    expect((await token({ grant_type: "refresh_token", refresh_token: refreshed.body.refresh_token, client_id })).status).toBe(400);
  });

  it("revoking a connected app stops its tokens at once", async () => {
    const { client_id } = (await register()).body;
    const code = await getCode(client_id);
    const issued = (await token({ grant_type: "authorization_code", code, redirect_uri: redirect, code_verifier: verifier, client_id })).body;
    expect((await rpc(issued.access_token, "ping")).status).toBe(200);
    const conn = (await api("GET", "/api/settings/ai-access")).body.connections[0];
    expect((await api("DELETE", `/api/settings/ai-access/connections/${conn.id}`)).status).toBe(200);
    expect((await rpc(issued.access_token, "ping")).status).toBe(401);
    expect((await token({ grant_type: "refresh_token", refresh_token: issued.refresh_token, client_id })).status).toBe(400);
  });

  it("revokes through the RFC 7009 endpoint", async () => {
    const { client_id } = (await register()).body;
    const issued = (await token({ grant_type: "authorization_code", code: await getCode(client_id), redirect_uri: redirect, code_verifier: verifier, client_id })).body;
    const res = await fetch(`${ctx.base}/oauth/revoke`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `token=${issued.access_token}` });
    expect(res.status).toBe(200);
    expect((await rpc(issued.access_token, "ping")).status).toBe(401);
  });

  it("rejects a wrong verifier, another redirect URI and an unknown client", async () => {
    const { client_id } = (await register()).body;
    const base = { grant_type: "authorization_code", redirect_uri: redirect, code_verifier: verifier, client_id };
    expect((await token({ ...base, code: await getCode(client_id), code_verifier: "x".repeat(50) })).status).toBe(400);
    expect((await token({ ...base, code: await getCode(client_id), redirect_uri: "https://claude.ai/other" })).status).toBe(400);
    expect((await token({ ...base, code: await getCode(client_id), client_id: "nxcl_nope" })).status).toBe(401);
    expect((await token({ ...base, code: "bogus" })).status).toBe(400);
    expect((await token({ grant_type: "password", client_id })).status).toBe(400);
  });

  it("refuses bad authorization requests instead of redirecting", async () => {
    const { client_id } = (await register()).body;
    expect((await api("GET", `/api/oauth/authorize-info?${authorizeQuery(client_id, { redirect_uri: "https://claude.ai/not-registered" })}`)).status).toBe(400);
    expect((await api("GET", `/api/oauth/authorize-info?${authorizeQuery(client_id, { code_challenge_method: "plain" })}`)).status).toBe(400);
    expect((await api("GET", `/api/oauth/authorize-info?${authorizeQuery("nxcl_nope")}`)).status).toBe(400);
    expect((await api("GET", `/api/oauth/authorize-info?${authorizeQuery(client_id, { resource: "https://other.example.com/mcp" })}`)).status).toBe(400);
  });

  it("returns access_denied when the administrator declines", async () => {
    const { client_id } = (await register()).body;
    const res = await api("POST", "/api/oauth/authorize", { client_id, redirect_uri: redirect, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", state: "s1", decision: "deny" });
    const url = new URL(res.body.redirectUrl);
    expect(url.searchParams.get("error")).toBe("access_denied");
    expect(url.searchParams.get("code")).toBeNull();
  });

  it("lets only administrators approve", async () => {
    const { client_id } = (await register()).body;
    ctx.actAs({ roleName: "Staff" });
    try {
      const res = await api("POST", "/api/oauth/authorize", { client_id, redirect_uri: redirect, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", decision: "allow" });
      expect(res.status).toBe(403);
      const info = await api("GET", `/api/oauth/authorize-info?${authorizeQuery(client_id)}`);
      expect(info.body.canApprove).toBe(false);
    } finally { ctx.actAs(null); }
  });

  it("keeps static nxc_ tokens working", async () => {
    const created = await api("POST", "/api/settings/ai-access/tokens", { name: "static" });
    expect((await rpc(created.body.token, "ping")).status).toBe(200);
  });
});
