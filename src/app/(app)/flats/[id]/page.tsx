import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadSnapshot } from "@/lib/portfolio";
import { currentMonthKey, formatDate, formatMonth, parseMonthParam } from "@/lib/dates";
import { formatINR, roundMoney } from "@/lib/money";
import { isPersonalCategory } from "@/lib/categories";
import { expenseFlatColumnExists, queryExpenses } from "@/lib/queries";
import { flatMonthFigures, recordPaymentHref, suggestedRecordAmount, summarizeDashboard } from "@/lib/dashboard";
import { displayedRent, effectiveRentChanges, type SettledBefore } from "@/lib/rent";
import { rentChangesTableIsReady } from "@/lib/db";
import { reminderText } from "@/lib/reminders";
import { whatsAppHref } from "@/lib/upi";
import { notice, one } from "@/lib/search";
import { AdjustmentForm, RentChangeForm } from "@/components/record-forms";
import { ConfirmForm } from "@/components/submit-button";
import { StatusBadge } from "@/components/status-badge";
import { MonthSwitcher } from "@/components/month-switcher";
import { MonthSummary } from "@/components/month-summary";
import { PageHeader, buttonLinkClass, glassClass } from "@/components/ui-bits";
import { deleteAdjustmentAction, deleteFlatAction, deletePaymentAction, deleteRentChangeAction } from "@/server/rent-actions";
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
  const now = currentMonthKey();
  const query = await searchParams;
  const focus = parseMonthParam(one(query.month), now);
  const month = focus > now ? focus : now;
  const snapshot = await loadSnapshot(actor, flatId, month);
  if (!snapshot) notFound();
  const figures = flatMonthFigures(snapshot.ledger, focus);
  const summary = summarizeDashboard([{ ledger: snapshot.ledger }], focus);
  const expenses = actor.isAdmin ? await queryExpenses(actor, { flatId, limit: null }) : [];
  const expensesLinked = actor.isAdmin ? await expenseFlatColumnExists() : false;
  const year = focus.slice(0, 4);
  const yearExpenses = expenses.filter(
    (expense) => expense.expenseDate.startsWith(year) && !isPersonalCategory(expense.category),
  );
  const yearCollected = roundMoney(
    snapshot.ledger.months
      .filter((row) => row.month.startsWith(year))
      .reduce((sum, row) => sum + row.paid, 0),
  );
  const yearExpenseTotal = roundMoney(yearExpenses.reduce((sum, expense) => sum + expense.amount, 0));
  const yearProfit = roundMoney(yearCollected - yearExpenseTotal);
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
              Edit flat
            </Link>
          ) : undefined
        }
      />
      <MonthSwitcher month={focus} path={`/flats/${snapshot.id}`} />
      {error ? <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      {invited ? <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">Tenant invited. They can set a password on first login.</p> : null}

      <MonthSummary summary={summary} month={focus} />
      {snapshot.awaiting > 0 ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200">
          Waiting for confirmation: {formatINR(snapshot.awaiting)}. That money is not counted as paid yet.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Link href={`/pay?flat=${snapshot.id}`} className={buttonLinkClass()}>
          Pay rent
        </Link>
        {actor.isAdmin ? (
          <Link href={recordPaymentHref(snapshot.id, focus, suggestedRecordAmount(figures))} className={buttonLinkClass("secondary")}>
            Record payment
          </Link>
        ) : null}
        {actor.isAdmin ? (
          <a href="#rent-increase" className={buttonLinkClass("ghost")}>
            Change rent
          </a>
        ) : null}
        {wa ? (
          <a href={wa} target="_blank" rel="noreferrer" className={buttonLinkClass("ghost")}>
            Send reminder
          </a>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        {snapshot.tenantEmail || "No email"} · {snapshot.tenantPhone || "No phone"}
        {snapshot.rentStartDate ? ` · Rent from ${formatDate(snapshot.rentStartDate)}` : " · Rent start date not set"}
      </p>
      {actor.isAdmin ? (
        <section className={`${glassClass} px-4 py-4`}>
          <p className="text-sm font-semibold">Security deposit</p>
          <p className="font-display mt-1 text-3xl font-semibold">
            {snapshot.securityDeposit == null ? "Not entered" : formatINR(snapshot.securityDeposit)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Money this tenant has already given you to hold. It is not rent, and it is not added to what they owe.
          </p>
          <Link href={`/flats/${snapshot.id}/edit`} className="mt-3 inline-flex text-sm font-medium text-primary">
            Edit deposit
          </Link>
        </section>
      ) : null}

      <RentHistory
        actorIsAdmin={actor.isAdmin}
        flatId={snapshot.id}
        month={focus}
        currentRent={displayedRent(snapshot.ledger, focus, snapshot.monthlyRent)}
        changes={snapshot.rentChanges}
        editingId={one(query.change)}
        tableReady={rentChangesTableIsReady()}
      />

      <section>
        <h2 className="mb-1 font-display text-xl font-semibold">Each month</h2>
        <p className="mb-3 text-sm text-muted-foreground">What was due, what was paid, and what was still unpaid.</p>
        {snapshot.ledger.settledBefore || snapshot.ledger.months.length > 0 ? (
          <div className="space-y-2 md:hidden">
            {snapshot.ledger.settledBefore ? <SettledCard settled={snapshot.ledger.settledBefore} /> : null}
            {snapshot.ledger.months.map((row) => (
              <article key={row.month} className={`rounded-2xl p-4 ring-1 ring-foreground/10 ${rowTone(row)}`}>
                <p className="font-semibold">{formatMonth(row.month)}</p>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Due</dt>
                    <dd>{formatINR(row.charge)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Paid</dt>
                    <dd>{formatINR(row.paid)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Earlier</dt>
                    <dd>{formatINR(row.opening)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Balance</dt>
                    <dd className="font-medium">{formatINR(row.closing)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground md:hidden">No rent has accrued yet.</p>
        )}
        <div className="hidden overflow-x-auto rounded-2xl bg-card ring-1 ring-foreground/10 md:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-3 font-medium">Month</th>
                <th className="px-3 py-3 font-medium">Due</th>
                <th className="px-3 py-3 font-medium">Paid</th>
                <th className="px-3 py-3 font-medium">Earlier</th>
                <th className="px-3 py-3 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.ledger.settledBefore ? (
                <tr className="border-t border-foreground/10 bg-teal-50/80">
                  <td className="px-3 py-3">
                    <span className="font-medium text-teal-900">{snapshot.ledger.settledBefore.label}</span>
                    <span className="mt-0.5 block text-xs text-teal-800">
                      {formatMonth(snapshot.ledger.settledBefore.fromMonth)} – {formatMonth(snapshot.ledger.settledBefore.throughMonth)}
                      {" · "}
                      {snapshot.ledger.settledBefore.monthCount} months
                    </span>
                  </td>
                  <td className="px-3 py-3">{formatINR(snapshot.ledger.settledBefore.amount)}</td>
                  <td className="px-3 py-3">{formatINR(snapshot.ledger.settledBefore.amount)}</td>
                  <td className="px-3 py-3">{formatINR(0)}</td>
                  <td className="px-3 py-3 font-medium">{formatINR(0)}</td>
                </tr>
              ) : null}
              {snapshot.ledger.months.map((row) => (
                <tr key={row.month} className={`border-t border-foreground/10 ${rowTone(row)}`}>
                  <td className="px-3 py-3">
                    {formatMonth(row.month)}
                    {row.adjustment !== 0 ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Extra {formatINR(row.adjustment)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">{formatINR(row.charge)}</td>
                  <td className="px-3 py-3">{formatINR(row.paid)}</td>
                  <td className="px-3 py-3">{formatINR(row.opening)}</td>
                  <td className="px-3 py-3 font-medium">{formatINR(row.closing)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {actor.isAdmin ? (
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold">This flat&apos;s profit, {year}</h2>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
              <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">Paid</p>
              <p className="font-display mt-1 text-lg font-semibold">{formatINR(yearCollected)}</p>
            </div>
            <div className="rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
              <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">Expenses</p>
              <p className="font-display mt-1 text-lg font-semibold">{formatINR(yearExpenseTotal)}</p>
            </div>
            <div className="rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
              <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">After expenses</p>
              <p className={`font-display mt-1 text-lg font-semibold ${yearProfit >= 0 ? "text-teal-800" : "text-amber-800"}`}>
                {formatINR(yearProfit)}
              </p>
            </div>
          </div>
          {!expensesLinked ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Link expenses to this flat by running migrations/002_expense_flat.sql. Until then, profit here is rent collected only.
            </p>
          ) : yearExpenses.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No business expenses are linked to this flat in {year}. Personal expenses are left out.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {yearExpenses.map((expense) => (
                <li key={expense.id} className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-foreground/10">
                  <span>
                    {expense.title}
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {formatDate(expense.expenseDate)}
                      {expense.category ? ` · ${expense.category}` : ""}
                    </span>
                  </span>
                  <span className="font-medium">{formatINR(expense.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

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
          <h2 className="font-display text-xl font-semibold">Extra charge or discount</h2>
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
          <AdjustmentForm flatId={snapshot.id} month={focus} />
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

function RentHistory({
  actorIsAdmin,
  flatId,
  month,
  currentRent,
  changes,
  editingId,
  tableReady,
}: {
  actorIsAdmin: boolean;
  flatId: number;
  month: string;
  currentRent: number;
  changes: { id: number; effectiveMonth: string; monthlyRent: number; note: string | null }[];
  editingId?: string;
  tableReady: boolean;
}) {
  const editing = changes.find((change) => String(change.id) === editingId);
  const visible = effectiveRentChanges(changes);
  const timeline = [...visible].sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth) || b.id - a.id);
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold">Rent changes</h2>
      {timeline.length === 0 ? (
        <p className="text-sm text-muted-foreground">No increases yet. Each month uses the rent stored on the flat.</p>
      ) : (
        <ol className="space-y-2">
          {timeline.map((change) => (
            <li key={change.id} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{formatMonth(change.effectiveMonth)}</p>
                  <p className="text-sm text-muted-foreground">{change.note || "Rent increase"}</p>
                </div>
                <p className="font-display text-xl font-semibold">{formatINR(change.monthlyRent)}</p>
              </div>
              {actorIsAdmin ? (
                <div className="mt-3 flex gap-4">
                  <Link href={`/flats/${flatId}?month=${month.slice(0, 7)}&change=${change.id}#rent-increase`} className="text-sm font-medium text-primary">
                    Edit
                  </Link>
                  <ConfirmForm action={deleteRentChangeAction} message="Delete this rent increase?">
                    <input type="hidden" name="id" value={change.id} />
                    <input type="hidden" name="flat_id" value={flatId} />
                    <button type="submit" className="text-sm font-medium text-destructive">
                      Delete
                    </button>
                  </ConfirmForm>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {actorIsAdmin ? (
        tableReady || changes.length > 0 ? (
          <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
            <h3 className="mb-3 font-semibold">{editing ? "Edit this rent change" : "Change the rent"}</h3>
            <RentChangeForm flatId={flatId} change={editing} defaultMonth={month} currentRent={currentRent} />
            {editing ? (
              <p className="mt-3 text-sm">
                <Link href={`/flats/${flatId}#rent-increase`} className="font-medium text-primary">
                  Cancel edit
                </Link>
              </p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl bg-card p-4 text-sm leading-6 ring-1 ring-foreground/10">
            <p className="font-medium">Rent increases need one new table.</p>
            <pre className="mt-3 overflow-x-auto text-xs leading-5">{`CREATE TABLE IF NOT EXISTS public.rent_changes (
  id bigserial PRIMARY KEY,
  flat_id bigint NOT NULL REFERENCES public.flats (id),
  effective_month date NOT NULL,
  monthly_rent numeric(12,2) NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flat_id, effective_month)
);`}</pre>
            <p className="mt-2 text-muted-foreground">The same statement is in migrations/004_rent_changes.sql.</p>
          </div>
        )
      ) : null}
    </section>
  );
}

function rowTone(row: { charge: number; paid: number }): string {
  if (row.charge <= 0) return "bg-card";
  if (row.paid >= row.charge) return "bg-emerald-50/80";
  if (row.paid > 0) return "bg-amber-50/90";
  return "bg-rose-50/80";
}

function SettledCard({ settled }: { settled: SettledBefore }) {
  return (
    <article className="rounded-2xl bg-teal-50 p-4 text-teal-950 ring-1 ring-teal-200">
      <p className="font-semibold">{settled.label}</p>
      <p className="mt-1 text-sm">
        {formatMonth(settled.fromMonth)} – {formatMonth(settled.throughMonth)} · {settled.monthCount} month
        {settled.monthCount === 1 ? "" : "s"} treated as paid. Balance carried forward {formatINR(0)}.
      </p>
    </article>
  );
}
