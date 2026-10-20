import { Role } from "@/generated/prisma";
import { submitPlacement } from "@/app/actions";
import { Badge, Panel, Shell } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

export default async function Placement({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { role, user, student } = await requireRole([Role.STUDENT]);
  const query = await searchParams;
  const placement = student ? await prisma.ojtPlacement.findUnique({ where: { studentId: student.id }, include: { company: true } }) : null;
  const supervisor = placement?.supervisorId ? await prisma.userProfile.findUnique({ where: { id: placement.supervisorId }, select: { name: true } }) : null;
  return <Shell role={role} name={user.name} active="Company placement">
    <div className="heading-row"><div><div className="eyebrow">Internship host</div><h1 className="page-title">Company placement</h1><p className="subtle">Submit your host company and track its review status.</p></div></div>
    {query.error && <div className="notice error">{query.error === "already-submitted" ? "You already have a pending or approved placement." : query.error === "complete" ? "Complete your student profile first." : "Please check the company details and try again."}</div>}
    {query.success && <div className="notice success">Placement request saved and sent for coordinator review.</div>}
    {placement && <Panel title="Current placement"><div className="form-grid"><div className="field"><label>Company</label><input value={placement.company.name} readOnly /></div><div className="field"><label>Address</label><input value={placement.company.address ?? "Not provided"} readOnly /></div><div className="field"><label>Supervisor</label><input value={supervisor?.name ?? "Not assigned"} readOnly /></div><div className="field"><label>Status</label><div><Badge tone={placement.status === "APPROVED" ? "green" : placement.status === "REJECTED" ? "red" : "amber"}>{placement.status}</Badge></div></div></div></Panel>}
    {(!placement || placement.status === "REJECTED") && <Panel title="Submit a placement request">{!student ? <p className="subtle">Complete your <a href="/profile"><b>student profile</b></a> before submitting a company.</p> : <form action={submitPlacement}><div className="form-grid"><div className="field"><label htmlFor="company">Company name</label><input id="company" name="company" required minLength={2} maxLength={160} /></div><div className="field"><label htmlFor="address">Work address</label><input id="address" name="address" required minLength={4} maxLength={300} /></div></div><div className="actions"><button className="button">Submit for approval</button></div></form>}</Panel>}
  </Shell>;
}
