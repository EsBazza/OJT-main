import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { Role, type Prisma } from "@/generated/prisma";
import { Badge, EmptyState, PageHeader, Pagination, Panel, Shell, Table, withQuery } from "@/components/ui";
import { formatDateTime, isDateString, type Tone } from "@/lib/format";
import { pageArgs, parsePage } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Audit log" };

const actions: Record<string, [string, Tone]> = {
  STUDENT_PROFILE_UPDATED: ["Updated their profile", "gray"],
  PLACEMENT_SUBMITTED: ["Submitted a placement request", "blue"],
  PLACEMENT_APPROVED: ["Approved a placement", "green"],
  PLACEMENT_REJECTED: ["Rejected a placement", "red"],
  COMPANY_CREATED: ["Registered a company", "blue"],
  SUPERVISOR_PROVISIONED: ["Gave supervisor access", "blue"],
  SUPERVISOR_REMOVED: ["Removed supervisor access", "amber"],
  ACCOUNT_DEACTIVATED: ["Deactivated an account", "red"],
  ACCOUNT_ACTIVATED: ["Reactivated an account", "green"],
  ATTENDANCE_TIME_IN: ["Timed in", "gray"],
  ATTENDANCE_TIME_OUT: ["Timed out", "gray"],
  REPORT_SUBMITTED: ["Submitted a report", "blue"],
  REPORT_APPROVED: ["Approved a report", "green"],
  REPORT_RETURNED: ["Returned a report", "amber"],
  REPORT_SIGNED: ["Signed a report", "green"],
  SIGNATURE_VERIFIED: ["Verified a signature", "gray"],
};

function describe(details: Prisma.JsonValue | null): string {
  if (!details || typeof details !== "object" || Array.isArray(details)) return "";
  const entries = details as Record<string, unknown>;
  const parts: string[] = [];
  if (entries.day !== undefined) parts.push(`Day ${entries.day}`);
  if (entries.date) parts.push(String(entries.date));
  if (entries.version !== undefined) parts.push(`version ${entries.version}`);
  if (entries.company) parts.push(String(entries.company));
  if (entries.name) parts.push(String(entries.name));
  if (entries.status) parts.push(String(entries.status).toLowerCase());
  if (entries.result) parts.push(`result: ${String(entries.result).toLowerCase()}`);
  if (entries.shiftStart) parts.push(`shift ${entries.shiftStart}`);
  if (typeof entries.canSign === "boolean") parts.push(entries.canSign ? "can sign" : "review only");
  if (entries.remarks) parts.push(`“${String(entries.remarks).slice(0, 120)}”`);
  return parts.join(" · ");
}

type Query = { action?: string; actor?: string; dateFrom?: string; dateTo?: string; page?: string };

export default async function Audit({ searchParams }: { searchParams: Promise<Query> }) {
  const { role, user } = await requireRole([Role.COORDINATOR]);
  const query = await searchParams;
  const page = parsePage(query.page);
  const actorSearch = query.actor?.trim().slice(0, 100) ?? "";
  const actorIds = actorSearch ? (await prisma.userProfile.findMany({ where: { OR: [{ name: { contains: actorSearch, mode: "insensitive" } }, { email: { contains: actorSearch, mode: "insensitive" } }] }, select: { id: true }, take: 200 })).map((actor) => actor.id) : null;
  const where: Prisma.AuditLogWhereInput = {
    ...(query.action && actions[query.action] ? { action: query.action } : {}),
    ...(actorIds ? { actorId: { in: actorIds } } : {}),
    ...(isDateString(query.dateFrom) || isDateString(query.dateTo) ? { createdAt: {
      ...(isDateString(query.dateFrom) ? { gte: new Date(`${query.dateFrom}T00:00:00+08:00`) } : {}),
      ...(isDateString(query.dateTo) ? { lt: new Date(new Date(`${query.dateTo}T00:00:00+08:00`).getTime() + 86_400_000) } : {}),
    } } : {}),
  };
  const [events, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, ...pageArgs(page, 50) }),
    prisma.auditLog.count({ where }),
  ]);
  const actors = await prisma.userProfile.findMany({ where: { id: { in: [...new Set(events.flatMap((event) => event.actorId ? [event.actorId] : []))] } }, select: { id: true, name: true } });
  const actorNames = new Map(actors.map((actor) => [actor.id, actor.name]));

  return (
    <Shell role={role} name={user.name}>
      <PageHeader eyebrow="Accountability" title="Audit log" description="Every key action, newest first. Times are in Manila time." />
      <Panel title="Filters">
        <form method="get" className="filters">
          <div className="field"><label htmlFor="actor">Person</label><input id="actor" name="actor" type="search" defaultValue={actorSearch} placeholder="Name or email" /></div>
          <div className="field"><label htmlFor="action">Action</label><select id="action" name="action" defaultValue={query.action ?? ""}><option value="">All actions</option>{Object.entries(actions).map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="field"><label htmlFor="dateFrom">From</label><input id="dateFrom" name="dateFrom" type="date" defaultValue={query.dateFrom ?? ""} /></div>
          <div className="field"><label htmlFor="dateTo">To</label><input id="dateTo" name="dateTo" type="date" defaultValue={query.dateTo ?? ""} /></div>
          <div className="actions" style={{ marginTop: 0 }}><button className="button button-primary">Apply</button><a className="button button-ghost" href="/audit">Clear</a></div>
        </form>
      </Panel>
      <Panel title="Events">
        {events.length ? <Table caption="Audit events" headers={["When", "Who", "Action", "Details"]} rows={events.map((event) => {
          const [label, tone] = actions[event.action] ?? [event.action, "gray" as Tone];
          return [formatDateTime(event.createdAt), event.actorId ? actorNames.get(event.actorId) ?? "Removed account" : "System", <Badge key="a" tone={tone}>{label}</Badge>, describe(event.details) || "—"];
        })} /> : <EmptyState icon={SearchX} title="No matching events">Try different filters.</EmptyState>}
      </Panel>
      <Pagination page={page} total={total} size={50} href={(next) => withQuery("/audit", query, { page: next })} />
    </Shell>
  );
}
