export interface SourceOption {
  id: string;
  name: string;
  accountType?: string | null;
  isActive?: boolean | null;
  currentBalance?: string | null;
  isDefault?: boolean | null;
}

// Which account to offer when the payment method is picked: only when it is unambiguous
// (one active cash account for cash, one active bank account for bank-like methods). Otherwise nothing is guessed.
// When nothing is unambiguous, `fallbackToDefault` offers the default account (used for money received, not for refunds).
export function suggestSource(sources: SourceOption[], method: string, fallbackToDefault = false): string {
  const active = sources.filter((s) => s.isActive !== false);
  const wanted = method === "cash" ? "cash" : ["bank_transfer", "credit_card", "check"].includes(method) ? "bank" : null;
  const matches = wanted ? active.filter((s) => s.accountType === wanted) : [];
  if (matches.length === 1) return matches[0].id;
  return fallbackToDefault ? active.find((s) => s.isDefault)?.id ?? "" : "";
}
