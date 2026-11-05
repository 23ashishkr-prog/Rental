import { formatINR } from "./money";
import { pendingLabel } from "./rent";
import { UPI_ID } from "./upi";

export function reminderText(input: {
  tenantName: string | null;
  unitNumber: string;
  pending: number;
  pendingMonths: number;
  partial: boolean;
}): string {
  const name = input.tenantName?.trim() || "there";
  return `Hi ${name}, a reminder from Ordinary Rent. Flat ${input.unitNumber} has ${formatINR(input.pending)} pending (${pendingLabel(input.pendingMonths, input.partial)}). Please pay by UPI to ${UPI_ID}. Thank you.`;
}
