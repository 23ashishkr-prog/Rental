import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadSnapshots } from "@/lib/portfolio";
import { currentMonthKey, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { one } from "@/lib/search";
import QRCode from "qrcode";
import { PayPanel } from "@/components/pay-panel";
import { displayedRent } from "@/lib/rent";
import { flatMonthFigures } from "@/lib/dashboard";
import { buildUpiUrl } from "@/lib/upi";
import { PageHeader, buttonLinkClass } from "@/components/ui-bits";
export const dynamic = "force-dynamic";

export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireUser();
  const params = await searchParams;
  const requested = Number(one(params.flat));
  const month = currentMonthKey();
  const snapshots = await loadSnapshots(actor, month, { active: "all" });
  const flat =
    snapshots.find((item) => item.id === requested) ?? (snapshots.length === 1 ? snapshots[0] : undefined);

  if (!flat) {
    return (
      <div>
        <PageHeader title="Pay rent" subtitle="Choose the flat you are paying for." />
        {snapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No flat is linked to this account.</p>
        ) : (
          <ul className="space-y-2">
            {snapshots.map((item) => (
              <li key={item.id}>
                <Link href={`/pay?flat=${item.id}`} className="flex items-center justify-between rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
                  <span className="font-semibold">{item.unitNumber}</span>
                  <span className="font-display text-lg">{item.ledger.pending > 0 ? formatINR(item.ledger.pending) : "Clear"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const figures = flatMonthFigures(flat.ledger, month);
  const defaultAmount = flat.ledger.pending > 0 ? flat.ledger.pending : figures.left > 0 ? figures.left : displayedRent(flat.ledger, month, flat.monthlyRent);
  const initialQr =
    defaultAmount > 0
      ? await QRCode.toString(buildUpiUrl(defaultAmount, `Flat ${flat.unitNumber} rent`), {
          type: "svg",
          margin: 1,
          width: 220,
          color: { dark: "#134e4a", light: "#ffffff" },
        })
      : "";

  return (
    <div>
      <PageHeader
        title="Pay rent"
        subtitle={flat.tenantName ? `${flat.unitNumber} · ${flat.tenantName}` : flat.unitNumber}
      />
      <PayPanel
        flatId={flat.id}
        unitNumber={flat.unitNumber}
        defaultAmount={defaultAmount}
        initialQr={initialQr}
        today={todayIST()}
        month={month}
        pending={flat.ledger.pending}
        monthLeft={figures.left}
      />
      {actor.isAdmin ? (
        <Link href={`/payments/new?flat=${flat.id}&month=${month.slice(0, 7)}&amount=${defaultAmount > 0 ? defaultAmount : ""}`} className={`${buttonLinkClass("ghost")} mt-4 w-full`}>
          Record payment
        </Link>
      ) : null}
    </div>
  );
}
