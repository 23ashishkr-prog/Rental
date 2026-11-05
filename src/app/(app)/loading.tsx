export default function Loading() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="h-28 animate-pulse rounded-3xl bg-muted" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
