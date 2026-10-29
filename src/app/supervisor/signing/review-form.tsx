"use client";

import { Check, Undo2 } from "lucide-react";
import { reviewReport } from "@/app/actions/supervisor";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form";

export function ReviewForm({ versionId, label }: { versionId: string; label: string }) {
  return (
    <ActionForm action={reviewReport} className="stack review-form">
      <input type="hidden" name="versionId" value={versionId} />
      <Field label="Remarks" name="remarks" id={`remarks-${versionId}`} hint="Required when returning a report. Optional when approving.">
        {(props) => <textarea {...props} maxLength={2000} />}
      </Field>
      <div className="actions" style={{ marginTop: 0 }}>
        <SubmitButton name="decision" value="approve" pendingText="Approving…"><Check aria-hidden="true" size={18} />Approve</SubmitButton>
        <SubmitButton name="decision" value="return" variant="secondary" pendingText="Returning…" confirm={{ title: `Return ${label}?`, body: "The student will see your remarks and can edit and resubmit the report.", action: "Return report" }}><Undo2 aria-hidden="true" size={18} />Return for changes</SubmitButton>
      </div>
    </ActionForm>
  );
}
