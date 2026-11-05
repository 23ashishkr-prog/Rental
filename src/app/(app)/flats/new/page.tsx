import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { FlatForm } from "@/components/flat-form";
import { PageHeader } from "@/components/ui-bits";

export const dynamic = "force-dynamic";

export default async function NewFlatPage() {
  await requireAdmin();
  return (
    <div>
      <PageHeader title="Add flat" subtitle="Unit, tenant, and the rent that starts accruing." />
      <FlatForm />
      <Link href="/flats" className="mt-4 block text-center text-sm font-medium text-primary">
        Cancel
      </Link>
    </div>
  );
}
