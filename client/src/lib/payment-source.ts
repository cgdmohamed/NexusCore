export interface SourceOption {
  id: string;
  name: string;
  accountType?: string | null;
  isActive?: boolean | null;
  currentBalance?: string | null;
}

// Which account to offer when the payment method is picked: only when it is unambiguous
// (one active cash account for cash, one active bank account for bank-like methods). Otherwise nothing is guessed.
export function suggestSource(sources: SourceOption[], method: string): string {
  const active = sources.filter((s) => s.isActive !== false);
  const wanted = method === "cash" ? "cash" : ["bank_transfer", "credit_card", "check"].includes(method) ? "bank" : null;
  if (!wanted) return "";
  const matches = active.filter((s) => s.accountType === wanted);
  return matches.length === 1 ? matches[0].id : "";
}
