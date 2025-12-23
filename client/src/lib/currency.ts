export const CURRENCY = {
  code: 'EGP',
  symbol: 'ج.م',
  name: 'Egyptian Pound',
  position: 'after' as const,
};

export function formatCurrency(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
  const hasDecimals = numAmount % 1 !== 0;
  
  const formatted = numAmount.toLocaleString(undefined, {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
  
  if (CURRENCY.position === 'after') {
    return `${formatted} ${CURRENCY.symbol}`;
  }
  return `${CURRENCY.symbol}${formatted}`;
}

export function formatCurrencyShort(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
  const formatted = numAmount.toLocaleString();
  
  if (CURRENCY.position === 'after') {
    return `${formatted} ${CURRENCY.symbol}`;
  }
  return `${CURRENCY.symbol}${formatted}`;
}
