import { redirect, unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isConfigError, SetupScreen } from "@/components/setup-screen";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  try {
    const user = await getCurrentUser();
    if (user) redirect("/");
  } catch (error) {
    unstable_rethrow(error);
    if (isConfigError(error)) return <SetupScreen message={error.message} />;
    throw error;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Ordinary Rent</p>
      <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 mb-6 text-sm leading-6 text-muted-foreground">
        Use the email the owner has on file. The first time, you will choose a password. After that, the password is required.
      </p>
      <LoginForm />
    </main>
  );
}
