import { Role } from "@/generated/prisma";
import { submitDailyReport } from "@/app/actions";
import { Badge, Panel, Shell } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

export default async function Documentation({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { role, user, profile, student } = await requireRole([Role.STUDENT, Role.SUPERVISOR]);
  const query = await searchParams;
  const where = role === Role.STUDENT
    ? { studentId: student?.id ?? "" }
    : { student: { placement: { supervisorId: profile.id } } };
  const reports = await prisma.dailyDocumentation.findMany({ where, include: { student: { include: { user: true } }, versions: { orderBy: { version: "desc" }, take: 1, include: { approvals: { orderBy: { createdAt: "desc" }, take: 1 } } } }, orderBy: { day: "desc" }, take: 100 });
  const errors: Record<string, string> = { validation: "Check the report fields and try again.", locked: "That day is already submitted or signed. A signed report cannot be replaced.", save: "The report could not be saved. Check your database connection and try again.", "no-placement": "Your company placement must be approved before submitting a report.", complete: "Complete your student profile before submitting a report." };
  return <Shell role={role} name={user.name} active="Daily documentation">
    <div className="heading-row"><div><div className="eyebrow">OJT journal</div><h1 className="page-title">Daily documentation</h1><p className="subtle">Reports are saved as versioned records. Signed versions remain immutable.</p></div><Badge tone="blue">{reports.length} records</Badge></div>
    {query.error && <div className="notice error">{errors[query.error] ?? "The requested action could not be completed."}</div>}
    {query.success && <div className="notice success">Report saved and sent to your assigned supervisor.</div>}
    {role === Role.STUDENT && <Panel title="Submit a daily report">{!student ? <p className="subtle">Complete your student profile first.</p> : <form action={submitDailyReport}><div className="form-grid"><div className="field"><label htmlFor="day">OJT day number</label><input id="day" name="day" type="number" min="1" max="365" required /></div><div className="field"><label>File attachments</label><input type="file" disabled /><span className="small">Secure file storage is not configured yet.</span></div><div className="field full"><label htmlFor="activities">Activities completed</label><textarea id="activities" name="activities" minLength={10} maxLength={5000} required placeholder="Describe your work..." /></div><div className="field"><label htmlFor="skills">Skills learned</label><textarea id="skills" name="skills" minLength={2} maxLength={2000} required /></div><div className="field"><label htmlFor="challenges">Challenges and response</label><textarea id="challenges" name="challenges" minLength={2} maxLength={2000} required /></div></div><div className="actions"><button className="button">Submit report</button></div></form>}</Panel>}
    <Panel title={role === Role.STUDENT ? "My reports" : "Reports from assigned students"}>{reports.length ? reports.map((report) => {
      const version = report.versions[0];
      return <article key={report.id} style={{ padding: "14px 0", borderBottom: "1px solid #edf1f5" }}><div className="heading-row" style={{ minHeight: 0, margin: 0, padding: 0, background: "transparent", color: "inherit", flexDirection: "row", justifyContent: "space-between", textAlign: "left" }}><b>{role === Role.SUPERVISOR ? `${report.student.user.name} · ` : ""}Day {report.day} · Version {version?.version ?? 0}</b><Badge tone={report.status === "SIGNED" ? "green" : report.status === "SUBMITTED" ? "amber" : "blue"}>{report.status}</Badge></div>{version && <><p>{version.activities}</p><div className="small">Skills: {version.skills}<br />Challenges: {version.challenges}</div>{version.approvals[0]?.remarks && <div className="notice" style={{ marginTop: 10 }}>Supervisor remarks: {version.approvals[0].remarks}</div>}</>}</article>;
    }) : <div className="empty">No daily reports have been submitted.</div>}</Panel>
  </Shell>;
}
