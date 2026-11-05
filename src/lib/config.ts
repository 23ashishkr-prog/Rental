import { monthStart } from "./dates";
import { ConfigError } from "./errors";

/** Books do not charge rent before this month. Override with LEDGER_START_DATE. */
export const DEFAULT_LEDGER_START = "2026-04-01";

/**
 * First month that can accrue rent, from LEDGER_START_DATE or the default.
 * Each flat's ledger then starts at the later of this month and its own rent_start_date.
 */
export function ledgerStartMonth(): string {
  const raw = process.env.LEDGER_START_DATE?.trim();
  if (!raw) return monthStart(DEFAULT_LEDGER_START);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ConfigError(
      `LEDGER_START_DATE must be YYYY-MM-DD (received "${raw}"). Rent is not charged before this month. The default is ${DEFAULT_LEDGER_START}.`,
    );
  }
  try {
    return monthStart(raw);
  } catch {
    throw new ConfigError(
      `LEDGER_START_DATE must be a real date. The default is ${DEFAULT_LEDGER_START}.`,
    );
  }
}
