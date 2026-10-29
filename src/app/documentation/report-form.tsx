"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CloudOff, Save } from "lucide-react";
import { submitDailyReport } from "@/app/actions/student";
import { Field, FormErrors, SubmitButton } from "@/components/form";
import { initialFormState } from "@/lib/form-state";

export type ReportOption = { date: string; label: string; day: number; returned: boolean; withdrawn: boolean; activities: string; skills: string; challenges: string; remarks: string | null };

type Draft = { activities: string; skills: string; challenges: string; savedAt: number };

const labels = { date: "Date", activities: "Activities completed", skills: "Skills learned", challenges: "Challenges and response" };
const draftKey = (date: string) => `ojt-report-draft:${date}`;
const SUBMITTED_KEY = "ojt-report-submitted";
const timeFormat = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" });

// Drafts live only in this browser (per device); storage can be unavailable, so every access is guarded.
function readDraft(date: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(date));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function writeDraft(date: string, draft: Draft) {
  try { localStorage.setItem(draftKey(date), JSON.stringify(draft)); return true; } catch { return false; }
}
function removeDraft(date: string) {
  try { localStorage.removeItem(draftKey(date)); } catch { /* storage unavailable */ }
}

export function ReportForm({ options }: { options: ReportOption[] }) {
  const [state, action] = useActionState(submitDailyReport, initialFormState);
  const [date, setDate] = useState(state.values?.date ?? options[0]?.date ?? "");
  // The draft found when a date was opened; typing never changes it, so fields don't remount mid-edit.
  const [loaded, setLoaded] = useState<{ date: string; draft: Draft | null } | null>(null);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "unavailable">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = options.find((option) => option.date === date);

  // After a successful submit the page reloads with ?success; clear the draft that was sent.
  useEffect(() => {
    try {
      const sent = sessionStorage.getItem(SUBMITTED_KEY);
      if (sent && new URLSearchParams(window.location.search).has("success")) removeDraft(sent);
      sessionStorage.removeItem(SUBMITTED_KEY);
    } catch { /* storage unavailable */ }
  }, []);

  // Load any unsent draft whenever the chosen date changes.
  useEffect(() => {
    const saved = readDraft(date);
    setLoaded({ date, draft: saved });
    setLastSaved(saved?.savedAt ?? null);
    setSaveState(saved ? "saved" : "idle");
  }, [date]);
  const ready = loaded?.date === date;
  const restoredDraft = ready ? loaded.draft : null;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function onInput(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const data = new FormData(form);
      const next = { activities: String(data.get("activities") ?? ""), skills: String(data.get("skills") ?? ""), challenges: String(data.get("challenges") ?? ""), savedAt: Date.now() };
      if (!next.activities.trim() && !next.skills.trim() && !next.challenges.trim()) { removeDraft(date); setSaveState("idle"); return; }
      const ok = writeDraft(date, next);
      setSaveState(ok ? "saved" : "unavailable");
      if (ok) setLastSaved(next.savedAt);
    }, 600);
  }

  function discard() {
    removeDraft(date);
    setLoaded({ date, draft: null });
    setLastSaved(null);
    setSaveState("idle");
  }

  // Priority: what the student just tried to submit, then their unsent draft, then a returned/withdrawn report.
  const server = selected && (selected.returned || selected.withdrawn) ? { activities: selected.activities, skills: selected.skills, challenges: selected.challenges } : null;
  const values = state.values?.date === date ? state.values : { date, ...(restoredDraft ?? server ?? {}) };
  const formState = { ...state, values };
  const fieldsKey = `${date}:${ready ? (restoredDraft ? "draft" : "base") : "loading"}`;

  return (
    <form action={action} noValidate onInput={onInput} onSubmit={() => { try { sessionStorage.setItem(SUBMITTED_KEY, date); } catch { /* storage unavailable */ } }}>
      <FormErrors state={state} labels={labels} />
      <div className="form-grid">
        <Field label="Date" name="date" state={formState} required hint={selected ? `This will be OJT day ${selected.day}.` : undefined}>
          {(props) => (
            <select {...props} defaultValue={undefined} value={date} onChange={(event) => setDate(event.currentTarget.value)}>
              {options.map((option) => <option key={option.date} value={option.date}>{option.label}{option.returned ? " — returned for changes" : option.withdrawn ? " — withdrawn" : ""}</option>)}
            </select>
          )}
        </Field>
        <div className="field">
          <span className="label">Attachments</span>
          <p className="field-hint">File uploads are not available yet. Describe your work in the fields below.</p>
        </div>
        {selected?.remarks && <div className="remark field-full" role="note"><b>Supervisor remarks:</b> {selected.remarks}</div>}
        {restoredDraft && (
          <div className="draft-banner field-full" role="status">
            <Save aria-hidden="true" size={18} />
            <span>Restored your unsent draft from {timeFormat.format(restoredDraft.savedAt)}.</span>
            <button type="button" className="button button-ghost button-small" onClick={discard}>Discard draft</button>
          </div>
        )}
        {/* Remount the text fields when their starting values change so the defaults apply. */}
        <div key={fieldsKey} className="form-grid field-full" style={{ gridColumn: "1 / -1" }}>
          <Field label="Activities completed" name="activities" state={formState} full required maxLength={5000} hint="What tasks did you work on? (at least 10 characters)">
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
      <div className="actions">
        <SubmitButton pendingText="Submitting…">{selected?.returned || selected?.withdrawn ? "Resubmit report" : "Submit report"}</SubmitButton>
        <span className="draft-status" aria-live="polite">
          {saveState === "saved" && lastSaved && <><Save aria-hidden="true" size={14} />Draft saved on this device · {timeFormat.format(lastSaved)}</>}
          {saveState === "unavailable" && <><CloudOff aria-hidden="true" size={14} />Drafts can't be saved in this browser</>}
        </span>
      </div>
    </form>
  );
}
