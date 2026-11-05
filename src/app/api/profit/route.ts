import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parseYearParam, todayIST } from "@/lib/dates";
import { profitCsv, buildProfitReport } from "@/lib/profit";
import { expenseFlatColumnExists, queryAdjustments, queryExpenses, queryFlats, queryPayments } from "@/lib/queries";

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
  const [payments, adjustments, expenses] = await Promise.all([
    queryPayments(user, { limit: null }),
    queryAdjustments(user, flats.map((flat) => flat.id)),
    queryExpenses(user, { year, limit: null }),
  ]);
  const report = buildProfitReport({
    year,
    today: todayIST(),
    includePersonal,
    flats,
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
