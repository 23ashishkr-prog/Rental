import "server-only";
import { buildLedger, type Ledger } from "./rent";
import { roundMoney } from "./money";
import { queryAdjustments, queryFlats, queryPayments, queryRentChanges } from "./queries";
import type { Actor, AdjustmentRecord, FlatRecord, PaymentRecord, RentChangeRecord } from "./types";

export type FlatSnapshot = FlatRecord & {
  ledger: Ledger;
  payments: PaymentRecord[];
  adjustments: AdjustmentRecord[];
  rentChanges: RentChangeRecord[];
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
  const [payments, adjustments, rentChanges] = await Promise.all([
    queryPayments(actor, { flatIds: ids, limit: null }),
    queryAdjustments(actor, ids),
    queryRentChanges(actor, ids),
  ]);

  return flats.map((flat) => {
    const flatPayments = payments.filter((payment) => payment.flatId === flat.id);
    const flatAdjustments = adjustments.filter((adjustment) => adjustment.flatId === flat.id);
    const flatChanges = rentChanges.filter((change) => change.flatId === flat.id);
    const ledger = buildLedger({
      monthlyRent: flat.monthlyRent,
      rentStartDate: flat.rentStartDate,
      openingBalance: flat.openingBalance,
      rentChanges: flatChanges.map((change) => ({
        effectiveMonth: change.effectiveMonth,
        monthlyRent: change.monthlyRent,
        note: change.note,
      })),
      asOfMonth,
      adjustments: flatAdjustments.map((adjustment) => ({
        month: adjustment.month,
        amount: adjustment.amount,
      })),
      payments: flatPayments.map((payment) => ({
        forMonth: payment.forMonth,
        forMonthExplicit: payment.forMonth != null,
        paymentDate: payment.paymentDate,
        amount: payment.amount,
        status: payment.status,
        method: payment.method,
        upiRef: payment.upiRef,
        createdAt: payment.createdAt,
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
      rentChanges: flatChanges,
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
