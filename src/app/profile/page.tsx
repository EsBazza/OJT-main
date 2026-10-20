import { Role } from "@/generated/prisma";
import { saveStudentProfile } from "@/app/actions";
import { Panel, Shell } from "@/components/ui";
import { requireRole } from "@/lib/page-auth";

export default async function Profile({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { role, user, student } = await requireRole([Role.STUDENT]);
  const query = await searchParams;
  return <Shell role={role} name={user.name} active="My profile">
    <div className="heading-row"><div><div className="eyebrow">Student account</div><h1 className="page-title">My profile</h1><p className="subtle">Keep your program and student details up to date.</p></div></div>
    {query.error && <div className="notice error">{query.error === "student-number" ? "That student number is already registered." : "Please complete the required profile details."}</div>}
    {query.saved && <div className="notice success">Profile saved.</div>}
    <Panel title="Profile details"><form action={saveStudentProfile}>
      <div className="form-grid">
        <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" defaultValue={user.name} required minLength={2} maxLength={100} /></div>
        <div className="field"><label>Email</label><input value={user.email} readOnly /></div>
        <div className="field"><label htmlFor="studentNumber">Student number</label><input id="studentNumber" name="studentNumber" defaultValue={student?.studentNumber ?? ""} required minLength={3} maxLength={40} /></div>
        <div className="field"><label htmlFor="program">Program</label><input id="program" name="program" defaultValue={student?.program ?? ""} required minLength={2} maxLength={120} placeholder="e.g. BS Information Technology" /></div>
      </div>
      <div className="actions"><button className="button">Save profile</button></div>
    </form></Panel>
  </Shell>;
}
