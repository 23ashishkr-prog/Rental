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
    <div className="mb-4 flex items-center justify-between gap-2 rounded-[1.75rem] border border-white/80 bg-white/60 p-1.5 shadow-[0_12px_40px_-28px_rgba(92,58,24,0.45)] backdrop-blur-xl">
      <Link
        href={href(addMonths(month, -1))}
        className="grid h-14 min-w-14 place-items-center rounded-2xl text-2xl hover:bg-white/80"
        aria-label="Previous month"
      >
        ‹
      </Link>
      <p className="font-display text-xl font-semibold tracking-tight">{formatMonth(month)}</p>
      <Link
        href={href(addMonths(month, 1))}
        className="grid h-14 min-w-14 place-items-center rounded-2xl text-2xl hover:bg-white/80"
        aria-label="Next month"
      >
        ›
      </Link>
    </div>
  );
}
