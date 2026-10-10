// Prices can be typed in dollars or riyals together with the exchange rate; everything is stored in Egyptian pounds.

export const INPUT_CURRENCIES = ["EGP", "USD", "SAR"] as const;
export type InputCurrency = (typeof INPUT_CURRENCIES)[number];

export const isInputCurrency = (v: unknown): v is InputCurrency => INPUT_CURRENCIES.includes(v as InputCurrency);

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// The rate is "1 unit of the currency = N EGP"; EGP itself always converts at 1
export function parseRate(currency: InputCurrency, rate: string | number): number | null {
  if (currency === "EGP") return 1;
  const n = typeof rate === "number" ? rate : parseFloat(rate);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Pounds for an amount typed in `currency`, or null while the amount or the rate is missing or not usable
export function toEgp(amount: string | number, currency: InputCurrency, rate: string | number): number | null {
  const value = typeof amount === "number" ? amount : parseFloat(amount);
  const r = parseRate(currency, rate);
  if (!Number.isFinite(value) || value < 0 || r === null) return null;
  return round2(value * r);
}

// The amount to show in the field after the currency or the rate changes, given the pounds already stored
export function fromEgp(egp: string | number, currency: InputCurrency, rate: string | number): number | null {
  const value = typeof egp === "number" ? egp : parseFloat(egp);
  const r = parseRate(currency, rate);
  if (!Number.isFinite(value) || r === null) return null;
  return round2(value / r);
}
