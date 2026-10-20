import { Role } from "@/generated/prisma";
import { reviewReport, signApprovedReport } from "@/app/actions";
import { Badge, Panel, Shell } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

export default async function Signing({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const { role, user, profile } = await requireRole([Role.SUPERVISOR]);
  const query = await searchParams;
  const assignment = profile.supervisor;
  const reports = assignment ? await prisma.dailyDocumentation.findMany({ where: { student: { placement: { companyId: assignment.companyId, supervisorId: profile.id } } }, include: { student: { include: { user: true, placement: { include: { company: true } } } }, versions: { orderBy: { version: "desc" }, take: 1, include: { approvals: { orderBy: { createdAt: "desc" }, take: 1 }, signatures: true } } }, orderBy: { updatedAt: "desc" } }) : [];
  const messages: Record<string, string> = { invalid: "The report request was incomplete.", permission: "You are not authorized to review this report.", stale: "This report has already changed. Refresh the page and check its status.", signing: "The signature could not be saved. Confirm the signing key is configured on the server.", "signing-key": "Your registered supervisor key does not match the server signing key. Contact the coordinator before signing.", "no-assignment": "Your supervisor account has no active signing assignment." };
  return <Shell role={role} name={user.name} active="Review & signing">
    <div className="heading-row"><div><div className="eyebrow">Supervisor workspace</div><h1 className="page-title">Review and digital signing</h1><p className="subtle">Review only reports assigned to your company. Approval and signing are separately recorded.</p></div></div>
    {query.error && <div className="notice error">{messages[query.error] ?? "The action could not be completed."}</div>}
    {query.success && <div className="notice success">{query.success === "signed" ? "Report signed and saved." : "Review decision saved."}</div>}
    {!assignment && <div className="notice warn">{messages["no-assignment"]}</div>}
    {assignment && (reports.length ? reports.map((report) => {
      const version = report.versions[0];
      if (!version) return null;
      const canReview = report.status === "SUBMITTED" && !version.immutable && version.signatures.length === 0;
      const canSign = assignment.canSign && report.status === "APPROVED" && !version.immutable && version.signatures.length === 0;
      return <Panel key={report.id} title={`${report.student.user.name} · Day ${report.day} · Version ${version.version}`}><div className="small">{report.student.placement?.company.name ?? "No company"} · Student number {report.student.studentNumber}</div><h3>Activities</h3><p>{version.activities}</p><div className="form-grid"><div><span className="small">Skills</span><p>{version.skills}</p></div><div><span className="small">Challenges</span><p>{version.challenges}</p></div></div><p>Status <Badge tone={report.status === "SIGNED" ? "green" : report.status === "SUBMITTED" ? "amber" : "blue"}>{report.status}</Badge></p>{version.approvals[0]?.remarks && <div className="notice">Latest remarks: {version.approvals[0].remarks}</div>}
        {canReview && <form action={reviewReport}><input type="hidden" name="versionId" value={version.id} /><div className="field"><label htmlFor={`remarks-${version.id}`}>Review remarks</label><textarea id={`remarks-${version.id}`} name="remarks" maxLength={2000} /></div><div className="actions"><button className="button secondary" name="decision" value="return">Return for correction</button><button className="button" name="decision" value="approve">Approve report</button></div></form>}
        {canSign && <form action={signApprovedReport} className="actions"><input type="hidden" name="versionId" value={version.id} /><button className="button">Sign approved version</button><span className="small">Ed25519 signature is stored with the report version.</span></form>}
        {report.status === "APPROVED" && !assignment.canSign && <div className="notice warn">Your account can review but is not authorized to sign.</div>}
      </Panel>;
    }) : <Panel title="Assigned reports"><div className="empty">No reports have been submitted by your assigned students.</div></Panel>)}
  </Shell>;
}
