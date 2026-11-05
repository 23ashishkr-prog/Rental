import { requireAdmin } from "@/lib/auth";
import { todayIST } from "@/lib/dates";
import { ExpenseForm } from "@/components/record-forms";
import { PageHeader } from "@/components/ui-bits";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  await requireAdmin();
  return (
    <div>
      <PageHeader title="Add expense" />
      <ExpenseForm today={todayIST()} />
    </div>
  );
}
