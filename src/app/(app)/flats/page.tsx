import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadSnapshots } from "@/lib/portfolio";
import { currentMonthKey, formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { pendingLabel } from "@/lib/rent";
import { one } from "@/lib/search";
import { PageHeader, buttonLinkClass, controlClass } from "@/components/ui-bits";

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
  if (pendingOnly) snapshots = snapshots.filter((flat) => flat.ledger.pending > 0);

  return (
    <div>
      <PageHeader
        title="Flats"
        subtitle={`${snapshots.length} shown`}
        action={actor.isAdmin ? <Link href="/flats/new" className={buttonLinkClass()}>Add</Link> : undefined}
      />
      <form className="mb-4 space-y-3" action="/flats">
        <input name="q" defaultValue={q} placeholder="Search unit, name, phone, email" className={controlClass} />
        <div className="grid grid-cols-2 gap-2">
          <select name="active" defaultValue={active} className={controlClass} aria-label="Active filter">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
          <select name="pending" defaultValue={pendingOnly ? "1" : "0"} className={controlClass} aria-label="Pending filter">
            <option value="0">Any balance</option>
            <option value="1">Pending only</option>
          </select>
        </div>
        <button type="submit" className={buttonLinkClass("secondary") + " w-full"}>
          Search
        </button>
      </form>
      {snapshots.length === 0 ? (
        <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-foreground/10">No flats match.</p>
      ) : (
        <ul className="space-y-2">
          {snapshots.map((flat) => (
            <li key={flat.id}>
              <Link href={`/flats/${flat.id}`} className="block rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{flat.unitNumber}</p>
                    <p className="text-sm text-muted-foreground">{flat.tenantName || "No tenant"}</p>
                  </div>
                  <p className={`font-display text-xl font-semibold ${flat.ledger.pending > 0 ? "text-amber-800" : "text-teal-800"}`}>
                    {flat.ledger.pending > 0 ? formatINR(flat.ledger.pending) : "Clear"}
                  </p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatINR(flat.monthlyRent)} / month
                  {flat.ledger.pending > 0 ? ` · ${pendingLabel(flat.ledger.pendingMonths, flat.ledger.partial)}` : ""}
                  {!flat.active ? " · Inactive" : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Last payment:{" "}
                  {flat.lastPayment ? `${formatINR(flat.lastPayment.amount)} on ${formatDate(flat.lastPayment.paymentDate)}` : "none"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
