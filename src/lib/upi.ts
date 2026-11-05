import { roundMoney } from "./money";

export const UPI_ID = "9742515588@upi";
export const UPI_NAME = "Rent";

export function buildUpiUrl(amount: number, note: string): string {
  const rounded = roundMoney(amount);
  const am = rounded > 0 ? rounded.toFixed(2) : "0.00";
  const tn = note.replace(/\s+/g, " ").trim().slice(0, 80) || "Rent";
  return `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${am}&cu=INR&tn=${encodeURIComponent(tn)}`;
}

export function whatsAppHref(phone: string | null | undefined, text: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 11 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
