import fs from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { addItem, createClient, createInvoice, createQuotation, startApp, TEST_DATABASE_URL } from "./helpers";

// Requires PostgreSQL: TEST_DATABASE_URL=postgresql://... npm run test:integration
// WARNING: the public schema of that database is dropped and recreated.
describe.skipIf(!TEST_DATABASE_URL)("improvements D1-D8 (integration)", () => {
  let ctx: Awaited<ReturnType<typeof startApp>>;
  const api = (m: string, p: string, b?: unknown, h?: Record<string, string>) => ctx.api(m, p, b, h);
  const MISSING = "00000000-0000-0000-0000-000000000000";
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4];
  const dataUri = (type: string, bytes: number[] | Buffer) => `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  let seq = 0;
  const next = () => ++seq;

  beforeAll(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    ctx = await startApp();
  });
  afterAll(async () => {
    await ctx?.close();
  });

  const createUser = async () => {
    const n = next();
    const r = await api("POST", "/api/users", { username: `imp${n}`, email: `imp${n}@example.com`, password: "S3cure-pass-xyz" });
    return r.body;
  };

  describe("D1 - task list is filtered and paginated by the database", () => {
    let alice: any;
    let bob: any;
    beforeAll(async () => {
      alice = await createUser();
      bob = await createUser();
      // 30 tasks, created sequentially so createdAt strictly increases
      for (let i = 1; i <= 30; i++) {
        const r = await api("POST", "/api/tasks", {
          title: `Task ${String(i).padStart(2, "0")}${i === 7 ? " 100% done_ish" : ""}`,
          description: i % 10 === 0 ? "Quarterly review" : undefined,
          priority: i % 3 === 0 ? "high" : "medium",
          status: i % 5 === 0 ? "completed" : "pending",
          assignedTo: i <= 10 ? alice.id : i <= 20 ? bob.id : undefined,
        });
        expect(r.status).toBe(201);
      }
    });
    const list = async (qs = "") => (await api("GET", `/api/tasks${qs}`)).body as any[];
    const titles = (rows: any[]) => rows.map((t) => t.title);

    it("keeps the response shape: an array of tasks with assigneeName", async () => {
      const rows = await list("?limit=3");
      expect(rows).toHaveLength(3);
      expect(rows[0]).toMatchObject({ title: "Task 30" });
      const mine = (await list(`?assignedTo=${alice.id}&limit=1`))[0];
      expect(mine.assigneeName).toBeTruthy();
      expect((await list("?limit=1"))[0].assigneeName).toBeNull();
    });

    it("defaults to 50 rows, newest first, and pages with limit/offset", async () => {
      const all = await list();
      expect(all).toHaveLength(30);
      expect(titles(all.slice(0, 2))).toEqual(["Task 30", "Task 29"]);
      expect(titles(await list("?limit=5&offset=5"))).toEqual(["Task 25", "Task 24", "Task 23", "Task 22", "Task 21"]);
      expect(titles(await list("?sortOrder=asc&limit=2"))).toEqual(["Task 01", "Task 02"]);
    });

    it("sanitises limit and offset", async () => {
      expect(await list("?limit=abc")).toHaveLength(30);
      expect(await list("?limit=-3")).toHaveLength(30);
      expect(await list("?limit=100000")).toHaveLength(30);
      expect(titles(await list("?offset=-4&limit=1"))).toEqual(["Task 30"]);
      expect(await list("?limit=0")).toHaveLength(30);
    });

    it("filters by status and priority", async () => {
      expect((await list("?status=completed")).length).toBe(6);
      expect((await list("?priority=high")).length).toBe(10);
      expect((await list("?status=completed&priority=high")).length).toBe(2); // 15 and 30
    });

    it("filters by assignee and creator, which used to be ignored", async () => {
      expect((await list(`?assignedTo=${alice.id}`)).length).toBe(10);
      expect((await list(`?assignedTo=${bob.id}`)).length).toBe(10);
      expect((await list(`?createdBy=${ctx.currentUserId}`)).length).toBe(30);
      expect((await list(`?createdBy=${alice.id}`)).length).toBe(0);
      expect((await list(`?assignedTo=${MISSING}`)).length).toBe(0);
    });

    it("myTasks returns the signed-in user's tasks", async () => {
      ctx.actAs({ id: bob.id });
      const rows = await list("?myTasks=true");
      ctx.actAs(null);
      expect(rows).toHaveLength(10);
      expect(rows.every((t) => t.assignedTo === bob.id)).toBe(true);
    });

    it("searches title and description case-insensitively and treats % and _ literally", async () => {
      expect((await list("?search=quarterly")).length).toBe(3);
      expect(titles(await list(`?search=${encodeURIComponent("100%")}`))).toEqual(["Task 07 100% done_ish"]);
      expect(titles(await list(`?search=${encodeURIComponent("_")}`))).toEqual(["Task 07 100% done_ish"]);
      expect((await list("?search=task 1")).length).toBe(10); // Task 10..19
    });

    it("combines filters and pagination", async () => {
      const rows = await list(`?assignedTo=${alice.id}&status=pending&limit=3&offset=1`);
      expect(titles(rows)).toEqual(["Task 08", "Task 07 100% done_ish", "Task 06"]);
    });
  });

  describe("D8 - notification endpoints are reachable", () => {
    const notify = async (userId: string, title: string) => {
      const { notificationService } = await import("../../server/notification-service");
      return notificationService.createNotification({ userId, type: "task_assigned", title, message: title, priority: "medium", createdBy: userId } as any);
    };

    it("lists, counts and marks notifications read for the signed-in user only", async () => {
      const other = await createUser();
      const mine = [await notify(ctx.currentUserId, "A"), await notify(ctx.currentUserId, "B"), await notify(ctx.currentUserId, "C")];
      const theirs = await notify(other.id, "Not mine");

      const listed = await api("GET", "/api/notifications");
      expect(listed.status).toBe(200);
      expect(listed.body).toMatchObject({ success: true, unreadCount: 3 });
      expect(listed.body.data).toHaveLength(3);
      expect((await api("GET", "/api/notifications/unread-count")).body.data.unreadCount).toBe(3);

      expect((await api("PATCH", `/api/notifications/${(mine[0] as any).id}/read`)).status).toBe(200);
      expect((await api("GET", "/api/notifications/unread-count")).body.data.unreadCount).toBe(2);

      // someone else's notification cannot be marked read by me
      await api("PATCH", `/api/notifications/${(theirs as any).id}/read`);
      ctx.actAs({ id: other.id });
      expect((await api("GET", "/api/notifications/unread-count")).body.data.unreadCount).toBe(1);
      ctx.actAs(null);

      expect((await api("PATCH", "/api/notifications/mark-all-read")).status).toBe(200);
      expect((await api("GET", "/api/notifications/unread-count")).body.data.unreadCount).toBe(0);
      expect((await api("GET", "/api/notifications?unreadOnly=true")).body.data).toHaveLength(0);
    });

    it("stores and returns notification preferences", async () => {
      expect((await api("GET", "/api/notifications/settings")).body).toMatchObject({ success: true, data: [] });
      expect((await api("PUT", "/api/notifications/settings", { notificationType: "task_assigned", emailEnabled: false })).status).toBe(200);
      const after = (await api("GET", "/api/notifications/settings")).body.data;
      expect(after).toHaveLength(1);
      expect(after[0]).toMatchObject({ notificationType: "task_assigned", emailEnabled: false, inAppEnabled: true });

      const bulk = await api("PUT", "/api/notifications/settings/bulk", {
        preferences: [
          { notificationType: "task_assigned", inAppEnabled: false },
          { notificationType: "invoice_paid", emailEnabled: false },
        ],
      });
      expect(bulk.status).toBe(200);
      const rows = (await api("GET", "/api/notifications/settings")).body.data as any[];
      expect(rows).toHaveLength(2);
      expect(rows.find((r) => r.notificationType === "task_assigned")).toMatchObject({ inAppEnabled: false, emailEnabled: false });
    });

    it("rejects unknown notification types and empty bulk updates without changing anything", async () => {
      const before = (await api("GET", "/api/notifications/settings")).body.data.length;
      expect((await api("PUT", "/api/notifications/settings", { notificationType: "not_a_type" })).status).toBe(400);
      expect((await api("PUT", "/api/notifications/settings", {})).status).toBe(400);
      expect((await api("PUT", "/api/notifications/settings/bulk", { preferences: [] })).status).toBe(400);
      expect((await api("PUT", "/api/notifications/settings/bulk", { preferences: [{ notificationType: "system_alert" }, { notificationType: "bogus" }] })).status).toBe(400);
      expect((await api("GET", "/api/notifications/settings")).body.data.length).toBe(before);
    });

    it("keeps the admin-only tools admin-only", async () => {
      ctx.actAs({ roleName: "Sales" });
      expect((await api("POST", "/api/notifications/test", {})).status).toBe(403);
      expect((await api("POST", "/api/notifications/system", {})).status).toBe(403);
      ctx.actAs(null);
    });
  });

  describe("D4 - profile pictures are stored as files, not base64 in the database", () => {
    const newEmployee = (extra: Record<string, unknown> = {}) => {
      const n = next();
      return api("POST", "/api/employees", {
        firstName: "Pic",
        lastName: String(n),
        email: `pic${n}@example.com`,
        jobTitle: "Dev",
        department: "operations",
        hiringDate: new Date().toISOString(),
        ...extra,
      });
    };
    const profileFiles = () => (fs.existsSync(path.join(ctx.uploadsDir, "profiles")) ? fs.readdirSync(path.join(ctx.uploadsDir, "profiles")) : []);

    it("saves an uploaded image as a file and stores only its URL", async () => {
      const r = await newEmployee({ profileImage: dataUri("image/png", PNG) });
      expect(r.status).toBe(201);
      expect(r.body.profileImage).toMatch(/^\/uploads\/profiles\/[\w-]+\.png$/);
      expect(profileFiles()).toContain(path.basename(r.body.profileImage));
      const served = await ctx.raw(r.body.profileImage);
      expect(served.status).toBe(200);
      expect(served.type).toMatch(/image\/png/);
      expect([...served.body]).toEqual(PNG);
    });

    it("replaces and removes the previous file when the picture changes or is cleared", async () => {
      const emp = (await newEmployee({ profileImage: dataUri("image/png", PNG) })).body;
      const first = path.basename(emp.profileImage);
      const update = (profileImage: string) =>
        api("PUT", `/api/employees/${emp.id}`, { firstName: emp.firstName, lastName: emp.lastName, email: emp.email, jobTitle: "Dev", department: "operations", hiringDate: emp.hiringDate, profileImage });

      const jpeg = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3];
      const changed = await update(dataUri("image/jpeg", jpeg));
      expect(changed.status).toBe(200);
      expect(changed.body.profileImage).toMatch(/\.jpg$/);
      expect(profileFiles()).not.toContain(first);

      const unchanged = await update(changed.body.profileImage);
      expect(unchanged.status).toBe(200);
      expect(unchanged.body.profileImage).toBe(changed.body.profileImage);

      const cleared = await update("");
      expect(cleared.status).toBe(200);
      expect(cleared.body.profileImage).toBeNull();
      expect(profileFiles()).not.toContain(path.basename(changed.body.profileImage));
    });

    it("rejects anything that is not a real, small image", async () => {
      const before = profileFiles().length;
      expect((await newEmployee({ profileImage: dataUri("text/html", Buffer.from("<script>alert(1)</script>")) })).status).toBe(400);
      expect((await newEmployee({ profileImage: dataUri("image/png", Buffer.from("not a png at all")) })).status).toBe(400);
      expect((await newEmployee({ profileImage: "javascript:alert(1)" })).status).toBe(400);
      expect((await newEmployee({ profileImage: "https://tracker.example/pixel.png" })).status).toBe(400);
      expect((await newEmployee({ profileImage: dataUri("image/png", Buffer.concat([Buffer.from(PNG), Buffer.alloc(5 * 1024 * 1024)])) })).status).toBe(400);
      expect(profileFiles().length).toBe(before);
    });

    it("leaves legacy base64 pictures alone until they are replaced", async () => {
      const emp = (await newEmployee()).body;
      const { employees } = await import("../../shared/schema");
      const { eq } = await import("drizzle-orm");
      const legacy = dataUri("image/png", PNG);
      await ctx.db.update(employees).set({ profileImage: legacy }).where(eq(employees.id, emp.id));
      const same = await api("PUT", `/api/employees/${emp.id}`, { firstName: "Renamed", lastName: emp.lastName, email: emp.email, jobTitle: "Dev", department: "operations", hiringDate: emp.hiringDate, profileImage: legacy });
      expect(same.status).toBe(200);
      expect(same.body.profileImage).toMatch(/^\/uploads\/profiles\//); // an unchanged data URI is converted on save
    });

    it("converts the picture sent from the user profile page too", async () => {
      const emp = (await newEmployee()).body;
      const user = (await api("POST", "/api/users", { username: `pu${next()}`, email: `pu${next()}@example.com`, password: "S3cure-pass-xyz", employeeId: emp.id })).body;
      const r = await api("PUT", `/api/users/${user.id}`, { profileImageUrl: dataUri("image/png", PNG) });
      expect(r.status).toBe(200);
      const stored = (await api("GET", `/api/employees/${emp.id}`)).body.profileImage;
      expect(stored).toMatch(/^\/uploads\/profiles\/.+\.png$/);
      expect((await api("PUT", `/api/users/${user.id}`, { profileImageUrl: dataUri("text/html", Buffer.from("x")) })).status).toBe(400);
    });

    it("an invalid employee payload is a 400, not a 500", async () => {
      expect((await newEmployee({ email: undefined, firstName: undefined })).status).toBe(400);
    });
  });

  describe("D5 - document numbers are allocated without collisions", () => {
    it("creates 40 invoices at once with unique, gapless numbers", async () => {
      const client = await createClient(api, "Numbers");
      const results = await Promise.all(Array.from({ length: 40 }, () => api("POST", "/api/invoices", { clientId: client.id, amount: "1" })));
      expect(results.map((r) => r.status)).toEqual(Array(40).fill(201));
      const numbers = results.map((r) => r.body.invoiceNumber as string).sort();
      expect(new Set(numbers).size).toBe(40);
      const seqs = numbers.map((n) => parseInt(n.split("-")[2], 10)).sort((a, b) => a - b);
      expect(seqs[seqs.length - 1] - seqs[0]).toBe(39); // contiguous
    });

    it("creates 40 quotations at once with unique, gapless numbers", async () => {
      const client = await createClient(api, "QNumbers");
      const results = await Promise.all(Array.from({ length: 40 }, () => api("POST", "/api/quotations", { clientId: client.id, title: "q" })));
      expect(results.map((r) => r.status)).toEqual(Array(40).fill(201));
      const seqs = results.map((r) => parseInt((r.body.quotationNumber as string).split("-")[2], 10)).sort((a, b) => a - b);
      expect(new Set(seqs).size).toBe(40);
      expect(seqs[seqs.length - 1] - seqs[0]).toBe(39);
    });

    it("mixes direct invoice creation with quotation conversions safely", async () => {
      const client = await createClient(api, "Mixed");
      const quotations = await Promise.all(Array.from({ length: 5 }, async () => {
        const q = await createQuotation(api, client.id);
        await addItem(api, q.id, 1, 10);
        return q;
      }));
      const results = await Promise.all([
        ...quotations.map((q) => api("POST", `/api/quotations/${q.id}/convert-to-invoice`)),
        ...Array.from({ length: 5 }, () => api("POST", "/api/invoices", { clientId: client.id, amount: "1" })),
      ]);
      expect(results.map((r) => r.status)).toEqual(Array(10).fill(201));
      const numbers = results.map((r) => (r.body.invoice ?? r.body).invoiceNumber);
      expect(new Set(numbers).size).toBe(10);
    });
  });

  describe("D6 - a quotation converts to exactly one invoice, even under concurrency", () => {
    it("two simultaneous conversions: one wins, one gets 409", async () => {
      const client = await createClient(api, "Race");
      const q = await createQuotation(api, client.id);
      await addItem(api, q.id, 2, 50);
      const results = await Promise.all([1, 2, 3, 4].map(() => api("POST", `/api/quotations/${q.id}/convert-to-invoice`)));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(3);

      const { invoices } = await import("../../shared/schema");
      const { eq } = await import("drizzle-orm");
      const rows = await ctx.db.select().from(invoices).where(eq(invoices.quotationId, q.id));
      expect(rows).toHaveLength(1);
      expect(rows[0].amount).toBe("100.00");
    });

    it("a failure part-way leaves no invoice behind and the quotation unconverted", async () => {
      const client = await createClient(api, "Atomic");
      const q = await createQuotation(api, client.id);
      await addItem(api, q.id, 1, 25);
      const { invoiceItems } = await import("../../shared/schema");
      const { sql } = await import("drizzle-orm");
      // make the item copy step fail inside the transaction
      await ctx.db.execute(sql`ALTER TABLE invoice_items ADD CONSTRAINT zz_fail CHECK (false) NOT VALID`);
      try {
        const r = await api("POST", `/api/quotations/${q.id}/convert-to-invoice`);
        expect(r.status).toBe(500);
      } finally {
        await ctx.db.execute(sql`ALTER TABLE invoice_items DROP CONSTRAINT zz_fail`);
      }
      void invoiceItems;
      const { invoices, quotations } = await import("../../shared/schema");
      const { eq } = await import("drizzle-orm");
      expect(await ctx.db.select().from(invoices).where(eq(invoices.quotationId, q.id))).toHaveLength(0);
      const [after] = await ctx.db.select().from(quotations).where(eq(quotations.id, q.id));
      expect(after.status).not.toBe("invoiced");
      expect(after.invoiceId).toBeNull();
      // and a retry afterwards works
      expect((await api("POST", `/api/quotations/${q.id}/convert-to-invoice`)).status).toBe(201);
    });
  });

  describe("D7 - messages", () => {
    it("rejects empty, non-text and oversized messages", async () => {
      const other = await createUser();
      const conv = (await api("POST", "/api/conversations", { participantId: other.id })).body;
      const send = (content: unknown) => api("POST", `/api/conversations/${conv.id}/messages`, { content });

      expect((await send("hello")).status).toBe(201);
      expect((await send("x".repeat(5000))).status).toBe(201);
      expect((await send("x".repeat(5001))).status).toBe(400);
      expect((await send("   ")).status).toBe(400);
      expect((await send(undefined)).status).toBe(400);
      expect((await send({ evil: true })).status).toBe(400);
      expect((await send(12345)).status).toBe(400);
      const messages = (await api("GET", `/api/conversations/${conv.id}/messages`)).body;
      expect(messages.length).toBe(2);
    });
  });
});
