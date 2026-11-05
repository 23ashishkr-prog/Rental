import { requireAdmin } from "@/lib/auth";
import { queryFlats } from "@/lib/queries";
import { currentMonthKey, todayIST } from "@/lib/dates";
import { one } from "@/lib/search";
import { PaymentForm } from "@/components/payment-form";
import { PageHeader } from "@/components/ui-bits";

export const dynamic = "force-dynamic";

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  const flats = await queryFlats(actor, { active: "all" });
  const params = await searchParams;
  const preset = Number(one(params.flat));
  return (
    <div>
      <PageHeader title="Record payment" subtitle="Partial, back-dated, and advance payments are all allowed." />
      {flats.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add a flat before recording a payment.</p>
      ) : (
        <PaymentForm flats={flats} today={todayIST()} month={currentMonthKey()} presetFlatId={Number.isInteger(preset) ? preset : undefined} />
      )}
    </div>
  );
}
