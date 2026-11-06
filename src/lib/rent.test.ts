import assert from "node:assert/strict";
import { test } from "node:test";
import {
  baselineRentChange,
  buildLedger,
  isImplicitForMonthStamp,
  monthStanding,
  pendingLabel,
  rentChangeAmountRepairs,
  rentForMonth,
} from "./rent";

const rent = 10000;

const booksOpen = "2000-01-01";

test("three unpaid months carry forward", () => {
  const ledger = buildLedger({
    monthlyRent: rent,
    rentStartDate: "2026-01-15",
    asOfMonth: "2026-03-01",
    booksOpenDate: booksOpen,
  });
  assert.equal(ledger.months.length, 3);
  assert.equal(ledger.pending, 30000);
  assert.equal(ledger.pendingMonths, 3);
  assert.equal(ledger.partial, false);
  assert.equal(ledger.months[2].closing, 30000);
});

test("partial payment leaves one partial month", () => {
  const ledger = buildLedger({
    monthlyRent: rent,
    rentStartDate: "2026-01-01",
    asOfMonth: "2026-03-01",
    booksOpenDate: booksOpen,
    payments: [
      { forMonth: "2026-01-01", paymentDate: "2026-01-05", amount: 25000, status: "confirmed" },
    ],
  });
  assert.equal(ledger.pending, 5000);
  assert.equal(ledger.pendingMonths, 1);
  assert.equal(ledger.partial, true);
});

test("later overpayment clears an earlier unpaid month", () => {
  const ledger = buildLedger({
    monthlyRent: rent,
    rentStartDate: "2026-01-01",
    asOfMonth: "2026-02-01",
    booksOpenDate: booksOpen,
    payments: [
      { forMonth: "2026-02-01", paymentDate: "2026-02-04", amount: 20000, status: "confirmed" },
    ],
  });
  assert.equal(ledger.months[0].closing, 10000);
  assert.equal(ledger.months[1].closing, 0);
  assert.equal(ledger.pending, 0);
  assert.equal(ledger.pendingMonths, 0);
});

test("null for_month falls back to the payment date month", () => {
  const ledger = buildLedger({
    monthlyRent: rent,
    rentStartDate: "2026-04-01",
    asOfMonth: "2026-04-01",
    payments: [{ forMonth: null, paymentDate: "2026-04-18", amount: 10000, status: "confirmed" }],
  });
  assert.equal(ledger.months[0].paid, 10000);
  assert.equal(ledger.pending, 0);
});

test("pending and rejected payments do not reduce the balance", () => {
  const ledger = buildLedger({
    monthlyRent: rent,
    rentStartDate: "2026-04-01",
    asOfMonth: "2026-04-01",
    payments: [
      { forMonth: "2026-04-01", paymentDate: "2026-04-02", amount: 10000, status: "pending" },
      { forMonth: "2026-04-01", paymentDate: "2026-04-03", amount: 10000, status: "rejected" },
    ],
  });
  assert.equal(ledger.pending, 10000);
  assert.equal(ledger.totalPaid, 0);
});

test("a future month payment is advance, not current credit", () => {
  const ledger = buildLedger({
    monthlyRent: rent,
    rentStartDate: "2026-04-01",
    asOfMonth: "2026-04-01",
    payments: [
      { forMonth: "2026-05-01", paymentDate: "2026-04-20", amount: 10000, status: "confirmed" },
    ],
  });
  assert.equal(ledger.pending, 10000);
  assert.equal(ledger.advancePaid, 10000);
  assert.equal(ledger.credit, 0);
});

test("adjustments add to the month and a negative adjustment is a discount", () => {
  const extra = buildLedger({
    monthlyRent: rent,
    rentStartDate: "2026-06-01",
    asOfMonth: "2026-06-01",
    adjustments: [{ month: "2026-06-15", amount: 500 }],
  });
  assert.equal(extra.months[0].charge, 10500);
  assert.equal(extra.pending, 10500);

  const discount = buildLedger({
    monthlyRent: rent,
    rentStartDate: "2026-06-01",
    asOfMonth: "2026-06-01",
    adjustments: [{ month: "2026-06-01", amount: -10000 }],
    payments: [],
  });
  assert.equal(discount.pending, 0);
  assert.equal(discount.months[0].charge, 0);
});

