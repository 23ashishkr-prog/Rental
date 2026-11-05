"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { actionError, type FormState } from "@/lib/action-error";
import { requireAdmin, requireUser } from "@/lib/auth";
import { AppError, ConfigError } from "@/lib/errors";
import { isValidEmail } from "@/lib/email";
import {
  deleteAdjustment,
  deleteExpense,
  deleteFlat,
  deletePayment,
  deleteRentChange,
  insertAdjustment,
  insertExpense,
  insertFlat,
  insertPayment,
  inviteTenant,
  saveRentChange,
  setPaymentStatus,
  updateExpense,
  updateFlat,
  updatePayment,
  type ExpenseInput,
  type FlatInput,
  type PaymentInput,
} from "@/lib/mutations";
import { roundMoney } from "@/lib/money";
import {
  clip,
  emptyToNull,
  readAmount,
  readDate,
  readId,
  readMonthField,
  readOptionalDate,
  readSignedAmount,
  readString,
} from "@/lib/parse";

const STATUSES = new Set(["pending", "confirmed", "rejected"]);

function flatFromForm(formData: FormData): FlatInput {
  const unitNumber = clip(readString(formData, "unit_number"), 40);
  if (!unitNumber) throw new AppError("Enter the flat or unit number.");
  const email = readString(formData, "tenant_email");
  if (email && !isValidEmail(email)) throw new AppError("Enter a valid tenant email, or leave it blank.");
  const activeValues = formData.getAll("active").map(String);
  const active = activeValues.length === 0 ? true : activeValues.includes("on") || activeValues.includes("true");
  const rentRaw = readString(formData, "monthly_rent").replace(/[₹,\s]/g, "");
  const rentValue = rentRaw === "" ? 0 : Number(rentRaw);
  if (!Number.isFinite(rentValue) || rentValue < 0 || rentValue > 10_000_000) {
    throw new AppError("Enter a monthly rent of zero or more.");
  }
  return {
    unitNumber,
    tenantName: emptyToNull(clip(readString(formData, "tenant_name"), 120)),
    tenantEmail: email ? email.toLowerCase() : null,
    tenantPhone: emptyToNull(clip(readString(formData, "tenant_phone"), 20)),
    monthlyRent: roundMoney(rentValue),
    rentStartDate: readOptionalDate(formData, "rent_start_date"),
    active,
    openingBalance: readOpeningBalance(formData),
  };
}

function readOpeningBalance(formData: FormData): number {
  const raw = readString(formData, "opening_balance").replace(/[₹,\s]/g, "");
  if (!raw) return 0;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new AppError("Enter an opening balance, or leave it blank.");
  const rounded = roundMoney(value);
  if (Math.abs(rounded) > 10_000_000) throw new AppError("That opening balance is too large.");
  return rounded;
}

function paymentFromForm(formData: FormData, fallbackStatus: PaymentInput["status"]): PaymentInput {
  const statusRaw = readString(formData, "status");
  const status = STATUSES.has(statusRaw) ? (statusRaw as PaymentInput["status"]) : fallbackStatus;
  const method = clip(readString(formData, "method"), 40);
  return {
    flatId: readId(formData, "flat_id"),
    amount: readAmount(formData),
    paymentDate: readDate(formData, "payment_date", "payment date"),
    forMonth: readMonthField(formData, "for_month"),
    method: method || null,
    upiRef: emptyToNull(clip(readString(formData, "upi_ref"), 80)),
    notes: emptyToNull(clip(readString(formData, "notes"), 2000)),
    status,
  };
}

function expenseFromForm(formData: FormData): ExpenseInput {
  const title = clip(readString(formData, "title"), 120);
  if (!title) throw new AppError("Enter a title for the expense.");
  const flatRaw = readString(formData, "flat_id");
  let flatId: number | null = null;
  if (flatRaw) {
    const parsed = Number(flatRaw);
    if (!Number.isInteger(parsed) || parsed <= 0) throw new AppError("Choose a valid flat.");
    flatId = parsed;
  }
  const category = clip(readString(formData, "category"), 40);
  return {
    title,
    category: category || "Other",
    amount: readAmount(formData),
    expenseDate: readDate(formData, "expense_date", "expense date"),
    notes: emptyToNull(clip(readString(formData, "notes"), 2000)),
    flatId,
  };
}

export async function saveFlatAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requireAdmin();
    const input = flatFromForm(formData);
    const existing = readString(formData, "id");
    if (existing) {
      const id = Number(existing);
      await updateFlat(actor, id, input);
      revalidatePath("/flats");
      revalidatePath(`/flats/${id}`);
      revalidatePath("/");
      revalidatePath("/profit");
      redirect(`/flats/${id}`);
    }
    const id = await insertFlat(actor, input);
    revalidatePath("/flats");
    revalidatePath("/");
    revalidatePath("/profit");
    redirect(`/flats/${id}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteFlatAction(formData: FormData): Promise<void> {
  const id = readId(formData);
  try {
    const actor = await requireAdmin();
    await deleteFlat(actor, id);
  } catch (error) {
    unstable_rethrow(error);
    const message = error instanceof AppError ? error.message : "Could not delete that flat.";
    redirect(`/flats/${id}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/flats");
  redirect("/flats");
}

