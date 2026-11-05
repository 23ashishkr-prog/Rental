import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { queryExpenses, queryFlats } from "@/lib/queries";
import { todayIST } from "@/lib/dates";
import { ExpenseForm } from "@/components/record-forms";
import { ConfirmForm } from "@/components/submit-button";
import { PageHeader } from "@/components/ui-bits";
import { deleteExpenseAction } from "@/server/rent-actions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin();
  const { id } = await params;
  const [expense] = await queryExpenses(actor, { id: Number(id) });
  if (!expense) notFound();
  const flats = await queryFlats(actor, { active: "all" });
  return (
    <div className="space-y-6">
      <PageHeader title="Edit expense" />
      <ExpenseForm expense={expense} today={todayIST()} flats={flats} />
      <ConfirmForm action={deleteExpenseAction} message="Delete this expense?">
        <input type="hidden" name="id" value={expense.id} />
        <Button type="submit" variant="destructive" className="h-12 w-full text-base">
          Delete expense
        </Button>
      </ConfirmForm>
    </div>
  );
}
