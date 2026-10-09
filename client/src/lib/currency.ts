export const CURRENCY = {
  code: 'EGP',
  symbol: 'ج.م',
  name: 'Egyptian Pound',
  position: 'after' as const,
};

// Western digits in both languages so figures read the same in lists, details and printed documents.
// The result is wrapped in a left-to-right isolate with a no-break space, so "1,500 ج.م" stays one unit in RTL.
const LRI = '⁦';
const PDI = '⁩';
const NBSP = ' ';

function toNumber(amount: number | string | null | undefined): number {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
}

export function formatNumber(amount: number | string | null | undefined, maxFractionDigits = 2): string {
  const n = toNumber(amount);
  return n.toLocaleString('en-US', {
    minimumFractionDigits: n % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: maxFractionDigits,
  });
}

function withSymbol(formatted: string): string {
  return CURRENCY.position === 'after' ? `${formatted} ${CURRENCY.symbol}` : `${CURRENCY.symbol}${formatted}`;
}

export function formatCurrency(amount: number | string | null | undefined): string {
  return withSymbol(formatNumber(amount));
}

export function formatCurrencyShort(amount: number | string | null | undefined): string {
  return withSymbol(toNumber(amount).toLocaleString('en-US'));
}
