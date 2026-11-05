import { isPersonalCategory } from "./categories";
import { toCsv } from "./csv";
import { addMonths, monthStart } from "./dates";
import { fromPaise, toPaise } from "./money";
import { buildLedger } from "./rent";

export function includedMonths(year: number, today: string): string[] {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return [];
  const currentYear = Number(today.slice(0, 4));
  if (!Number.isFinite(currentYear) || year > currentYear) return [];
  const last = year < currentYear ? `${year}-12-01` : `${today.slice(0, 7)}-01`;
  const months: string[] = [];
  for (let month = `${year}-01-01`; month <= last && months.length < 12; month = addMonths(month, 1)) {
    months.push(month);
  }
  return months;
}

export type ProfitFlatInput = {
  id: number;
  unitNumber: string;
  tenantName: string | null;
  monthlyRent: number;
  rentStartDate: string | null;
  active: boolean;
  openingBalance?: number;
};

export type ProfitPaymentInput = {
  flatId: number;
  forMonth: string | null;
  paymentDate: string;
  amount: number;
  status: string | null;
};

export type ProfitAdjustmentInput = {
  flatId: number;
  month: string;
  amount: number;
};

export type ProfitExpenseInput = {
  flatId: number | null;
  category: string | null;
  amount: number;
  expenseDate: string;
  title: string;
};

export type ProfitFlatRow = {
  id: number;
  unitNumber: string;
  tenantName: string | null;
  active: boolean;
  due: number;
  collected: number;
  expenses: number;
  net: number;
  rate: number | null;
  lowCollection: boolean;
  topCost: boolean;
};

export type ProfitCategory = {
  category: string;
  amount: number;
  share: number;
};

export type ProfitMonth = {
  month: string;
  collected: number;
  expenses: number;
};

export type ProfitReport = {
  year: number;
  months: string[];
  includePersonal: boolean;
  flats: ProfitFlatRow[];
  totals: {
    due: number;
    collected: number;
    flatExpenses: number;
    overhead: number;
    personal: number;
    net: number;
    rate: number | null;
  };
  categories: ProfitCategory[];
  trend: ProfitMonth[];
  lowCollection: ProfitFlatRow[];
  topCategory: ProfitCategory | null;
};

function inMonths(date: string, months: Set<string>): boolean {
  try {
    return months.has(monthStart(date));
  } catch {
    return false;
  }
}

function lowRate(collectedPaise: number, duePaise: number): boolean {
  return duePaise > 0 && collectedPaise * 10 < duePaise * 8;
}

export function formatRate(collected: number, due: number): string {
  const duePaise = toPaise(due);
  if (duePaise <= 0) return "—";
  return `${Math.round((toPaise(collected) * 100) / duePaise)}%`;
}

