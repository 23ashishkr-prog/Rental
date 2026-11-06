"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import QRCode from "qrcode";
import { submitTenantPaymentAction } from "@/server/rent-actions";
import { Field, FormMessage, buttonLinkClass, controlClass } from "@/components/ui-bits";
import { SubmitButton } from "@/components/submit-button";
import { formatINR } from "@/lib/money";
import { UPI_ID, buildUpiUrl } from "@/lib/upi";

export function PayPanel({
  flatId,
  unitNumber,
  defaultAmount,
  initialQr,
  today,
  month,
  pending,
  monthLeft = 0,
}: {
  flatId: number;
  unitNumber: string;
  defaultAmount: number;
  initialQr: string;
  today: string;
  month: string;
  pending: number;
  monthLeft?: number;
}) {
  const [amount, setAmount] = useState(defaultAmount > 0 ? String(defaultAmount) : "");
  const [qr, setQr] = useState(initialQr);
  const [copied, setCopied] = useState(false);
  const requestId = useRef(0);
  const [state, action] = useActionState(submitTenantPaymentAction, null);
  const [paidOn, setPaidOn] = useState(today);
  const [forMonth, setForMonth] = useState(month.slice(0, 7));
  const [monthTouched, setMonthTouched] = useState(false);
  const numeric = Number(amount);
  const safeAmount = Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  const note = `Flat ${unitNumber} rent`;
  const link = buildUpiUrl(safeAmount, note);

  async function onAmountChange(value: string) {
    setAmount(value);
    const id = ++requestId.current;
    const next = Number(value);
    if (!Number.isFinite(next) || next <= 0) {
      setQr("");
      return;
    }
    try {
      const svg = await QRCode.toString(buildUpiUrl(next, note), {
        type: "svg",
        margin: 1,
        width: 220,
        color: { dark: "#134e4a", light: "#ffffff" },
      });
      if (id === requestId.current) setQr(svg);
    } catch {
      if (id === requestId.current) setQr("");
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-card p-4 ring-1 ring-foreground/10">
        <p className="text-sm font-semibold text-foreground/80">Amount to pay · {unitNumber}</p>
        <p className={`font-display mt-1 text-5xl font-semibold tracking-tight ${pending > 0 ? "text-rose-700" : "text-emerald-800"}`}>
          {pending > 0 ? formatINR(pending) : "Nothing unpaid"}
        </p>
        {monthLeft > 0 ? <p className="mt-2 text-sm text-foreground/75">Left to collect this month {formatINR(monthLeft)}</p> : null}
        {monthLeft > 0 && pending > 0 && monthLeft !== pending ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="min-h-11 rounded-full bg-white px-3 text-sm font-medium ring-1 ring-foreground/10" onClick={() => void onAmountChange(String(monthLeft))}>
              Left this month · {formatINR(monthLeft)}
            </button>
            <button type="button" className="min-h-11 rounded-full bg-white px-3 text-sm font-medium ring-1 ring-foreground/10" onClick={() => void onAmountChange(String(pending))}>
              All unpaid · {formatINR(pending)}
            </button>
          </div>
        ) : null}
        <Field label="Amount to pay (₹)" htmlFor="amount-preview" hint="Filled in for you. Change it only for a smaller payment.">
          <input
            id="amount-preview"
            inputMode="decimal"
            value={amount}
            onChange={(event) => void onAmountChange(event.target.value)}
            className={controlClass}
          />
        </Field>
        <a href={safeAmount > 0 ? link : undefined} className={`${buttonLinkClass()} mt-4 w-full ${safeAmount <= 0 ? "pointer-events-none opacity-50" : ""}`}>
          Pay {safeAmount > 0 ? formatINR(safeAmount) : ""} with UPI
        </a>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          UPI ID{" "}
          <button
            type="button"
            className="font-medium text-foreground underline decoration-primary/40 underline-offset-2"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(UPI_ID);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {UPI_ID}
          </button>
          {copied ? " · copied" : ""}
        </p>
        {qr ? (
          <div
            className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3 ring-1 ring-foreground/10"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
        ) : null}
      </section>

      <form action={action} className="space-y-4">
        <input type="hidden" name="flat_id" value={flatId} />
        <input type="hidden" name="amount" value={safeAmount || ""} />
        <Field label="UPI reference" htmlFor="upi_ref" hint="From GPay, PhonePe, or your bank after you pay.">
          <input id="upi_ref" name="upi_ref" required minLength={4} autoComplete="off" className={controlClass} />
        </Field>
        <Field label="Comment" htmlFor="notes">
          <textarea id="notes" name="notes" rows={3} className={`${controlClass} h-auto py-3`} placeholder="Optional note for the owner" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date you paid" htmlFor="payment_date">
            <input
              id="payment_date"
              name="payment_date"
              type="date"
              required
              value={paidOn}
              onChange={(event) => {
                const next = event.target.value;
                setPaidOn(next);
                if (!monthTouched && /^\d{4}-\d{2}-\d{2}$/.test(next)) setForMonth(next.slice(0, 7));
              }}
              className={controlClass}
            />
          </Field>
          <Field label="Which month this is for" htmlFor="for_month" hint="Already set to this month. Change it only if you are paying a different month.">
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
        <FormMessage state={state} />
        <SubmitButton pendingLabel="Submitting…">Submit for confirmation</SubmitButton>
      </form>
    </div>
  );
}
