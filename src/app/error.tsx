"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const migration = /password_hash|DATABASE_URL|AUTH_SECRET|flat_id|opening_balance|security_deposit|LEDGER_START|rent_changes/.test(error.message);
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5">
      <h1 className="font-display text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {migration
          ? error.message
          : "The page could not be loaded. Check the connection and try again."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 h-12 rounded-xl bg-primary text-base font-medium text-primary-foreground"
      >
        Try again
      </button>
    </main>
  );
}
