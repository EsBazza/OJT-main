import { Role } from "@/generated/prisma";
import { Badge, Panel, Shell, Table } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

function clock(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(value) : "—";
}

export default async function History() {
  const { role, user, student } = await requireRole([Role.STUDENT, Role.COORDINATOR]);
  const rows = await prisma.attendanceRecord.findMany({
    where: role === Role.STUDENT ? { studentId: student?.id ?? "" } : undefined,
    include: { student: { include: { user: true, placement: { include: { company: true } } } } },
    orderBy: [{ date: "desc" }, { timeIn: "desc" }], take: 250,
  });
  const hours = rows.reduce((sum, row) => sum + (row.timeIn && row.timeOut ? (row.timeOut.getTime() - row.timeIn.getTime()) / 3_600_000 : 0), 0);
  return <Shell role={role} name={user.name} active="Attendance history">
    <div className="heading-row"><div><div className="eyebrow">Saved attendance</div><h1 className="page-title">Attendance history</h1><p className="subtle">Records are loaded from the OJT database.</p></div></div>
    <div className="cards"><div className="card"><div className="card-label">Entries shown</div><div className="card-value">{rows.length}</div><div className="card-note">Most recent 250</div></div><div className="card"><div className="card-label">Completed hours</div><div className="card-value">{hours.toFixed(1)}</div><div className="card-note">Only complete time-in/out pairs</div></div></div>
    <Panel title="Attendance records">{rows.length ? <Table headers={role === Role.STUDENT ? ["Date", "Time in", "Time out", "Hours", "Method", "Status"] : ["Student", "Company", "Date", "Time in", "Time out", "Status"]} rows={rows.map((row) => role === Role.STUDENT
      ? [new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(row.date), clock(row.timeIn), clock(row.timeOut), row.timeIn && row.timeOut ? ((row.timeOut.getTime() - row.timeIn.getTime()) / 3_600_000).toFixed(2) : "—", row.verification ? "Verified device" : row.method, <Badge tone={row.status === "ABSENT" ? "red" : row.status === "LATE" ? "amber" : "green"}>{row.status}</Badge>]
      : [row.student.user.name, row.student.placement?.company.name ?? "—", new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(row.date), clock(row.timeIn), clock(row.timeOut), <Badge tone={row.status === "ABSENT" ? "red" : row.status === "LATE" ? "amber" : "green"}>{row.status}</Badge>])} /> : <div className="empty">No attendance records yet.</div>}</Panel>
  </Shell>;
}
