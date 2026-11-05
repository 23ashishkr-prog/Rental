import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { queryFlats } from "@/lib/queries";
import { FlatForm } from "@/components/flat-form";
import { PageHeader } from "@/components/ui-bits";

export const dynamic = "force-dynamic";

export default async function EditFlatPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin();
  const { id } = await params;
  const flatId = Number(id);
  const [flat] = await queryFlats(actor, { flatId, active: "all" });
  if (!flat) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${flat.unitNumber}`} />
      <FlatForm flat={flat} />
    </div>
  );
}
