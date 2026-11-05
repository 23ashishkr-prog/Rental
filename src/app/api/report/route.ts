import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadSnapshots } from "@/lib/portfolio";
import { parseMonthParam } from "@/lib/dates";
import { toCsv } from "@/lib/csv";
import { pendingLabel } from "@/lib/rent";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const month = parseMonthParam(new URL(request.url).searchParams.get("month") ?? undefined);
  const snapshots = await loadSnapshots(user, month, { active: "all" });
  const headers = [
    "Flat",
    "Tenant",
    "Email",
    "Phone",
    "Monthly rent INR",
    "Opening INR",
    "Charge INR",
    "Adjustment INR",
    "Paid INR",
    "Closing INR",
    "Pending INR",
    "Pending months",
    "Credit INR",
  ];
  const rows = snapshots.map((flat) => {
    const line = flat.ledger.months.find((item) => item.month === month);
    return [
      flat.unitNumber,
      flat.tenantName,
      flat.tenantEmail,
      flat.tenantPhone,
      line?.rent ?? flat.monthlyRent,
      line?.opening ?? 0,
      line?.charge ?? 0,
      line?.adjustment ?? 0,
      line?.paid ?? 0,
      line?.closing ?? 0,
      flat.ledger.pending,
      pendingLabel(flat.ledger.pendingMonths, flat.ledger.partial),
      flat.ledger.credit,
    ];
  });
  const csv = toCsv(headers, rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rent-report-${month.slice(0, 7)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
