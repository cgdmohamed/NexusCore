import { describe, it, expect } from "vitest";
import { suggestSource } from "../client/src/lib/payment-source";

const cash = { id: "c1", name: "Cash", accountType: "cash", isActive: true };
const bank = { id: "b1", name: "Bank", accountType: "bank", isActive: true };

describe("suggestSource", () => {
  it("offers the only cash account for cash and the only bank account for bank-like methods", () => {
    expect(suggestSource([cash, bank], "cash")).toBe("c1");
    expect(suggestSource([cash, bank], "bank_transfer")).toBe("b1");
    expect(suggestSource([cash, bank], "check")).toBe("b1");
  });

  it("guesses nothing when there is more than one candidate or none", () => {
    expect(suggestSource([bank, { ...bank, id: "b2" }], "bank_transfer")).toBe("");
    expect(suggestSource([bank], "cash")).toBe("");
    expect(suggestSource([cash, bank], "other")).toBe("");
  });

  it("ignores inactive accounts", () => {
    expect(suggestSource([{ ...bank, isActive: false }], "bank_transfer")).toBe("");
    expect(suggestSource([{ ...bank, isActive: false }, { ...bank, id: "b2" }], "bank_transfer")).toBe("b2");
  });

  it("falls back to the default account only when asked to", () => {
    const def = { ...bank, id: "d1", isDefault: true };
    const two = [def, { ...bank, id: "b2" }];
    expect(suggestSource(two, "bank_transfer")).toBe("");
    expect(suggestSource(two, "bank_transfer", true)).toBe("d1");
    expect(suggestSource([def], "other", true)).toBe("d1");
    expect(suggestSource([{ ...def, isActive: false }], "other", true)).toBe("");
  });
});
