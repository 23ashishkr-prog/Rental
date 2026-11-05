import { AppError } from "./errors";
import { monthStart } from "./dates";
import { roundMoney } from "./money";

export function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function readAmount(formData: FormData, key = "amount"): number {
  const raw = readString(formData, key).replace(/[₹,\s]/g, "");
  if (!raw) throw new AppError("Enter an amount.");
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new AppError("Enter a valid amount.");
  const rounded = roundMoney(value);
  if (rounded <= 0) throw new AppError("Amount must be greater than zero.");
  if (rounded > 10_000_000) throw new AppError("That amount is too large.");
  return rounded;
}

export function readSignedAmount(formData: FormData, key = "amount"): number {
  const raw = readString(formData, key).replace(/[₹,\s]/g, "");
  if (!raw) throw new AppError("Enter an adjustment amount.");
  const value = Number(raw);
  if (!Number.isFinite(value) || roundMoney(value) === 0) {
    throw new AppError("Enter a non-zero amount. Use a negative number for a discount or waiver.");
  }
  const rounded = roundMoney(value);
  if (Math.abs(rounded) > 10_000_000) throw new AppError("That amount is too large.");
  return rounded;
}

export function readDate(formData: FormData, key: string, label: string): string {
  const value = readString(formData, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError(`Choose a valid ${label}.`);
  return value;
}

export function readOptionalDate(formData: FormData, key: string): string | null {
  const value = readString(formData, key);
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError("Choose a valid date.");
  return value;
}

export function readMonthField(formData: FormData, key: string): string {
  const value = readString(formData, key);
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return monthStart(value);
  throw new AppError("Choose a valid month.");
}

export function readId(formData: FormData, key = "id"): number {
  const id = Number(readString(formData, key));
  if (!Number.isInteger(id) || id <= 0) throw new AppError("That record could not be found.");
  return id;
}
