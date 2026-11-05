import { Badge } from "@/components/ui/badge";
import type { PaymentStatus } from "@/lib/types";

const styles: Record<PaymentStatus, string> = {
  confirmed: "bg-teal-100 text-teal-950",
  pending: "bg-amber-100 text-amber-950",
  rejected: "bg-rose-100 text-rose-950",
};

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const label = status === "confirmed" ? "Confirmed" : status === "pending" ? "Pending" : "Rejected";
  return <Badge className={`h-6 px-2 capitalize ${styles[status]}`}>{label}</Badge>;
}
