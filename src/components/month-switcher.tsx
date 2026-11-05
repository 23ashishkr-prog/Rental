import Link from "next/link";
import { addMonths, formatMonth } from "@/lib/dates";

export function MonthSwitcher({
  month,
  path,
  extra,
}: {
  month: string;
  path: string;
  extra?: Record<string, string | undefined>;
}) {
  function href(next: string) {
    const params = new URLSearchParams();
    params.set("month", next.slice(0, 7));
    for (const [key, value] of Object.entries(extra ?? {})) {
      if (value) params.set(key, value);
    }
    return `${path}?${params.toString()}`;
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl bg-card p-2 ring-1 ring-foreground/10">
      <Link href={href(addMonths(month, -1))} className="grid h-11 min-w-11 place-items-center rounded-xl text-lg hover:bg-muted" aria-label="Previous month">
        ‹
      </Link>
      <p className="font-display text-lg font-semibold">{formatMonth(month)}</p>
      <Link href={href(addMonths(month, 1))} className="grid h-11 min-w-11 place-items-center rounded-xl text-lg hover:bg-muted" aria-label="Next month">
        ›
      </Link>
    </div>
  );
}
