import { requireAdmin } from "@/lib/auth";
import { queryFlats } from "@/lib/queries";
import { InviteForm } from "@/components/record-forms";
import { PageHeader } from "@/components/ui-bits";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const actor = await requireAdmin();
  const flats = await queryFlats(actor, { active: "all" });
  return (
    <div>
      <PageHeader
        title="Invite a tenant"
        subtitle="Creates a login for that email and links it to the flat. They set a password on first sign-in."
      />
      {flats.length === 0 ? <p className="text-sm text-muted-foreground">Add a flat first.</p> : <InviteForm flats={flats} />}
    </div>
  );
}
