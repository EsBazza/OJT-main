import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { Role, type Prisma } from "@/generated/prisma";
import { Badge, EmptyState, PageHeader, Pagination, Panel, Shell, Table, withQuery } from "@/components/ui";
import { pageArgs, parsePage } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";
import { AccountActions, CompanyForm, SupervisorForm } from "./coordinator-forms";

export const metadata: Metadata = { title: "Users & companies" };

type Query = { q?: string; role?: string; page?: string; cpage?: string };

const roleNames: Record<Role, string> = { STUDENT: "Student", SUPERVISOR: "Supervisor", COORDINATOR: "Coordinator" };

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

      <div className="grid-2">
        <Panel title="Assign a supervisor">
          <SupervisorForm accounts={eligible.filter((profile) => profile.id !== user.id).map((profile) => ({ id: profile.id, label: `${profile.name} · ${profile.email} · ${roleNames[profile.role]}` }))} companies={allCompanies.map((company) => ({ id: company.id, label: company.name }))} />
        </Panel>
        <Panel title="Register a company">
          <CompanyForm />
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
            <AccountActions key="a" userId={profile.id} name={profile.name} active={profile.active} supervisor={profile.role === Role.SUPERVISOR} />
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
