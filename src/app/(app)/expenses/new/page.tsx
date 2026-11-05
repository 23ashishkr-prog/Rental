import { requireAdmin } from "@/lib/auth";
import { todayIST } from "@/lib/dates";
import { queryFlats } from "@/lib/queries";
import { ExpenseForm } from "@/components/record-forms";
import { PageHeader } from "@/components/ui-bits";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const actor = await requireAdmin();
  const flats = await queryFlats(actor, { active: "all" });
  return (
    <div>
      <PageHeader title="Add expense" />
      <ExpenseForm today={todayIST()} flats={flats} />
    </div>
  );
}
