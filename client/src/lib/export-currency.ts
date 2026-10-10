import { fromEgp, parseRate, type InputCurrency } from "./currency-input";

type Row = Record<string, any>;

// Amounts are stored in pounds; an export in another currency divides them by the rate typed at export time.
// Rows are copied, never changed, and the file says which currency and rate it uses.
export function convertRows(rows: Row[], amountFields: string[], currency: InputCurrency, rate: string | number): Row[] {
  if (currency === "EGP") return rows;
  const r = parseRate(currency, rate);
  if (r === null) throw new Error("Invalid exchange rate");
  return rows.map((row) => {
    const copy: Row = { ...row };
    for (const field of amountFields) {
      const value = row[field];
      if (value === null || value === undefined || value === "") continue;
      const converted = fromEgp(value, currency, r);
      if (converted !== null) copy[field] = converted;
    }
    copy.export_currency = currency;
    copy.exchange_rate = r;
    return copy;
  });
}

const needsQuotes = /[",\n\r]/;

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return needsQuotes.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// UTF-8 with a byte-order mark so Excel opens Arabic text correctly; zero is written as 0, not left blank
export function rowsToCsv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = rows.map((row) => headers.map((h) => cell(row[h])).join(","));
  return "﻿" + [headers.map(cell).join(","), ...lines].join("\n");
}
