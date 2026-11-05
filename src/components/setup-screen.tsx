import { ConfigError } from "@/lib/errors";

export function SetupScreen({ message }: { message: string }) {
  const migration = message.includes("password_hash") || message.includes("migrations/");
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
      <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Ordinary Rent</p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">Setup needed</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
      {migration ? (
        <pre className="mt-5 overflow-x-auto rounded-2xl bg-card p-4 text-xs leading-5 ring-1 ring-foreground/10">
{`ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS password_hash text;

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS password_set_at timestamptz;`}
        </pre>
      ) : null}
      <p className="mt-4 text-xs text-muted-foreground">
        The full script is in migrations/001_app_users_password.sql. It only adds columns.
      </p>
    </main>
  );
}

export function isConfigError(error: unknown): error is ConfigError {
  return error instanceof ConfigError;
}
