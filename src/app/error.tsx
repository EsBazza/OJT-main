"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="center-page">
      <div className="stack" style={{ justifyItems: "center", maxWidth: 480 }}>
        <AlertTriangle aria-hidden="true" size={40} color="var(--color-danger)" />
        <h1 style={{ color: "var(--color-heading)" }}>Something went wrong</h1>
        <p className="muted">The page could not load. This is usually a temporary connection problem with the database. Try again in a moment.</p>
        {error.digest && <p className="small">Reference: <code>{error.digest}</code></p>}
        <div className="actions" style={{ justifyContent: "center" }}>
          <button type="button" className="button button-primary" onClick={reset}>Try again</button>
          <Link className="button button-secondary" href="/">Go to dashboard</Link>
        </div>
      </div>
    </main>
  );
}
