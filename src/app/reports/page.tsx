import { AttendanceStatus, Role } from "@/generated/prisma";
import { Badge, Card, Panel, Shell, Table } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

type Query = { dateFrom?: string; dateTo?: string; studentId?: string; companyId?: string };
function validDate(value?: string) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : undefined; }

export default async function Reports({ searchParams }: { searchParams: Promise<Query> }) {
  const { role, user } = await requireRole([Role.COORDINATOR]);
  const query = await searchParams;
  const from = validDate(query.dateFrom);
  const toDate = validDate(query.dateTo);
  const to = toDate ? new Date(toDate.getTime() + 86_400_000) : undefined;
  const studentId = query.studentId || undefined;
  const companyId = query.companyId || undefined;
  const [students, companies, records] = await Promise.all([
    prisma.student.findMany({ where: { user: { role: Role.STUDENT, active: true } }, include: { user: true }, orderBy: { user: { name: "asc" } }, take: 500 }),
    prisma.company.findMany({ orderBy: { name: "asc" }, take: 500 }),
    prisma.attendanceRecord.findMany({ where: { ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}), ...(studentId ? { studentId } : {}), ...(companyId ? { student: { placement: { companyId } } } : {}) }, include: { student: { include: { user: true, placement: { include: { company: true } } } } }, orderBy: [{ date: "desc" }, { timeIn: "desc" }], take: 2000 }),
  ]);
  const hours = records.reduce((sum, row) => sum + (row.timeIn && row.timeOut ? (row.timeOut.getTime() - row.timeIn.getTime()) / 3_600_000 : 0), 0);
  const count = (status: AttendanceStatus) => records.filter((record) => record.status === status).length;
  return <Shell role={role} name={user.name} active="Reports">
    <div className="heading-row"><div><div className="eyebrow">Coordinator workspace</div><h1 className="page-title">Attendance reports</h1><p className="subtle">Metrics and records are calculated from saved attendance events.</p></div></div>
    <Panel title="Filter records"><form method="get"><div className="form-grid"><div className="field"><label htmlFor="dateFrom">Date from</label><input id="dateFrom" type="date" name="dateFrom" defaultValue={query.dateFrom} /></div><div className="field"><label htmlFor="dateTo">Date to</label><input id="dateTo" type="date" name="dateTo" defaultValue={query.dateTo} /></div><div className="field"><label htmlFor="studentId">Student</label><select id="studentId" name="studentId" defaultValue={studentId ?? ""}><option value="">All students</option>{students.map((student) => <option key={student.id} value={student.id}>{student.user.name}</option>)}</select></div><div className="field"><label htmlFor="companyId">Company</label><select id="companyId" name="companyId" defaultValue={companyId ?? ""}><option value="">All companies</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div></div><div className="actions"><button className="button">Apply filters</button><a className="button secondary" href="/reports">Clear filters</a></div></form></Panel>
    <div className="cards"><Card label="Present" value={String(count(AttendanceStatus.PRESENT))} note="Matching records" /><Card label="Late" value={String(count(AttendanceStatus.LATE))} note="Matching records" /><Card label="Absent" value={String(count(AttendanceStatus.ABSENT))} note="Matching records" /><Card label="Completed hours" value={hours.toFixed(1)} note="From complete time pairs" /></div>
    <Panel title={`Attendance detail · ${records.length} records`}>{records.length ? <Table headers={["Student", "Company", "Date", "Time in", "Time out", "Status", "Hours", "Method"]} rows={records.map((record) => [record.student.user.name, record.student.placement?.company.name ?? "—", new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(record.date), record.timeIn ? new Intl.DateTimeFormat("en-PH", { timeStyle: "short", timeZone: "Asia/Manila" }).format(record.timeIn) : "—", record.timeOut ? new Intl.DateTimeFormat("en-PH", { timeStyle: "short", timeZone: "Asia/Manila" }).format(record.timeOut) : "—", <Badge tone={record.status === "ABSENT" ? "red" : record.status === "LATE" ? "amber" : "green"}>{record.status}</Badge>, record.timeIn && record.timeOut ? ((record.timeOut.getTime() - record.timeIn.getTime()) / 3_600_000).toFixed(2) : "—", record.verification ? "Verified device" : record.method])} /> : <div className="empty">No attendance records match these filters.</div>}</Panel>
  </Shell>;
}
