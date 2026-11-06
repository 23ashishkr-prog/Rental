"use client";

import { useState } from "react";
import { useActionState } from "react";
import { savePaymentAction } from "@/server/rent-actions";
import { Field, FormMessage, controlClass } from "@/components/ui-bits";
import { SubmitButton } from "@/components/submit-button";
import { formatINR } from "@/lib/money";
import type { FlatRecord, PaymentRecord } from "@/lib/types";
import { cn } from "cn";

function monthKey(value: string): string {
  return value.slice(0, 7);
}

const METHODS = ["UPI", "Cash", "Bank transfer", "Cheque", "Other"] as const;

export type PaymentSuggestion = {
  flatId: number;
  due: number;
  left: number;
  total: number;
};

export function PaymentForm({
  flats,
  payment,
  today,
  month,
  presetFlatId,
  presetAmount,
  suggestions = [],
}: {
  flats: Pick<FlatRecord, "id" | "unitNumber" | "tenantName">[];
  payment?: PaymentRecord;
  today: string;
  month: string;
  presetFlatId?: number;
  presetAmount?: number;
  suggestions?: PaymentSuggestion[];
}) {
  const [state, action] = useActionState(savePaymentAction, null);
  const initialFlat = payment?.flatId ?? presetFlatId ?? flats[0]?.id ?? 0;
  const initialDate = (payment?.paymentDate || today).slice(0, 10);
  const explicitMonth = payment?.forMonth ? monthKey(payment.forMonth) : "";
  const startingMonth = explicitMonth || (payment ? monthKey(initialDate) : monthKey(month || initialDate));
  const [flatId, setFlatId] = useState(initialFlat);
  const [paymentDate, setPaymentDate] = useState(initialDate);
  const [forMonth, setForMonth] = useState(startingMonth);
  const [monthTouched, setMonthTouched] = useState(startingMonth !== monthKey(initialDate));
  const [amount, setAmount] = useState(payment ? String(payment.amount) : presetAmount && presetAmount > 0 ? String(presetAmount) : suggestedAmount(suggestions, initialFlat));
  const [amountTouched, setAmountTouched] = useState(Boolean(payment) || Boolean(presetAmount && presetAmount > 0));
  const [method, setMethod] = useState(payment?.method && METHODS.includes(payment.method as (typeof METHODS)[number]) ? payment.method : payment?.method || "UPI");
  const suggestion = suggestions.find((item) => item.flatId === flatId);
  const amountChoices = suggestion ? amountChoicesFor(suggestion) : [];
  const [more, setMore] = useState(Boolean(payment && (payment.upiRef || payment.notes || payment.status !== "confirmed")));

  return (
    <form action={action} className="space-y-4">
      {payment ? <input type="hidden" name="id" value={payment.id} /> : null}
      <input type="hidden" name="method" value={method} />
      <Field label="Flat" htmlFor="flat_id">
        <select
          id="flat_id"
          name="flat_id"
          required
          value={flatId ? String(flatId) : ""}
          onChange={(event) => {
            const next = Number(event.target.value);
            setFlatId(next);
            if (!amountTouched) setAmount(suggestedAmount(suggestions, next));
          }}
          className={controlClass}
        >
          {flats.map((flat) => (
            <option key={flat.id} value={flat.id}>
              {flat.unitNumber}
              {flat.tenantName ? ` · ${flat.tenantName}` : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Amount (₹)" htmlFor="amount" hint="Tap a choice, or type a different amount.">
        {amountChoices.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {amountChoices.map((choice) => (
              <button
                key={choice.label}
                type="button"
                aria-pressed={amount === String(choice.amount)}
                onClick={() => {
                  setAmountTouched(true);
                  setAmount(String(choice.amount));
                }}
                className={cn(
                  "min-h-11 rounded-full px-3 text-sm font-medium",
                  amount === String(choice.amount)
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/80 text-foreground ring-1 ring-foreground/10",
                )}
              >
                {choice.label} · {formatINR(choice.amount)}
              </button>
            ))}
          </div>
        ) : null}
        <input
          id="amount"
          name="amount"
          inputMode="decimal"
          required
          value={amount}
          onChange={(event) => {
            setAmountTouched(true);
            setAmount(event.target.value);
          }}
          className={controlClass}
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date paid" htmlFor="payment_date" hint="Filled in for you. Change it if the money arrived on another day.">
          <input
            id="payment_date"
            name="payment_date"
            type="date"
            required
            value={paymentDate}
            onChange={(event) => {
              const next = event.target.value;
              setPaymentDate(next);
              if (!monthTouched && /^\d{4}-\d{2}-\d{2}$/.test(next)) setForMonth(monthKey(next));
            }}
            className={controlClass}
          />
        </Field>
        <Field label="Which month this is for" htmlFor="for_month" hint="Filled in for you. Change it only when the money is for a different month.">
          <input
            id="for_month"
            name="for_month"
            type="month"
            required
            value={forMonth}
            onChange={(event) => {
              setMonthTouched(true);
              setForMonth(event.target.value);
            }}
            className={controlClass}
          />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">How they paid</legend>
        <div className="flex flex-wrap gap-2">
          {METHODS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={method === item}
              onClick={() => setMethod(item)}
              className={cn(
                "min-h-11 rounded-full px-3 text-sm font-medium",
                method === item ? "bg-primary text-primary-foreground" : "bg-white/80 ring-1 ring-foreground/10",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </fieldset>
      {more ? (
        <div className="space-y-4 rounded-2xl bg-white/60 px-4 py-4 ring-1 ring-foreground/10">
          <Field label="Status" htmlFor="status" hint="Confirmed counts toward rent. Pending does not.">
            <select id="status" name="status" defaultValue={payment?.status || "confirmed"} className={controlClass}>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </Field>
          <Field label="UPI reference" htmlFor="upi_ref">
            <input id="upi_ref" name="upi_ref" defaultValue={payment?.upiRef ?? ""} className={controlClass} />
          </Field>
          <Field label="Notes" htmlFor="notes">
            <textarea id="notes" name="notes" rows={3} defaultValue={payment?.notes ?? ""} className={`${controlClass} h-auto py-3`} />
          </Field>
        </div>
      ) : (
        <>
          <input type="hidden" name="status" value={payment?.status || "confirmed"} />
          <button type="button" onClick={() => setMore(true)} className="min-h-12 text-left text-sm font-medium text-primary">
            Add a reference or note
          </button>
        </>
      )}
      <FormMessage state={state} />
      <SubmitButton>{payment ? "Save payment" : "Record payment"}</SubmitButton>
    </form>
  );
}

function suggestedAmount(suggestions: PaymentSuggestion[], flatId: number): string {
  const match = suggestions.find((item) => item.flatId === flatId);
  if (!match) return "";
  if (match.left > 0) return String(match.left);
  if (match.total > 0) return String(match.total);
  if (match.due > 0) return String(match.due);
  return "";
}

function amountChoicesFor(suggestion: PaymentSuggestion): { label: string; amount: number }[] {
  const choices = [
    { label: "Left this month", amount: suggestion.left },
    { label: "This month's rent", amount: suggestion.due },
    { label: "All unpaid", amount: suggestion.total },
  ];
  return choices.filter((choice, index) => choice.amount > 0 && choices.findIndex((other) => other.amount === choice.amount) === index);
}
