export interface AttentionItem { key: string; count: number; amount?: number; href: string; secondary?: number }

export interface AgingData {
  buckets: Record<"notDue" | "d1_30" | "d31_60" | "d61_90" | "d90plus", { count: number; amount: number }>;
  total: number;
  overdueCount: number;
  overdueAmount: number;
  topDebtors: { clientId: string | null; name: string; outstanding: number; oldestDaysPastDue: number }[];
}

export interface MonthPoint { month: string; collected: number; spent: number; net: number }

export interface OverviewData {
  attention: AttentionItem[];
  aging?: AgingData;
  cashflow?: { months: MonthPoint[]; hasSpent: boolean; hasCollected: boolean };
}
