import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadSnapshots } from "@/lib/portfolio";
import { currentMonthKey } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { flatMonthFigures, recordPaymentHref, suggestedRecordAmount } from "@/lib/dashboard";
import { one } from "@/lib/search";
import { PageHeader, buttonLinkClass, controlClass } from "@/components/ui-bits";
import { cn } from "cn";

export const dynamic = "force-dynamic";

export default async function FlatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireUser();
  const params = await searchParams;
  const q = one(params.q) ?? "";
  const active = one(params.active) === "all" || one(params.active) === "inactive" ? one(params.active)! : "active";
  const pendingOnly = one(params.pending) === "1";
  const month = currentMonthKey();
  let snapshots = await loadSnapshots(actor, month, {
    q,
    active: active as "active" | "inactive" | "all",
  });
  if (pendingOnly) snapshots = snapshots.filter((flat) => flat.ledger.pending > 0 || flatMonthFigures(flat.ledger, month).total > 0);

  return (
    <div>
      <PageHeader
        title="Flats"
        subtitle={`${snapshots.length} shown`}
        action={actor.isAdmin ? <Link href="/flats/new" className={buttonLinkClass()}>Add flat</Link> : undefined}
      />
      <form className="mb-3" action="/flats">
        <input type="hidden" name="active" value={active} />
        {pendingOnly ? <input type="hidden" name="pending" value="1" /> : null}
        <div className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search name or flat" className={controlClass} />
          <button type="submit" className={`${buttonLinkClass("secondary")} shrink-0 px-4`}>
            Search
          </button>
        </div>
      </form>
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip href={filterHref({ q, active: "active", pending: pendingOnly })} on={active === "active"}>
          Active
        </FilterChip>
        <FilterChip href={filterHref({ q, active: "inactive", pending: pendingOnly })} on={active === "inactive"}>
          Inactive
        </FilterChip>
        <FilterChip href={filterHref({ q, active: "all", pending: pendingOnly })} on={active === "all"}>
          All flats
        </FilterChip>
        <FilterChip href={filterHref({ q, active, pending: !pendingOnly })} on={pendingOnly}>
          Still unpaid
        </FilterChip>
      </div>
      {snapshots.length === 0 ? (
        <p className="rounded-[1.75rem] border border-white/80 bg-white/60 p-4 text-sm text-muted-foreground">No flats match.</p>
      ) : (
        <ul className="space-y-3">
          {snapshots.map((flat) => {
            const figures = flatMonthFigures(flat.ledger, month);
            const tone =
              figures.status === "paid"
                ? "border-emerald-200/90 bg-emerald-50/80"
                : figures.status === "partial"
                  ? "border-amber-200/90 bg-amber-50/80"
                  : figures.status === "due"
                    ? "border-rose-200/90 bg-rose-50/75"
                    : "border-white/80 bg-white/60";
            const owes = figures.left > 0 || figures.total > 0 || flat.ledger.pending > 0;
            return (
              <li key={flat.id} className={`rounded-[1.75rem] border p-4 ${tone}`}>
                <Link href={`/flats/${flat.id}?month=${month.slice(0, 7)}`} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{flat.unitNumber}</p>
                      <p className="text-sm text-foreground/70">{flat.tenantName || "No tenant"}</p>
                    </div>
                    <p className={`font-display text-xl font-semibold ${owes ? "text-rose-700" : "text-emerald-800"}`}>
                      {owes ? formatINR(figures.total || flat.ledger.pending) : "Paid"}
                    </p>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-foreground/65">Due</dt>
                      <dd className="font-semibold">{formatINR(figures.due)}</dd>
                    </div>
                    <div>
                      <dt className="text-emerald-900/80">Paid</dt>
                      <dd className="font-semibold text-emerald-800">{formatINR(figures.paid)}</dd>
                    </div>
                    <div>
                      <dt className="text-foreground/65">Left</dt>
                      <dd className={`font-semibold ${figures.left > 0 ? "text-rose-700" : "text-emerald-800"}`}>{formatINR(figures.left)}</dd>
                    </div>
                  </dl>
                  {!flat.active ? <p className="mt-2 text-xs text-muted-foreground">Inactive</p> : null}
                </Link>
                {owes ? (
                  <div className="mt-3">
                    {actor.isAdmin ? (
                      <Link href={recordPaymentHref(flat.id, month, suggestedRecordAmount(figures))} className={`${buttonLinkClass()} w-full`}>
                        Record payment
                      </Link>
                    ) : (
                      <Link href={`/pay?flat=${flat.id}`} className={`${buttonLinkClass()} w-full`}>
                        Pay rent
                      </Link>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function filterHref({ q, active, pending }: { q: string; active: string; pending: boolean }): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (active !== "active") params.set("active", active);
  if (pending) params.set("pending", "1");
  const query = params.toString();
  return query ? `/flats?${query}` : "/flats";
}

function FilterChip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={on ? "true" : undefined}
      className={cn(
        "inline-flex h-11 items-center rounded-full px-4 text-sm font-medium",
        on ? "bg-primary text-primary-foreground" : "bg-white/70 text-foreground ring-1 ring-foreground/10",
      )}
    >
      {children}
    </Link>
  );
}