export function buildProfitReport(input: {
  year: number;
  today: string;
  includePersonal: boolean;
  flats: ProfitFlatInput[];
  payments: ProfitPaymentInput[];
  adjustments: ProfitAdjustmentInput[];
  expenses: ProfitExpenseInput[];
}): ProfitReport {
  const months = includedMonths(input.year, input.today);
  const monthSet = new Set(months);
  const asOf = months.at(-1) ?? `${input.year - 1}-12-01`;

  const inRange = input.expenses.filter((expense) => inMonths(expense.expenseDate, monthSet));
  const personal = inRange.filter((expense) => isPersonalCategory(expense.category));
  const business = input.includePersonal ? inRange : inRange.filter((expense) => !isPersonalCategory(expense.category));
  const personalPaise = personal.reduce((sum, expense) => sum + toPaise(expense.amount), 0);

  const known = new Set(input.flats.map((flat) => flat.id));
  let overheadPaise = 0;
  const categoryPaise = new Map<string, number>();
  const expenseByMonth = new Map<string, number>();
  const expenseByFlat = new Map<number, number>();

  for (const expense of business) {
    const paise = toPaise(expense.amount);
    let bucketMonth: string | null = null;
    try {
      bucketMonth = monthStart(expense.expenseDate);
    } catch {
      bucketMonth = null;
    }
    if (bucketMonth) expenseByMonth.set(bucketMonth, (expenseByMonth.get(bucketMonth) ?? 0) + paise);
    const label = expense.category?.trim() || "Other";
    categoryPaise.set(label, (categoryPaise.get(label) ?? 0) + paise);
    if (expense.flatId != null && known.has(expense.flatId)) {
      expenseByFlat.set(expense.flatId, (expenseByFlat.get(expense.flatId) ?? 0) + paise);
    } else {
      overheadPaise += paise;
    }
  }

  const collectedByMonth = new Map<string, number>();
  const rows: ProfitFlatRow[] = [];
  let duePaise = 0;
  let collectedPaise = 0;

  for (const flat of input.flats) {
    const ledger = buildLedger({
      monthlyRent: flat.monthlyRent,
      rentStartDate: flat.rentStartDate,
      openingBalance: flat.openingBalance,
      asOfMonth: asOf,
      adjustments: input.adjustments.filter((item) => item.flatId === flat.id),
      payments: input.payments.filter((item) => item.flatId === flat.id),
    });
    let flatDue = 0;
    let flatCollected = 0;
    for (const line of ledger.months) {
      if (!monthSet.has(line.month)) continue;
      flatDue += toPaise(line.charge);
      flatCollected += toPaise(line.paid);
      collectedByMonth.set(line.month, (collectedByMonth.get(line.month) ?? 0) + toPaise(line.paid));
    }
    const linked = expenseByFlat.get(flat.id) ?? 0;
    const touched =
      flat.active ||
      flatDue > 0 ||
      flatCollected > 0 ||
      linked > 0 ||
      inRange.some((expense) => expense.flatId === flat.id);
    if (!touched) continue;
    const due = fromPaise(flatDue);
    const collected = fromPaise(flatCollected);
    rows.push({
      id: flat.id,
      unitNumber: flat.unitNumber,
      tenantName: flat.tenantName,
      active: flat.active,
      due,
      collected,
      expenses: fromPaise(linked),
      net: fromPaise(flatCollected - linked),
      rate: flatDue > 0 ? flatCollected / flatDue : null,
      lowCollection: lowRate(flatCollected, flatDue),
      topCost: false,
    });
    duePaise += flatDue;
    collectedPaise += flatCollected;
  }

  rows.sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, "en", { numeric: true }) || a.id - b.id);
  const topExpense = rows.reduce((max, row) => Math.max(max, toPaise(row.expenses)), 0);
  if (topExpense > 0) {
    for (const row of rows) row.topCost = toPaise(row.expenses) === topExpense;
  }

  const businessPaise = overheadPaise + [...expenseByFlat.values()].reduce((sum, value) => sum + value, 0);
  const categories = [...categoryPaise.entries()]
    .map(([category, amount]) => ({
      category,
      amount: fromPaise(amount),
      share: businessPaise > 0 ? amount / businessPaise : 0,
    }))
    .sort((a, b) => toPaise(b.amount) - toPaise(a.amount) || a.category.localeCompare(b.category));

  const flatExpensePaise = [...expenseByFlat.values()].reduce((sum, value) => sum + value, 0);

  return {
    year: input.year,
    months,
    includePersonal: input.includePersonal,
    flats: rows,
    totals: {
      due: fromPaise(duePaise),
      collected: fromPaise(collectedPaise),
      flatExpenses: fromPaise(flatExpensePaise),
      overhead: fromPaise(overheadPaise),
      personal: input.includePersonal ? 0 : fromPaise(personalPaise),
      net: fromPaise(collectedPaise - flatExpensePaise - overheadPaise),
      rate: duePaise > 0 ? collectedPaise / duePaise : null,
    },
    categories,
    trend: months.map((month) => ({
      month,
      collected: fromPaise(collectedByMonth.get(month) ?? 0),
      expenses: fromPaise(expenseByMonth.get(month) ?? 0),
    })),
    lowCollection: rows.filter((row) => row.lowCollection),
    topCategory: categories[0] && toPaise(categories[0].amount) > 0 ? categories[0] : null,
  };
}

export function profitCsv(report: ProfitReport): string {
  const headers = ["Section", "Name", "Detail", "Due INR", "Collected INR", "Expenses INR", "Overhead INR", "Net INR", "Rate", "Share"];
  const rows: Array<Array<string | number | null>> = report.flats.map((flat) => [
    "Flat",
    flat.unitNumber,
    flat.tenantName,
    flat.due,
    flat.collected,
    flat.expenses,
    "",
    flat.net,
    formatRate(flat.collected, flat.due),
    flat.lowCollection ? "Low collection" : flat.topCost ? "Top cost" : "",
  ]);
  rows.push([
    "Total",
    String(report.year),
    report.includePersonal ? "Personal included" : "Personal excluded",
    report.totals.due,
    report.totals.collected,
    report.totals.flatExpenses,
    report.totals.overhead,
    report.totals.net,
    formatRate(report.totals.collected, report.totals.due),
    "",
  ]);
  for (const category of report.categories) {
    rows.push(["Category", category.category, "", "", "", category.amount, "", "", "", Math.round(category.share * 100)]);
  }
  for (const month of report.trend) {
    rows.push(["Month", month.month.slice(0, 7), "", "", month.collected, month.expenses, "", "", "", ""]);
  }
  return toCsv(headers, rows);
}
