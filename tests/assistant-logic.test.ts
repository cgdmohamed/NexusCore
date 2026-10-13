import { describe, expect, it } from "vitest";
import { changeFields, collapseEvents, describeAction, groupActions, isWriteTool, subjectOf, suggestionKeys } from "../client/src/lib/assistant-logic";

describe("assistant confirmation summary", () => {
  it("lists fields and estimates an invoice total with tax and discount", () => {
    const s = describeAction({ id: "1", name: "create_invoice", title: "Create invoice", args: { clientName: "Globex", title: "Retainer", taxRate: 14, discountRate: 10, items: [{ name: "Consulting", quantity: 10, unitPrice: 150 }, { name: "Setup", quantity: 1, unitPrice: 500 }] } });
    expect(s.fields.map((f) => f.key)).toEqual(["clientName", "title", "taxRate", "discountRate"]);
    expect(s.lines).toHaveLength(2);
    expect(s.total).toBe(2080);
  });

  it("applies a line discount to a quotation estimate and ignores empty fields", () => {
    const s = describeAction({ id: "1", name: "create_quotation", title: "q", args: { clientName: "A", title: "T", notes: "", items: [{ description: "x", quantity: 2, unitPrice: 100, discountPercent: 10 }] } });
    expect(s.total).toBe(180);
    expect(s.fields.find((f) => f.key === "notes")).toBeUndefined();
  });

  it("has no total for other actions", () => {
    expect(describeAction({ id: "1", name: "create_task", title: "t", args: { title: "x" } }).total).toBeNull();
  });

  it("tells reading tools from changes, and offers prompts by permission", () => {
    expect(isWriteTool("create_task")).toBe(true);
    expect(isWriteTool("update_task")).toBe(true);
    expect(isWriteTool("list_clients")).toBe(false);
    expect(suggestionKeys({ view: (m) => m === "tasks", add: () => false })).toEqual(["overdue"]);
    expect(suggestionKeys({ view: () => true, add: () => true })).toHaveLength(4);
  });
});

describe("assistant confirmation grouping", () => {
  const upd = (id: string, taskId: string, args: object, names = {}) => ({ id, name: "update_task", title: "Update task", args: { taskId, ...args }, names });

  it("merges separate updates to the same task into one row", () => {
    const groups = groupActions([
      upd("1", "t1", { dueDate: "2026-10-23" }, { taskId: "Call supplier" }),
      upd("2", "t2", { dueDate: "2026-10-24" }, { taskId: "Send offer" }),
      upd("3", "t2", { priority: "high" }, { taskId: "Send offer" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[0].rows[1].args).toMatchObject({ dueDate: "2026-10-24", priority: "high" });
    expect(subjectOf(groups[0].rows[1])).toBe("Send offer");
  });

  it("keeps creations separate and hides the subject id from the changes", () => {
    expect(groupActions([{ id: "1", name: "create_task", title: "c", args: { title: "A" } }, { id: "2", name: "create_task", title: "c", args: { title: "A" } }])[0].rows).toHaveLength(2);
    expect(changeFields(upd("1", "t1", { priority: "high", assigneeId: "u1" }, { assigneeId: "Sara Ali" }))).toEqual([{ key: "priority", value: "high" }, { key: "assigneeId", value: "Sara Ali" }]);
  });

  it("shows a repeated step once with a count", () => {
    const out: any[] = collapseEvents([{ role: "event", name: "update_task", ok: true }, { role: "event", name: "update_task", ok: true }, { role: "assistant", text: "x" }, { role: "event", name: "update_task", ok: false }] as any);
    expect(out.map((i) => i.count ?? 0)).toEqual([2, 0, 1]);
  });
});
