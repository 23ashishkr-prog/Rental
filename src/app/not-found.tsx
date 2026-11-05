import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5">
      <h1 className="font-display text-3xl font-semibold">Page not found</h1>
      <p className="mt-3 text-sm text-muted-foreground">That flat or page is not available on this account.</p>
      <Link href="/" className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-4 text-primary-foreground">
        Back home
      </Link>
    </main>
  );
}
