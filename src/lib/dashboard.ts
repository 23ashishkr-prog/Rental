import { monthStart } from "./dates";
import { fromPaise, roundMoney, toPaise } from "./money";
import { monthStanding, type Ledger, type MonthStanding } from "./rent";

/** One flat, one month, taken from the same ledger row the flat page shows. */
export type FlatMonthFigures = {
  due: number;
  paid: number;
  left: number;
  earlier: number;
  total: number;
  status: MonthStanding["status"];
};

export type DashboardSummary = {
  due: number;
  paid: number;
  left: number;
  earlier: number;
  total: number;
  /** Ledger payments counted toward this calendar year, through the selected month. */
  paidThisYear: number;
  paidFlats: number;
  partialFlats: number;
  unpaidFlats: number;
  /**
   * Share of this month's due that is covered.
   * Extra payment above a flat's due does not raise the percent.
   * 1 when nothing is due, or when every flat's due is covered.
   */
  progress: number;
};

type SummaryFlat = {
  ledger: Ledger;
  /**
   * Accepted so callers can pass a flat through unchanged.
   * A deposit is not rent and is never read here.
   */
  securityDeposit?: number | null;
};

/** Due, paid, and what is still unpaid for one flat in the selected month. */
export function flatMonthFigures(ledger: Ledger, month: string): FlatMonthFigures {
  const standing = monthStanding(ledger, month);
  const left = standing.remaining;
  const earlier = standing.arrears;
  return {
    due: standing.charge,
    paid: standing.collected,
    left,
    earlier,
    total: roundMoney(left + earlier),
    status: standing.status,
  };
}

/**
 * Home totals for the flats on screen.
 * Every figure is the sum of `flatMonthFigures`, which reads `buildLedger`.
 * Collected is money the ledger counted toward the month, not cash dated in that month.
 * Total still unpaid is left this month plus earlier unpaid. It is not reduced by a deposit.
 */
export function summarizeDashboard(flats: SummaryFlat[], month: string): DashboardSummary {
  let due = 0;
  let paid = 0;
  let left = 0;
  let earlier = 0;
  let covered = 0;
  let paidThisYear = 0;
  let paidFlats = 0;
  let partialFlats = 0;
  let unpaidFlats = 0;
  let through = "";
  let year = "";
  try {
    through = monthStart(month);
    year = through.slice(0, 4);
  } catch {
    through = "";
  }

  for (const flat of flats) {
    const figures = flatMonthFigures(flat.ledger, month);
    const duePaise = toPaise(figures.due);
    const paidPaise = toPaise(figures.paid);
    due += duePaise;
    paid += paidPaise;
    left += toPaise(figures.left);
    earlier += toPaise(figures.earlier);
    covered += Math.min(Math.max(0, paidPaise), Math.max(0, duePaise));
    if (figures.status === "paid") paidFlats += 1;
    else if (figures.status === "partial") partialFlats += 1;
    else if (figures.status === "due") unpaidFlats += 1;
    if (!year) continue;
    for (const row of flat.ledger.months) {
      if (row.month.startsWith(year) && row.month <= through) paidThisYear += toPaise(row.paid);
    }
  }

  return {
    due: fromPaise(due),
    paid: fromPaise(paid),
    left: fromPaise(left),
    earlier: fromPaise(earlier),
    total: fromPaise(left + earlier),
    paidThisYear: fromPaise(paidThisYear),
    paidFlats,
    partialFlats,
    unpaidFlats,
    progress: due <= 0 ? 1 : covered / due,
  };
}

/** Amount to offer when recording a payment: what is left this month, otherwise the whole unpaid total. */
export function suggestedRecordAmount(figures: FlatMonthFigures): number {
  if (figures.left > 0) return figures.left;
  if (figures.total > 0) return figures.total;
  return figures.due > 0 ? figures.due : 0;
}

export function recordPaymentHref(flatId: number, month: string, amount: number): string {
  const params = new URLSearchParams();
  params.set("flat", String(flatId));
  params.set("month", month.slice(0, 7));
  if (amount > 0) params.set("amount", String(roundMoney(amount)));
  return `/payments/new?${params.toString()}`;
}
