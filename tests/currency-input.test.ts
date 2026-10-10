import { describe, it, expect } from "vitest";
import { toEgp, fromEgp, parseRate, isInputCurrency } from "../client/src/lib/currency-input";

describe("currency input conversion", () => {
  it("keeps pounds as they are", () => {
    expect(toEgp("250.5", "EGP", "")).toBe(250.5);
    expect(toEgp(100, "EGP", "garbage")).toBe(100);
  });

  it("converts dollars and riyals with the typed rate", () => {
    expect(toEgp("100", "USD", "50")).toBe(5000);
    expect(toEgp("100", "SAR", "13.33")).toBe(1333);
    expect(toEgp("19.99", "USD", "48.75")).toBe(974.51);
  });

  it("refuses an unusable rate or amount", () => {
    expect(toEgp("100", "USD", "")).toBeNull();
    expect(toEgp("100", "USD", "0")).toBeNull();
    expect(toEgp("100", "USD", "-3")).toBeNull();
    expect(toEgp("", "USD", "50")).toBeNull();
    expect(toEgp("-5", "USD", "50")).toBeNull();
    expect(parseRate("SAR", "abc")).toBeNull();
  });

  it("goes back from pounds when the currency changes", () => {
    expect(fromEgp("5000", "USD", "50")).toBe(100);
    expect(fromEgp("5000", "EGP", "")).toBe(5000);
    expect(fromEgp("5000", "USD", "")).toBeNull();
  });

  it("knows the supported currencies", () => {
    expect(isInputCurrency("USD")).toBe(true);
    expect(isInputCurrency("EUR")).toBe(false);
  });
});
