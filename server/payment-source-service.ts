import { sql, eq } from "drizzle-orm";
import { db } from "./db";
import { paymentSources, paymentSourceTransactions } from "@shared/schema";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class PaymentSourceError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// Existing databases were created before payments could point at an account; added at startup (idempotent)
export async function runPaymentSourceLinkMigration(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_source_id VARCHAR REFERENCES payment_sources(id)`);
  } catch (err) {
    console.error("⚠️ Payment source link migration failed (non-fatal):", err);
  }
}

// An empty value means "no account": the payment is recorded without touching any balance
export function sourceIdFrom(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export interface MoveMoney {
  sourceId: string;
  direction: "in" | "out";
  amount: number;
  description: string;
  referenceType: "payment" | "refund" | "credit_refund" | "payment_assignment";
  referenceId?: string | null;
  userId?: string;
}

// Adds to or takes from an account and logs the movement with the balance before and after.
// Runs inside the caller's transaction, so the record that caused the movement and the balance change stand or fall together.
export async function moveMoney(tx: Tx, m: MoveMoney): Promise<void> {
  const [source] = await tx.select().from(paymentSources).where(eq(paymentSources.id, m.sourceId)).for("update");
  if (!source) throw new PaymentSourceError("Payment source not found", 404);
  if (source.isActive === false) throw new PaymentSourceError("Payment source is not active");
  if (!Number.isFinite(m.amount) || m.amount <= 0) throw new PaymentSourceError("Amount must be a positive number");

  const signed = m.direction === "in" ? m.amount : -m.amount;
  const balanceBefore = source.currentBalance ?? "0";
  const [updated] = await tx
    .update(paymentSources)
    .set({ currentBalance: sql`${paymentSources.currentBalance} + ${signed}::numeric`, updatedAt: new Date() })
    .where(eq(paymentSources.id, m.sourceId))
    .returning();

  await tx.insert(paymentSourceTransactions).values({
    paymentSourceId: m.sourceId,
    // "refund" is already used for an expense paid back into an account, so money returned to a client has its own type
    type: m.direction === "in" ? "income" : "client_refund",
    amount: m.amount.toFixed(2),
    description: m.description,
    referenceId: m.referenceId ?? null,
    referenceType: m.referenceType,
    balanceBefore,
    balanceAfter: updated?.currentBalance ?? (parseFloat(balanceBefore) + signed).toFixed(2),
    createdBy: m.userId,
  });
}

// Checks an account can receive or pay out before the record that refers to it is written
export async function assertUsableSource(tx: Tx, sourceId: string): Promise<void> {
  const [source] = await tx.select({ id: paymentSources.id, isActive: paymentSources.isActive }).from(paymentSources).where(eq(paymentSources.id, sourceId));
  if (!source) throw new PaymentSourceError("Payment source not found", 404);
  if (source.isActive === false) throw new PaymentSourceError("Payment source is not active");
}
