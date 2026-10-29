"use client";

import { useActionState } from "react";
import { submitPlacement } from "@/app/actions/student";
import { Field, FormErrors, SubmitButton } from "@/components/form";
import { initialFormState } from "@/lib/form-state";

export function PlacementForm({ companies }: { companies: string[] }) {
  const [state, action] = useActionState(submitPlacement, initialFormState);
  return (
    <form action={action} noValidate>
      <FormErrors state={state} labels={{ company: "Company name", address: "Work address" }} />
      <div className="form-grid">
        <Field label="Company name" name="company" state={state} required maxLength={160} list="known-companies" autoComplete="organization" hint="Pick an existing company if it is listed, so your coordinator can match it." />
        <Field label="Work address" name="address" state={state} required maxLength={300} autoComplete="street-address" />
      </div>
      <datalist id="known-companies">{companies.map((name) => <option key={name} value={name} />)}</datalist>
      <div className="actions"><SubmitButton pendingText="Submitting…">Submit for approval</SubmitButton></div>
    </form>
  );
}
