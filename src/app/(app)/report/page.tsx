import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadSnapshots } from "@/lib/portfolio";
import { formatMonth, parseMonthParam } from "@/lib/dates";
import { one } from "@/lib/search";
import { formatINR } from "@/lib/money";
import { pendingLabel } from "@/lib/rent";
import { MonthSwitcher } from "@/components/month-switcher";
import { PageHeader, buttonLinkClass } from "@/components/ui-bits";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireUser();
  const params = await searchParams;
  const month = parseMonthParam(one(params.month));
  const snapshots = await loadSnapshots(actor, month, { active: "all" });

  return (
    <div>
      <PageHeader
        title="Monthly report"
        subtitle={formatMonth(month)}
        action={
          <a href={`/api/report?month=${month.slice(0, 7)}`} className={buttonLinkClass()}>
            CSV
          </a>
        }
      />
      <MonthSwitcher month={month} path="/report" />
      <div className="space-y-2 md:hidden">
        {snapshots.map((flat) => {
          const row = flat.ledger.months.find((item) => item.month === month);
          return (
            <Link key={flat.id} href={`/flats/${flat.id}`} className="block rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{flat.unitNumber}</p>
                  <p className="text-sm text-muted-foreground">{flat.tenantName || "No tenant"}</p>
                </div>
                <p className="font-display text-lg font-semibold">{formatINR(flat.ledger.pending)}</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Charge {formatINR(row?.charge ?? 0)} · Paid {formatINR(row?.paid ?? 0)} · {pendingLabel(flat.ledger.pendingMonths, flat.ledger.partial)}
              </p>
            </Link>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto rounded-2xl bg-card ring-1 ring-foreground/10 md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-3 font-medium">Flat</th>
              <th className="px-3 py-3 font-medium">Opening</th>
              <th className="px-3 py-3 font-medium">Charge</th>
              <th className="px-3 py-3 font-medium">Paid</th>
              <th className="px-3 py-3 font-medium">Closing</th>
              <th className="px-3 py-3 font-medium">Pending</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((flat) => {
              const row = flat.ledger.months.find((item) => item.month === month);
              return (
                <tr key={flat.id} className="border-t border-foreground/10">
                  <td className="px-3 py-3">
                    <Link href={`/flats/${flat.id}`} className="font-medium">
                      {flat.unitNumber}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{flat.tenantName}</span>
                  </td>
                  <td className="px-3 py-3">{formatINR(row?.opening ?? 0)}</td>
                  <td className="px-3 py-3">{formatINR(row?.charge ?? 0)}</td>
                  <td className="px-3 py-3">{formatINR(row?.paid ?? 0)}</td>
                  <td className="px-3 py-3">{formatINR(row?.closing ?? 0)}</td>
                  <td className="px-3 py-3">
                    {formatINR(flat.ledger.pending)}
                    <span className="block text-xs text-muted-foreground">
                      {pendingLabel(flat.ledger.pendingMonths, flat.ledger.partial)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
