import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadSnapshots } from "@/lib/portfolio";
import { parseMonthParam } from "@/lib/dates";
import { flatMonthFigures, recordPaymentHref, suggestedRecordAmount, summarizeDashboard } from "@/lib/dashboard";
import { reminderText } from "@/lib/reminders";
import { whatsAppHref } from "@/lib/upi";
import { one } from "@/lib/search";
import { MonthSwitcher } from "@/components/month-switcher";
import { MonthSummary } from "@/components/month-summary";
import { HomeBoard, type HomeFlatCard } from "@/components/home-board";
import { buttonLinkClass } from "@/components/ui-bits";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireUser();
  const params = await searchParams;
  const month = parseMonthParam(one(params.month));
  const snapshots = await loadSnapshots(actor, month, { active: actor.isAdmin ? "active" : "all" });
  const summary = summarizeDashboard(snapshots, month);
  const cards: HomeFlatCard[] = snapshots
    .map((flat) => {
      const figures = flatMonthFigures(flat.ledger, month);
      const amount = suggestedRecordAmount(figures);
      const remind =
        flat.ledger.pending > 0
          ? whatsAppHref(
              flat.tenantPhone,
              reminderText({
                tenantName: flat.tenantName,
                unitNumber: flat.unitNumber,
                pending: flat.ledger.pending,
                pendingMonths: flat.ledger.pendingMonths,
                partial: flat.ledger.partial,
              }),
            )
          : null;
      return {
        id: flat.id,
        unitNumber: flat.unitNumber,
        tenantName: flat.tenantName,
        due: figures.due,
        paid: figures.paid,
        left: figures.left,
        earlier: figures.earlier,
        total: figures.total,
        status: figures.status,
        detailsHref: `/flats/${flat.id}?month=${month.slice(0, 7)}`,
        recordHref: actor.isAdmin ? recordPaymentHref(flat.id, month, amount) : null,
        payHref: `/pay?flat=${flat.id}`,
        whatsAppHref: actor.isAdmin ? remind : null,
      };
    })
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.unitNumber.localeCompare(b.unitNumber, "en", { numeric: true }));

  return (
    <div>
      <MonthSwitcher month={month} path="/" />
      {snapshots.length === 0 ? (
        <p className="rounded-[1.75rem] border border-white/80 bg-white/60 px-4 py-5 text-sm text-muted-foreground">
          {actor.isAdmin
            ? "No active flats yet."
            : "No flat is linked to this login yet. Ask the owner to invite this email on your flat."}
        </p>
      ) : (
        <>
          <MonthSummary summary={summary} month={month} />
          {actor.isAdmin ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href={`/payments/new?month=${month.slice(0, 7)}`} className={buttonLinkClass()}>
                Record payment
              </Link>
              <Link href="/profit" className={buttonLinkClass("secondary")}>
                Profit by flat
              </Link>
            </div>
          ) : (
            <Link href={snapshots.length === 1 ? `/pay?flat=${snapshots[0].id}` : "/pay"} className={`${buttonLinkClass()} mt-4 w-full`}>
              Pay rent
            </Link>
          )}
          <HomeBoard flats={cards} canRecord={actor.isAdmin} />
        </>
      )}
    </div>
  );
}

function statusRank(status: HomeFlatCard["status"]): number {
  if (status === "due") return 0;
  if (status === "partial") return 1;
  if (status === "paid") return 2;
  return 3;
}
