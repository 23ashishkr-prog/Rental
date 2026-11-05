const IST = "Asia/Kolkata";

export function monthStart(input: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(input.trim());
  if (!match) {
    throw new Error("Invalid date");
  }
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error("Invalid date");
  }
  return `${match[1]}-${match[2]}-01`;
}

export function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = monthStart(month).split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}-01`;
}

export function currentMonthKey(now = new Date()): string {
  return `${todayIST(now).slice(0, 7)}-01`;
}

export function todayIST(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function utcCalendar(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

/**
 * Calendar day for a Postgres date or timestamp.
 * Midnight UTC (how a `date` is usually serialized) keeps that calendar day.
 * Any other instant uses Asia/Kolkata, so 00:00 IST is not pushed into the previous month.
 */
export function calendarDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const midnightUtc =
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0 &&
      value.getUTCMilliseconds() === 0;
    return midnightUtc ? utcCalendar(value) : todayIST(value);
  }
  const text = String(value).trim();
  if (!text) return null;
  const storedMidnight = /^(\d{4}-\d{2}-\d{2})(?:[ T]00:00:00(?:\.\d+)?(?:Z|[+-]00:?00)?)?$/.exec(text);
  if (storedMidnight) return storedMidnight[1];
  if (/[tT]/.test(text)) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return todayIST(parsed);
  }
  const prefix = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return prefix ? prefix[1] : null;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatMonth(month: string): string {
  try {
    const [year, monthNumber] = monthStart(month).split("-").map(Number);
    const date = new Date(Date.UTC(year, monthNumber - 1, 1));
    return new Intl.DateTimeFormat("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  } catch {
    return month;
  }
}

export function formatMonthShort(month: string): string {
  try {
    const [year, monthNumber] = monthStart(month).split("-").map(Number);
    const date = new Date(Date.UTC(year, monthNumber - 1, 1));
    return new Intl.DateTimeFormat("en-IN", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  } catch {
    return month;
  }
}

export function isInMonth(date: string, month: string): boolean {
  return date.slice(0, 7) === month.slice(0, 7);
}

export function currentYearIST(now = new Date()): number {
  return Number(todayIST(now).slice(0, 4));
}

export function parseYearParam(raw: string | undefined, fallback = currentYearIST()): number {
  if (raw && /^\d{4}$/.test(raw)) {
    const year = Number(raw);
    if (year >= 2000 && year <= 2100) return year;
  }
  return fallback;
}

export function parseMonthParam(raw: string | undefined, fallback = currentMonthKey()): string {
  if (!raw) return fallback;
  try {
    return monthStart(raw);
  } catch {
    return fallback;
  }
}
