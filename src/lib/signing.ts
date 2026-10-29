import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

export type SignedPayload = {
  id: string;
  studentId: string;
  day: number;
  version: number;
  activities: string;
  skills: string;
  challenges: string;
  company: string;
  submittedAt: string;
  approvedBy: string;
  approvedAt: string;
};

export function canonical(document: SignedPayload): string {
  return JSON.stringify({
    id: document.id,
    studentId: document.studentId,
    day: document.day,
    version: document.version,
    activities: document.activities,
    skills: document.skills,
    challenges: document.challenges,
    company: document.company,
    submittedAt: document.submittedAt,
    approvedBy: document.approvedBy,
    approvedAt: document.approvedAt,
  } satisfies SignedPayload);
}

export function digest(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function signPayload(payload: string) {
  const key = process.env.SIGNING_PRIVATE_KEY_PEM;
  if (!key) throw new Error("Signing key is not configured on the server.");
  const signature = sign(null, Buffer.from(payload), createPrivateKey(key)).toString("base64");
  const keyId = process.env.SIGNING_KEY_ID;
  if (!keyId) throw new Error("Signing key identifier is not configured on the server.");
  return { signature, digest: digest(payload), keyId };
}

export function signingPublicKeyPem(): string | null {
  const key = process.env.SIGNING_PRIVATE_KEY_PEM;
  if (!key) return null;
  return createPublicKey(createPrivateKey(key)).export({ type: "spki", format: "pem" }).toString();
}

function normalizePem(pem: string): string {
  return createPublicKey(pem).export({ type: "spki", format: "pem" }).toString();
}

// The trust anchor comes from server configuration, never from the signature row being verified.
export function trustedSigningKey(): { publicKeyPem: string; keyId: string } | null {
  const keyId = process.env.SIGNING_KEY_ID;
  const configured = process.env.SIGNING_PUBLIC_KEY_PEM?.trim();
  const publicKeyPem = configured ? normalizePem(configured.replaceAll("\\n", "\n")) : signingPublicKeyPem();
  return keyId && publicKeyPem ? { publicKeyPem, keyId } : null;
}

export function sameKey(a: string, b: string): boolean {
  try {
    return normalizePem(a) === normalizePem(b);
  } catch {
    return false;
  }
}

export function verifyPayload(payload: string, signature: string, publicPem: string): boolean {
  return verify(null, Buffer.from(payload), createPublicKey(publicPem), Buffer.from(signature, "base64"));
}

export type Verification = "VALID" | "DOCUMENT CHANGED" | "INVALID SIGNATURE" | "SIGNER NOT AUTHORIZED" | "SIGNING KEY NOT TRUSTED" | "VERIFICATION ERROR";
export type VerifiableDocument = SignedPayload & { signedAt: string; signer: string; approvedForCompany: boolean; keyId: string; digest: string; signature: string };

export function verifyDocument(document: VerifiableDocument, trust: { publicKeyPem?: string; keyId?: string; authorizedSigner?: boolean } = {}) {
  const verifiedAt = new Date().toISOString();
  try {
    if (!document.signedAt || !document.keyId) return { result: "VERIFICATION ERROR" as Verification, explanation: "This version has not been signed.", digest: "", verifiedAt };
    const payload = canonical(document);
    const actual = digest(payload);
    if (actual !== document.digest) return { result: "DOCUMENT CHANGED" as Verification, explanation: "The saved report no longer matches the signed content.", digest: actual, verifiedAt };
    if (!document.signer || document.signer !== document.approvedBy || !document.approvedAt || !document.approvedForCompany || trust.authorizedSigner === false) {
      return { result: "SIGNER NOT AUTHORIZED" as Verification, explanation: "The signer has no matching approval and company authorization.", digest: actual, verifiedAt };
    }
    const publicPem = trust.publicKeyPem ?? process.env.SIGNING_PUBLIC_KEY_PEM;
    const trustedKeyId = trust.keyId ?? process.env.SIGNING_KEY_ID;
    if (!publicPem || !trustedKeyId || document.keyId !== trustedKeyId) return { result: "SIGNING KEY NOT TRUSTED" as Verification, explanation: "No trusted public key is configured for this key identifier.", digest: actual, verifiedAt };
    if (!verifyPayload(payload, document.signature, publicPem)) return { result: "INVALID SIGNATURE" as Verification, explanation: "The Ed25519 signature does not verify for this payload.", digest: actual, verifiedAt };
    return { result: "VALID" as Verification, explanation: "The signed content is unchanged and the signing key is trusted and authorized.", digest: actual, verifiedAt };
  } catch {
    return { result: "VERIFICATION ERROR" as Verification, explanation: "Verification could not be completed with the current server configuration.", digest: "", verifiedAt };
  }
}
