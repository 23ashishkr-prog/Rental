import assert from "node:assert/strict";
import { test } from "node:test";
import { buildProfitReport, formatRate } from "./profit";

test("profit ignores months before the books open and excludes personal costs", () => {
  const report = buildProfitReport({
    year: 2026,
    today: "2026-04-20",
    includePersonal: false,
    flats: [
      {
        id: 1,
        unitNumber: "701",
        tenantName: "A",
        monthlyRent: 23000,
        rentStartDate: "2026-03-01",
        active: true,
      },
    ],
    payments: [{ flatId: 1, forMonth: null, paymentDate: "2026-04-07", amount: 23000, status: null }],
    adjustments: [],
    expenses: [
      { flatId: 1, category: "Repairs", amount: 3000, expenseDate: "2026-04-10", title: "Tap" },
      { flatId: null, category: "Staff", amount: 8000, expenseDate: "2026-04-01", title: "Salary" },
      { flatId: null, category: "Personal", amount: 500, expenseDate: "2026-04-02", title: "Draw" },
    ],
  });
  assert.deepEqual(report.months, ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"]);
  assert.equal(report.flats[0].due, 23000);
  assert.equal(report.flats[0].collected, 23000);
  assert.equal(report.flats[0].expenses, 3000);
  assert.equal(report.flats[0].net, 20000);
  assert.equal(report.flats[0].lowCollection, false);
  assert.equal(report.totals.overhead, 8000);
  assert.equal(report.totals.personal, 500);
  assert.equal(report.totals.net, 12000);
  assert.equal(formatRate(report.totals.collected, report.totals.due), "100%");
  assert.equal(report.categories.some((category) => category.category === "Personal"), false);
});

test("a flat under 80% collected is flagged", () => {
  const report = buildProfitReport({
    year: 2026,
    today: "2026-05-02",
    includePersonal: false,
    flats: [
      {
        id: 2,
        unitNumber: "201",
        tenantName: null,
        monthlyRent: 10000,
        rentStartDate: "2025-09-01",
        active: true,
      },
    ],
    payments: [{ flatId: 2, forMonth: null, paymentDate: "2026-04-02", amount: 10000, status: "confirmed" }],
    adjustments: [],
    expenses: [],
  });
  assert.equal(report.flats[0].due, 20000);
  assert.equal(report.flats[0].collected, 10000);
  assert.equal(report.flats[0].lowCollection, true);
  assert.equal(report.months[0], "2026-01-01");
  assert.equal(report.trend[3].collected, 10000);
});
