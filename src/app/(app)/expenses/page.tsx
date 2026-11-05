import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { queryExpenses } from "@/lib/queries";
import { formatDate, formatMonth, parseMonthParam } from "@/lib/dates";
import { formatINR, roundMoney } from "@/lib/money";
import { one } from "@/lib/search";
import { MonthSwitcher } from "@/components/month-switcher";
import { PageHeader, buttonLinkClass, controlClass } from "@/components/ui-bits";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  const params = await searchParams;
  const month = parseMonthParam(one(params.month));
  const q = one(params.q) ?? "";
  const expenses = await queryExpenses(actor, { month, q });
  const total = roundMoney(expenses.reduce((sum, expense) => sum + expense.amount, 0));

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle={`${formatMonth(month)} · ${formatINR(total)}`}
        action={<Link href="/expenses/new" className={buttonLinkClass()}>Add</Link>}
      />
      <MonthSwitcher month={month} path="/expenses" extra={{ q: q || undefined }} />
      <form className="mb-4 flex gap-2" action="/expenses">
        <input type="hidden" name="month" value={month.slice(0, 7)} />
        <input name="q" defaultValue={q} placeholder="Search title or category" className={controlClass} />
        <button type="submit" className={buttonLinkClass("secondary")}>
          Go
        </button>
      </form>
      {expenses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No expenses for this filter.</p>
      ) : (
        <ul className="space-y-2">
          {expenses.map((expense) => (
            <li key={expense.id}>
              <Link href={`/expenses/${expense.id}/edit`} className="block rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{expense.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(expense.expenseDate)}
                      {expense.category ? ` · ${expense.category}` : ""}
                    </p>
                  </div>
                  <p className="font-display text-xl font-semibold">{formatINR(expense.amount)}</p>
                </div>
                {expense.notes ? <p className="mt-2 text-sm text-muted-foreground">{expense.notes}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
