import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { queryPayments } from "@/lib/queries";
import { formatDate, formatMonth } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader, buttonLinkClass } from "@/components/ui-bits";
import { confirmPaymentAction, rejectPaymentAction } from "@/server/rent-actions";

export const dynamic = "force-dynamic";

export default async function ConfirmationsPage() {
  const actor = await requireAdmin();
  const payments = await queryPayments(actor, { status: "pending", limit: 200 });

  return (
    <div>
      <PageHeader title="Pending confirmations" subtitle="Tenant UPI submissions stay here until you confirm or reject them." />
      {payments.length === 0 ? (
        <p className="rounded-2xl bg-teal-50 px-4 py-5 text-sm text-teal-900 ring-1 ring-teal-200">
          Nothing is waiting for confirmation.
        </p>
      ) : (
        <ul className="space-y-3">
          {payments.map((payment) => (
            <li key={payment.id} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{payment.unitNumber}</p>
                  <p className="text-sm text-muted-foreground">{payment.tenantName || "Tenant"}</p>
                  <p className="mt-1 text-sm">
                    {formatDate(payment.paymentDate)}
                    {payment.forMonth ? ` · ${formatMonth(payment.forMonth)}` : ""}
                  </p>
                  {payment.upiRef ? <p className="text-sm">UPI ref: {payment.upiRef}</p> : null}
                  {payment.notes ? <p className="mt-1 text-sm text-muted-foreground">{payment.notes}</p> : null}
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-semibold">{formatINR(payment.amount)}</p>
                  <StatusBadge status={payment.status} />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <form action={confirmPaymentAction}>
                  <input type="hidden" name="id" value={payment.id} />
                  <button type="submit" className={`${buttonLinkClass()} w-full`}>
                    Confirm
                  </button>
                </form>
                <form action={rejectPaymentAction}>
                  <input type="hidden" name="id" value={payment.id} />
                  <button type="submit" className={`${buttonLinkClass("secondary")} w-full`}>
                    Reject
                  </button>
                </form>
              </div>
              <Link href={`/payments/${payment.id}/edit`} className="mt-2 inline-block text-sm font-medium text-primary">
                Edit before confirming
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
