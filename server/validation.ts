// Input validation helpers for monetary values.
// Money columns are numeric(10, 2), so the largest storable amount is 99,999,999.99.
export const MAX_MONEY = 99_999_999.99;

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** A finite money amount within [0 or >0, MAX_MONEY]; `null` when the value is not acceptable. */
export function parseMoney(value: unknown, { allowZero = false }: { allowZero?: boolean } = {}): number | null {
  const n = toNumber(value);
  if (n === null || n > MAX_MONEY) return null;
  return n > 0 || (allowZero && n === 0) ? n : null;
}

/** A percentage between 0 and 100; `null` when the value is not acceptable. */
export function parsePercent(value: unknown): number | null {
  const n = toNumber(value);
  return n !== null && n >= 0 && n <= 100 ? n : null;
}

/** True when the optional field was not supplied at all. */
export const isAbsent = (value: unknown) => value === undefined || value === null || value === "";

/** A valid date from an ISO string / timestamp; `null` when it cannot be parsed. */
export function parseDateValue(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
