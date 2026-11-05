import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadSnapshots } from "@/lib/portfolio";
import { queryExpenses, queryPayments } from "@/lib/queries";
import { currentMonthKey, formatDate, formatMonth, isInMonth, parseMonthParam } from "@/lib/dates";
import { formatINR, roundMoney } from "@/lib/money";
import { monthStanding, pendingLabel, type MonthStanding } from "@/lib/rent";
import { reminderText } from "@/lib/reminders";
import { whatsAppHref } from "@/lib/upi";
import { one } from "@/lib/search";
import { MonthSwitcher } from "@/components/month-switcher";
import { PageHeader, Stat, buttonLinkClass } from "@/components/ui-bits";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireUser();
  const params = await searchParams;
  const month = parseMonthParam(one(params.month));
  const viewingNow = month === currentMonthKey();

  if (!actor.isAdmin) {
    const snapshots = await loadSnapshots(actor, month, { active: "all" });
    return <TenantHome snapshots={snapshots} month={month} />;
  }

  const [snapshots, expenses, allPayments] = await Promise.all([
    loadSnapshots(actor, month, { active: "active" }),
    queryExpenses(actor, { month }),
    queryPayments(actor, { limit: null }),
  ]);
  const year = month.slice(0, 4);
  const through = month.slice(0, 7);
  const collected = roundMoney(
    allPayments
      .filter((payment) => payment.status === "confirmed" && isInMonth(payment.paymentDate, month))
      .reduce((sum, payment) => sum + payment.amount, 0),
  );
  const collectedYear = roundMoney(
    allPayments
      .filter(
        (payment) =>
          payment.status === "confirmed" &&
          payment.paymentDate.startsWith(year) &&
          payment.paymentDate.slice(0, 7) <= through,
      )
      .reduce((sum, payment) => sum + payment.amount, 0),
  );
  const standings = snapshots.map((flat) => ({ flat, standing: monthStanding(flat.ledger, month) }));
  const dueThisMonth = roundMoney(standings.reduce((sum, item) => sum + item.standing.charge, 0));
  const remainingThisMonth = roundMoney(standings.reduce((sum, item) => sum + item.standing.remaining, 0));
  const arrears = roundMoney(standings.reduce((sum, item) => sum + item.standing.arrears, 0));
  const pending = roundMoney(snapshots.reduce((sum, flat) => sum + flat.ledger.pending, 0));
  const expenseTotal = roundMoney(expenses.reduce((sum, expense) => sum + expense.amount, 0));
  const ordered = [...standings].sort((a, b) => statusRank(a.standing) - statusRank(b.standing) || a.flat.unitNumber.localeCompare(b.flat.unitNumber, "en", { numeric: true }));
  const recentPayments = allPayments
    .filter((payment) => isInMonth(payment.paymentDate, month) || (payment.forMonth ? isInMonth(payment.forMonth, month) : false))
    .slice(0, 8);

  const groups = new Map<string, number>();
  for (const expense of expenses) {
    const key = expense.category || "Other";
    groups.set(key, roundMoney((groups.get(key) ?? 0) + expense.amount));
  }

  return (
    <div>
      <PageHeader
        eyebrow="Dashboard"
        title={viewingNow ? "This month" : formatMonth(month)}
        subtitle={`${snapshots.length} active flat${snapshots.length === 1 ? "" : "s"}`}
        action={
          <Link href="/payments/new" className={buttonLinkClass()}>
            Record
          </Link>
        }
      />
      <MonthSwitcher month={month} path="/" />
      <section className="mb-4 rounded-3xl bg-primary px-5 py-5 text-primary-foreground">
        <p className="text-xs font-semibold tracking-[0.14em] uppercase opacity-80">Collected this month</p>
        <p className="font-display mt-1 text-4xl font-semibold tracking-tight">{formatINR(collected)}</p>
        <p className="mt-1 text-sm opacity-80">Year to date {formatINR(collectedYear)}</p>
      </section>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Due this month" value={formatINR(dueThisMonth)} hint="Rent plus adjustments" />
        <Stat label="Collected" value={formatINR(collected)} hint="Received this month" tone="good" />
        <Stat label="Still to collect" value={formatINR(remainingThisMonth)} hint="This month's rent left" tone={remainingThisMonth > 0 ? "warn" : "good"} />
        <Stat label="Earlier arrears" value={formatINR(arrears)} hint="Carried in from previous months" tone={arrears > 0 ? "warn" : "default"} />
      </div>
      <section className="mt-3 rounded-2xl bg-card px-4 py-4 ring-1 ring-foreground/10">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Total pending</p>
        <p className="font-display mt-1 text-3xl font-semibold">{formatINR(pending)}</p>
        <p className="mt-1 text-sm text-muted-foreground">Earlier arrears plus whatever is still unpaid this month.</p>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Expenses · {formatINR(expenseTotal)}</h2>
          <Link href={`/profit?year=${year}`} className="text-sm font-medium text-primary">
            Profit by flat
          </Link>
        </div>
        {groups.size === 0 ? (
          <p className="rounded-2xl bg-card px-4 py-5 text-sm text-muted-foreground ring-1 ring-foreground/10">
            No expenses in {formatMonth(month)}.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {[...groups.entries()].map(([category, amount]) => (
              <div key={category} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{category}</p>
                <p className="font-display mt-1 text-2xl font-semibold">{formatINR(amount)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 font-display text-xl font-semibold">Flats</h2>
        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active flats yet.</p>
        ) : (
          <ul className="space-y-2">
            {ordered.map(({ flat, standing }) => {
              const wa =
                flat.ledger.pending > 0
                  ? whatsAppHref(
                      flat.tenantPhone,
                      reminderText({
                        tenantName: flat.tenantName,
                        unitNumber: flat.unitNumber,
                        pending: flat.ledger.pending,
                        pendingMonths: flat.ledger.pendingMonths,
                        partial: flat.ledger.partial,
                      }),
                    )
                  : null;
              return (
                <li key={flat.id} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
                  <Link href={`/flats/${flat.id}`} className="block">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold">{flat.unitNumber}</p>
                        <p className="text-sm text-muted-foreground">{flat.tenantName || "No tenant name"}</p>
                      </div>
                      <MonthStatus standing={standing} />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Earlier arrears {formatINR(standing.arrears)}
                      {flat.ledger.pending > 0 ? ` · ${pendingLabel(flat.ledger.pendingMonths, flat.ledger.partial)} overall` : ""}
                    </p>
                  </Link>
                  {standing.status !== "paid" && standing.status !== "none" ? (
                    <div className="mt-3 flex gap-2">
                      <Link href={`/payments/new?flat=${flat.id}`} className={`${buttonLinkClass("secondary")} h-11 flex-1 text-sm`}>
                        Record
                      </Link>
                      {wa ? (
                        <a href={wa} target="_blank" rel="noreferrer" className={`${buttonLinkClass("ghost")} h-11 flex-1 text-sm`}>
                          WhatsApp
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 font-display text-xl font-semibold">Recent payments</h2>
        {recentPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments recorded for this month yet.</p>
        ) : (
          <ul className="space-y-2">
            {recentPayments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
                <div>
                  <p className="font-medium">{payment.unitNumber}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(payment.paymentDate)}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-semibold">{formatINR(payment.amount)}</p>
                  <StatusBadge status={payment.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function statusRank(standing: MonthStanding): number {
  if (standing.status === "due") return 0;
  if (standing.status === "partial") return 1;
  if (standing.status === "paid") return 2;
  return 3;
}

function MonthStatus({ standing }: { standing: MonthStanding }) {
  if (standing.status === "paid") {
    return <p className="font-display text-lg font-semibold text-teal-800">Paid</p>;
  }
  if (standing.status === "partial") {
    return (
      <p className="text-right font-display text-lg font-semibold text-amber-800">
        Partial
        <span className="mt-0.5 block text-sm">{formatINR(standing.remaining)}</span>
      </p>
    );
  }
  if (standing.status === "due") {
    return (
      <p className="text-right font-display text-lg font-semibold text-amber-800">
        Due
        <span className="mt-0.5 block text-sm">{formatINR(standing.remaining)}</span>
      </p>
    );
  }
  return <p className="text-sm text-muted-foreground">No charge</p>;
}

function TenantHome({
  snapshots,
  month,
}: {
  snapshots: Awaited<ReturnType<typeof loadSnapshots>>;
  month: string;
}) {
  if (snapshots.length === 0) {
    return (
      <div>
        <PageHeader title="Your rent" subtitle="No flat is linked to this login yet." />
        <p className="rounded-2xl bg-card p-4 text-sm leading-6 text-muted-foreground ring-1 ring-foreground/10">
          Ask the owner to invite this email on your flat. Until then there is nothing to pay here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Your flat" title={snapshots.length === 1 ? snapshots[0].unitNumber : "Your flats"} subtitle={formatMonth(month)} />
      {snapshots.map((flat) => (
        <article key={flat.id} className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
          {snapshots.length > 1 ? <p className="text-sm font-semibold">{flat.unitNumber}</p> : null}
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {flat.ledger.pending > 0 ? "Pending rent" : "Balance"}
          </p>
          <p className={`font-display mt-1 text-5xl font-semibold tracking-tight ${flat.ledger.pending > 0 ? "text-amber-800" : "text-teal-800"}`}>
            {flat.ledger.pending > 0 ? formatINR(flat.ledger.pending) : flat.ledger.credit > 0 ? formatINR(flat.ledger.credit) : formatINR(0)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {flat.ledger.pending > 0
              ? pendingLabel(flat.ledger.pendingMonths, flat.ledger.partial)
              : flat.ledger.credit > 0
                ? "Credit carried forward"
                : "Nothing pending"}
          </p>
          <Link href={`/pay?flat=${flat.id}`} className={`${buttonLinkClass()} mt-4 w-full`}>
            Pay rent
          </Link>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Monthly rent</dt>
              <dd className="font-medium">{formatINR(flat.monthlyRent)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total paid</dt>
              <dd className="font-medium">{formatINR(flat.ledger.totalPaid + flat.ledger.advancePaid)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last payment</dt>
              <dd className="font-medium">
                {flat.lastPayment ? `${formatINR(flat.lastPayment.amount)} · ${formatDate(flat.lastPayment.paymentDate)}` : "None yet"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Awaiting confirmation</dt>
              <dd className="font-medium">{formatINR(flat.awaiting)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}
