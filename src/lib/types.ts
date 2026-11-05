export type PaymentStatus = "pending" | "confirmed" | "rejected";

export type Actor = {
  id: number;
  email: string;
  name: string | null;
  role: "admin" | "tenant";
  isAdmin: boolean;
  flatIds: number[];
};

export type DbUser = {
  id: number;
  email: string;
  name: string | null;
  role: "admin" | "tenant";
  flatId: number | null;
  passwordHash: string | null;
  isAdmin: boolean;
};

export type FlatRecord = {
  id: number;
  unitNumber: string;
  tenantName: string | null;
  monthlyRent: number;
  rentStartDate: string | null;
  tenantEmail: string | null;
  tenantPhone: string | null;
  active: boolean;
  openingBalance: number;
  createdAt: string;
};

export type PaymentRecord = {
  id: number;
  flatId: number;
  unitNumber: string;
  tenantName: string | null;
  paymentDate: string;
  amount: number;
  notes: string | null;
  forMonth: string | null;
  method: string | null;
  upiRef: string | null;
  status: PaymentStatus;
  createdAt: string;
};

export type ExpenseRecord = {
  id: number;
  title: string;
  category: string | null;
  amount: number;
  expenseDate: string;
  notes: string | null;
  flatId: number | null;
  unitNumber: string | null;
  createdAt: string;
};

export type RentChangeRecord = {
  id: number;
  flatId: number;
  effectiveMonth: string;
  monthlyRent: number;
  note: string | null;
  createdAt: string;
};

export type AdjustmentRecord = {
  id: number;
  flatId: number;
  month: string;
  amount: number;
  reason: string | null;
  createdBy: number | null;
  createdAt: string;
};

export function ownsFlat(actor: Actor, flatId: number): boolean {
  return actor.isAdmin || actor.flatIds.includes(flatId);
}
