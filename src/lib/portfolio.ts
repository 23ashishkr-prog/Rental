import "server-only";
import { buildLedger, type Ledger } from "./rent";
import { roundMoney } from "./money";
import { queryAdjustments, queryFlats, queryPayments } from "./queries";
import type { Actor, AdjustmentRecord, FlatRecord, PaymentRecord } from "./types";

export type FlatSnapshot = FlatRecord & {
  ledger: Ledger;
  payments: PaymentRecord[];
  adjustments: AdjustmentRecord[];
  lastPayment: PaymentRecord | null;
  awaiting: number;
};

export async function loadSnapshots(
  actor: Actor,
  asOfMonth: string,
  opts: { q?: string; flatId?: number; active?: "active" | "inactive" | "all" } = {},
): Promise<FlatSnapshot[]> {
  const flats = await queryFlats(actor, opts);
  if (flats.length === 0) return [];
  const ids = flats.map((flat) => flat.id);
  const [payments, adjustments] = await Promise.all([
    queryPayments(actor, { flatIds: ids, limit: null }),
    queryAdjustments(actor, ids),
  ]);

  return flats.map((flat) => {
    const flatPayments = payments.filter((payment) => payment.flatId === flat.id);
    const flatAdjustments = adjustments.filter((adjustment) => adjustment.flatId === flat.id);
    const ledger = buildLedger({
      monthlyRent: flat.monthlyRent,
      rentStartDate: flat.rentStartDate,
      openingBalance: flat.openingBalance,
      asOfMonth,
      adjustments: flatAdjustments.map((adjustment) => ({
        month: adjustment.month,
        amount: adjustment.amount,
      })),
      payments: flatPayments.map((payment) => ({
        forMonth: payment.forMonth,
        paymentDate: payment.paymentDate,
        amount: payment.amount,
        status: payment.status,
      })),
    });
    const lastPayment =
      flatPayments
        .filter((payment) => payment.status === "confirmed")
        .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || b.id - a.id)[0] ?? null;
    const awaiting = roundMoney(
      flatPayments
        .filter((payment) => payment.status === "pending")
        .reduce((sum, payment) => sum + payment.amount, 0),
    );
    return {
      ...flat,
      ledger,
      payments: flatPayments,
      adjustments: flatAdjustments,
      lastPayment,
      awaiting,
    };
  });
}

export async function loadSnapshot(
  actor: Actor,
  flatId: number,
  asOfMonth: string,
): Promise<FlatSnapshot | null> {
  const [snapshot] = await loadSnapshots(actor, asOfMonth, { flatId, active: "all" });
  return snapshot ?? null;
}
