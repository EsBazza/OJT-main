import type { Metadata } from "next";
import { AlarmClock, CalendarCheck, CalendarClock, Clock, Download, FileWarning } from "lucide-react";
import { Role } from "@/generated/prisma";
import { AttendanceCalendar } from "@/components/attendance-calendar";
import { parseMonth } from "@/lib/analytics";
import { EmptyState, PageHeader, Pagination, Panel, Shell, Stat, Stats, StatusBadge, Table, withQuery } from "@/components/ui";
import { attendanceDisplayStatus, formatCalendarDate, formatHours, formatTime, hoursBetween, manilaDate, manilaDateString } from "@/lib/format";
import { pageArgs, parsePage } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Attendance history" };

export default async function History({ searchParams }: { searchParams: Promise<{ page?: string; month?: string }> }) {
  const { role, user, student } = await requireRole([Role.STUDENT]);
  const query = await searchParams;
  const page = parsePage(query.page);
  const where = { studentId: student?.id ?? "" };
  const today = manilaDate();
  const [rows, all] = await Promise.all([
    prisma.attendanceRecord.findMany({ where, orderBy: [{ date: "desc" }], ...pageArgs(page) }),
    prisma.attendanceRecord.findMany({ where, select: { date: true, status: true, timeIn: true, timeOut: true } }),
  ]);
  const { year, month } = parseMonth(query.month, manilaDateString());
  const hours = all.reduce((sum, row) => sum + hoursBetween(row.timeIn, row.timeOut), 0);
  const late = all.filter((row) => row.status === "LATE").length;
  const missed = all.filter((row) => attendanceDisplayStatus(row, today) === "INCOMPLETE").length;
  return (
    <Shell role={role} name={user.name}>
      <PageHeader eyebrow="Attendance" title="Attendance history" description="Every day you timed in, with server-recorded times." actions={<a className="button button-secondary" href="/api/export/attendance?format=pdf"><Download aria-hidden="true" size={18} />Download PDF</a>} />
      <Stats>
        <Stat icon={Clock} label="Hours rendered" value={formatHours(hours)} note="Completed days only" />
        <Stat icon={CalendarCheck} label="Days recorded" value={all.length} />
        <Stat icon={AlarmClock} label="Late" value={late} tone="amber" />
        <Stat icon={FileWarning} label="Missed time-outs" value={missed} tone="red" />
      </Stats>
      <Panel title="Calendar" id="calendar">
        <AttendanceCalendar year={year} month={month} records={all} today={today} href={(next) => withQuery("/attendance/history", query, { month: next }) + "#calendar"} />
      </Panel>
      <Panel title="Records">
        {rows.length ? <Table caption="Attendance records" headers={["Date", "Time in", "Time out", "Hours", "Status"]} rows={rows.map((row) => [formatCalendarDate(row.date), formatTime(row.timeIn), formatTime(row.timeOut), row.timeOut ? formatHours(hoursBetween(row.timeIn, row.timeOut)) : "—", <StatusBadge key="s" status={attendanceDisplayStatus(row, today)} />])} /> : <EmptyState icon={CalendarClock} title="No attendance yet">Records appear here after your first time-in.</EmptyState>}
      </Panel>
      <Pagination page={page} total={all.length} href={(next) => withQuery("/attendance/history", query, { page: next })} />
    </Shell>
  );
}
