"use client";

import { useActionState, useState } from "react";
import { submitDailyReport } from "@/app/actions/student";
import { Field, FormErrors, SubmitButton } from "@/components/form";
import { initialFormState } from "@/lib/form-state";

export type ReportOption = { date: string; label: string; day: number; returned: boolean; activities: string; skills: string; challenges: string; remarks: string | null };

const labels = { date: "Date", activities: "Activities completed", skills: "Skills learned", challenges: "Challenges and response" };

export function ReportForm({ options }: { options: ReportOption[] }) {
  const [state, action] = useActionState(submitDailyReport, initialFormState);
  const [date, setDate] = useState(state.values?.date ?? options[0]?.date ?? "");
  const selected = options.find((option) => option.date === date);
  // After a failed submit keep what the student typed; otherwise prefill a returned report.
  const values = state.values?.date === date ? state.values : selected?.returned ? { date, activities: selected.activities, skills: selected.skills, challenges: selected.challenges } : { date };
  const formState = { ...state, values };

  return (
    <form action={action} noValidate>
      <FormErrors state={state} labels={labels} />
      <div className="form-grid">
        <Field label="Date" name="date" state={formState} required hint={selected ? `This will be OJT day ${selected.day}.` : undefined}>
          {(props) => (
            <select {...props} defaultValue={undefined} value={date} onChange={(event) => setDate(event.currentTarget.value)}>
              {options.map((option) => <option key={option.date} value={option.date}>{option.label}{option.returned ? " — returned for changes" : ""}</option>)}
            </select>
          )}
        </Field>
        <div className="field">
          <span className="label">Attachments</span>
          <p className="field-hint">File uploads are not available yet. Describe your work in the fields below.</p>
        </div>
        {selected?.remarks && <div className="remark field-full" role="note"><b>Supervisor remarks:</b> {selected.remarks}</div>}
        {/* Remount the text fields when the date changes so their prefilled values update. */}
        <div key={date} className="form-grid field-full" style={{ gridColumn: "1 / -1" }}>
          <Field label="Activities completed" name="activities" state={formState} full required maxLength={5000} hint="What tasks did you work on today? (at least 10 characters)">
            {(props) => <textarea {...props} required maxLength={5000} rows={6} />}
          </Field>
          <Field label="Skills learned" name="skills" state={formState} required maxLength={2000}>
            {(props) => <textarea {...props} required maxLength={2000} />}
          </Field>
          <Field label="Challenges and response" name="challenges" state={formState} required maxLength={2000}>
            {(props) => <textarea {...props} required maxLength={2000} />}
          </Field>
        </div>
      </div>
      <div className="actions"><SubmitButton pendingText="Submitting…">{selected?.returned ? "Resubmit report" : "Submit report"}</SubmitButton></div>
    </form>
  );
}
