import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createCategory, createClient, createExpense, startApp, TEST_DATABASE_URL } from "./helpers";

describe.skipIf(!TEST_DATABASE_URL)("projects (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const api = (m: string, p: string, b?: unknown) => ctx.api(m, p, b);
  const mk = async (name: string, extra: object = {}) => (await api("POST", "/api/projects", { name, ...extra })).body;
  const task = (projectId: string, extra: object = {}) => api("POST", "/api/tasks", { title: "t", projectId, ...extra });
  const find = async (id: string) => (await api("GET", "/api/projects")).body.find((p: any) => p.id === id);

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
  });
  afterAll(async () => {
    await ctx?.close();
  });

  it("reports task counts, late tasks, health and spend in one list call", async () => {
    const p = await mk("Counted", { dueDate: "2099-01-01" });
    await task(p.id, { status: "completed" });
    await task(p.id, { status: "pending", dueDate: "2020-01-01" });
    await task(p.id, { status: "cancelled" });
    const cat = (await createCategory(api, "Proj")).id;
    await createExpense(api, cat, { amount: "120.50", relatedProjectId: p.id });
    await createExpense(api, cat, { amount: "999", relatedProjectId: p.id, status: "cancelled" });

    const row = await find(p.id);
    expect(row.taskCounts).toMatchObject({ completed: 1, pending: 1, cancelled: 1, total: 2 });
    expect(row.overdueTasks).toBe(1);
    expect(row.health).toBe("at_risk");
    expect(row.spent).toBe(120.5);
  });

  it("marks a project with all tasks done as ready to close, and one without tasks as no_tasks", async () => {
    const done = await mk("Done tasks");
    await task(done.id, { status: "completed" });
    expect((await find(done.id)).health).toBe("ready_to_close");
    const empty = await mk("Nothing yet");
    expect((await find(empty.id)).health).toBe("no_tasks");
  });

  it("sets completedAt when completed, clears it on reopening, and ignores a client-supplied value", async () => {
    const p = await mk("Lifecycle");
    expect(p.completedAt ?? null).toBeNull();
    const done = (await api("PUT", `/api/projects/${p.id}`, { status: "completed" })).body;
    expect(done.completedAt).toBeTruthy();
    const reopened = (await api("PUT", `/api/projects/${p.id}`, { status: "active" })).body;
    expect(reopened.completedAt).toBeNull();
    const forged = (await api("PUT", `/api/projects/${p.id}`, { name: "Lifecycle 2", completedAt: "2001-01-01" })).body;
    expect(forged.completedAt).toBeNull();
  });

  it("lists newest first", async () => {
    const a = await mk("Order A");
    await new Promise((r) => setTimeout(r, 15));
    const b = await mk("Order B");
    const ids = (await api("GET", "/api/projects")).body.map((x: any) => x.id);
    expect(ids.indexOf(b.id)).toBeLessThan(ids.indexOf(a.id));
  });

  it("refuses to delete a project that has tasks or expenses, and deletes an empty one", async () => {
    const withTask = await mk("Has task");
    await task(withTask.id);
    const r1 = await api("DELETE", `/api/projects/${withTask.id}`);
    expect(r1.status).toBe(409);
    expect(await find(withTask.id)).toBeTruthy();

    const withExpense = await mk("Has expense");
    await createExpense(api, (await createCategory(api, "ProjDel")).id, { relatedProjectId: withExpense.id });
    expect((await api("DELETE", `/api/projects/${withExpense.id}`)).status).toBe(409);

    const empty = await mk("Empty");
    expect((await api("DELETE", `/api/projects/${empty.id}`)).status).toBe(200);
    expect(await find(empty.id)).toBeUndefined();
  });

  it("archives and restores through the status", async () => {
    const client = await createClient(api, "ProjClient");
    const p = await mk("Archivable", { clientId: client.id });
    expect((await api("PUT", `/api/projects/${p.id}`, { status: "archived" })).body.status).toBe("archived");
    expect((await find(p.id)).health).toBe("archived");
    expect((await api("PUT", `/api/projects/${p.id}`, { status: "active" })).body.status).toBe("active");
    expect((await find(p.id)).clientName).toBe("ProjClient");
  });
});
