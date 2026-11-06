"use client";

import { useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/money";
import { cn } from "cn";

export type HomeFlatCard = {
  id: number;
  unitNumber: string;
  tenantName: string | null;
  due: number;
  paid: number;
  left: number;
  earlier: number;
  total: number;
  status: "paid" | "partial" | "due" | "none";
  detailsHref: string;
  recordHref: string | null;
  payHref: string | null;
  whatsAppHref: string | null;
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "due", label: "Not paid" },
  { id: "partial", label: "Part paid" },
  { id: "paid", label: "Paid" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const TONE = {
  paid: "border-emerald-200/90 bg-emerald-50/80",
  partial: "border-amber-200/90 bg-amber-50/85",
  due: "border-rose-200/90 bg-rose-50/80",
  none: "border-white/80 bg-white/60",
} as const;

const LABEL = {
  paid: "Paid",
  partial: "Part paid",
  due: "Not paid",
  none: "No rent this month",
} as const;

export function HomeBoard({ flats, canRecord }: { flats: HomeFlatCard[]; canRecord: boolean }) {
  const [filter, setFilter] = useState<FilterId>("all");
  const counts = {
    all: flats.length,
    paid: flats.filter((flat) => flat.status === "paid").length,
    partial: flats.filter((flat) => flat.status === "partial").length,
    due: flats.filter((flat) => flat.status === "due").length,
  };
  const shown = filter === "all" ? flats : flats.filter((flat) => flat.status === filter);

  return (
    <section className="mt-5">
      <h2 className="font-display text-xl font-semibold">Flats this month</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Show flats by payment status">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={cn(
              "min-h-14 rounded-2xl border px-3 py-2 text-left",
              filter === item.id ? "border-foreground/20 bg-white shadow-sm" : "border-white/70 bg-white/45",
              item.id === "paid" && "text-emerald-900",
              item.id === "partial" && "text-amber-950",
              item.id === "due" && "text-rose-900",
            )}
          >
            <span className="block text-sm font-medium">{item.label}</span>
            <span className="font-display text-2xl font-semibold">{counts[item.id]}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="mt-3 rounded-[1.75rem] border border-white/80 bg-white/60 px-4 py-5 text-sm text-muted-foreground">
          {flats.length === 0 ? "No flats to show." : "No flats in this group."}
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {shown.map((flat) => (
            <li key={flat.id} className={cn("rounded-[1.75rem] border p-4 shadow-[0_16px_40px_-30px_rgba(92,58,24,0.6)] backdrop-blur-xl", TONE[flat.status])}>
              <Link href={flat.detailsHref} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{flat.unitNumber}</p>
                    <p className="truncate text-sm text-foreground/70">{flat.tenantName || "No tenant name"}</p>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1 text-sm font-semibold",
                      flat.status === "paid" && "bg-emerald-700 text-white",
                      flat.status === "partial" && "bg-amber-600 text-white",
                      flat.status === "due" && "bg-rose-700 text-white",
                      flat.status === "none" && "bg-white/80 text-foreground",
                    )}
                  >
                    {LABEL[flat.status]}
                  </p>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-foreground/65">Due</dt>
                    <dd className="font-display text-lg font-semibold">{formatINR(flat.due)}</dd>
                  </div>
                  <div>
                    <dt className="text-emerald-900/80">Paid</dt>
                    <dd className="font-display text-lg font-semibold text-emerald-800">{formatINR(flat.paid)}</dd>
                  </div>
                  <div>
                    <dt className={flat.left > 0 ? "text-rose-900/80" : "text-emerald-900/80"}>Left</dt>
                    <dd className={cn("font-display text-lg font-semibold", flat.left > 0 ? "text-rose-700" : "text-emerald-800")}>
                      {formatINR(flat.left)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-sm text-foreground/75">
                  Earlier unpaid {formatINR(flat.earlier)} · Total {formatINR(flat.total)}
                </p>
              </Link>
              {flat.left > 0 || flat.total > 0 ? (
                <div className="mt-3 flex gap-2">
                  {canRecord && flat.recordHref ? (
                    <Link
                      href={flat.recordHref}
                      className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-primary px-3 text-sm font-medium text-primary-foreground"
                    >
                      Record payment
                    </Link>
                  ) : null}
                  {!canRecord && flat.payHref ? (
                    <Link
                      href={flat.payHref}
                      className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-primary px-3 text-sm font-medium text-primary-foreground"
                    >
                      Pay rent
                    </Link>
                  ) : null}
                  {flat.whatsAppHref ? (
                    <a
                      href={flat.whatsAppHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-white/80 px-3 text-sm font-medium ring-1 ring-foreground/10"
                    >
                      Remind
                    </a>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
