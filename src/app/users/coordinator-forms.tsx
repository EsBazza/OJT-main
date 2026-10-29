"use client";

import { changeAccount, createCompany, provisionSupervisor } from "@/app/actions/coordinator";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";

type Option = { id: string; label: string };

export function SupervisorForm({ accounts, companies }: { accounts: Option[]; companies: Option[] }) {
  return (
    <ActionForm action={provisionSupervisor} className="stack">
      <Field label="Account" name="userId" required hint="The person registers first, then you give their account supervisor access.">
        {(props) => <select {...props} defaultValue={props.defaultValue ?? ""}><option value="">Choose a registered account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select>}
      </Field>
      <Field label="Company" name="companyId" required>
        {(props) => <select {...props} defaultValue={props.defaultValue ?? ""}><option value="">Choose a company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.label}</option>)}</select>}
      </Field>
      <Field label="Permission" name="canSign">
        {(props) => <select {...props} defaultValue={props.defaultValue ?? "false"}><option value="false">Review reports only</option><option value="true">Review and sign approved reports</option></select>}
      </Field>
      <div><SubmitButton pendingText="Saving…">Save supervisor access</SubmitButton></div>
    </ActionForm>
  );
}

export function CompanyForm() {
  return (
    <ActionForm action={createCompany} className="stack">
      <Field label="Company name" name="name" id="company-name" required maxLength={160} autoComplete="organization" />
      <Field label="Address" name="address" id="company-address" required maxLength={300} />
      <div><SubmitButton pendingText="Creating…">Create company</SubmitButton></div>
    </ActionForm>
  );
}

export function AccountActions({ userId, name, active, supervisor }: { userId: string; name: string; active: boolean; supervisor: boolean }) {
  return (
    <div className="actions" style={{ marginTop: 0 }}>
      <ActionForm action={changeAccount}>
        <input type="hidden" name="userId" value={userId} />
        {active
          ? <SubmitButton name="change" value="deactivate" variant="danger" pendingText="Saving…" confirm={{ title: `Deactivate ${name}?`, body: "They will be signed out of OJT Monitor and cannot sign in until reactivated. Their records are kept.", action: "Deactivate" }}>Deactivate</SubmitButton>
          : <SubmitButton name="change" value="activate" variant="secondary" pendingText="Saving…">Reactivate</SubmitButton>}
      </ActionForm>
      {supervisor && (
        <ActionForm action={changeAccount}>
          <input type="hidden" name="userId" value={userId} />
          <SubmitButton name="change" value="remove-supervisor" variant="secondary" pendingText="Saving…" confirm={{ title: `Remove supervisor access for ${name}?`, body: "They will no longer review or sign reports. Their account becomes a regular account.", action: "Remove access" }}>Remove supervisor</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
