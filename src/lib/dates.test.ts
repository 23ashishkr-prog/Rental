import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarDate } from "./dates";

test("a date stored at UTC midnight keeps its calendar day", () => {
  assert.equal(calendarDate("2026-04-03T00:00:00.000Z"), "2026-04-03");
  assert.equal(calendarDate("2026-04-01 00:00:00"), "2026-04-01");
  assert.equal(calendarDate(new Date("2026-11-02T00:00:00.000Z")), "2026-11-02");
});

test("midnight in India is not the previous month", () => {
  assert.equal(calendarDate("2026-03-31T18:30:00.000Z"), "2026-04-01");
  assert.equal(calendarDate(new Date("2026-03-31T18:30:00.000Z")), "2026-04-01");
});
