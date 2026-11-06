"use client";

import { useState } from "react";
import { useActionState } from "react";
import { savePaymentAction } from "@/server/rent-actions";
import { Field, FormMessage, controlClass } from "@/components/ui-bits";
import { SubmitButton } from "@/components/submit-button";
import type { FlatRecord, PaymentRecord } from "@/lib/types";

function monthKey(value: string): string {
  return value.slice(0, 7);
}

export function PaymentForm({
  flats,
  payment,
  today,
  month,
  presetFlatId,
}: {
  flats: Pick<FlatRecord, "id" | "unitNumber" | "tenantName">[];
  payment?: PaymentRecord;
  today: string;
  month: string;
  presetFlatId?: number;
}) {
  const [state, action] = useActionState(savePaymentAction, null);
  const initialDate = (payment?.paymentDate || today).slice(0, 10);
  const explicitMonth = payment?.forMonth ? monthKey(payment.forMonth) : "";
  const [paymentDate, setPaymentDate] = useState(initialDate);
  const [forMonth, setForMonth] = useState(explicitMonth || monthKey(initialDate || month));
  const [monthTouched, setMonthTouched] = useState(Boolean(explicitMonth && explicitMonth !== monthKey(initialDate)));
  return (
    <form action={action} className="space-y-4">
      {payment ? <input type="hidden" name="id" value={payment.id} /> : null}
      <Field label="Flat" htmlFor="flat_id">
        <select
          id="flat_id"
          name="flat_id"
          required
          defaultValue={String(payment?.flatId ?? presetFlatId ?? flats[0]?.id ?? "")}
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
      <Field label="Amount (₹)" htmlFor="amount">
        <input
          id="amount"
          name="amount"
          inputMode="decimal"
          required
          defaultValue={payment ? String(payment.amount) : ""}
          className={controlClass}
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Payment date" htmlFor="payment_date" hint="Back-dated payments are allowed.">
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
        <Field
          label="Applied to month"
          htmlFor="for_month"
          hint="This stays on the payment month. Change it only when the money is for a different month."
        >
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Method" htmlFor="method">
          <select id="method" name="method" defaultValue={payment?.method || "UPI"} className={controlClass}>
            {["UPI", "Cash", "Bank transfer", "Cheque", "Other"].map((method) => (
              <option key={method}>{method}</option>
            ))}
          </select>
        </Field>
        <Field label="Status" htmlFor="status">
          <select id="status" name="status" defaultValue={payment?.status || "confirmed"} className={controlClass}>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
        </Field>
      </div>
      <Field label="UPI reference" htmlFor="upi_ref">
        <input id="upi_ref" name="upi_ref" defaultValue={payment?.upiRef ?? ""} className={controlClass} />
      </Field>
      <Field label="Notes" htmlFor="notes">
        <textarea id="notes" name="notes" rows={3} defaultValue={payment?.notes ?? ""} className={`${controlClass} h-auto py-3`} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>{payment ? "Save payment" : "Record payment"}</SubmitButton>
    </form>
  );
}
