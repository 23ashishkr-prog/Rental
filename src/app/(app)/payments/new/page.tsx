import { requireAdmin } from "@/lib/auth";
import { loadSnapshots } from "@/lib/portfolio";
import { parseMonthParam, todayIST } from "@/lib/dates";
import { flatMonthFigures } from "@/lib/dashboard";
import { roundMoney } from "@/lib/money";
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
  const params = await searchParams;
  const month = parseMonthParam(one(params.month));
  const preset = Number(one(params.flat));
  const presetAmount = readPresetAmount(one(params.amount));
  const snapshots = await loadSnapshots(actor, month, { active: "all" });
  const flats = snapshots.map((flat) => ({
    id: flat.id,
    unitNumber: flat.unitNumber,
    tenantName: flat.tenantName,
  }));
  const suggestions = snapshots.map((flat) => {
    const figures = flatMonthFigures(flat.ledger, month);
    return { flatId: flat.id, due: figures.due, left: figures.left, total: figures.total };
  });

  return (
    <div>
      <PageHeader title="Record payment" subtitle="The flat, amount, date, and month are filled in. Change only what is different." />
      {flats.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add a flat before recording a payment.</p>
      ) : (
        <PaymentForm
          flats={flats}
          today={todayIST()}
          month={month}
          presetFlatId={Number.isInteger(preset) && preset > 0 ? preset : undefined}
          presetAmount={presetAmount}
          suggestions={suggestions}
        />
      )}
    </div>
  );
}

function readPresetAmount(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw.replace(/[₹,\s]/g, ""));
  if (!Number.isFinite(value) || value <= 0 || value > 10_000_000) return undefined;
  return roundMoney(value);
}
