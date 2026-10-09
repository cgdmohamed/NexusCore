import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startApp, TEST_DATABASE_URL } from "./helpers";

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 7)]);

describe.skipIf(!TEST_DATABASE_URL)("avatars in messaging (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
  });
  afterAll(async () => {
    await ctx?.close();
  });

  async function person(username: string, own?: string | null, employeeImage?: string | null) {
    const { users, employees } = await import("../../shared/schema");
    let employeeId: string | null = null;
    if (employeeImage !== undefined) {
      const [e] = await ctx.db.insert(employees).values({ firstName: username, lastName: "Person", department: "operations" as any, profileImage: employeeImage }).returning();
      employeeId = e.id;
    }
    const [u] = await ctx.db.insert(users).values({ username, email: `${username}@example.com`, passwordHash: "x", profileImageUrl: own ?? null, employeeId }).returning();
    return u;
  }

  it("lists a link to the picture, not the picture, for people who have one", async () => {
    const withOwn = await person("avown", `data:image/png;base64,${png.toString("base64")}`);
    const withEmployee = await person("avemp", null, png.toString("base64"));
    const without = await person("avnone");
    const list = (await api("GET", "/api/messaging/users")).body;
    const byName = (n: string) => list.find((u: any) => u.username === n);
    expect(byName("avown").avatarUrl).toBe(`/api/avatars/${withOwn.id}`);
    expect(byName("avemp").avatarUrl).toBe(`/api/avatars/${withEmployee.id}`);
    expect(byName("avnone").avatarUrl).toBeNull();
    expect(JSON.stringify(list)).not.toContain("base64");
    expect(without.id).toBeTruthy();
  });

  it("serves the image with a cache header, preferring the account picture over the employee one", async () => {
    const u = await person("avserve", `data:image/png;base64,${png.toString("base64")}`, "AAAA");
    const r = await ctx.raw(`/api/avatars/${u.id}`);
    expect(r.status).toBe(200);
    expect(r.type).toBe("image/png");
    expect(r.headers.get("cache-control")).toMatch(/max-age/);
    expect(r.body.equals(png)).toBe(true);
  });

  it("redirects an https picture and returns 404 when there is nothing to show", async () => {
    const remote = await person("avremote", "https://images.example.test/me.jpg");
    const res = await fetch(`${ctx.base}/api/avatars/${remote.id}`, { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://images.example.test/me.jpg");
    const none = await person("avnothing");
    expect((await ctx.raw(`/api/avatars/${none.id}`)).status).toBe(404);
    expect((await ctx.raw("/api/avatars/00000000-0000-0000-0000-000000000000")).status).toBe(404);
  });

  it("includes the other person's picture in the conversation list", async () => {
    const other = await person("avchat", `data:image/png;base64,${png.toString("base64")}`);
    const created = await api("POST", "/api/conversations", { participantId: other.id });
    expect([200, 201]).toContain(created.status);
    const list = (await api("GET", "/api/conversations")).body;
    const conv = list.find((c: any) => c.id === created.body.id);
    expect(conv.otherUser.avatarUrl).toBe(`/api/avatars/${other.id}`);
    expect(JSON.stringify(list)).not.toContain("base64");
  });
});
