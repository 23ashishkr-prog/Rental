import { addMonths, monthStart } from "./dates";
import { fromPaise, toPaise } from "./money";

export type LedgerPayment = {
  forMonth: string | null;
  paymentDate: string;
  amount: number;
  status: string;
};

export type LedgerAdjustment = {
  month: string;
  amount: number;
};

export type LedgerMonth = {
  month: string;
  rent: number;
  adjustment: number;
  charge: number;
  paid: number;
  opening: number;
  closing: number;
};

export type Ledger = {
  months: LedgerMonth[];
  totalCharged: number;
  totalPaid: number;
  advancePaid: number;
  pending: number;
  credit: number;
  pendingMonths: number;
  partial: boolean;
};

/**
 * Rent is charged in full for the start month and every month after it, through asOfMonth.
 * Confirmed payments apply to for_month, or to the payment_date month when for_month is empty.
 * Unpaid balance and extra payment both carry forward. Payments tagged to a future month
 * stay as advance and do not reduce the balance due through asOfMonth.
 * Pending and rejected payments are ignored.
 */
export function buildLedger(input: {
  monthlyRent: number;
  rentStartDate: string | null;
  asOfMonth: string;
  adjustments?: LedgerAdjustment[];
  payments?: LedgerPayment[];
}): Ledger {
  const asOf = monthStart(input.asOfMonth);
  const start = input.rentStartDate ? monthStart(input.rentStartDate) : null;
  const rentPaise = toPaise(input.monthlyRent);

  const adjustments = new Map<string, number>();
  for (const adjustment of input.adjustments ?? []) {
    const month = monthStart(adjustment.month);
    adjustments.set(month, (adjustments.get(month) ?? 0) + toPaise(adjustment.amount));
  }

  const paidByMonth = new Map<string, number>();
  let preStartPaise = 0;
  let advancePaise = 0;

  for (const payment of input.payments ?? []) {
    if (payment.status !== "confirmed") continue;
    const source = payment.forMonth || payment.paymentDate;
    if (!source) continue;
    const month = monthStart(source);
    const amount = toPaise(payment.amount);
    if (!start || month > asOf) {
      if (!start && month <= asOf) preStartPaise += amount;
      else advancePaise += amount;
      continue;
    }
    if (month < start) {
      preStartPaise += amount;
      continue;
    }
    paidByMonth.set(month, (paidByMonth.get(month) ?? 0) + amount);
  }

  if (!start || start > asOf) {
    const credit = fromPaise(preStartPaise);
    return {
      months: [],
      totalCharged: 0,
      totalPaid: credit,
      advancePaid: fromPaise(advancePaise),
      pending: 0,
      credit,
      pendingMonths: 0,
      partial: false,
    };
  }

  const months: LedgerMonth[] = [];
  let running = -preStartPaise;
  let totalCharged = 0;
  let totalPaid = preStartPaise;
  let guard = 0;

  for (let month = start; month <= asOf; month = addMonths(month, 1)) {
    if (++guard > 600) break;
    const adjustment = adjustments.get(month) ?? 0;
    const charge = rentPaise + adjustment;
    const paid = paidByMonth.get(month) ?? 0;
    const opening = running;
    const closing = opening + charge - paid;
    months.push({
      month,
      rent: fromPaise(rentPaise),
      adjustment: fromPaise(adjustment),
      charge: fromPaise(charge),
      paid: fromPaise(paid),
      opening: fromPaise(opening),
      closing: fromPaise(closing),
    });
    running = closing;
    totalCharged += charge;
    totalPaid += paid;
  }

  const pendingPaise = Math.max(0, running);
  const creditPaise = Math.max(0, -running);

  let pool = preStartPaise;
  for (const month of months) pool += toPaise(month.paid);

  let pendingMonths = 0;
  let partial = false;
  for (const month of months) {
    const charge = toPaise(month.charge);
    if (charge <= 0) {
      pool += -charge;
      continue;
    }
    if (pool >= charge) {
      pool -= charge;
    } else if (pool > 0) {
      pendingMonths += 1;
      partial = true;
      pool = 0;
    } else {
      pendingMonths += 1;
    }
  }

  if (pendingPaise === 0) {
    pendingMonths = 0;
    partial = false;
  }

  return {
    months,
    totalCharged: fromPaise(totalCharged),
    totalPaid: fromPaise(totalPaid),
    advancePaid: fromPaise(advancePaise),
    pending: fromPaise(pendingPaise),
    credit: fromPaise(creditPaise),
    pendingMonths,
    partial,
  };
}

export function pendingLabel(months: number, partial: boolean): string {
  if (months <= 0) return "Nothing pending";
  if (months === 1 && partial) return "Part of 1 month pending";
  if (partial && months > 1) {
    const full = months - 1;
    return `${full} full month${full === 1 ? "" : "s"} + a partial month`;
  }
  return `${months} month${months === 1 ? "" : "s"} pending`;
}