test("rent before the start date is not charged and early payments become credit", () => {
  const ledger = buildLedger({
    monthlyRent: rent,
    rentStartDate: "2026-03-01",
    asOfMonth: "2026-03-01",
    booksOpenDate: booksOpen,
    payments: [
      { forMonth: "2026-01-01", paymentDate: "2026-01-01", amount: 4000, status: "confirmed" },
    ],
  });
  assert.equal(ledger.months.length, 1);
  assert.equal(ledger.pending, 6000);
  assert.equal(ledger.months[0].opening, -4000);
});

test("no start date does not accrue rent", () => {
  const ledger = buildLedger({
    monthlyRent: rent,
    rentStartDate: null,
    asOfMonth: "2026-08-01",
    payments: [
      { forMonth: null, paymentDate: "2026-08-02", amount: 500, status: "confirmed" },
    ],
  });
  assert.equal(ledger.pending, 0);
  assert.equal(ledger.credit, 500);
  assert.equal(ledger.months.length, 0);
});

test("as-of before start has no charge", () => {
  const ledger = buildLedger({
    monthlyRent: rent,
    rentStartDate: "2026-09-01",
    asOfMonth: "2026-01-01",
  });
  assert.equal(ledger.pending, 0);
  assert.equal(ledger.months.length, 0);
});

test("year boundary walks December into January", () => {
  const ledger = buildLedger({
    monthlyRent: rent,
    rentStartDate: "2025-12-01",
    asOfMonth: "2026-01-01",
    booksOpenDate: booksOpen,
  });
  assert.deepEqual(
    ledger.months.map((month) => month.month),
    ["2025-12-01", "2026-01-01"],
  );
  assert.equal(ledger.pending, 20000);
});

test("null status counts as confirmed and a null for_month uses the payment month", () => {
  const ledger = buildLedger({
    monthlyRent: rent,
    rentStartDate: "2025-07-01",
    asOfMonth: "2026-04-01",
    payments: [{ forMonth: null, paymentDate: "2026-04-03T00:00:00.000Z", amount: rent, status: null }],
  });
  assert.equal(ledger.months[0].month, "2026-04-01");
  assert.equal(ledger.months.length, 1);
  assert.equal(ledger.months[0].paid, rent);
  assert.equal(ledger.pending, 0);
});

test("a flat that paid every month since April is clear even if rent started in 2025", () => {
  const payments = ["04-07", "05-01", "06-03", "07-01", "08-02", "09-01", "10-05", "11-02"].map((day) => ({
    forMonth: null,
    paymentDate: `2026-${day}`,
    amount: 23000,
    status: null as string | null,
  }));
  const ledger = buildLedger({
    monthlyRent: 23000,
    rentStartDate: "2026-03-01",
    asOfMonth: "2026-11-01",
    payments,
  });
  assert.equal(ledger.months[0].month, "2026-04-01");
  assert.equal(ledger.months.at(-1)?.month, "2026-11-01");
  assert.equal(ledger.pending, 0);
  const november = ledger.months.at(-1)!;
  assert.equal(november.paid, 23000);
  assert.equal(november.opening, 0);
  assert.equal(ledger.settledBefore?.label, "Paid (before Apr 2026)");
  assert.equal(ledger.settledBefore?.monthCount, 1);
  assert.equal(ledger.settledBefore?.fromMonth, "2026-03-01");
  assert.equal(ledger.months[0].opening, 0);
  assert.equal(monthStanding(ledger, "2026-11-01").status, "paid");
  assert.equal(monthStanding(ledger, "2026-11-01").remaining, 0);
  assert.equal(monthStanding(ledger, "2026-11-01").arrears, 0);
});

test("this month can be paid while earlier arrears remain", () => {
  const ledger = buildLedger({
    monthlyRent: 22000,
    rentStartDate: "2026-07-01",
    asOfMonth: "2026-11-01",
    payments: [
      { forMonth: null, paymentDate: "2026-07-01", amount: 11000, status: "confirmed" },
      { forMonth: null, paymentDate: "2026-08-02", amount: 23000, status: "confirmed" },
      { forMonth: null, paymentDate: "2026-09-02", amount: 20000, status: "confirmed" },
      { forMonth: null, paymentDate: "2026-10-01", amount: 22000, status: "confirmed" },
      { forMonth: null, paymentDate: "2026-11-02", amount: 22000, status: "confirmed" },
    ],
  });
  const november = ledger.months.at(-1)!;
  assert.equal(november.paid, 22000);
  assert.equal(november.opening, 12000);
  assert.equal(ledger.pending, 12000);
  assert.equal(monthStanding(ledger, "2026-11").status, "paid");
  assert.equal(monthStanding(ledger, "2026-11").arrears, 12000);
});

