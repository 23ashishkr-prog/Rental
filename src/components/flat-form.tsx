"use client";

import { useActionState } from "react";
import { saveFlatAction } from "@/server/rent-actions";
import { Field, FormMessage, controlClass } from "@/components/ui-bits";
import { SubmitButton } from "@/components/submit-button";
import type { FlatRecord } from "@/lib/types";

export function FlatForm({ flat }: { flat?: FlatRecord }) {
  const [state, action] = useActionState(saveFlatAction, null);
  return (
    <form action={action} className="space-y-4">
      {flat ? <input type="hidden" name="id" value={flat.id} /> : null}
      <Field label="Flat / unit" htmlFor="unit_number">
        <input id="unit_number" name="unit_number" required defaultValue={flat?.unitNumber ?? ""} className={controlClass} />
      </Field>
      <Field label="Tenant name" htmlFor="tenant_name">
        <input id="tenant_name" name="tenant_name" defaultValue={flat?.tenantName ?? ""} className={controlClass} />
      </Field>
      <Field label="Tenant email" htmlFor="tenant_email" hint="Used to match their login, ignoring dots in Gmail addresses.">
        <input
          id="tenant_email"
          name="tenant_email"
          type="email"
          defaultValue={flat?.tenantEmail ?? ""}
          className={controlClass}
        />
      </Field>
      <Field label="Tenant phone" htmlFor="tenant_phone" hint="WhatsApp reminders use this number.">
        <input id="tenant_phone" name="tenant_phone" inputMode="tel" defaultValue={flat?.tenantPhone ?? ""} className={controlClass} />
      </Field>
      <Field label="Monthly rent (₹)" htmlFor="monthly_rent">
        <input
          id="monthly_rent"
          name="monthly_rent"
          inputMode="decimal"
          required
          defaultValue={flat ? String(flat.monthlyRent) : ""}
          className={controlClass}
        />
      </Field>
      <Field label="Rent start date" htmlFor="rent_start_date" hint="Rent is charged from this month onward. Leave blank if it has not started.">
        <input
          id="rent_start_date"
          name="rent_start_date"
          type="date"
          defaultValue={flat?.rentStartDate ?? ""}
          className={controlClass}
        />
      </Field>
      <input type="hidden" name="active" value="false" />
      <label className="flex min-h-12 items-center gap-3 text-sm font-medium">
        <input type="checkbox" name="active" value="on" defaultChecked={flat?.active ?? true} className="size-5 accent-primary" />
        Active flat
      </label>
      <FormMessage state={state} />
      <SubmitButton>{flat ? "Save flat" : "Add flat"}</SubmitButton>
    </form>
  );
}
