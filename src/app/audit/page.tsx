import { Role } from "@/generated/prisma";
import { Badge, Panel, Shell, Table } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

export default async function Audit() {
  const { role, user } = await requireRole([Role.COORDINATOR]);
  const events = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const actorIds = [...new Set(events.flatMap((event) => event.actorId ? [event.actorId] : []))];
  const actors = await prisma.userProfile.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
  const actorNames = new Map(actors.map((actor) => [actor.id, actor.name]));
  return <Shell role={role} name={user.name} active="Audit logs">
    <div className="heading-row"><div><div className="eyebrow">Security and accountability</div><h1 className="page-title">Audit logs</h1><p className="subtle">Recent workflow events recorded in the database.</p></div></div>
    <Panel title="Recent events">{events.length ? <Table headers={["Time", "Actor", "Action", "Record", "Details"]} rows={events.map((event) => [new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(event.createdAt), event.actorId ? actorNames.get(event.actorId) ?? "Account removed" : "System", event.action, `${event.targetType} · ${event.targetId.slice(0, 8)}`, event.details ? JSON.stringify(event.details) : "—"])} /> : <div className="empty">No audit events have been recorded yet.</div>}</Panel>
  </Shell>;
}