test("months before the books open are one paid summary and do not create arrears", () => {
  const ledger = buildLedger({
    monthlyRent: 14000,
    rentStartDate: "2025-10-01",
    asOfMonth: "2026-11-01",
    payments: [{ forMonth: null, paymentDate: "2026-03-20", amount: 14000, status: "confirmed" }],
  });
  assert.equal(ledger.settledBefore?.label, "Paid (before Apr 2026)");
  assert.equal(ledger.settledBefore?.fromMonth, "2025-10-01");
  assert.equal(ledger.settledBefore?.throughMonth, "2026-03-01");
  assert.equal(ledger.settledBefore?.monthCount, 6);
  assert.equal(ledger.settledBefore?.amount, 84000);
  assert.equal(ledger.months[0].month, "2026-04-01");
  assert.equal(ledger.months[0].opening, 0);
  assert.equal(ledger.pending, 14000 * 8);
});

test("opening balance is prior dues and is not created by months before the books open", () => {
  const ledger = buildLedger({
    monthlyRent: 14000,
    rentStartDate: "2025-10-01",
    asOfMonth: "2026-04-01",
    openingBalance: 14000,
    payments: [{ forMonth: null, paymentDate: "2026-04-09", amount: 14000, status: "confirmed" }],
  });
  assert.deepEqual(
    ledger.months.map((month) => month.month),
    ["2026-04-01"],
  );
  assert.equal(ledger.months[0].opening, 14000);
  assert.equal(ledger.pending, 14000);
});

test("midnight IST does not move a payment into the previous month", () => {
  const ledger = buildLedger({
    monthlyRent: rent,
    rentStartDate: "2026-04-01",
    asOfMonth: "2026-04-01",
    payments: [
      {
        forMonth: null,
        paymentDate: "2026-03-31T18:30:00.000Z",
        amount: rent,
        status: "confirmed",
      },
    ],
  });
  assert.equal(ledger.months[0].paid, rent);
  assert.equal(ledger.pending, 0);
});

test("rent for a month follows the latest increase on or before it", () => {
  const changes = [
    { effectiveMonth: "2026-05-15", monthlyRent: 12000 },
    { effectiveMonth: "2026-07-01", monthlyRent: 13000 },
  ];
  assert.equal(rentForMonth("2026-04-01", 10000, changes), 10000);
  assert.equal(rentForMonth("2026-05-01", 10000, changes), 12000);
  assert.equal(rentForMonth("2026-06-01", 10000, changes), 12000);
  assert.equal(rentForMonth("2026-08-01", 10000, changes), 13000);
});

test("paying the old rent after an increase leaves that month short", () => {
  const ledger = buildLedger({
    monthlyRent: 10000,
    rentStartDate: "2026-04-01",
    asOfMonth: "2026-06-01",
    rentChanges: [{ effectiveMonth: "2026-05-01", monthlyRent: 12000 }],
    payments: [
      { forMonth: null, paymentDate: "2026-04-03", amount: 10000, status: "confirmed" },
      { forMonth: null, paymentDate: "2026-05-04", amount: 10000, status: "confirmed" },
      { forMonth: null, paymentDate: "2026-06-02", amount: 12000, status: "confirmed" },
    ],
  });
  assert.equal(ledger.months[0].rent, 10000);
  assert.equal(ledger.months[0].closing, 0);
  assert.equal(ledger.months[1].rent, 12000);
  assert.equal(ledger.months[1].paid, 10000);
  assert.equal(monthStanding(ledger, "2026-05-01").status, "partial");
  assert.equal(monthStanding(ledger, "2026-05-01").remaining, 2000);
  assert.equal(ledger.months[2].rent, 12000);
  assert.equal(ledger.pending, 2000);
});

test("keeping the latest rent on the flat does not rewrite earlier months", () => {
  const baseline = baselineRentChange({
    rentStartDate: "2026-04-01",
    storedRent: 10000,
    changes: [{ effectiveMonth: "2026-06-01", monthlyRent: 12000 }],
  });
  assert.deepEqual(baseline, { effectiveMonth: "2026-04-01", monthlyRent: 10000 });
  assert.equal(
    baselineRentChange({
      rentStartDate: "2026-04-01",
      storedRent: 10000,
      changes: [
        { effectiveMonth: "2026-04-01", monthlyRent: 10000 },
        { effectiveMonth: "2026-06-01", monthlyRent: 12000 },
      ],
    }),
    null,
  );
});

