import { ledgerStartMonth } from "./config";
import { addMonths, calendarDate, formatMonthShort, monthStart } from "./dates";
import { fromPaise, roundMoney, toPaise } from "./money";

/** Note written by the app when it keeps the rent from before an increase. Admins do not type this. */
export const PREVIOUS_RENT_NOTE = "Previous rent";

/**
 * First day this app could save `for_month`. Rows created earlier came from the
 * original import, which had no month override.
 */
export const FOR_MONTH_FEATURE_DAY = "2026-11-05";

/** Month the edit form was defaulting to when imported payments were re-saved. */
export const IMPLICIT_FOR_MONTH_STAMP = "2026-11-01";

export type LedgerPayment = {
  forMonth: string | null;
  paymentDate: string;
  amount: number;
  status: string | null;
  /** True when an admin or tenant chose a month other than the payment date. */
  forMonthExplicit?: boolean;
  method?: string | null;
  upiRef?: string | null;
  createdAt?: string | null;
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

export type RentRate = {
  effectiveMonth: string;
  monthlyRent: number;
  note?: string | null;
};

/** Latest increase on or before the month, otherwise the rent stored on the flat. */
export function rentForMonth(month: string, fallback: number, changes: RentRate[] = []): number {
  const key = monthStart(month);
  let selected: { effective: string; rent: number } | null = null;
  for (const change of changes) {
    let effective: string;
    try {
      effective = monthStart(change.effectiveMonth);
    } catch {
      continue;
    }
    if (effective <= key && (!selected || effective >= selected.effective)) {
      selected = { effective, rent: change.monthlyRent };
    }
  }
  return selected ? selected.rent : fallback;
}

export function displayedRent(ledger: Ledger, month: string, fallback: number): number {
  try {
    const key = monthStart(month);
    return ledger.months.find((row) => row.month === key)?.rent ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * When the flat's stored rent is overwritten with the latest increase, keep the previous
 * amount as a change from the rent start so earlier months do not jump to the new rent.
 */
export function baselineRentChange(input: {
  rentStartDate: string | null;
  storedRent: number;
  changes: RentRate[];
}): RentRate | null {
  if (!input.rentStartDate || input.changes.length === 0) return null;
  let start: string;
  try {
    start = monthStart(input.rentStartDate);
  } catch {
    return null;
  }
  let earliest = "";
  for (const change of input.changes) {
    try {
      const month = monthStart(change.effectiveMonth);
      if (!earliest || month < earliest) earliest = month;
    } catch {
      continue;
    }
  }
  if (!earliest || start >= earliest) return null;
  const covered = input.changes.some((change) => {
    try {
      return monthStart(change.effectiveMonth) <= start;
    } catch {
      return false;
    }
  });
  if (covered) return null;
  const earliestRow = input.changes.find((change) => {
    try {
      return monthStart(change.effectiveMonth) === earliest;
    } catch {
      return false;
    }
  });
  let amount = input.storedRent;
  // The flat's stored rent may already have been replaced with the new amount.
  // Copying that amount back to the rent start makes every earlier month use the new rent.
  if (earliestRow && roundMoney(input.storedRent) === roundMoney(earliestRow.monthlyRent)) {
    const others = [
      ...new Set(
        input.changes
          .map((change) => roundMoney(change.monthlyRent))
          .filter((rent) => rent !== roundMoney(input.storedRent)),
      ),
    ];
    if (others.length !== 1) return null;
    amount = others[0];
  }
  if (earliestRow && roundMoney(amount) === roundMoney(earliestRow.monthlyRent)) return null;
  return { effectiveMonth: start, monthlyRent: amount };
}

/**
 * Imported payments have no month override. Re-saving one in the edit form used to
 * store today's month and the default method "UPI" without a UPI reference.
 * That stamp is not an explicit choice. A for_month chosen after the feature
 * existed, or saved with another method or a UPI reference, is left alone.
 */
export function isImplicitForMonthStamp(input: {
  forMonth: string | null;
  paymentDate: string;
  method: string | null;
  upiRef: string | null;
  createdAt: string | null;
}): boolean {
  if (!input.forMonth) return false;
  if ((input.method ?? "").trim().toLowerCase() !== "upi") return false;
  if (input.upiRef?.trim()) return false;
  const created = input.createdAt ? calendarDate(input.createdAt) : null;
  if (!created || created >= FOR_MONTH_FEATURE_DAY) return false;
  try {
    const assigned = monthStart(input.forMonth);
    const paid = monthStart(input.paymentDate);
    return assigned === IMPLICIT_FOR_MONTH_STAMP && assigned !== paid;
  } catch {
    return false;
  }
}

/** Month a payment counts toward: an explicit override, otherwise the payment date. */
export function assignedMonth(payment: {
  forMonth: string | null;
  paymentDate: string;
  forMonthExplicit?: boolean;
  method?: string | null;
  upiRef?: string | null;
  createdAt?: string | null;
}): string | null {
  if (payment.forMonth) {
    const implicit =
      !payment.forMonthExplicit &&
      isImplicitForMonthStamp({
        forMonth: payment.forMonth,
        paymentDate: payment.paymentDate,
        method: payment.method ?? null,
        upiRef: payment.upiRef ?? null,
        createdAt: payment.createdAt ?? null,
      });
    if (!implicit) return monthOf(payment.forMonth);
  }
  return monthOf(payment.paymentDate);
}

export function paymentInMonth(
  payment: {
    forMonth: string | null;
    paymentDate: string;
    forMonthExplicit?: boolean;
    method?: string | null;
    upiRef?: string | null;
    createdAt?: string | null;
  },
  month: string,
): boolean {
  const assigned = assignedMonth(payment);
  if (!assigned) return false;
  return assigned.slice(0, 7) === month.slice(0, 7);
}

/**
 * Code-generated "Previous rent" rows are kept only when they record the rent
 * from before the first admin-entered change. A copy of the new rent onto earlier
 * months, or the old rent parked after that change, is not part of the schedule.
 */
export function effectiveRentChanges<T extends RentRate>(changes: T[]): T[] {
  const user = changes.filter((change) => (change.note ?? "") !== PREVIOUS_RENT_NOTE);
  if (user.length === 0) return changes;
  let earliest = "";
  let earliestRent: number | null = null;
  for (const change of user) {
    try {
      const month = monthStart(change.effectiveMonth);
      if (!earliest || month < earliest) {
        earliest = month;
        earliestRent = change.monthlyRent;
      }
    } catch {
      continue;
    }
  }
  if (!earliest) return changes;
  return changes.filter((change) => {
    if ((change.note ?? "") !== PREVIOUS_RENT_NOTE) return true;
    try {
      const month = monthStart(change.effectiveMonth);
      if (month > earliest) return false;
      if (earliestRent != null && roundMoney(change.monthlyRent) === roundMoney(earliestRent)) return false;
      return true;
    } catch {
      return false;
    }
  });
}

export type RentAmountRepair = { id: number; monthlyRent: number };

/**
 * Corrections for "Previous rent" rows this app wrote. Does not change admin-entered
 * amounts. Returns nothing once the rows already match the schedule.
 */
export function rentChangeAmountRepairs(
  changes: Array<RentRate & { id: number }>,
): RentAmountRepair[] {
  const synthetic = changes.filter((change) => (change.note ?? "") === PREVIOUS_RENT_NOTE);
  const user = changes.filter((change) => (change.note ?? "") !== PREVIOUS_RENT_NOTE);
  if (synthetic.length === 0 || user.length === 0) return [];
  const userAmounts = new Set(user.map((change) => roundMoney(change.monthlyRent)));
  const preserved = [
    ...new Set(synthetic.map((change) => roundMoney(change.monthlyRent)).filter((amount) => !userAmounts.has(amount))),
  ];
  if (preserved.length !== 1) return [];
  const previous = preserved[0];
  let earliest = "";
  for (const change of user) {
    try {
      const month = monthStart(change.effectiveMonth);
      if (!earliest || month < earliest) earliest = month;
    } catch {
      continue;
    }
  }
  if (!earliest) return [];
  const updates: RentAmountRepair[] = [];
  for (const row of synthetic) {
    let month: string;
    try {
      month = monthStart(row.effectiveMonth);
    } catch {
      continue;
    }
    const amount = roundMoney(row.monthlyRent);
    // A generated row before the first admin change should hold the previous rent,
    // not a copy of the new amount. Rows dated after that change are ignored by the
    // ledger, so their amount is left untouched.
    if (month < earliest && userAmounts.has(amount) && amount !== previous) {
      updates.push({ id: row.id, monthlyRent: previous });
    }
  }
  return updates;
}

function settledHistory(
  rentMonth: string | null,
  open: string,
  asOf: string,
  monthlyRent: number,
  changes: RentRate[],
): SettledBefore | null {
  if (!rentMonth || rentMonth >= open) return null;
  const lastSettled = addMonths(open, -1);
  const through = lastSettled < asOf ? lastSettled : asOf;
  if (through < rentMonth) return null;
  let monthCount = 0;
  let amount = 0;
  for (let month = rentMonth; month <= through && monthCount < 600; month = addMonths(month, 1)) {
    monthCount += 1;
    amount += toPaise(rentForMonth(month, monthlyRent, changes));
  }
  if (monthCount === 0) return null;
  return {
    fromMonth: rentMonth,
    throughMonth: through,
    monthCount,
    amount: fromPaise(amount),
    label: paidBeforeLabel(open),
  };
}

/**
 * First month this flat has a ledger row.
 * Nothing is listed before the books-open month. On or after that, the row starts
 * at the earliest of the rent start, a counted payment's assigned month, and a
 * rent change, through asOf. A rent start before the books open still opens the
 * ledger on the books-open month. A payment or rent change before the books open
 * does not. Pending and rejected payments are not activity.
 */
function firstChargedMonth(input: {
  rentMonth: string | null;
  open: string;
  asOf: string;
  payments: LedgerPayment[];
  changes: RentRate[];
}): string | null {
  let earliest: string | null = null;
  const consider = (month: string | null) => {
    if (!month || month < input.open || month > input.asOf) return;
    if (!earliest || month < earliest) earliest = month;
  };
  if (input.rentMonth) consider(input.rentMonth < input.open ? input.open : input.rentMonth);
  for (const payment of input.payments) {
    if (!paymentCounts(payment.status)) continue;
    consider(assignedMonth(payment));
  }
  for (const change of input.changes) consider(monthOf(change.effectiveMonth));
  return earliest;
}

/**
 * Every flat uses the same window. Rent is charged from the earliest of
 * rent_start_date, a confirmed payment, and a rent change, and never before
 * the books-open month (LEDGER_START_DATE, default 2026-04-01), through asOfMonth.
 * A rent start before the books open still begins on that books-open month.
 * Earlier months, back to rent_start_date, are treated as fully paid with a zero opening balance.
 * That history is one summary line, not payment rows.
 * Confirmed payments (and rows with a null status) apply to an explicit for_month,
 * or to the payment_date month when for_month was not chosen. A for_month that the
 * edit form filled in with the current month on an imported row does not count.
 * Unpaid balance and extra payment both carry forward. Payments tagged to a future
 * month stay as advance.
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
  rentChanges?: RentRate[];
}): Ledger {
  const asOf = monthStart(input.asOfMonth);
  const open = monthStart(input.booksOpenDate ?? ledgerStartMonth());
  const rentMonth = input.rentStartDate ? monthStart(input.rentStartDate) : null;
  const changes = effectiveRentChanges(input.rentChanges ?? []);
  const start = firstChargedMonth({
    rentMonth,
    open,
    asOf,
    payments: input.payments ?? [],
    changes,
  });
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
    const month = assignedMonth(payment);
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

  const settledBefore = settledHistory(rentMonth, open, asOf, input.monthlyRent, changes);

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
    const rentPaise = toPaise(rentForMonth(month, input.monthlyRent, changes));
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
