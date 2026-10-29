import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { Role, type Prisma } from "@/generated/prisma";
import { changeAccount, createCompany, provisionSupervisor } from "@/app/actions/coordinator";
import { SubmitButton } from "@/components/form";
import { Badge, EmptyState, Notice, PageHeader, Pagination, Panel, Shell, Table, withQuery } from "@/components/ui";
import { pageArgs, parsePage } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Users & companies" };

type Query = { q?: string; role?: string; page?: string; cpage?: string; error?: string; success?: string };

const errors: Record<string, string> = {
  company: "Enter a valid company name and address.",
  "duplicate-company": "A company with that name already exists.",
  provision: "Choose an active, non-coordinator account (not your own) and a company.",
  "student-activity": "That account already has student placement, attendance, or reports. Use a separate account for the supervisor.",
  "has-students": "This supervisor still has approved students. Reassign or finish those placements first.",
  "signing-key": "The server signing key (SIGNING_PRIVATE_KEY_PEM and SIGNING_KEY_ID) must be configured before granting signing permission.",
  account: "That account change is not allowed.",
};
const successes: Record<string, string> = { company: "Company created.", supervisor: "Supervisor access saved.", deactivate: "Account deactivated.", activate: "Account reactivated.", "remove-supervisor": "Supervisor access removed." };
const roleNames: Record<Role, string> = { STUDENT: "Student", SUPERVISOR: "Supervisor", COORDINATOR: "Coordinator" };

function AccountAction({ userId, change, label, variant = "secondary" }: { userId: string; change: string; label: string; variant?: "secondary" | "danger" }) {
  return <form action={changeAccount}><input type="hidden" name="userId" value={userId} /><input type="hidden" name="change" value={change} /><SubmitButton variant={variant} pendingText="Saving…">{label}</SubmitButton></form>;
}

