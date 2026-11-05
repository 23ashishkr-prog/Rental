import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { queryFlats, queryPayments } from "@/lib/queries";
import { currentMonthKey, todayIST } from "@/lib/dates";
import { PaymentForm } from "@/components/payment-form";
import { ConfirmForm } from "@/components/submit-button";
import { PageHeader } from "@/components/ui-bits";
import { deletePaymentAction } from "@/server/rent-actions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EditPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin();
  const { id } = await params;
  const paymentId = Number(id);
  const [payment] = await queryPayments(actor, { id: paymentId, limit: 1 });
  if (!payment) notFound();
  const flats = await queryFlats(actor, { active: "all" });
  return (
    <div className="space-y-6">
      <PageHeader title="Edit payment" subtitle={payment.unitNumber} />
      <PaymentForm flats={flats} payment={payment} today={todayIST()} month={payment.forMonth || currentMonthKey()} />
      <ConfirmForm action={deletePaymentAction} message="Delete this payment permanently?">
        <input type="hidden" name="id" value={payment.id} />
        <Button type="submit" variant="destructive" className="h-12 w-full text-base">
          Delete payment
        </Button>
      </ConfirmForm>
    </div>
  );
}
