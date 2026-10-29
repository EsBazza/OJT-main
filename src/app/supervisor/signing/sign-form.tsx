"use client";

import { useState } from "react";
import { PenLine } from "lucide-react";
import { signApprovedReport } from "@/app/actions/supervisor";
import { SubmitButton } from "@/components/form";

// Signing is permanent, so it needs an explicit confirmation first.
export function SignForm({ versionId, label }: { versionId: string; label: string }) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <form action={signApprovedReport} className="stack" style={{ marginTop: 16 }}>
      <input type="hidden" name="versionId" value={versionId} />
      <label className="checkbox">
        <input type="checkbox" name="confirm" value="yes" checked={confirmed} onChange={(event) => setConfirmed(event.currentTarget.checked)} />
        <span>I confirm that I reviewed {label} and approve signing it. A signed report can never be edited.</span>
      </label>
      <div><SubmitButton disabled={!confirmed} pendingText="Signing…"><PenLine aria-hidden="true" size={18} />Sign report</SubmitButton></div>
    </form>
  );
}
