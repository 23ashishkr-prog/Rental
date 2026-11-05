import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_LEDGER_START, ledgerStartMonth } from "./config";

test("ledger start comes from one setting and defaults to April 2026", () => {
  const previous = process.env.LEDGER_START_DATE;
  try {
    delete process.env.LEDGER_START_DATE;
    assert.equal(DEFAULT_LEDGER_START, "2026-04-01");
    assert.equal(ledgerStartMonth(), "2026-04-01");
    process.env.LEDGER_START_DATE = "2024-06-15";
    assert.equal(ledgerStartMonth(), "2024-06-01");
  } finally {
    if (previous === undefined) delete process.env.LEDGER_START_DATE;
    else process.env.LEDGER_START_DATE = previous;
  }
});
