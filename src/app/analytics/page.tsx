import type { Metadata } from "next";
import { AlarmClock, BarChart3, CalendarCheck, FileWarning, Hourglass } from "lucide-react";
import { Role } from "@/generated/prisma";
import { DailyAttendanceChart, HoursChart, LateRateChart } from "@/components/charts";
import { EmptyState, PageHeader, Panel, Shell, Stat, Stats } from "@/components/ui";
import { attendanceBucket, dailyCounts, hoursBy, lateRateBy } from "@/lib/analytics";
import { formatHours, hoursBetween, manilaDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Analytics" };

const DAYS = 30;
const requiredHours = Math.max(1, Number(process.env.OJT_REQUIRED_HOURS) || 486);

export default async function Analytics() {
  const { role, user } = await requireRole([Role.COORDINATOR]);
  const today = manilaDate();
  const since = new Date(today.getTime() - (DAYS - 1) * 86_400_000);
  const [recent, allTime] = await Promise.all([
    prisma.attendanceRecord.findMany({ where: { date: { gte: since, lte: today } }, select: { date: true, status: true, timeIn: true, timeOut: true, student: { select: { placement: { select: { company: { select: { name: true } } } } } } } }),
    prisma.attendanceRecord.findMany({ where: { student: { user: { role: Role.STUDENT, active: true } } }, select: { date: true, status: true, timeIn: true, timeOut: true, student: { select: { studentNumber: true, user: { select: { name: true } } } } } }),
  ]);

  const daily = dailyCounts(recent, today, DAYS);
  const buckets = recent.filter((row) => row.timeIn).map((row) => attendanceBucket(row, today));
  const lateRate = buckets.length ? buckets.filter((bucket) => bucket === "late").length / buckets.length : 0;
  const missed = buckets.filter((bucket) => bucket === "missed").length;
  const recentHours = recent.reduce((sum, row) => sum + hoursBetween(row.timeIn, row.timeOut), 0);
  const completeDays = recent.filter((row) => row.timeIn && row.timeOut).length;
  const companies = lateRateBy(recent.map((row) => ({ ...row, group: row.student.placement?.company.name ?? null })));
  const students = hoursBy(allTime.map((row) => ({ ...row, group: `${row.student.user.name} (${row.student.studentNumber})` })));
  const finished = students.filter((row) => row.hours >= requiredHours).length;

  return (
    <Shell role={role} name={user.name}>
      <PageHeader eyebrow="Coordinator" title="Analytics" description={`Attendance patterns for the last ${DAYS} days and overall hours progress.`} />
      <Stats>
        <Stat icon={CalendarCheck} label={`Time-ins (${DAYS} days)`} value={buckets.length} tone="green" />
        <Stat icon={AlarmClock} label="Late rate" value={`${Math.round(lateRate * 100)}%`} note="Of time-ins in this period" tone="amber" />
        <Stat icon={FileWarning} label="Missed time-outs" value={missed} note="In this period" tone="red" />
        <Stat icon={Hourglass} label="Average day" value={completeDays ? `${formatHours(recentHours / completeDays)} h` : "—"} note={`${finished} of ${students.length} students finished`} />
      </Stats>
      <Panel title={`Daily attendance · last ${DAYS} days`}>
        {buckets.length ? <DailyAttendanceChart data={daily} /> : <EmptyState icon={BarChart3} title="No attendance in this period">The chart fills in as students time in.</EmptyState>}
      </Panel>
      <div className="grid-2">
        <Panel title="Late rate by company">
          {companies.length ? <LateRateChart rows={companies} /> : <EmptyState icon={BarChart3} title="No company data yet" />}
        </Panel>
        <Panel title="Hours progress by student">
          {students.length ? <HoursChart rows={students.slice(0, 15)} required={requiredHours} /> : <EmptyState icon={BarChart3} title="No hours recorded yet" />}
          {students.length > 15 && <p className="small" style={{ marginTop: 12 }}>Showing the 15 students with the most hours. Use the attendance report for everyone.</p>}
        </Panel>
      </div>
    </Shell>
  );
}
