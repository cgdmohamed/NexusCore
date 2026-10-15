import { describe, expect, it } from "vitest";
import { editDistance, matchNames, nameSearchIds, normalizeName, pickByName, type Named } from "../server/mcp/names";

const row = (id: string, label: string, ...extra: string[]): Named => ({ id, label, keys: [label, ...extra] });

describe("normalizeName", () => {
  it("treats spacing, case and punctuation as the same name", () => {
    for (const v of ["rose gold", "Rose Gold", "ROSE-GOLD", "rose_gold", "Rose  Gold.", "rosegold"]) expect(normalizeName(v)).toBe("rosegold");
  });
  it("treats Arabic spellings that differ in hamza, ya, ta marbuta and marks as the same", () => {
    expect(normalizeName("أحمد")).toBe(normalizeName("احمد"));
    expect(normalizeName("مدرسة")).toBe(normalizeName("مدرسه"));
    expect(normalizeName("مصطفى")).toBe(normalizeName("مصطفي"));
    expect(normalizeName("مُحَمَّد")).toBe("محمد");
    expect(normalizeName("إبراهيم")).toBe(normalizeName("ابراهيم"));
  });
});

describe("matching names", () => {
  const rows = [row("1", "rosegold"), row("2", "Blue Ocean"), row("3", "Blue Oasis Hotel")];

  it("finds rosegold from 'rose gold' and from either case", () => {
    for (const q of ["rose gold", "Rose Gold", "ROSE-GOLD", "rosegold"]) {
      const r = pickByName(q, rows, "projects", { none: "" });
      expect("picked" in r && r.picked.id).toBe("1");
    }
  });

  it("prefers an exact name over a longer one that contains it", () => {
    const r = pickByName("blue ocean", [row("a", "Blue Ocean"), row("b", "Blue Ocean Resort")], "projects", { none: "" });
    expect("picked" in r && r.picked.id).toBe("a");
  });

  it("lists the candidates when several names contain the text", () => {
    const r = pickByName("blue", rows, "projects", { none: "" });
    expect("error" in r && r.error).toMatch(/matches 2 projects/);
  });

  it("offers a 'did you mean' for a slip of the keyboard, and never picks it for you", () => {
    const r = pickByName("rosgold", rows, "projects", { none: "" });
    expect("error" in r && r.error).toMatch(/Did you mean: rosegold \(1\)/);
  });

  it("says nothing fits when nothing is close", () => {
    const r = pickByName("zzzz", rows, "projects", { none: "Use list_projects." });
    expect("error" in r && r.error).toMatch(/No project matches "zzzz"\. Use list_projects\./);
  });

  it("answers to any of a person's spellings", () => {
    const people = [row("u1", "Ahmed Ali", "ahmed.ali", "ahmed@x.test")];
    expect(matchNames("ahmedali", people).exact).toHaveLength(1);
    expect(matchNames("ahmed@x.test", people).exact).toHaveLength(1);
    expect(matchNames("ali", people).contains).toHaveLength(1);
  });

  it("builds a search that ignores spacing", () => {
    expect(nameSearchIds("rose gold", rows)).toEqual(["1"]);
    expect(nameSearchIds("", rows)).toEqual([]);
  });
});

describe("editDistance", () => {
  it("counts single edits", () => {
    expect(editDistance("rosgold", "rosegold")).toBe(1);
    expect(editDistance("abc", "abc")).toBe(0);
    expect(editDistance("", "ab")).toBe(2);
    expect(editDistance("kitten", "sitting")).toBe(3);
  });
});
