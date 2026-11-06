import Link from "next/link";
import { AppNav, type NavItem } from "@/components/app-nav";
import type { Actor } from "@/lib/types";

export function Shell({
  user,
  pendingCount,
  children,
}: {
  user: Actor;
  pendingCount: number;
  children: React.ReactNode;
}) {
  const items: NavItem[] = user.isAdmin
    ? [
        { href: "/", label: "Home", icon: "home" },
        { href: "/flats", label: "Flats", icon: "flats" },
        { href: "/payments", label: "Payments", icon: "payments", badge: pendingCount || undefined },
        { href: "/expenses", label: "Expenses", icon: "expenses" },
        { href: "/more", label: "More", icon: "more" },
      ]
    : [
        { href: "/", label: "Home", icon: "home" },
        { href: "/pay", label: "Pay", icon: "pay" },
        { href: "/payments", label: "History", icon: "payments", badge: pendingCount || undefined },
        { href: "/report", label: "Report", icon: "report" },
        { href: "/account", label: "Account", icon: "account" },
      ];

  const who = user.name?.split(" ")[0] || user.email;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      <AppNav items={items} />
      <div className="min-w-0">
        <header
          className="sticky top-0 z-30 border-b border-white/60 bg-background/75 backdrop-blur-xl"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 md:px-8">
            <Link href="/" className="flex items-center gap-2 md:hidden">
              <span className="grid size-8 place-items-center rounded-lg bg-primary text-sm text-primary-foreground">
                ₹
              </span>
              <span className="font-display text-base font-semibold">Ordinary Rent</span>
            </Link>
            <p className="hidden text-sm text-muted-foreground md:block">
              {user.isAdmin ? "Admin" : "Your flat"} · {user.email}
            </p>
            <p className="truncate text-sm text-muted-foreground md:hidden">{who}</p>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:px-8 md:pt-6 md:pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}
