"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CircleUser,
  FileSpreadsheet,
  Home,
  IndianRupee,
  Menu,
  Receipt,
  Wallet,
} from "lucide-react";
import { logoutAction } from "@/server/auth-actions";
import { cn } from "cn";

export type NavItem = {
  href: string;
  label: string;
  icon: "home" | "flats" | "payments" | "expenses" | "more" | "pay" | "report" | "account";
  badge?: number;
};

const ICONS = {
  home: Home,
  flats: Building2,
  payments: Wallet,
  expenses: Receipt,
  more: Menu,
  pay: IndianRupee,
  report: FileSpreadsheet,
  account: CircleUser,
};

function active(path: string, href: string) {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

export function AppNav({ items }: { items: NavItem[] }) {
  const path = usePathname();

  const links = items.map((item) => {
    const Icon = ICONS[item.icon];
    const on = active(path, item.href);
    return { ...item, Icon, on };
  });

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-foreground/10 bg-card/80 px-3 py-5 md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary font-display text-lg text-primary-foreground">
            ₹
          </span>
          <span className="font-display text-lg leading-none font-semibold">Ordinary Rent</span>
        </Link>
        <div className="flex flex-1 flex-col gap-1">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.on ? "page" : undefined}
              className={cn(
                "flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium",
                item.on ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.Icon className="size-5" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="grid min-w-6 place-items-center rounded-full bg-amber-700 px-1.5 text-xs text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="h-12 w-full rounded-xl px-3 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Log out
          </button>
        </form>
      </aside>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 bg-card/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        <ul
          className="grid"
          style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}
        >
          {links.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={item.on ? "page" : undefined}
                className={cn(
                  "relative flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium",
                  item.on ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.Icon className="size-6" aria-hidden />
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="absolute top-1.5 right-[calc(50%-1.4rem)] grid min-w-5 place-items-center rounded-full bg-amber-700 px-1 text-[10px] text-white">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
