import { describe, it, expect } from "vitest";
import { convertRows, rowsToCsv } from "../client/src/lib/export-currency";

const rows = [
  { id: "a", amount: "5000.00", paidAmount: "0", taxAmount: null, note: "x" },
  { id: "b", amount: "1333.00", paidAmount: "", taxAmount: "100", note: "y" },
];

describe("export in another currency", () => {
  it("leaves pounds untouched", () => {
    expect(convertRows(rows, ["amount"], "EGP", "")).toBe(rows);
  });

  it("converts only the money fields and says which currency and rate were used", () => {
    const out = convertRows(rows, ["amount", "paidAmount", "taxAmount"], "USD", "50");
    expect(out[0]).toMatchObject({ amount: 100, paidAmount: 0, taxAmount: null, note: "x", export_currency: "USD", exchange_rate: 50 });
    expect(out[1]).toMatchObject({ amount: 26.66, paidAmount: "", taxAmount: 2 });
  });

  it("does not change the original rows", () => {
    convertRows(rows, ["amount"], "SAR", "13");
    expect(rows[0].amount).toBe("5000.00");
  });

  it("refuses an unusable rate", () => {
    expect(() => convertRows(rows, ["amount"], "USD", "")).toThrow();
    expect(() => convertRows(rows, ["amount"], "USD", "0")).toThrow();
  });
});

describe("rowsToCsv", () => {
  it("quotes commas, quotes and line breaks, keeps zero, and starts with a BOM", () => {
    const csv = rowsToCsv([{ a: "x,y", b: 'say "hi"', c: 0, d: null, e: "l1\nl2" }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('a,b,c,d,e\n"x,y","say ""hi""",0,,"l1\nl2"');
  });

  it("is empty without rows", () => {
    expect(rowsToCsv([])).toBe("");
  });
});
