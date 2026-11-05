import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { countPendingPayments } from "@/lib/queries";
import { PageHeader } from "@/components/ui-bits";

export const dynamic = "force-dynamic";

export default async function MorePage() {
  const actor = await requireUser();
  const pending = actor.isAdmin ? await countPendingPayments(actor) : 0;
  const links = actor.isAdmin
    ? [
        { href: "/confirmations", label: "Pending confirmations", hint: pending ? `${pending} waiting` : "None waiting" },
        { href: "/report", label: "Monthly report", hint: "Balances and CSV export" },
        { href: "/profit", label: "Profit by flat", hint: "Collection, expenses, and net" },
        { href: "/tenants", label: "Invite a tenant", hint: "Email login for one flat" },
        { href: "/account", label: "Account", hint: actor.email },
      ]
    : [
        { href: "/report", label: "Monthly report", hint: "Your flat only" },
        { href: "/account", label: "Account", hint: actor.email },
      ];

  return (
    <div>
      <PageHeader title="More" />
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="block rounded-2xl bg-card px-4 py-4 ring-1 ring-foreground/10">
              <span className="block text-base font-semibold">{link.label}</span>
              <span className="text-sm text-muted-foreground">{link.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
