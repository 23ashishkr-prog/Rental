import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { queryFlats, queryPayments } from "@/lib/queries";
import { formatDate, formatMonth, parseMonthParam, currentMonthKey } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { one } from "@/lib/search";
import { MonthSwitcher } from "@/components/month-switcher";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader, buttonLinkClass, controlClass } from "@/components/ui-bits";
import { FilterForm } from "@/components/filter-form";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireUser();
  const params = await searchParams;
  const month = parseMonthParam(one(params.month), currentMonthKey());
  const status = one(params.status) || "all";
  const q = one(params.q) ?? "";
  const flatRaw = one(params.flat);
  const flatId = flatRaw && Number(flatRaw) > 0 ? Number(flatRaw) : undefined;
  const submitted = one(params.submitted) === "1";
  const [payments, flats] = await Promise.all([
    queryPayments(actor, { month, status, q, flatId }),
    actor.isAdmin ? queryFlats(actor, { active: "all" }) : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        title={actor.isAdmin ? "Payments" : "Payment history"}
        subtitle={actor.isAdmin ? "Confirmed money counts toward rent. Pending does not." : "Pending rows are waiting for the owner to confirm."}
        action={actor.isAdmin ? <Link href="/payments/new" className={buttonLinkClass()}>Add</Link> : undefined}
      />
      {submitted ? (
        <p className="mb-4 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">
          Payment submitted. It stays pending until an admin confirms it.
        </p>
      ) : null}
      <MonthSwitcher
        month={month}
        path="/payments"
        extra={{ status: status === "all" ? undefined : status, q: q || undefined, flat: flatId ? String(flatId) : undefined }}
      />
      <FilterForm action="/payments" className="mb-4 space-y-3">
        <input type="hidden" name="month" value={month.slice(0, 7)} />
        <input name="q" defaultValue={q} placeholder="Search flat, reference, notes" className={controlClass} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select name="status" defaultValue={status} className={controlClass} aria-label="Status">
            <option value="all">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
          {actor.isAdmin ? (
            <select name="flat" defaultValue={flatId ? String(flatId) : ""} className={controlClass} aria-label="Flat">
              <option value="">All flats</option>
              {flats.map((flat) => (
                <option key={flat.id} value={flat.id}>
                  {flat.unitNumber}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <button type="submit" className={`${buttonLinkClass("secondary")} w-full`}>
          Search
        </button>
      </FilterForm>
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payments for this filter.</p>
      ) : (
        <ul className="space-y-2">
          {payments.map((payment) => (
            <li key={payment.id} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{payment.unitNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(payment.paymentDate)}
                    {payment.forMonth ? ` · for ${formatMonth(payment.forMonth)}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {payment.method || "Payment"}
                    {payment.upiRef ? ` · ${payment.upiRef}` : ""}
                  </p>
                  {payment.notes ? <p className="mt-1 text-sm">{payment.notes}</p> : null}
                </div>
                <div className="text-right">
                  <p className="font-display text-xl font-semibold">{formatINR(payment.amount)}</p>
                  <StatusBadge status={payment.status} />
                </div>
              </div>
              {actor.isAdmin ? (
                <Link href={`/payments/${payment.id}/edit`} className="mt-2 inline-block text-sm font-medium text-primary">
                  Edit
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
