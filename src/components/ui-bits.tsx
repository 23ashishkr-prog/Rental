import type { FormState } from "@/lib/action-error";
import { cn } from "cn";

export const controlClass =
  "h-12 w-full rounded-xl border border-input bg-card px-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

export function buttonLinkClass(variant: "primary" | "secondary" | "ghost" = "primary") {
  return cn(
    "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
    variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
    variant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    variant === "ghost" && "bg-card text-foreground ring-1 ring-foreground/10 hover:bg-muted",
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FormMessage({ state }: { state: FormState | null }) {
  if (state?.error) {
    return (
      <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {state.error}
      </p>
    );
  }
  if (state?.ok) {
    return <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">{state.ok}</p>;
  }
  return null;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="font-display text-[1.7rem] leading-tight font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn";
}) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "font-display mt-1 text-[1.65rem] leading-none font-semibold tracking-tight",
          tone === "good" && "text-teal-800",
          tone === "warn" && "text-amber-800",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
