import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { calendarDate } from "./dates";
import { ConfigError } from "./errors";

let client: NeonQueryFunction<false, false> | null = null;

export function sql(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new ConfigError(
        "DATABASE_URL is not set. Add the Neon pooled connection string locally in .env.local and in the Vercel project environment.",
      );
    }
    client = neon(url);
  }
  return client;
}

export function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

/** Blank and missing values stay empty. Zero is kept, so an entered deposit of 0 is not "not set". */
export function asOptionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function asDate(value: unknown): string | null {
  return calendarDate(value);
}

export function asText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

export function isUndefinedColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return candidate.code === "42703" || /password_hash/.test(candidate.message ?? "");
}

export function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "23505");
}

export function missingColumn(error: unknown, column: string): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return candidate.code === "42703" && (candidate.message ?? "").includes(column);
}

export function isForeignKeyViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "23503");
}

export function isUndefinedTable(error: unknown, table: string): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return candidate.code === "42P01" && (candidate.message ?? "").includes(table);
}

let openingBalanceColumnReady = false;
let expenseFlatColumnReady = false;
let rentChangesTableReady = false;

export function markOpeningBalanceReady(): void {
  openingBalanceColumnReady = true;
}

export function openingBalanceColumnIsReady(): boolean {
  return openingBalanceColumnReady;
}

export function markExpenseFlatReady(): void {
  expenseFlatColumnReady = true;
}

export function expenseFlatColumnIsReady(): boolean {
  return expenseFlatColumnReady;
}

export function markRentChangesReady(): void {
  rentChangesTableReady = true;
}

export function rentChangesTableIsReady(): boolean {
  return rentChangesTableReady;
}
