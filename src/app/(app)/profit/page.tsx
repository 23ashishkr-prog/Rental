import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { formatMonthShort, parseYearParam, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { expenseFlatColumnExists, queryAdjustments, queryExpenses, queryFlats, queryPayments, queryRentChanges } from "@/lib/queries";
import { buildProfitReport, formatRate, type ProfitReport } from "@/lib/profit";
import { one } from "@/lib/search";
import { PageHeader, Stat, buttonLinkClass } from "@/components/ui-bits";

export const dynamic = "force-dynamic";

export default async function ProfitPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  const params = await searchParams;
  const year = parseYearParam(one(params.year));
  const includePersonal = one(params.personal) === "1";
  const linked = await expenseFlatColumnExists();
  if (!linked) {
    return (
      <div>
        <PageHeader
          title="Profit by flat"
          subtitle="Run one additive migration so overhead is not mixed into every flat."
        />
        <pre className="overflow-x-auto rounded-2xl bg-card p-4 text-xs leading-6 ring-1 ring-foreground/10">{`ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS flat_id bigint REFERENCES public.flats (id);`}</pre>
        <p className="mt-3 text-sm text-muted-foreground">The same statement is in migrations/002_expense_flat.sql. Existing expenses stay, with no flat attached.</p>
      </div>
    );
  }

  const flats = await queryFlats(actor, { active: "all" });
  const flatIds = flats.map((flat) => flat.id);
  const [payments, adjustments, expenses, rentChanges] = await Promise.all([
    queryPayments(actor, { limit: null }),
    queryAdjustments(actor, flatIds),
    queryExpenses(actor, { year, limit: null }),
    queryRentChanges(actor, flatIds),
  ]);
  const report = buildProfitReport({
    year,
    today: todayIST(),
    includePersonal,
    flats: flats.map((flat) => ({
      ...flat,
      rentChanges: rentChanges
        .filter((change) => change.flatId === flat.id)
        .map((change) => ({
          effectiveMonth: change.effectiveMonth,
          monthlyRent: change.monthlyRent,
          note: change.note,
        })),
    })),
    payments,
    adjustments,
    expenses,
  });

  return (
    <div>
      <PageHeader
        title={`Profit ${year}`}
        subtitle={includePersonal ? "Personal spending is included" : "Personal spending is excluded"}
        action={
          <a href={`/api/profit?year=${year}${includePersonal ? "&personal=1" : ""}`} className={buttonLinkClass("secondary")}>
            CSV
          </a>
        }
      />
      <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl bg-card p-2 ring-1 ring-foreground/10">
        <Link href={yearHref(year - 1, includePersonal)} className="grid h-11 min-w-11 place-items-center rounded-xl text-lg hover:bg-muted" aria-label="Previous year">
          ‹
        </Link>
        <p className="font-display text-lg font-semibold">{year}</p>
        <Link href={yearHref(year + 1, includePersonal)} className="grid h-11 min-w-11 place-items-center rounded-xl text-lg hover:bg-muted" aria-label="Next year">
          ›
        </Link>
      </div>
      <p className="mb-4 text-sm">
        <Link href={yearHref(year, !includePersonal)} className="font-medium text-primary">
          {includePersonal ? "Hide personal" : "Include personal"}
        </Link>
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Collected" value={formatINR(report.totals.collected)} hint="Applied to this year's rent" tone="good" />
        <Stat label="Flat expenses" value={formatINR(report.totals.flatExpenses)} />
        <Stat label="Overhead" value={formatINR(report.totals.overhead)} hint="Not linked to a flat" />
        <Stat
          label="Net profit"
          value={formatINR(report.totals.net)}
          tone={report.totals.net >= 0 ? "good" : "warn"}
        />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Collection {formatRate(report.totals.collected, report.totals.due)} of {formatINR(report.totals.due)} due.
        {report.totals.personal > 0 ? ` Personal left out: ${formatINR(report.totals.personal)}.` : ""}
      </p>

      {report.lowCollection.length > 0 || report.topCategory ? (
        <section className="mt-5 space-y-2">
          <h2 className="font-display text-xl font-semibold">Watch</h2>
          {report.lowCollection.map((flat) => (
            <p key={flat.id} className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200">
              <Link href={`/flats/${flat.id}`} className="font-semibold">
                {flat.unitNumber}
              </Link>{" "}
              collected {formatRate(flat.collected, flat.due)}. Under 80% of rent due.
            </p>
          ))}
          {report.topCategory ? (
            <p className="rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-foreground/10">
              Largest cost is {report.topCategory.category}, {formatINR(report.topCategory.amount)} (
              {Math.round(report.topCategory.share * 100)}%).
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 font-display text-xl font-semibold">By flat</h2>
        <div className="space-y-2 md:hidden">
          {report.flats.map((flat) => (
            <FlatCard key={flat.id} flat={flat} />
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-2xl bg-card ring-1 ring-foreground/10 md:block">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-3 font-medium">Flat</th>
                <th className="px-3 py-3 font-medium">Collected</th>
                <th className="px-3 py-3 font-medium">Expenses</th>
                <th className="px-3 py-3 font-medium">Net</th>
                <th className="px-3 py-3 font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {report.flats.map((flat) => (
                <tr key={flat.id} className={`border-t border-foreground/10 ${flat.lowCollection ? "bg-amber-50" : ""}`}>
                  <td className="px-3 py-3">
                    <Link href={`/flats/${flat.id}`} className="font-medium">
                      {flat.unitNumber}
                    </Link>
                    {flat.lowCollection ? <span className="mt-0.5 block text-xs text-amber-800">Low collection</span> : null}
                    {flat.topCost ? <span className="mt-0.5 block text-xs text-rose-800">Highest flat cost</span> : null}
                  </td>
                  <td className="px-3 py-3">{formatINR(flat.collected)}</td>
                  <td className="px-3 py-3">{formatINR(flat.expenses)}</td>
                  <td className="px-3 py-3">{formatINR(flat.net)}</td>
                  <td className="px-3 py-3">{formatRate(flat.collected, flat.due)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 font-display text-xl font-semibold">By category</h2>
        {report.categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No business expenses in this year yet.</p>
        ) : (
          <ul className="space-y-2">
            {report.categories.map((category) => (
              <li key={category.category} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">{category.category}</p>
                  <p className="font-display text-lg font-semibold">{formatINR(category.amount)}</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, Math.round(category.share * 100))}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{Math.round(category.share * 100)}% of expenses</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 font-display text-xl font-semibold">Month by month</h2>
        <ul className="space-y-2">
          {report.trend.map((month) => {
            const max = Math.max(month.collected, month.expenses, 1);
            return (
              <li key={month.month} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
                <p className="font-medium">{formatMonthShort(month.month)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Collected {formatINR(month.collected)} · Expenses {formatINR(month.expenses)}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-teal-700" style={{ width: `${(month.collected / max) * 100}%` }} />
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-amber-700" style={{ width: `${(month.expenses / max) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function yearHref(year: number, personal: boolean): string {
  const params = new URLSearchParams();
  params.set("year", String(year));
  if (personal) params.set("personal", "1");
  return `/profit?${params.toString()}`;
}

function FlatCard({ flat }: { flat: ProfitReport["flats"][number] }) {
  return (
    <Link
      href={`/flats/${flat.id}`}
      className={`block rounded-2xl p-4 ring-1 ${flat.lowCollection ? "bg-amber-50 ring-amber-200" : "bg-card ring-foreground/10"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{flat.unitNumber}</p>
          <p className="text-sm text-muted-foreground">{flat.tenantName || "No tenant"}</p>
        </div>
        <p className={`font-display text-xl font-semibold ${flat.net >= 0 ? "text-teal-800" : "text-amber-800"}`}>
          {formatINR(flat.net)}
        </p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Collected {formatINR(flat.collected)} · Expenses {formatINR(flat.expenses)} · {formatRate(flat.collected, flat.due)}
      </p>
      {flat.lowCollection ? <p className="mt-1 text-xs font-semibold text-amber-800">Low collection</p> : null}
      {flat.topCost ? <p className="mt-1 text-xs font-semibold text-rose-800">Highest flat cost</p> : null}
    </Link>
  );
}
