// Shared by the invoice, quotation and client statement print pages

export const CURRENCY_SYMBOLS: Record<string, string> = { EGP: "ج.م", USD: "$", SAR: "ر.س" };

export function formatDisplay(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const formatted = amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === "USD" ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
}

// An item with no price and no discount is a freebie shown as "included" rather than as zero
export function isIncludedItem(item: any): boolean {
  if (typeof item.isIncluded === "boolean") return item.isIncluded;
  return parseFloat(item.displayUnitPrice || item.egpUnitPrice || "0") === 0
    && parseFloat(item.displayTotalPrice || item.egpTotalPrice || "0") === 0
    && parseFloat(item.discount || "0") === 0;
}

export interface PrintCompany {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  vatNumber?: string;
  regNumber?: string;
}

// Snapshots saved before the shared company block carried the name, address, phone and email as separate fields
export function snapshotCompany(snap: any): PrintCompany {
  if (snap?.company?.name) return snap.company;
  return {
    name: snap?.companyName || "Creative Code Nexus",
    address: snap?.companyAddress,
    phone: snap?.companyPhone,
    email: snap?.companyEmail,
  };
}

export const STATUS_STYLES: Record<string, { background: string; color: string }> = {
  paid: { background: "#dcfce7", color: "#15803d" },
  accepted: { background: "#dcfce7", color: "#15803d" },
  invoiced: { background: "#dcfce7", color: "#15803d" },
  partially_paid: { background: "#dbeafe", color: "#2563eb" },
  sent: { background: "#e0f2fe", color: "#0369a1" },
  draft: { background: "#f3f4f6", color: "#374151" },
  overdue: { background: "#fee2e2", color: "#dc2626" },
  rejected: { background: "#fee2e2", color: "#dc2626" },
  expired: { background: "#fef3c7", color: "#d97706" },
  cancelled: { background: "#f3f4f6", color: "#6b7280" },
  refunded: { background: "#ede9fe", color: "#7c3aed" },
  partially_refunded: { background: "#fef3c7", color: "#d97706" },
};

export const statusStyle = (status: string | undefined) => STATUS_STYLES[status || ""] || STATUS_STYLES.draft;
