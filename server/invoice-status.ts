// Which invoice statuses a person may set by hand.
// Everything else is a consequence of something that happened and is only ever set by that action:
// payments move an invoice to partially_paid / paid, refunds to refunded / partially_refunded,
// and cancelling goes through its own endpoint.

export const MANUAL_STATUSES = ["draft", "sent"] as const;
type Manual = (typeof MANUAL_STATUSES)[number];

export interface StatusChangeInput {
  current: { status: string; paidAmount: string | null };
  target: unknown;
  paymentCount: number;
}

export type StatusChangeResult = { ok: true; status: Manual } | { ok: false; httpStatus: 400 | 409; message: string };

export function checkManualStatusChange({ current, target, paymentCount }: StatusChangeInput): StatusChangeResult {
  if (typeof target !== "string" || !(MANUAL_STATUSES as readonly string[]).includes(target)) {
    if (target === "cancelled") {
      return { ok: false, httpStatus: 400, message: "Use the cancel action to cancel an invoice." };
    }
    return {
      ok: false,
      httpStatus: 400,
      message: "Only draft and sent can be set by hand. Payment, refund and cancellation statuses are set by those actions.",
    };
  }
  if (current.status === "cancelled") {
    return { ok: false, httpStatus: 409, message: "A cancelled invoice cannot change status." };
  }
  // Once money has moved, the status follows the payments
  if (paymentCount > 0 || parseFloat(current.paidAmount || "0") > 0) {
    return { ok: false, httpStatus: 409, message: "This invoice already has payments, so its status follows them." };
  }
  return { ok: true, status: target as Manual };
}
