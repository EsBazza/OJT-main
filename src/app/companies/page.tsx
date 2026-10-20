import { PlacementStatus, Role } from "@/generated/prisma";
import { decidePlacement } from "@/app/actions";
import { Badge, Panel, Shell } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

export default async function Companies({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { role, user } = await requireRole([Role.COORDINATOR]);
  const query = await searchParams;
  const placements = await prisma.ojtPlacement.findMany({ where: { status: PlacementStatus.PENDING }, include: { student: { include: { user: true } }, company: true }, orderBy: { submittedAt: "asc" } });
  const companyIds = [...new Set(placements.map((placement) => placement.companyId))];
  const supervisors = await prisma.supervisorAssignment.findMany({ where: { companyId: { in: companyIds }, active: true }, include: { user: true } });
  const supervisorsByCompany = new Map<string, typeof supervisors>();
  for (const supervisor of supervisors) supervisorsByCompany.set(supervisor.companyId, [...(supervisorsByCompany.get(supervisor.companyId) ?? []), supervisor]);
  return <Shell role={role} name={user.name} active="Company approvals">
    <div className="heading-row"><div><div className="eyebrow">Coordinator workspace</div><h1 className="page-title">Placement approvals</h1><p className="subtle">Review real requests submitted by students and assign an active company supervisor.</p></div></div>
    {query.error && <div className="notice error">{query.error === "supervisor" ? "Choose an active supervisor assigned to this company before approval." : "This request changed or could not be processed. Refresh the list."}</div>}
    {query.success && <div className="notice success">Placement decision saved.</div>}
    {placements.length ? placements.map((placement) => {
      const companySupervisors = supervisorsByCompany.get(placement.companyId) ?? [];
      return <Panel key={placement.id} title={placement.company.name}><div className="form-grid"><div><span className="small">Student</span><div><b>{placement.student.user.name}</b> · {placement.student.studentNumber}</div></div><div><span className="small">Program</span><div><b>{placement.student.program}</b></div></div><div><span className="small">Address</span><div><b>{placement.company.address ?? "Not provided"}</b></div></div><div><span className="small">Submitted</span><div><b>{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(placement.submittedAt)}</b></div></div></div><p>Status <Badge tone="amber">PENDING</Badge></p>
        <form action={decidePlacement} className="actions"><input type="hidden" name="placementId" value={placement.id} /><div className="field"><label htmlFor={`supervisor-${placement.id}`}>Assigned supervisor</label><select id={`supervisor-${placement.id}`} name="supervisorId" defaultValue=""><option value="">Choose supervisor</option>{companySupervisors.map((assignment) => <option key={assignment.userId} value={assignment.userId}>{assignment.user.name}{assignment.canSign ? " · Can sign" : " · Review only"}</option>)}</select></div><button className="button" name="decision" value="approve" disabled={!companySupervisors.length}>Approve</button><button className="button secondary" name="decision" value="reject">Reject</button></form>
        {!companySupervisors.length && <p className="small">No supervisor has been assigned to this company yet. Configure a supervisor account before approval.</p>}
      </Panel>;
    }) : <Panel title="Pending requests"><div className="empty">There are no pending placement requests.</div></Panel>}
  </Shell>;
}
