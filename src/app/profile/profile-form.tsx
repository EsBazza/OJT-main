"use client";

import { useActionState } from "react";
import { saveStudentProfile } from "@/app/actions/student";
import { Field, FormErrors, SubmitButton } from "@/components/form";
import { initialFormState } from "@/lib/form-state";

export function ProfileForm({ name, email, studentNumber, program }: { name: string; email: string; studentNumber: string | null; program: string }) {
  const [state, action] = useActionState(saveStudentProfile, initialFormState);
  return (
    <form action={action} noValidate>
      <FormErrors state={state} labels={{ name: "Full name", studentNumber: "Student number", program: "Program" }} />
      {state.success && <div className="notice notice-success" role="status"><div>{state.success}</div></div>}
      <div className="form-grid">
        <Field label="Full name" name="name" state={state} defaultValue={name} required maxLength={100} autoComplete="name" />
        <Field label="Email" name="email-display" value={email} readOnly hint="Change your email through your account provider." />
        {studentNumber
          ? <Field label="Student number" name="studentNumber-display" value={studentNumber} readOnly hint="Locked after registration. Ask your coordinator if it is wrong." />
          : <Field label="Student number" name="studentNumber" state={state} required maxLength={40} hint="As printed on your school ID. This cannot be changed later." />}
        <Field label="Program" name="program" state={state} defaultValue={program} required maxLength={120} placeholder="BS Information Technology" />
      </div>
      <div className="actions"><SubmitButton pendingText="Saving…">Save profile</SubmitButton></div>
    </form>
  );
}
