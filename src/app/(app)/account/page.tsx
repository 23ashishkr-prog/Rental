import { requireUser } from "@/lib/auth";
import { findUserById } from "@/lib/queries";
import { PasswordForm } from "@/components/record-forms";
import { PageHeader } from "@/components/ui-bits";
import { logoutAction } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const actor = await requireUser();
  const user = await findUserById(actor.id);
  return (
    <div className="space-y-6">
      <PageHeader title="Account" subtitle={actor.isAdmin ? "Admin" : "Tenant"} />
      <section className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <p className="text-lg font-semibold">{actor.name || "No name"}</p>
        <p className="text-sm">{actor.email}</p>
      </section>
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Password</h2>
        <PasswordForm hasPassword={Boolean(user?.passwordHash)} />
      </section>
      <form action={logoutAction}>
        <Button type="submit" variant="secondary" className="h-12 w-full text-base">
          Log out
        </Button>
      </form>
    </div>
  );
}
