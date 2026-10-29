import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { Role, type Prisma } from "@/generated/prisma";
import { EmptyState, PageHeader, Pagination, Panel, Shell, Stat, Stats, StatusBadge, Table, withQuery } from "@/components/ui";
import { attendanceDisplayStatus, formatCalendarDate, formatHours, formatTime, hoursBetween, isDateString, manilaDate } from "@/lib/format";
import { pageArgs, parsePage } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Attendance report" };

type Query = { dateFrom?: string; dateTo?: string; studentId?: string; companyId?: string; page?: string };

export default async function Reports({ searchParams }: { searchParams: Promise<Query> }) {
  const { role, user } = await requireRole([Role.COORDINATOR]);
  const query = await searchParams;
  const page = parsePage(query.page);
  const from = isDateString(query.dateFrom) ? new Date(`${query.dateFrom}T00:00:00.000Z`) : undefined;
  const to = isDateString(query.dateTo) ? new Date(`${query.dateTo}T00:00:00.000Z`) : undefined;
  const studentId = query.studentId || undefined;
  const companyId = query.companyId || undefined;
  const where: Prisma.AttendanceRecordWhereInput = {
    ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(studentId ? { studentId } : {}),
    ...(companyId ? { student: { placement: { companyId } } } : {}),
  };
  const today = manilaDate();
  const [students, companies, records, summary] = await Promise.all([
    prisma.student.findMany({ where: { user: { role: Role.STUDENT } }, include: { user: true }, orderBy: { user: { name: "asc" } }, take: 1000 }),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 1000 }),
    prisma.attendanceRecord.findMany({ where, include: { student: { include: { user: true, placement: { include: { company: true } } } } }, orderBy: [{ date: "desc" }, { timeIn: "desc" }], ...pageArgs(page) }),
    prisma.attendanceRecord.findMany({ where, select: { date: true, status: true, timeIn: true, timeOut: true } }),
  ]);
  const hours = summary.reduce((sum, row) => sum + hoursBetween(row.timeIn, row.timeOut), 0);
  const count = (status: string) => summary.filter((row) => attendanceDisplayStatus(row, today) === status).length;

  return (
    <Shell role={role} name={user.name}>
      <PageHeader eyebrow="Coordinator" title="Attendance report" description="Totals cover every record that matches the filters, not just this page." />
      <Panel title="Filters">
        <form method="get" className="filters">
          <div className="field"><label htmlFor="dateFrom">From</label><input id="dateFrom" type="date" name="dateFrom" defaultValue={from ? query.dateFrom : ""} /></div>
          <div className="field"><label htmlFor="dateTo">To</label><input id="dateTo" type="date" name="dateTo" defaultValue={to ? query.dateTo : ""} /></div>
          <div className="field"><label htmlFor="studentId">Student</label><select id="studentId" name="studentId" defaultValue={studentId ?? ""}><option value="">All students</option>{students.map((student) => <option key={student.id} value={student.id}>{student.user.name} · {student.studentNumber}</option>)}</select></div>
          <div className="field"><label htmlFor="companyId">Company</label><select id="companyId" name="companyId" defaultValue={companyId ?? ""}><option value="">All companies</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div>
          <div className="actions" style={{ marginTop: 0 }}><button className="button button-primary">Apply</button><a className="button button-ghost" href="/reports">Clear</a></div>
        </form>
      </Panel>
      <Stats>
        <Stat label="Present" value={count("PRESENT")} tone="green" />
        <Stat label="Late" value={count("LATE")} tone="amber" />
        <Stat label="Missed time-outs" value={count("INCOMPLETE")} tone="red" />
        <Stat label="Hours rendered" value={formatHours(hours)} note={`${summary.length} records`} />
      </Stats>
      <Panel title="Records">
        {records.length ? <Table caption="Attendance records" headers={["Student", "Company", "Date", "Time in", "Time out", "Hours", "Status"]} rows={records.map((record) => [
          record.student.user.name,
          record.student.placement?.company.name ?? "—",
          formatCalendarDate(record.date),
          formatTime(record.timeIn),
          formatTime(record.timeOut),
          record.timeOut ? formatHours(hoursBetween(record.timeIn, record.timeOut)) : "—",
          <StatusBadge key="s" status={attendanceDisplayStatus(record, today)} />,
        ])} /> : <EmptyState icon={SearchX} title="No matching records">Try a wider date range or clear the filters.</EmptyState>}
      </Panel>
      <Pagination page={page} total={summary.length} href={(next) => withQuery("/reports", query, { page: next })} />
    </Shell>
  );
}
