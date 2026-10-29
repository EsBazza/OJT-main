"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Loader2, ShieldCheck, XCircle } from "lucide-react";

type Result = { result: string; explanation: string; digest: string; verifiedAt: string };

const verdicts: Record<string, { tone: "valid" | "changed" | "invalid"; title: string }> = {
  VALID: { tone: "valid", title: "Signature valid" },
  "DOCUMENT CHANGED": { tone: "changed", title: "Report was changed after signing" },
  "INVALID SIGNATURE": { tone: "invalid", title: "Signature does not match" },
  "SIGNER NOT AUTHORIZED": { tone: "invalid", title: "Signer not authorized" },
  "SIGNING KEY NOT TRUSTED": { tone: "invalid", title: "Signing key not trusted" },
  "VERIFICATION ERROR": { tone: "invalid", title: "Could not verify" },
};
const icons = { valid: CheckCircle2, changed: AlertTriangle, invalid: XCircle };

export function VerifyButton({ documentId }: { documentId: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function verify() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/verification", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ documentId }) });
      const body = await response.json();
      if (response.ok) setResult(body);
      else setError(body.error || "Verification failed.");
    } catch {
      setError("The verification request failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const verdict = result ? verdicts[result.result] ?? verdicts["VERIFICATION ERROR"] : null;
  const Icon = verdict ? icons[verdict.tone] : null;
  return (
    <div>
      <button type="button" className="button button-primary" disabled={busy} onClick={verify}>
        {busy ? <Loader2 className="spin" aria-hidden="true" size={18} /> : <ShieldCheck aria-hidden="true" size={18} />}
        {busy ? "Verifying…" : result ? "Verify again" : "Verify signature"}
      </button>
      <div aria-live="polite">
        {verdict && result && Icon && (
          <div className={`verdict verdict-${verdict.tone}`}>
            <Icon aria-hidden="true" size={28} />
            <div><b>{verdict.title}</b><div>{result.explanation}</div><div className="small" style={{ color: "inherit" }}>Checked {new Date(result.verifiedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</div></div>
          </div>
        )}
        {error && <div className="notice notice-error" role="alert" style={{ marginTop: 12 }}><XCircle aria-hidden="true" size={20} /><div>{error}</div></div>}
      </div>
    </div>
  );
}

export function CopyDigest({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="digest">
      <code>{value}</code>
      <button type="button" className="button button-ghost" aria-label="Copy digest" onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } }}>
        <Copy aria-hidden="true" size={16} />{copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