export async function savePaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requireAdmin();
    const input = paymentFromForm(formData, "confirmed");
    const existing = readString(formData, "id");
    if (existing) {
      await updatePayment(actor, Number(existing), input);
    } else {
      await insertPayment(actor, input);
    }
    revalidatePath("/payments");
    revalidatePath("/");
    revalidatePath("/profit");
    revalidatePath(`/flats/${input.flatId}`);
    revalidatePath("/confirmations");
    redirect(`/flats/${input.flatId}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function submitTenantPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requireUser();
    const input = paymentFromForm(formData, "pending");
    if (!actor.isAdmin && !actor.flatIds.includes(input.flatId)) {
      throw new AppError("You can only submit a payment for your own flat.");
    }
    const reference = input.upiRef ?? "";
    if (reference.length < 4) throw new AppError("Enter the UPI reference from your payment app (at least 4 characters).");
    input.status = actor.isAdmin ? "confirmed" : "pending";
    input.method = "UPI";
    await insertPayment(actor, input);
    revalidatePath("/pay");
    revalidatePath("/");
    revalidatePath("/payments");
    revalidatePath("/confirmations");
    revalidatePath(`/flats/${input.flatId}`);
    redirect(actor.isAdmin ? `/flats/${input.flatId}` : "/payments?submitted=1");
  } catch (error) {
    return actionError(error);
  }
}

export async function deletePaymentAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const id = readId(formData);
  await deletePayment(actor, id);
  revalidatePath("/payments");
  revalidatePath("/");
  revalidatePath("/confirmations");
  redirect("/payments");
}

export async function confirmPaymentAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  await setPaymentStatus(actor, readId(formData), "confirmed");
  revalidatePath("/confirmations");
  revalidatePath("/payments");
  revalidatePath("/");
  redirect("/confirmations");
}

export async function rejectPaymentAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  await setPaymentStatus(actor, readId(formData), "rejected");
  revalidatePath("/confirmations");
  revalidatePath("/payments");
  revalidatePath("/");
  redirect("/confirmations");
}

export async function saveExpenseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requireAdmin();
    const input = expenseFromForm(formData);
    const existing = readString(formData, "id");
    if (existing) await updateExpense(actor, Number(existing), input);
    else await insertExpense(actor, input);
    revalidatePath("/expenses");
    revalidatePath("/");
    revalidatePath("/profit");
    redirect("/expenses");
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  await deleteExpense(actor, readId(formData));
  revalidatePath("/expenses");
  revalidatePath("/");
  revalidatePath("/profit");
  redirect("/expenses");
}

function revalidateRent(flatId: number) {
  revalidatePath(`/flats/${flatId}`);
  revalidatePath("/flats");
  revalidatePath("/");
  revalidatePath("/profit");
  revalidatePath("/report");
  revalidatePath("/pay");
}

export async function saveRentChangeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requireAdmin();
    const flatId = readId(formData, "flat_id");
    const existing = readString(formData, "id");
    await saveRentChange(actor, {
      id: existing ? readId(formData) : undefined,
      flatId,
      effectiveMonth: readMonthField(formData, "effective_month"),
      monthlyRent: readAmount(formData),
      note: emptyToNull(clip(readString(formData, "note"), 200)),
      updateCurrent: formData.getAll("update_current").map(String).includes("on"),
    });
    revalidateRent(flatId);
    redirect(`/flats/${flatId}#rent-increase`);
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteRentChangeAction(formData: FormData): Promise<void> {
  const flatId = readId(formData, "flat_id");
  try {
    const actor = await requireAdmin();
    await deleteRentChange(actor, readId(formData));
  } catch (error) {
    unstable_rethrow(error);
    const message =
      error instanceof AppError || error instanceof ConfigError ? error.message : "Could not delete that rent change.";
    redirect(`/flats/${flatId}?error=${encodeURIComponent(message)}#rent-increase`);
  }
  revalidateRent(flatId);
  redirect(`/flats/${flatId}#rent-increase`);
}

export async function saveAdjustmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requireAdmin();
    const flatId = readId(formData, "flat_id");
    await insertAdjustment(actor, {
      flatId,
      month: readMonthField(formData, "month"),
      amount: readSignedAmount(formData),
      reason: emptyToNull(clip(readString(formData, "reason"), 200)),
    });
    revalidatePath(`/flats/${flatId}`);
    revalidatePath("/");
    revalidatePath("/profit");
    redirect(`/flats/${flatId}`);
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteAdjustmentAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const flatId = await deleteAdjustment(actor, readId(formData));
  revalidatePath(`/flats/${flatId ?? ""}`);
  revalidatePath("/");
  revalidatePath("/profit");
  redirect(flatId ? `/flats/${flatId}` : "/flats");
}

export async function inviteTenantAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const actor = await requireAdmin();
    const flatId = readId(formData, "flat_id");
    const email = readString(formData, "email");
    await inviteTenant(actor, {
      flatId,
      email,
      name: emptyToNull(clip(readString(formData, "name"), 120)),
      phone: emptyToNull(clip(readString(formData, "phone"), 20)),
    });
    revalidatePath("/tenants");
    revalidatePath(`/flats/${flatId}`);
    revalidatePath("/flats");
    redirect(`/flats/${flatId}?invited=1`);
  } catch (error) {
    return actionError(error);
  }
}
