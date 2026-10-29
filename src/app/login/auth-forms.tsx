"use client";

import { useActionState, useState } from "react";
import { Check, Circle } from "lucide-react";
import { supabaseLogin, supabaseRegister } from "@/app/actions/auth";
import { Field, FormErrors, SubmitButton } from "@/components/form";
import { initialFormState } from "@/lib/form-state";
import { passwordRules } from "@/lib/password";

const registerLabels = { name: "Full name", email: "Email", studentNumber: "Student number", program: "Program", password: "Password" };

function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="checklist" aria-label="Password requirements">
      {passwordRules.map((rule) => {
        const met = rule.test(value);
        return <li key={rule.label} data-met={met}>{met ? <Check aria-hidden="true" size={16} /> : <Circle aria-hidden="true" size={14} />}{rule.label}<span className="sr-only">{met ? " (met)" : " (not met)"}</span></li>;
      })}
    </ul>
  );
}

export function AuthForms() {
  const [tab, setTab] = useState<"signin" | "register">("signin");
  const [loginState, login] = useActionState(supabaseLogin, initialFormState);
  const [registerState, register] = useActionState(supabaseRegister, initialFormState);
  const [password, setPassword] = useState("");

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Account" data-active={tab}>
        <button type="button" role="tab" id="tab-signin" className="tab" aria-selected={tab === "signin"} aria-controls="panel-signin" onClick={() => setTab("signin")}>Sign in</button>
        <button type="button" role="tab" id="tab-register" className="tab" aria-selected={tab === "register"} aria-controls="panel-register" onClick={() => setTab("register")}>Create account</button>
      </div>

      <div role="tabpanel" id="panel-signin" aria-labelledby="tab-signin" hidden={tab !== "signin"}>
        <form action={login} noValidate>
          <FormErrors state={loginState} labels={{ email: "Email", password: "Password" }} />
          <Field label="Email" name="email" type="email" state={loginState} autoComplete="email" required />
          <Field label="Password" name="password" type="password" state={loginState} autoComplete="current-password" required />
          <SubmitButton block pendingText="Signing in…">Sign in</SubmitButton>
        </form>
      </div>

      <div role="tabpanel" id="panel-register" aria-labelledby="tab-register" hidden={tab !== "register"}>
        {registerState.success ? (
          <div className="notice notice-success" role="status" style={{ marginTop: 16 }}>
            <div><b>Account created</b><div>{registerState.success}</div><button type="button" className="button button-secondary" style={{ marginTop: 12 }} onClick={() => setTab("signin")}>Go to sign in</button></div>
          </div>
        ) : (
          <form action={register} noValidate>
            <FormErrors state={registerState} labels={registerLabels} />
            <Field label="Full name" name="name" state={registerState} autoComplete="name" required maxLength={100} />
            <Field label="Email" name="email" type="email" state={registerState} autoComplete="email" required />
            <Field label="Student number" name="studentNumber" state={registerState} autoComplete="off" required maxLength={40} hint="As printed on your school ID. This cannot be changed later." />
            <Field label="Program" name="program" state={registerState} required maxLength={120} placeholder="BS Information Technology" />
            <Field label="Password" name="password" type="password" state={registerState} autoComplete="new-password" required maxLength={128} onChange={(event) => setPassword(event.currentTarget.value)} hint={<PasswordChecklist value={password} />} />
            <SubmitButton block pendingText="Creating account…">Create student account</SubmitButton>
          </form>
        )}
      </div>
    </>
  );
}
