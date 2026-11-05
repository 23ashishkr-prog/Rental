import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadSnapshot } from "@/lib/portfolio";
import { currentMonthKey, formatDate, formatMonth } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { pendingLabel } from "@/lib/rent";
import { reminderText } from "@/lib/reminders";
import { whatsAppHref } from "@/lib/upi";
import { notice, one } from "@/lib/search";
import { AdjustmentForm } from "@/components/record-forms";
import { ConfirmForm } from "@/components/submit-button";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader, buttonLinkClass } from "@/components/ui-bits";
import { deleteAdjustmentAction, deleteFlatAction, deletePaymentAction } from "@/server/rent-actions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function FlatDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireUser();
  const { id } = await params;
  const flatId = Number(id);
  if (!Number.isInteger(flatId) || flatId <= 0) notFound();
  const month = currentMonthKey();
  const snapshot = await loadSnapshot(actor, flatId, month);
  if (!snapshot) notFound();
  const query = await searchParams;
  const error = notice(query.error);
  const invited = one(query.invited) === "1";
  const wa =
    snapshot.ledger.pending > 0
      ? whatsAppHref(
          snapshot.tenantPhone,
          reminderText({
            tenantName: snapshot.tenantName,
            unitNumber: snapshot.unitNumber,
            pending: snapshot.ledger.pending,
            pendingMonths: snapshot.ledger.pendingMonths,
            partial: snapshot.ledger.partial,
          }),
        )
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={snapshot.active ? "Flat" : "Inactive flat"}
        title={snapshot.unitNumber}
        subtitle={snapshot.tenantName || "No tenant on file"}
        action={
          actor.isAdmin ? (
            <Link href={`/flats/${snapshot.id}/edit`} className={buttonLinkClass("secondary")}>
              Edit
            </Link>
          ) : undefined
        }
      />
      {error ? <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      {invited ? <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">Tenant invited. They can set a password on first login.</p> : null}

      <section className="rounded-3xl bg-primary px-5 py-5 text-primary-foreground">
        <p className="text-xs font-semibold tracking-[0.14em] uppercase opacity-80">Pending</p>
        <p className="font-display text-4xl font-semibold">{formatINR(snapshot.ledger.pending)}</p>
        <p className="mt-1 text-sm opacity-85">
          {snapshot.ledger.pending > 0
            ? pendingLabel(snapshot.ledger.pendingMonths, snapshot.ledger.partial)
            : snapshot.ledger.credit > 0
              ? `${formatINR(snapshot.ledger.credit)} credit`
              : "Nothing pending"}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <p>Rent {formatINR(snapshot.monthlyRent)}</p>
          <p>Paid {formatINR(snapshot.ledger.totalPaid)}</p>
          {snapshot.ledger.advancePaid > 0 ? <p>Advance {formatINR(snapshot.ledger.advancePaid)}</p> : null}
          {snapshot.awaiting > 0 ? <p>Unconfirmed {formatINR(snapshot.awaiting)}</p> : null}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Link href={`/pay?flat=${snapshot.id}`} className={buttonLinkClass()}>
          Pay / show UPI
        </Link>
        {actor.isAdmin ? (
          <Link href={`/payments/new?flat=${snapshot.id}`} className={buttonLinkClass("secondary")}>
            Record payment
          </Link>
        ) : null}
        {wa ? (
          <a href={wa} target="_blank" rel="noreferrer" className={buttonLinkClass("ghost")}>
            WhatsApp reminder
          </a>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        {snapshot.tenantEmail || "No email"} · {snapshot.tenantPhone || "No phone"}
        {snapshot.rentStartDate ? ` · Rent from ${formatDate(snapshot.rentStartDate)}` : " · Rent start date not set"}
      </p>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Ledger</h2>
        {snapshot.ledger.months.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rent has accrued yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-foreground/10">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-3 font-medium">Month</th>
                  <th className="px-3 py-3 font-medium">Charge</th>
                  <th className="px-3 py-3 font-medium">Paid</th>
                  <th className="px-3 py-3 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.ledger.months.map((row) => (
                  <tr key={row.month} className="border-t border-foreground/10">
                    <td className="px-3 py-3">
                      {formatMonth(row.month)}
                      {row.adjustment !== 0 ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Adjustment {formatINR(row.adjustment)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">{formatINR(row.charge)}</td>
                    <td className="px-3 py-3">{formatINR(row.paid)}</td>
                    <td className="px-3 py-3 font-medium">{formatINR(row.closing)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Payments</h2>
        {snapshot.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <ul className="space-y-2">
            {[...snapshot.payments]
              .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || b.id - a.id)
              .map((payment) => (
                <li key={payment.id} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{formatINR(payment.amount)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(payment.paymentDate)}
                        {payment.forMonth ? ` · for ${formatMonth(payment.forMonth)}` : ""}
                        {payment.method ? ` · ${payment.method}` : ""}
                      </p>
                      {payment.upiRef ? <p className="text-xs text-muted-foreground">Ref {payment.upiRef}</p> : null}
                      {payment.notes ? <p className="mt-1 text-sm">{payment.notes}</p> : null}
                    </div>
                    <StatusBadge status={payment.status} />
                  </div>
                  {actor.isAdmin ? (
                    <div className="mt-3 flex gap-2">
                      <Link href={`/payments/${payment.id}/edit`} className="text-sm font-medium text-primary">
                        Edit
                      </Link>
                      <ConfirmForm action={deletePaymentAction} message="Delete this payment?">
                        <input type="hidden" name="id" value={payment.id} />
                        <button type="submit" className="text-sm font-medium text-destructive">
                          Delete
                        </button>
                      </ConfirmForm>
                    </div>
                  ) : null}
                </li>
              ))}
          </ul>
        )}
      </section>

      {actor.isAdmin ? (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Rent adjustments</h2>
          {snapshot.adjustments.length > 0 ? (
            <ul className="space-y-2">
              {snapshot.adjustments.map((adjustment) => (
                <li key={adjustment.id} className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
                  <div>
                    <p className="font-medium">
                      {formatMonth(adjustment.month)} · {formatINR(adjustment.amount)}
                    </p>
                    <p className="text-sm text-muted-foreground">{adjustment.reason || "No reason"}</p>
                  </div>
                  <ConfirmForm action={deleteAdjustmentAction} message="Remove this adjustment?">
                    <input type="hidden" name="id" value={adjustment.id} />
                    <button type="submit" className="text-sm font-medium text-destructive">
                      Remove
                    </button>
                  </ConfirmForm>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No adjustments yet.</p>
          )}
          <AdjustmentForm flatId={snapshot.id} month={month} />
          <ConfirmForm action={deleteFlatAction} message="Delete this flat? This only works when it has no history.">
            <input type="hidden" name="id" value={snapshot.id} />
            <Button type="submit" variant="destructive" className="h-12 w-full text-base">
              Delete flat
            </Button>
          </ConfirmForm>
        </section>
      ) : null}
    </div>
  );
}
