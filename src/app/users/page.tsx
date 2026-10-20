import { Role } from "@/generated/prisma";
import { createCompany, provisionSupervisor } from "@/app/actions";
import { Badge, Panel, Shell, Table } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

export default async function Users({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { role, user } = await requireRole([Role.COORDINATOR]);
  const query = await searchParams;
  const [profiles, companies] = await Promise.all([
    prisma.userProfile.findMany({ include: { student: true, supervisor: { include: { company: true } } }, orderBy: [{ role: "asc" }, { name: "asc" }], take: 500 }),
    prisma.company.findMany({ orderBy: { name: "asc" }, take: 500 }),
  ]);
  const errors: Record<string, string> = { company: "Enter a valid company name and address.", "duplicate-company": "A company with that name already exists.", provision: "Choose an active user account and company.", "signing-key": "A valid Ed25519 signing key and key identifier must be configured before granting signing permission." };
  return <Shell role={role} name={user.name} active="User & roles">
    <div className="heading-row"><div><div className="eyebrow">Coordinator workspace</div><h1 className="page-title">Users, roles, and companies</h1><p className="subtle">Manage real profile records. Coordinator privileges must be granted by a trusted database administrator.</p></div></div>
    {query.error && <div className="notice error">{errors[query.error] ?? "The requested change could not be completed."}</div>}
    {query.success && <div className="notice success">{query.success === "company" ? "Company record created." : "Supervisor access saved."}</div>}
    <div className="grid-2">
      <Panel title="Register a company"><form action={createCompany}><div className="field"><label htmlFor="company-name">Company name</label><input id="company-name" name="name" required minLength={2} maxLength={160} /></div><div className="field" style={{ marginTop: 12 }}><label htmlFor="company-address">Address</label><input id="company-address" name="address" required minLength={4} maxLength={300} /></div><div className="actions"><button className="button">Create company</button></div></form></Panel>
      <Panel title="Assign a supervisor"><form action={provisionSupervisor}><div className="field"><label htmlFor="userId">Account</label><select id="userId" name="userId" required defaultValue=""><option value="">Choose a registered account</option>{profiles.filter((profile) => profile.active && profile.role !== Role.COORDINATOR).map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.email} · {profile.role}</option>)}</select></div><div className="field" style={{ marginTop: 12 }}><label htmlFor="companyId">Company</label><select id="companyId" name="companyId" required defaultValue=""><option value="">Choose a company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div><div className="field" style={{ marginTop: 12 }}><label htmlFor="canSign">Digital signing permission</label><select id="canSign" name="canSign" defaultValue="false"><option value="false">Review reports only</option><option value="true">Review and sign approved reports</option></select></div><div className="actions"><button className="button">Save supervisor access</button></div></form><p className="small">Signing also requires the supervisor’s public key to be provisioned securely.</p></Panel>
    </div>
      <Panel title={`${profiles.length} registered accounts`}>
      {profiles.length ? <Table headers={["Name", "Email", "Role", "Student / Company", "Access"]} rows={profiles.map((profile) => [profile.name, profile.email, profile.role, profile.student?.studentNumber ?? profile.supervisor?.company.name ?? "—", <Badge tone={profile.active ? "green" : "red"}>{profile.active ? "Active" : "Inactive"}</Badge>])} /> : <div className="empty">No profiles are registered yet.</div>}
    </Panel>
    <Panel title={`${companies.length} companies`}>
      {companies.length ? <Table headers={["Company", "Address", "Approved", "Active supervisors"]} rows={companies.map((company) => [company.name, company.address ?? "—", <Badge tone={company.approved ? "green" : "amber"}>{company.approved ? "Approved" : "Pending"}</Badge>, String(profiles.filter((profile) => profile.supervisor?.companyId === company.id && profile.supervisor.active).length)])} /> : <div className="empty">No companies have been added.</div>}
    </Panel>
  </Shell>;
}
