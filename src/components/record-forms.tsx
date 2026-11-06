"use client";

import { useActionState } from "react";
import { saveExpenseAction, saveAdjustmentAction, saveRentChangeAction, inviteTenantAction } from "@/server/rent-actions";
import { changePasswordAction } from "@/server/auth-actions";
import { Field, FormMessage, controlClass } from "@/components/ui-bits";
import { SubmitButton } from "@/components/submit-button";
import { EXPENSE_CATEGORIES } from "@/lib/categories";
import type { ExpenseRecord, FlatRecord } from "@/lib/types";

export function ExpenseForm({
  expense,
  today,
  flats,
}: {
  expense?: ExpenseRecord;
  today: string;
  flats: { id: number; unitNumber: string; active: boolean }[];
}) {
  const [state, action] = useActionState(saveExpenseAction, null);
  const known = new Set<string>(EXPENSE_CATEGORIES);
  const current = expense?.category?.trim() ?? "";
  const categories = current && !known.has(current) ? [current, ...EXPENSE_CATEGORIES] : [...EXPENSE_CATEGORIES];
  return (
    <form action={action} className="space-y-4">
      {expense ? <input type="hidden" name="id" value={expense.id} /> : null}
      <Field label="Title" htmlFor="title">
        <input id="title" name="title" required defaultValue={expense?.title ?? ""} className={controlClass} />
      </Field>
      <Field label="Flat" htmlFor="flat_id" hint="Leave this as general overhead for staff salary and other costs that are not one flat.">
        <select id="flat_id" name="flat_id" defaultValue={expense?.flatId ? String(expense.flatId) : ""} className={controlClass}>
          <option value="">General overhead</option>
          {flats.map((flat) => (
            <option key={flat.id} value={flat.id}>
              {flat.unitNumber}
              {flat.active ? "" : " (inactive)"}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Category" htmlFor="category" hint="Personal is left out of the business profit report unless you include it there.">
        <select id="category" name="category" defaultValue={expense?.category || "Other"} className={controlClass}>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Amount (₹)" htmlFor="amount">
        <input
          id="amount"
          name="amount"
          inputMode="decimal"
          required
          defaultValue={expense ? String(expense.amount) : ""}
          className={controlClass}
        />
      </Field>
      <Field label="Date" htmlFor="expense_date">
        <input
          id="expense_date"
          name="expense_date"
          type="date"
          required
          defaultValue={expense?.expenseDate || today}
          className={controlClass}
        />
      </Field>
      <Field label="Notes" htmlFor="notes">
        <textarea id="notes" name="notes" rows={3} defaultValue={expense?.notes ?? ""} className={`${controlClass} h-auto py-3`} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>{expense ? "Save expense" : "Add expense"}</SubmitButton>
    </form>
  );
}

export function RentChangeForm({
  flatId,
  change,
  defaultMonth,
  currentRent,
}: {
  flatId: number;
  change?: { id: number; effectiveMonth: string; monthlyRent: number; note: string | null };
  defaultMonth: string;
  currentRent?: number;
}) {
  const [state, action] = useActionState(saveRentChangeAction, null);
  return (
    <form action={action} id="rent-increase" className="space-y-4">
      <input type="hidden" name="flat_id" value={flatId} />
      {change ? <input type="hidden" name="id" value={change.id} /> : null}
      <Field label="From which month" htmlFor="effective_month" hint="This rent is due from this month until the next change.">
        <input
          id="effective_month"
          name="effective_month"
          type="month"
          required
          defaultValue={(change?.effectiveMonth || defaultMonth).slice(0, 7)}
          className={controlClass}
        />
      </Field>
      <Field label="New monthly rent (₹)" htmlFor="rent_change_amount" hint="Starts from the rent they pay now. Change the number, then save.">
        <input
          id="rent_change_amount"
          name="amount"
          inputMode="decimal"
          required
          defaultValue={change ? String(change.monthlyRent) : currentRent != null ? String(currentRent) : ""}
          className={controlClass}
        />
      </Field>
      <Field label="Note" htmlFor="rent_note">
        <input id="rent_note" name="note" defaultValue={change?.note ?? ""} className={controlClass} placeholder="Optional" />
      </Field>
      <label className="flex min-h-12 items-start gap-3 text-sm font-medium">
        <input type="checkbox" name="update_current" value="on" defaultChecked={!change} className="mt-1 size-5 accent-primary" />
        <span>Use this as the rent from the month above. Earlier months stay on the old rent.</span>
      </label>
      <FormMessage state={state} />
      <SubmitButton>{change ? "Save rent change" : "Save new rent"}</SubmitButton>
    </form>
  );
}

export function AdjustmentForm({ flatId, month }: { flatId: number; month: string }) {
  const [state, action] = useActionState(saveAdjustmentAction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="flat_id" value={flatId} />
      <Field label="Month" htmlFor="month">
        <input id="month" name="month" type="month" required defaultValue={month.slice(0, 7)} className={controlClass} />
      </Field>
      <Field label="Amount (₹)" htmlFor="adjustment-amount" hint="Positive adds a charge. Negative is a discount or waiver.">
        <input id="adjustment-amount" name="amount" inputMode="decimal" required placeholder="-500 or 800" className={controlClass} />
      </Field>
      <Field label="Reason" htmlFor="reason">
        <input id="reason" name="reason" className={controlClass} placeholder="Water, waiver, late fee…" />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>Add adjustment</SubmitButton>
    </form>
  );
}

export function InviteForm({ flats }: { flats: Pick<FlatRecord, "id" | "unitNumber" | "tenantName">[] }) {
  const [state, action] = useActionState(inviteTenantAction, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Flat" htmlFor="flat_id">
        <select id="flat_id" name="flat_id" required className={controlClass} defaultValue={flats[0] ? String(flats[0].id) : ""}>
          {flats.map((flat) => (
            <option key={flat.id} value={flat.id}>
              {flat.unitNumber}
              {flat.tenantName ? ` · ${flat.tenantName}` : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tenant email" htmlFor="email" hint="They choose a password the first time they sign in.">
        <input id="email" name="email" type="email" required className={controlClass} />
      </Field>
      <Field label="Name" htmlFor="name">
        <input id="name" name="name" className={controlClass} />
      </Field>
      <Field label="Phone" htmlFor="phone">
        <input id="phone" name="phone" inputMode="tel" className={controlClass} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>Invite tenant</SubmitButton>
    </form>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className="space-y-4">
      {hasPassword ? (
        <Field label="Current password" htmlFor="current">
          <input id="current" name="current" type="password" autoComplete="current-password" required className={controlClass} />
        </Field>
      ) : null}
      <Field label="New password" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={controlClass} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm">
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} className={controlClass} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Updating…">Update password</SubmitButton>
    </form>
  );
}
