import { describe, expect, it } from "vitest";
import { clientPayload, groupTasks, projectPayload, taskPayload, whatsappLink, type MobileTask } from "../client/src/mobile/logic";

const now = new Date("2026-10-09T09:00:00");
const task = (id: string, extra: Partial<MobileTask> = {}): MobileTask => ({
  id, title: id, description: null, status: "pending", priority: "medium", dueDate: null, projectId: null,
  assignedTo: null, assigneeName: null, createdAt: "2026-10-01T00:00:00Z", ...extra,
});

describe("groupTasks", () => {
  it("splits open tasks into overdue, today, upcoming and no date, most urgent first", () => {
    const groups = groupTasks([
      task("later", { dueDate: "2026-10-20T00:00:00" }),
      task("soon", { dueDate: "2026-10-12T00:00:00" }),
      task("late-low", { dueDate: "2026-10-01T00:00:00", priority: "low" }),
      task("late-old", { dueDate: "2026-09-20T00:00:00" }),
      task("now-high", { dueDate: "2026-10-09T15:00:00", priority: "high" }),
      task("now-low", { dueDate: "2026-10-09T08:00:00", priority: "low" }),
      task("nodate"),
    ], now);
    expect(groups.map((g) => g.key)).toEqual(["overdue", "today", "upcoming", "no_date"]);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["late-old", "late-low"]);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(["now-high", "now-low"]);
    expect(groups[2].tasks.map((t) => t.id)).toEqual(["soon", "later"]);
  });

  it("hides cancelled tasks and shows completed ones only when asked", () => {
    const tasks = [task("a"), task("b", { status: "completed" }), task("c", { status: "cancelled" })];
    expect(groupTasks(tasks, now, "open").flatMap((g) => g.tasks.map((t) => t.id))).toEqual(["a"]);
    expect(groupTasks(tasks, now, "done").flatMap((g) => g.tasks.map((t) => t.id))).toEqual(["b"]);
    expect(groupTasks(tasks, now, "all").flatMap((g) => g.tasks.map((t) => t.id))).toEqual(["a", "b"]);
  });

  it("counts an in-progress task as open", () => {
    expect(groupTasks([task("a", { status: "in_progress" })], now)[0].key).toBe("no_date");
  });
});

describe("payloads", () => {
  it("builds a task with only the filled fields", () => {
    expect(taskPayload({ title: "  Call client  ", dueDate: "", projectId: "" })).toEqual({ ok: true, payload: { title: "Call client", priority: "medium" } });
    expect(taskPayload({ title: "x", projectId: "p1", dueDate: "2026-10-10", priority: "high", assignedTo: "u1" })).toEqual({
      ok: true, payload: { title: "x", priority: "high", projectId: "p1", dueDate: "2026-10-10", assignedTo: "u1" },
    });
    expect(taskPayload({ title: "   " })).toEqual({ ok: false, error: "title_required" });
  });

  it("builds a project and requires a name", () => {
    expect(projectPayload({ name: " Site ", clientId: "c1" })).toEqual({ ok: true, payload: { name: "Site", clientId: "c1" } });
    expect(projectPayload({ name: "" })).toEqual({ ok: false, error: "name_required" });
  });

  it("builds a client, dropping blanks and rejecting a malformed email", () => {
    expect(clientPayload({ name: "Acme", phone: " 010 123 ", email: "" })).toEqual({ ok: true, payload: { name: "Acme", phone: "010 123" } });
    expect(clientPayload({ name: "Acme", email: "nope" })).toEqual({ ok: false, error: "bad_email" });
    expect(clientPayload({ name: "Acme", email: "a@b.co" }).ok).toBe(true);
    expect(clientPayload({ name: " " })).toEqual({ ok: false, error: "name_required" });
  });
});

describe("whatsappLink", () => {
  it("turns local Egyptian numbers into international ones", () => {
    expect(whatsappLink("010 1234 5678")).toBe("https://wa.me/201012345678");
    expect(whatsappLink("+20 10 1234 5678")).toBe("https://wa.me/201012345678");
    expect(whatsappLink("0020 10 1234 5678")).toBe("https://wa.me/201012345678");
    expect(whatsappLink("abc")).toBeNull();
    expect(whatsappLink("123")).toBeNull();
  });
});
