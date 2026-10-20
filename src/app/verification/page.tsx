import { Role } from "@/generated/prisma";
import { Panel, Shell } from "@/components/ui";
import { VerifyButton } from "@/components/verify-button";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

export default async function Verification() {
  const { role, user } = await requireRole([Role.COORDINATOR]);
  const signatures = await prisma.digitalSignature.findMany({
    include: {
      version: {
        include: {
          documentation: {
            include: {
              student: { include: { user: true, placement: { include: { company: true } } } },
            },
          },
          approvals: { where: { decision: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { signedAt: "desc" },
  });
  const signerIds = [...new Set(signatures.map((item) => item.signerId))];
  const signers = await prisma.userProfile.findMany({ where: { id: { in: signerIds } }, include: { supervisor: true } });
  const signerById = new Map(signers.map((signer) => [signer.id, signer]));
  return <Shell role={role} name={user.name} active="Signature verification">
    <div className="heading-row"><div><div className="eyebrow">Integrity records</div><h1 className="page-title">Digital signature verification</h1><p className="subtle">Verify saved report versions against the signing supervisor’s registered Ed25519 public key.</p></div></div>
    <div className="notice warn">A valid signature confirms that the signed content has not changed and matches a trusted key. It does not independently prove a person’s real-world identity.</div>
    {signatures.length ? signatures.map((signature) => {
      const version = signature.version;
      const report = version.documentation;
      const signer = signerById.get(signature.signerId);
      return <Panel key={signature.id} title={`Day ${report.day} · Version ${version.version} · ${report.student.user.name}`}><div className="form-grid"><div><span className="small">Company</span><div><b>{report.student.placement?.company.name ?? "Placement not found"}</b></div></div><div><span className="small">Signer</span><div><b>{signer?.name ?? "Unknown account"}</b></div></div><div><span className="small">Signed</span><div><b>{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(signature.signedAt)}</b></div></div><div><span className="small">Key identifier</span><div><b>{signature.keyId}</b></div></div><div className="field full"><span className="small">SHA-256 digest</span><code style={{ overflowWrap: "anywhere" }}>{signature.digest}</code></div></div><p>{version.activities}</p><VerifyButton documentId={version.id} /></Panel>;
    }) : <Panel title="Signed report versions"><div className="empty">No digitally signed reports are available to verify.</div></Panel>}
  </Shell>;
}
