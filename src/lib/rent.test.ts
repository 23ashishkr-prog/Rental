import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLedger, pendingLabel } from "./rent";

const rent = 10000;

test("three unpaid months carry forward", () => {
  const ledger = buildLedger({
    monthlyRent: rent,
    rentStartDate: "2026-01-15",
    asOfMonth: "2026-03-01",
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
  });
  assert.deepEqual(
    ledger.months.map((month) => month.month),
    ["2025-12-01", "2026-01-01"],
  );
  assert.equal(ledger.pending, 20000);
});

test("pending label describes partial months", () => {
  assert.equal(pendingLabel(0, false), "Nothing pending");
  assert.equal(pendingLabel(1, true), "Part of 1 month pending");
  assert.equal(pendingLabel(2, false), "2 months pending");
  assert.equal(pendingLabel(3, true), "2 full months + a partial month");
});
