import assert from "node:assert/strict";
import { test } from "node:test";
import { flatMonthFigures, recordPaymentHref, suggestedRecordAmount, summarizeDashboard } from "./dashboard";
import { buildLedger } from "./rent";

const books = "2026-04-01";

test("home totals are the sum of each flat's ledger month, not cash received that month", () => {
  const withAdvance = buildLedger({
    monthlyRent: 20000,
    rentStartDate: "2026-11-01",
    asOfMonth: "2026-11-01",
    booksOpenDate: books,
    openingBalance: 3000,
    payments: [
      { forMonth: null, paymentDate: "2026-11-04", amount: 5000, status: "confirmed" },
      {
        forMonth: "2026-12-01",
        forMonthExplicit: true,
        paymentDate: "2026-11-06",
        amount: 7000,
        status: "confirmed",
      },
      { forMonth: null, paymentDate: "2026-01-15", amount: 9999, status: "confirmed" },
    ],
  });
  const clearedThisMonth = buildLedger({
    monthlyRent: 10000,
    rentStartDate: "2026-10-01",
    asOfMonth: "2026-11-01",
    booksOpenDate: books,
    payments: [
      { forMonth: null, paymentDate: "2026-11-02", amount: 10000, status: "confirmed" },
    ],
  });

  const summary = summarizeDashboard(
    [
      { ledger: withAdvance, securityDeposit: 250000 },
      { ledger: clearedThisMonth, securityDeposit: 1000000 },
    ],
    "2026-11-01",
  );
  const withoutDeposit = summarizeDashboard(
    [{ ledger: withAdvance }, { ledger: clearedThisMonth }],
    "2026-11-01",
  );

  const novemberA = withAdvance.months.find((row) => row.month === "2026-11-01")!;
  const novemberB = clearedThisMonth.months.find((row) => row.month === "2026-11-01")!;
  assert.equal(novemberA.paid, 5000);
  assert.equal(novemberA.charge, 20000);
  assert.equal(novemberA.opening, 3000);
  assert.equal(summary.due, novemberA.charge + novemberB.charge);
  assert.equal(summary.paid, novemberA.paid + novemberB.paid);
  assert.equal(summary.paid, 15000);
  assert.equal(summary.left, 15000);
  assert.equal(summary.earlier, 3000 + 10000);
  assert.equal(summary.total, summary.left + summary.earlier);
  assert.equal(summary.paidThisYear, 15000);
  assert.equal(summary.partialFlats, 1);
  assert.equal(summary.paidFlats, 1);
  assert.equal(summary.unpaidFlats, 0);
  assert.deepEqual(summary, withoutDeposit);
});

test("earlier unpaid is the carried balance, and it is not added twice", () => {
  const ledger = buildLedger({
    monthlyRent: 10000,
    rentStartDate: "2026-04-01",
    asOfMonth: "2026-05-01",
    booksOpenDate: books,
    payments: [{ forMonth: null, paymentDate: "2026-05-03", amount: 4000, status: "confirmed" }],
  });
  const figures = flatMonthFigures(ledger, "2026-05-01");
  const summary = summarizeDashboard([{ ledger }], "2026-05-01");
  assert.equal(figures.due, 10000);
  assert.equal(figures.paid, 4000);
  assert.equal(figures.left, 6000);
  assert.equal(figures.earlier, 10000);
  assert.equal(figures.total, 16000);
  assert.equal(figures.status, "partial");
  assert.equal(summary.earlier, 10000);
  assert.equal(summary.total, 16000);
  assert.equal(summary.partialFlats, 1);
});

test("total still unpaid stays left plus earlier even when an extra payment clears the net balance", () => {
  const ledger = buildLedger({
    monthlyRent: 10000,
    rentStartDate: "2026-04-01",
    asOfMonth: "2026-05-01",
    booksOpenDate: books,
    payments: [{ forMonth: null, paymentDate: "2026-05-08", amount: 25000, status: "confirmed" }],
  });
  const summary = summarizeDashboard([{ ledger, securityDeposit: 50000 }], "2026-05-01");
  assert.equal(ledger.pending, 0);
  assert.equal(summary.left, 0);
  assert.equal(summary.earlier, 10000);
  assert.equal(summary.total, 10000);
  assert.equal(summary.paid, 25000);
  assert.equal(summary.paidFlats, 1);
  assert.equal(summary.progress, 1);
});

test("collection progress ignores extra payment and still counts an unpaid flat", () => {
  const overpaid = buildLedger({
    monthlyRent: 10000,
    rentStartDate: "2026-11-01",
    asOfMonth: "2026-11-01",
    booksOpenDate: books,
    payments: [{ forMonth: null, paymentDate: "2026-11-02", amount: 20000, status: "confirmed" }],
  });
  const unpaid = buildLedger({
    monthlyRent: 10000,
    rentStartDate: "2026-11-01",
    asOfMonth: "2026-11-01",
    booksOpenDate: books,
  });
  const summary = summarizeDashboard([{ ledger: overpaid }, { ledger: unpaid }], "2026-11-01");
  assert.equal(summary.paid, 20000);
  assert.equal(summary.due, 20000);
  assert.equal(summary.left, 10000);
  assert.equal(summary.progress, 0.5);
  assert.equal(summary.paidFlats, 1);
  assert.equal(summary.unpaidFlats, 1);
});

test("a month with no rent due is complete, and the record link prefills what is left", () => {
  const ledger = buildLedger({
    monthlyRent: 8000,
    rentStartDate: "2026-12-01",
    asOfMonth: "2026-11-01",
    booksOpenDate: books,
  });
  const summary = summarizeDashboard([{ ledger }], "2026-11-01");
  assert.equal(summary.due, 0);
  assert.equal(summary.paid, 0);
  assert.equal(summary.progress, 1);
  assert.equal(summary.unpaidFlats, 0);
  const figures = flatMonthFigures(
    buildLedger({
      monthlyRent: 8000,
      rentStartDate: "2026-11-01",
      asOfMonth: "2026-11-01",
      booksOpenDate: books,
      payments: [{ forMonth: null, paymentDate: "2026-11-02", amount: 3000, status: "confirmed" }],
    }),
    "2026-11-01",
  );
  assert.equal(suggestedRecordAmount(figures), 5000);
  assert.equal(recordPaymentHref(12, "2026-11-01", suggestedRecordAmount(figures)), "/payments/new?flat=12&month=2026-11&amount=5000");
});
