import { ledgerStartMonth } from "./config";
import { addMonths, calendarDate, formatMonthShort, monthStart } from "./dates";
import { fromPaise, toPaise } from "./money";

export type LedgerPayment = {
  forMonth: string | null;
  paymentDate: string;
  amount: number;
  status: string | null;
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

/** Months from rent_start_date up to the books-open month, treated as fully paid. Not stored as payments. */
export type SettledBefore = {
  fromMonth: string;
  throughMonth: string;
  monthCount: number;
  amount: number;
  label: string;
};

export type Ledger = {
  months: LedgerMonth[];
  settledBefore: SettledBefore | null;
  totalCharged: number;
  totalPaid: number;
  advancePaid: number;
  pending: number;
  credit: number;
  pendingMonths: number;
  partial: boolean;
};

/** Label for the single pre-books line, from LEDGER_START_DATE. Default: "Paid (before Apr 2026)". */
export function paidBeforeLabel(booksOpenMonth: string): string {
  return `Paid (before ${formatMonthShort(booksOpenMonth)})`;
}

function monthOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = calendarDate(value);
  if (!day) return null;
  try {
    return monthStart(day);
  } catch {
    return null;
  }
}

/** Null, blank, and confirmed payments count. Pending and rejected do not. */
export function paymentCounts(status: string | null | undefined): boolean {
  if (status == null) return true;
  const value = status.trim().toLowerCase();
  return value === "" || value === "confirmed";
}

export type MonthStanding = {
  charge: number;
  collected: number;
  remaining: number;
  status: "paid" | "partial" | "due" | "none";
  arrears: number;
};

/** This month's rent versus payments allocated to it, plus arrears carried in. */
export function monthStanding(ledger: Ledger, month: string): MonthStanding {
  const empty: MonthStanding = { charge: 0, collected: 0, remaining: 0, status: "none", arrears: 0 };
  let key: string;
  try {
    key = monthStart(month);
  } catch {
    return empty;
  }
  const row = ledger.months.find((item) => item.month === key);
  if (!row) return empty;
  const charge = toPaise(row.charge);
  const paid = toPaise(row.paid);
  let status: MonthStanding["status"] = "none";
  if (charge > 0 && paid >= charge) status = "paid";
  else if (charge > 0 && paid > 0) status = "partial";
  else if (charge > 0) status = "due";
  return {
    charge: row.charge,
    collected: row.paid,
    remaining: fromPaise(Math.max(0, charge - paid)),
    status,
    arrears: fromPaise(Math.max(0, toPaise(row.opening))),
  };
}

function settledHistory(
  rentMonth: string | null,
  open: string,
  asOf: string,
  monthlyRent: number,
): SettledBefore | null {
  if (!rentMonth || rentMonth >= open) return null;
  const lastSettled = addMonths(open, -1);
  const through = lastSettled < asOf ? lastSettled : asOf;
  if (through < rentMonth) return null;
  let monthCount = 0;
  for (let month = rentMonth; month <= through && monthCount < 600; month = addMonths(month, 1)) {
    monthCount += 1;
  }
  if (monthCount === 0) return null;
  return {
    fromMonth: rentMonth,
    throughMonth: through,
    monthCount,
    amount: fromPaise(toPaise(monthlyRent) * monthCount),
    label: paidBeforeLabel(open),
  };
}

/**
 * Rent is charged in full from the later of rent_start_date and the books-open month
 * (LEDGER_START_DATE, default 2026-04-01) through asOfMonth.
 * Earlier months, back to rent_start_date, are treated as fully paid with a zero opening balance.
 * That history is one summary line, not payment rows.
 * Confirmed payments (and rows with a null status) apply to for_month, or to the
 * payment_date month when for_month is empty. Unpaid balance and extra payment both
 * carry forward. Payments tagged to a future month stay as advance.
 * Pending and rejected payments are ignored. openingBalance is prior dues at the first charged month.
 */
export function buildLedger(input: {
  monthlyRent: number;
  rentStartDate: string | null;
  asOfMonth: string;
  adjustments?: LedgerAdjustment[];
  payments?: LedgerPayment[];
  openingBalance?: number;
  booksOpenDate?: string;
}): Ledger {
  const asOf = monthStart(input.asOfMonth);
  const open = monthStart(input.booksOpenDate ?? ledgerStartMonth());
  const rentMonth = input.rentStartDate ? monthStart(input.rentStartDate) : null;
  const start = rentMonth && rentMonth > open ? rentMonth : rentMonth ? open : null;
  const rentPaise = toPaise(input.monthlyRent);
  const openingPaise = toPaise(input.openingBalance ?? 0);

  const adjustments = new Map<string, number>();
  for (const adjustment of input.adjustments ?? []) {
    const month = monthOf(adjustment.month);
    if (!month) continue;
    adjustments.set(month, (adjustments.get(month) ?? 0) + toPaise(adjustment.amount));
  }

  const paidByMonth = new Map<string, number>();
  let preStartPaise = 0;
  let advancePaise = 0;

  for (const payment of input.payments ?? []) {
    if (!paymentCounts(payment.status)) continue;
    const source = payment.forMonth || payment.paymentDate;
    const month = monthOf(source);
    if (!month) continue;
    const amount = toPaise(payment.amount);
    if (month < open) continue;
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

  const settledBefore = settledHistory(rentMonth, open, asOf, input.monthlyRent);

  if (!start || start > asOf) {
    const net = -preStartPaise;
    return {
      months: [],
      settledBefore,
      totalCharged: 0,
      totalPaid: fromPaise(preStartPaise),
      advancePaid: fromPaise(advancePaise),
      pending: fromPaise(Math.max(0, net)),
      credit: fromPaise(Math.max(0, -net)),
      pendingMonths: 0,
      partial: false,
    };
  }

  const months: LedgerMonth[] = [];
  let running = openingPaise - preStartPaise;
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
    settledBefore,
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
