"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, XCircle } from "lucide-react";
import type { FormState } from "@/lib/form-state";

type ButtonProps = { children: React.ReactNode; pendingText?: string; variant?: "primary" | "secondary" | "danger" | "ghost"; name?: string; value?: string; disabled?: boolean; className?: string; block?: boolean };

// Disables itself while the form is submitting, which also blocks double submissions.
export function SubmitButton({ children, pendingText, variant = "primary", name, value, disabled, className, block }: ButtonProps) {
  const { pending, data } = useFormStatus();
  // When a form has several submit buttons, only show progress on the one that was pressed.
  const pressed = pending && (!name || data?.get(name) === value);
  return (
    <button type="submit" name={name} value={value} disabled={pending || disabled} aria-disabled={pending || disabled} className={`button button-${variant}${block ? " button-block" : ""}${className ? ` ${className}` : ""}`}>
      {pressed && <Loader2 className="spin" aria-hidden="true" size={18} />}
      {pressed ? pendingText ?? "Saving…" : children}
    </button>
  );
}

type FieldProps = {
  label: string;
  name: string;
  state?: FormState;
  hint?: React.ReactNode;
  full?: boolean;
  children?: (props: { id: string; name: string; "aria-invalid"?: boolean; "aria-describedby"?: string; defaultValue?: string }) => React.ReactNode;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "children" | "name">;

export function Field({ label, name, state, hint, full, children, id: givenId, ...input }: FieldProps) {
  const id = givenId ?? `field-${name}`;
  const error = state?.fieldErrors?.[name];
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  const controlProps = { id, name, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, defaultValue: state?.values?.[name] ?? (input.defaultValue as string | undefined) };
  return (
    <div className={`field${full ? " field-full" : ""}${error ? " field-error" : ""}`}>
      <label htmlFor={id}>{label}{input.required && <span className="required" aria-hidden="true"> *</span>}</label>
      {children ? children(controlProps) : <input {...input} {...controlProps} />}
      {hint && <div className="field-hint" id={`${id}-hint`}>{hint}</div>}
      {error && <p className="field-message" id={`${id}-error`}><XCircle aria-hidden="true" size={16} />{error}</p>}
    </div>
  );
}

// Lists every problem after a failed submit and moves focus to it, with links to each field.
export function FormErrors({ state, labels }: { state: FormState; labels: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const fields = Object.entries(state.fieldErrors ?? {});
  useEffect(() => { if (state.error || fields.length) ref.current?.focus(); }, [state, fields.length]);
  if (!state.error && !fields.length) return null;
  return (
    <div className="notice notice-error form-errors" role="alert" tabIndex={-1} ref={ref}>
      <XCircle aria-hidden="true" size={20} />
      <div>
        <b>{state.error ?? "Please fix the following:"}</b>
        {fields.length > 0 && <ul>{fields.map(([field, message]) => <li key={field}><a href={`#field-${field}`}>{labels[field] ?? field}: {message}</a></li>)}</ul>}
      </div>
    </div>
  );
}
