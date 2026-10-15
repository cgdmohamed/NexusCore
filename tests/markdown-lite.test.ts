import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown, safeHref } from "../client/src/lib/markdown-lite";

describe("inline", () => {
  it("reads bold, italics and code, and leaves other text alone", () => {
    expect(parseInline("a **b** c *d* `e`")).toEqual([
      { t: "text", v: "a " }, { t: "b", c: [{ t: "text", v: "b" }] }, { t: "text", v: " c " }, { t: "i", c: [{ t: "text", v: "d" }] }, { t: "text", v: " " }, { t: "code", v: "e" },
    ]);
    expect(parseInline("2 * 3 = 6 and snake_case_name")).toEqual([{ t: "text", v: "2 * 3 = 6 and snake_case_name" }]);
    expect(parseInline("**unfinished")).toEqual([{ t: "text", v: "**unfinished" }]);
  });

  it("nests bold around code and keeps Arabic intact", () => {
    expect(parseInline("**مهمة `T1`**")).toEqual([{ t: "b", c: [{ t: "text", v: "مهمة " }, { t: "code", v: "T1" }] }]);
  });

  it("only links to the web, an email, or inside the app", () => {
    expect(safeHref("https://x.test/a")).toBe("https://x.test/a");
    expect(safeHref("/invoices/12")).toBe("/invoices/12");
    expect(safeHref("mailto:a@b.test")).toBe("mailto:a@b.test");
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "//evil.test", "vbscript:x"]) expect(safeHref(bad)).toBeNull();
    expect(parseInline("[x](javascript:alert(1))")).toEqual([{ t: "text", v: "[x](javascript:alert(1))" }]);
    expect(parseInline("[open](/tasks)")).toEqual([{ t: "a", href: "/tasks", c: [{ t: "text", v: "open" }] }]);
  });

  it("never turns text into markup", () => {
    expect(parseInline("<script>alert(1)</script> <b>x</b>")).toEqual([{ t: "text", v: "<script>alert(1)</script> <b>x</b>" }]);
  });
});

describe("blocks", () => {
  it("lays out the reply that showed raw marks", () => {
    const reply = [
      "Since no work has started, here is the list for **RoseGold SEO** up to today:",
      "",
      "### Due today",
      "1. **W1 · Quick fixes** — **Pending**, high priority",
      "   - Restore the menu link.",
      "   - Fix the 5xx URL, then run **Validate Fix**.",
      "2. **Weekly SEO report** — **In progress**",
      "",
      "### Already completed today",
      "- **W1 · Client confirmations**",
      "- **W1 · Measurement setup**",
    ].join("\n");
    const blocks = parseMarkdown(reply);
    expect(blocks.map((b) => b.t)).toEqual(["p", "h", "list", "h", "list"]);
    const due = blocks[2] as any;
    expect(due.ordered).toBe(true);
    expect(due.items).toHaveLength(2);
    expect(due.items[0].inline[0]).toEqual({ t: "b", c: [{ t: "text", v: "W1 · Quick fixes" }] });
    expect(due.items[0].children[0]).toMatchObject({ t: "list", ordered: false });
    expect(due.items[0].children[0].items).toHaveLength(2);
    expect((blocks[1] as any).level).toBe(3);
    expect((blocks[4] as any).items).toHaveLength(2);
    // none of the raw marks survive in the text
    expect(JSON.stringify(blocks)).not.toMatch(/\*\*|###/);
  });

  it("reads paragraphs with line breaks, rules, quotes and code", () => {
    const blocks = parseMarkdown("one\ntwo\n\n---\n\n> quoted **bold**\n\n```js\nconst a = 1;\n```");
    expect(blocks.map((b) => b.t)).toEqual(["p", "hr", "quote", "code"]);
    expect((blocks[0] as any).c).toEqual([{ t: "text", v: "one\ntwo" }]);
    expect((blocks[3] as any).v).toBe("const a = 1;");
  });

  it("reads a table", () => {
    const blocks = parseMarkdown("| Client | Owed |\n|---|---:|\n| A | 750 |\n| B | **400** |");
    const t = blocks[0] as any;
    expect(t.t).toBe("table");
    expect(t.head).toHaveLength(2);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[1][1]).toEqual([{ t: "b", c: [{ t: "text", v: "400" }] }]);
  });

  it("is not fooled by a list-looking number inside text, and handles empty and odd input", () => {
    expect(parseMarkdown("The total is 5.5 million")).toEqual([{ t: "p", c: [{ t: "text", v: "The total is 5.5 million" }] }]);
    expect(parseMarkdown("")).toEqual([]);
    expect(() => parseMarkdown("```\nunclosed")).not.toThrow();
    expect(parseMarkdown("• نقطة")).toEqual([{ t: "list", ordered: false, items: [{ inline: [{ t: "text", v: "نقطة" }], children: [] }] }]);
  });
});
