import type { Metadata } from "next";
import { Clock, FileCheck2, ShieldCheck } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Notice } from "@/components/ui";
import { AuthForms } from "./auth-forms";
import { LoginScene } from "./login-scene";

export const metadata: Metadata = { title: "Sign in" };

const features = [
  { icon: Clock, title: "Server-timed attendance", text: "Time in and out in one tap. Late and missed time-outs are flagged automatically." },
  { icon: FileCheck2, title: "Daily reports", text: "Write each day's report and follow it from submitted to approved to signed." },
  { icon: ShieldCheck, title: "Tamper-proof signatures", text: "Signed reports are locked with Ed25519 and can be verified at any time." },
];

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  return (
    <main className="auth">
      <LoginScene />
      <div className="auth-layout">
        <section className="auth-hero" aria-labelledby="hero-title">
          <div className="brand auth-brand"><span className="brand-mark" aria-hidden="true">O</span>OJT Monitor</div>
          <h1 id="hero-title" className="auth-headline">Every OJT hour, <span>tracked and signed.</span></h1>
          <p className="auth-lede">Attendance, daily reports, and supervisor approvals in one secure place.</p>
          <ul className="auth-features">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title}><span className="auth-feature-icon"><Icon aria-hidden="true" size={20} /></span><div><b>{title}</b><span>{text}</span></div></li>
            ))}
          </ul>
        </section>

        <section className="auth-card" aria-labelledby="auth-title">
          <div className="brand auth-card-brand"><span className="brand-mark" aria-hidden="true">O</span>OJT Monitor</div>
          <h2 id="auth-title">Welcome</h2>
          <p className="muted">Sign in to your internship workspace.</p>
          {query.error === "profile" && (
            <div style={{ marginTop: 16 }}>
              <Notice tone="error" title="Account not available">This account has no active OJT profile. It may have been deactivated. Contact your OJT coordinator.</Notice>
              <form action={signOut}><button className="button button-secondary button-block">Sign out and use another account</button></form>
            </div>
          )}
          {query.error !== "profile" && <AuthForms />}
          <p className="small" style={{ marginTop: 24 }}>Supervisor and coordinator accounts are set up by your OJT coordinator.</p>
        </section>
      </div>
    </main>
  );
}