test("imported april and may payments are not pulled into the current month", () => {
  const changes = [
    { id: 1, effectiveMonth: "2026-07-01", monthlyRent: 4000, note: "increase" },
    { id: 2, effectiveMonth: "2026-11-01", monthlyRent: 21000, note: "Previous rent" },
    { id: 3, effectiveMonth: "2025-07-01", monthlyRent: 4000, note: "Previous rent" },
  ];
  assert.deepEqual(rentChangeAmountRepairs(changes), [{ id: 3, monthlyRent: 21000 }]);
  const payments = [
    ["2026-04-04", "2026-04-07T07:38:50.560Z"],
    ["2026-05-03", "2026-05-03T02:38:13.098Z"],
  ].map(([paymentDate, createdAt]) => ({
    forMonth: "2026-11-01",
    paymentDate,
    amount: 21000,
    status: "confirmed" as const,
    method: "UPI",
    upiRef: null,
    createdAt,
  }));
  assert.equal(isImplicitForMonthStamp(payments[0]), true);
  assert.equal(isImplicitForMonthStamp(payments[1]), true);
  assert.equal(
    isImplicitForMonthStamp({
      forMonth: "2026-12-01",
      paymentDate: "2026-11-06",
      method: "UPI",
      upiRef: null,
      createdAt: "2026-11-06T04:00:00.000Z",
    }),
    false,
  );
  const ledger = buildLedger({
    monthlyRent: 21000,
    rentStartDate: "2025-07-01",
    asOfMonth: "2026-11-01",
    rentChanges: changes,
    payments: [
      ...payments,
      { forMonth: null, paymentDate: "2026-06-04", amount: 21000, status: "confirmed" },
      { forMonth: null, paymentDate: "2026-07-05", amount: 22000, status: "confirmed" },
      { forMonth: null, paymentDate: "2026-08-04", amount: 25000, status: "confirmed" },
      { forMonth: null, paymentDate: "2026-09-07", amount: 25000, status: "confirmed" },
      { forMonth: null, paymentDate: "2026-10-03", amount: 25000, status: "confirmed" },
      { forMonth: null, paymentDate: "2026-11-04", amount: 25000, status: "confirmed" },
    ],
  });
  const row = (month: string) => ledger.months.find((item) => item.month === month);
  assert.equal(ledger.settledBefore?.monthCount, 9);
  assert.equal(ledger.settledBefore?.amount, 189000);
  assert.equal(row("2026-04-01")?.rent, 21000);
  assert.equal(row("2026-04-01")?.paid, 21000);
  assert.equal(row("2026-05-01")?.rent, 21000);
  assert.equal(row("2026-05-01")?.paid, 21000);
  assert.equal(row("2026-06-01")?.paid, 21000);
  assert.equal(row("2026-10-01")?.rent, 4000);
  assert.equal(row("2026-10-01")?.paid, 25000);
  assert.equal(row("2026-11-01")?.rent, 4000);
  assert.equal(row("2026-11-01")?.paid, 25000);
});

test("an explicit month chosen after the import still overrides the payment date", () => {
  const ledger = buildLedger({
    monthlyRent: 21000,
    rentStartDate: "2026-04-01",
    asOfMonth: "2026-11-01",
    payments: [
      {
        forMonth: "2026-11-01",
        forMonthExplicit: true,
        paymentDate: "2026-04-04",
        amount: 21000,
        status: "confirmed",
        method: "UPI",
        upiRef: null,
        createdAt: "2026-04-07T07:38:50.560Z",
      },
    ],
  });
  assert.equal(ledger.months.find((month) => month.month === "2026-04-01")?.paid, 0);
  assert.equal(ledger.months.find((month) => month.month === "2026-11-01")?.paid, 21000);
});

test("replacing the flat rent does not copy that new amount onto the months before it", () => {
  assert.deepEqual(
    baselineRentChange({
      rentStartDate: "2025-07-01",
      storedRent: 4000,
      changes: [
        { effectiveMonth: "2026-07-01", monthlyRent: 4000, note: "increase" },
        { effectiveMonth: "2026-11-01", monthlyRent: 21000, note: "Previous rent" },
      ],
    }),
    { effectiveMonth: "2025-07-01", monthlyRent: 21000 },
  );
});

test("pending label describes partial months", () => {
  assert.equal(pendingLabel(0, false), "Nothing pending");
  assert.equal(pendingLabel(1, true), "Part of 1 month pending");
  assert.equal(pendingLabel(2, false), "2 months pending");
  assert.equal(pendingLabel(3, true), "2 full months + a partial month");
});
