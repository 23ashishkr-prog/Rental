import assert from "node:assert/strict";
import { test } from "node:test";
import { gmailLocalPart, isAdminEmail, normalizeEmail } from "./email";
import { addMonths, monthStart } from "./dates";
import { buildUpiUrl } from "./upi";

test("admin gmail addresses match ignoring dots and case", () => {
  assert.equal(isAdminEmail("sudi.chandra@gmail.com"), true);
  assert.equal(isAdminEmail("Sudi.Chandra@Gmail.com"), true);
  assert.equal(isAdminEmail("sudichandra@gmail.com"), true);
  assert.equal(isAdminEmail("sudi.chandra@googlemail.com"), true);
  assert.equal(isAdminEmail("23.ashish.kr@gmail.com"), true);
  assert.equal(isAdminEmail("23.ashishkr@gmail.com"), true);
  assert.equal(isAdminEmail("23ASHISHKR@gmail.com"), true);
  assert.equal(isAdminEmail("23.ashish.kr@googlemail.com"), true);
});

test("plus tags and other inboxes are not treated as those admins", () => {
  assert.equal(isAdminEmail("sudi.chandra+rent@gmail.com"), false);
  assert.equal(isAdminEmail("tenant@gmail.com"), false);
  assert.equal(isAdminEmail("23.ashish.kr@example.com"), false);
});

test("gmail local part keeps plus tags and drops dots", () => {
  assert.equal(gmailLocalPart("23.Ashish.Kr@gmail.com"), "23ashishkr");
  assert.equal(gmailLocalPart("A.B+tag@googlemail.com"), "ab+tag");
  assert.equal(gmailLocalPart("person@example.com"), null);
  assert.equal(normalizeEmail("  Person@Example.com "), "person@example.com");
});

test("month math crosses years", () => {
  assert.equal(monthStart("2026-11-05"), "2026-11-01");
  assert.equal(addMonths("2026-11-01", 2), "2027-01-01");
  assert.equal(addMonths("2026-01-01", -1), "2025-12-01");
});

test("upi link prefills the payee and amount", () => {
  const url = buildUpiUrl(1500, "Flat A1 Nov 2026");
  assert.equal(url.startsWith("upi://pay?"), true);
  assert.match(url, /pa=9742515588@upi/);
  assert.match(url, /am=1500\.00/);
  assert.match(url, /cu=INR/);
  assert.match(url, /pn=Rent/);
  assert.match(url, /tn=Flat%20A1%20Nov%202026/);
});
