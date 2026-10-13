import { describe, expect, it } from "vitest";
import { describeAction, isWriteTool, suggestionKeys } from "../client/src/lib/assistant-logic";

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