export default async function Users({ searchParams }: { searchParams: Promise<Query> }) {
  const { role, user } = await requireRole([Role.COORDINATOR]);
  const query = await searchParams;
  const page = parsePage(query.page);
  const companyPage = parsePage(query.cpage);
  const search = query.q?.trim().slice(0, 100) ?? "";
  const roleFilter = Object.values(Role).includes(query.role as Role) ? (query.role as Role) : undefined;
  const where: Prisma.UserProfileWhereInput = {
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }, { student: { studentNumber: { contains: search, mode: "insensitive" } } }] } : {}),
  };
  const [profiles, total, eligible, companies, companyTotal, allCompanies, supervisorCounts] = await Promise.all([
    prisma.userProfile.findMany({ where, include: { student: true, supervisor: { include: { company: true } } }, orderBy: [{ role: "asc" }, { name: "asc" }], ...pageArgs(page) }),
    prisma.userProfile.count({ where }),
    prisma.userProfile.findMany({ where: { active: true, role: { not: Role.COORDINATOR } }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: "asc" }, take: 1000 }),
    prisma.company.findMany({ orderBy: { name: "asc" }, ...pageArgs(companyPage) }),
    prisma.company.count(),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 1000 }),
    prisma.supervisorAssignment.groupBy({ by: ["companyId"], where: { active: true }, _count: true }),
  ]);
  const supervisorsByCompany = new Map(supervisorCounts.map((row) => [row.companyId, row._count]));

  return (
    <Shell role={role} name={user.name}>
      <PageHeader eyebrow="Coordinator" title="Users & companies" description="Register companies, give supervisor access, and manage accounts. Coordinator access is granted by a database administrator." />
      {query.error && <Notice tone="error">{errors[query.error] ?? "The change could not be completed."}</Notice>}
      {query.success && <Notice tone="success">{successes[query.success] ?? "Saved."}</Notice>}

      <div className="grid-2">
        <Panel title="Assign a supervisor">
          <form action={provisionSupervisor} className="stack">
            <div className="field"><label htmlFor="userId">Account</label><select id="userId" name="userId" required defaultValue=""><option value="">Choose a registered account</option>{eligible.filter((profile) => profile.id !== user.id).map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.email} · {roleNames[profile.role]}</option>)}</select><p className="field-hint">The person registers first, then you give their account supervisor access.</p></div>
            <div className="field"><label htmlFor="companyId">Company</label><select id="companyId" name="companyId" required defaultValue=""><option value="">Choose a company</option>{allCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div>
            <div className="field"><label htmlFor="canSign">Permission</label><select id="canSign" name="canSign" defaultValue="false"><option value="false">Review reports only</option><option value="true">Review and sign approved reports</option></select></div>
            <div><SubmitButton pendingText="Saving…">Save supervisor access</SubmitButton></div>
          </form>
        </Panel>
        <Panel title="Register a company">
          <form action={createCompany} className="stack">
            <div className="field"><label htmlFor="company-name">Company name</label><input id="company-name" name="name" required minLength={2} maxLength={160} autoComplete="organization" /></div>
            <div className="field"><label htmlFor="company-address">Address</label><input id="company-address" name="address" required minLength={4} maxLength={300} /></div>
            <div><SubmitButton pendingText="Creating…">Create company</SubmitButton></div>
          </form>
        </Panel>
      </div>

      <Panel title="Accounts" id="accounts">
        <form method="get" className="filters" role="search" style={{ marginBottom: 16 }}>
          <div className="field"><label htmlFor="q">Search</label><input id="q" name="q" type="search" defaultValue={search} placeholder="Name, email, or student number" /></div>
          <div className="field"><label htmlFor="role">Role</label><select id="role" name="role" defaultValue={roleFilter ?? ""}><option value="">All roles</option>{Object.values(Role).map((value) => <option key={value} value={value}>{roleNames[value]}</option>)}</select></div>
          <div className="actions" style={{ marginTop: 0 }}><button className="button button-primary">Search</button>{(search || roleFilter) && <a className="button button-ghost" href="/users">Clear</a>}</div>
        </form>
        {profiles.length ? <Table caption="Accounts" headers={["Name", "Email", "Role", "Details", "Status", "Actions"]} rows={profiles.map((profile) => [
          profile.name,
          profile.email,
          roleNames[profile.role],
          profile.student?.studentNumber ?? (profile.supervisor?.active ? `${profile.supervisor.company.name}${profile.supervisor.canSign ? " · can sign" : ""}` : "—"),
          <Badge key="s" tone={profile.active ? "green" : "red"}>{profile.active ? "Active" : "Inactive"}</Badge>,
          profile.role === Role.COORDINATOR || profile.id === user.id ? <span key="a" className="muted">—</span> : (
            <div key="a" className="actions" style={{ marginTop: 0 }}>
              {profile.active ? <AccountAction userId={profile.id} change="deactivate" label="Deactivate" variant="danger" /> : <AccountAction userId={profile.id} change="activate" label="Reactivate" />}
              {profile.role === Role.SUPERVISOR && <AccountAction userId={profile.id} change="remove-supervisor" label="Remove supervisor" />}
            </div>
          ),
        ])} /> : <EmptyState icon={SearchX} title="No matching accounts">Try a different search or role.</EmptyState>}
      </Panel>
      <Pagination page={page} total={total} href={(next) => withQuery("/users", query, { page: next }) + "#accounts"} />

      <Panel title="Companies" id="companies">
        {companies.length ? <Table caption="Companies" headers={["Company", "Address", "Status", "Active supervisors"]} rows={companies.map((company) => [company.name, company.address ?? "—", <Badge key="s" tone={company.approved ? "green" : "amber"}>{company.approved ? "Approved" : "Proposed by student"}</Badge>, String(supervisorsByCompany.get(company.id) ?? 0)])} /> : <EmptyState title="No companies yet" />}
      </Panel>
      <Pagination page={companyPage} total={companyTotal} href={(next) => withQuery("/users", query, { cpage: next }) + "#companies"} />
    </Shell>
  );
}
