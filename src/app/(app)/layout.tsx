import { unstable_rethrow } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { countPendingPayments } from "@/lib/queries";
import type { Actor } from "@/lib/types";
import { isConfigError, SetupScreen } from "@/components/setup-screen";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let user: Actor | null = null;
  let pendingCount = 0;
  let setupMessage: string | null = null;
  try {
    user = await requireUser();
    pendingCount = await countPendingPayments(user);
  } catch (error) {
    unstable_rethrow(error);
    if (isConfigError(error)) setupMessage = error.message;
    else throw error;
  }
  if (setupMessage) return <SetupScreen message={setupMessage} />;
  if (!user) return null;
  return (
    <Shell user={user} pendingCount={pendingCount}>
      {children}
    </Shell>
  );
}
