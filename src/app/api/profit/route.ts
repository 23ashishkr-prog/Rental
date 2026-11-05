import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parseYearParam, todayIST } from "@/lib/dates";
import { profitCsv, buildProfitReport } from "@/lib/profit";
import { expenseFlatColumnExists, queryAdjustments, queryExpenses, queryFlats, queryPayments, queryRentChanges } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!user.isAdmin) return NextResponse.redirect(new URL("/", request.url));
  const url = new URL(request.url);
  const year = parseYearParam(url.searchParams.get("year") ?? undefined);
  const includePersonal = url.searchParams.get("personal") === "1";
  if (!(await expenseFlatColumnExists())) {
    return NextResponse.json(
      { error: "Run migrations/002_expense_flat.sql before exporting profit." },
      { status: 409 },
    );
  }
  const flats = await queryFlats(user, { active: "all" });
  const flatIds = flats.map((flat) => flat.id);
  const [payments, adjustments, expenses, rentChanges] = await Promise.all([
    queryPayments(user, { limit: null }),
    queryAdjustments(user, flatIds),
    queryExpenses(user, { year, limit: null }),
    queryRentChanges(user, flatIds),
  ]);
  const report = buildProfitReport({
    year,
    today: todayIST(),
    includePersonal,
    flats: flats.map((flat) => ({
      ...flat,
      rentChanges: rentChanges
        .filter((change) => change.flatId === flat.id)
        .map((change) => ({ effectiveMonth: change.effectiveMonth, monthlyRent: change.monthlyRent })),
    })),
    payments,
    adjustments,
    expenses,
  });
  return new NextResponse(profitCsv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="profit-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
