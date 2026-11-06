import { formatINR } from "@/lib/money";
import { formatMonth } from "@/lib/dates";
import type { DashboardSummary } from "@/lib/dashboard";
import { glassClass } from "@/components/ui-bits";

export function MonthSummary({ summary, month }: { summary: DashboardSummary; month: string }) {
  const percent = Math.round(summary.progress * 100);
  const monthClear = summary.left <= 0;
  const allClear = monthClear && summary.earlier <= 0;
  const year = month.slice(0, 4);

  return (
    <section
      className={`${glassClass} px-5 py-5 ${
        allClear ? "bg-emerald-50/75" : monthClear ? "bg-amber-50/70" : "bg-white/55"
      }`}
    >
      <p className="text-sm font-semibold tracking-wide text-emerald-900/80">This month · {formatMonth(month)}</p>
      <p className="mt-4 text-sm font-medium text-foreground/80">Left to collect this month</p>
      <p
        className={`font-display mt-1 text-5xl leading-none font-semibold tracking-tight ${
          monthClear ? "text-emerald-800" : "text-rose-700"
        }`}
      >
        {formatINR(summary.left)}
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/70 px-3 py-3">
          <dt className="text-sm text-muted-foreground">Due this month</dt>
          <dd className="font-display mt-1 text-2xl font-semibold tracking-tight">{formatINR(summary.due)}</dd>
        </div>
        <div className="rounded-2xl bg-emerald-50/80 px-3 py-3">
          <dt className="text-sm text-emerald-900/80">Paid this month</dt>
          <dd className="font-display mt-1 text-2xl font-semibold tracking-tight text-emerald-800">{formatINR(summary.paid)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-muted-foreground">Paid is money for this month. Money that arrived this month for a different month is not included here.</p>
      <div
        className="mt-4 h-3 overflow-hidden rounded-full bg-rose-200/80"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="How much of this month's rent is paid"
      >
        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${percent}%` }} />
      </div>
      <p className={`mt-2 text-sm font-medium ${summary.progress >= 1 ? "text-emerald-800" : "text-foreground/80"}`}>
        {summary.due <= 0
          ? "Nothing is due this month"
          : summary.left <= 0
            ? "All of this month's rent is paid"
            : `${percent}% of this month's rent is paid`}
      </p>

      <div className="mt-5 space-y-3 border-t border-foreground/10 pt-4">
        <div className="flex items-end justify-between gap-3">
          <p className="text-sm font-medium">Still unpaid from earlier months</p>
          <p className={`font-display text-2xl font-semibold ${summary.earlier > 0 ? "text-rose-700" : "text-emerald-800"}`}>
            {formatINR(summary.earlier)}
          </p>
        </div>
        <div className="flex items-end justify-between gap-3 rounded-2xl bg-white/75 px-3 py-3">
          <div>
            <p className="text-sm font-semibold">Total still unpaid</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Left this month plus earlier unpaid</p>
          </div>
          <p className={`font-display text-3xl font-semibold tracking-tight ${summary.total > 0 ? "text-rose-700" : "text-emerald-800"}`}>
            {formatINR(summary.total)}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Paid toward {year} so far {formatINR(summary.paidThisYear)}
        </p>
      </div>
    </section>
  );
}
