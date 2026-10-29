"use client";

import Link from "next/link";
import { decidePlacement } from "@/app/actions/coordinator";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";

export function DecisionForm({ placementId, student, company, supervisors }: { placementId: string; student: string; company: string; supervisors: { id: string; label: string }[] }) {
  return (
    <ActionForm action={decidePlacement} className="decision-form" resetOnSuccess={false}>
      <input type="hidden" name="placementId" value={placementId} />
      <div className="filters">
        <Field label="Supervisor" name="supervisorId" id={`supervisor-${placementId}`}>
          {(props) => (
            <select {...props} defaultValue={props.defaultValue ?? ""}>
              <option value="">Choose supervisor</option>
              {supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.label}</option>)}
            </select>
          )}
        </Field>
        <Field label="Shift starts" name="shiftStart" id={`shift-${placementId}`} type="time" defaultValue="08:00" />
        <Field label="Grace (minutes)" name="graceMinutes" id={`grace-${placementId}`} type="number" min={0} max={120} defaultValue="15" inputMode="numeric" />
      </div>
      {!supervisors.length && <p className="small" style={{ marginTop: 8 }}>No supervisor is assigned to {company} yet. <Link href="/users">Assign one</Link> before approving.</p>}
      <div className="actions">
        <SubmitButton name="decision" value="approve" disabled={!supervisors.length} pendingText="Approving…">Approve</SubmitButton>
        <SubmitButton name="decision" value="reject" variant="secondary" pendingText="Rejecting…" confirm={{ title: `Reject ${student}'s request?`, body: `${student} will be told the placement at ${company} was not approved and can submit another company.`, action: "Reject request" }}>Reject</SubmitButton>
      </div>
    </ActionForm>
  );
}
