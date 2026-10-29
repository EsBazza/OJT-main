import type { Metadata } from "next";
import Link from "next/link";
import { LogIn, LogOut } from "lucide-react";
import { PlacementStatus, Role } from "@/generated/prisma";
import { recordAttendance } from "@/app/actions/student";
import { SubmitButton } from "@/components/form";
import { ElapsedTimer } from "@/components/elapsed-timer";
import { LiveClock } from "@/components/live-clock";
import { DefinitionGrid, Notice, PageHeader, Panel, Shell, StatusBadge, SuccessMark } from "@/components/ui";
import { attendanceDisplayStatus, formatCalendarDate, formatHours, formatTime, hoursBetween, manilaDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Attendance" };

const errors: Record<string, string> = {
  "no-placement": "Your placement must be approved before you can record attendance.",
  "already-in": "You already timed in today.",
  "not-checked-in": "There is no open time-in for today, or you already timed out.",
  invalid: "That attendance action was not recognized.",
  save: "Attendance could not be saved. Try again in a moment.",
};

export default async function Attendance({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { role, user, student } = await requireRole([Role.STUDENT]);
  const query = await searchParams;
  const today = manilaDate();
  const [record, placement, openPast] = student ? await Promise.all([
    prisma.attendanceRecord.findUnique({ where: { studentId_date: { studentId: student.id, date: today } } }),
    prisma.ojtPlacement.findUnique({ where: { studentId: student.id }, include: { company: true } }),
    prisma.attendanceRecord.count({ where: { studentId: student.id, date: { lt: today }, timeIn: { not: null }, timeOut: null } }),
  ]) : [null, null, 0];
  const approved = placement?.status === PlacementStatus.APPROVED;
  const status = record ? attendanceDisplayStatus(record, today) : null;

  return (
    <Shell role={role} name={user.name}>
      <PageHeader eyebrow="Attendance" title="Daily attendance" description={formatCalendarDate(today, "full")} actions={<Link className="button button-secondary" href="/attendance/history">View history</Link>} />
      {query.error && <Notice tone="error">{errors[query.error] ?? "Attendance could not be saved."}</Notice>}
      {!student && <Notice tone="warn" title="Profile needed">Complete your <Link href="/profile">student profile</Link> first.</Notice>}
      {student && !approved && <Notice tone="warn" title="Placement not approved">You can record attendance once your coordinator approves your <Link href="/placement">placement</Link>.</Notice>}
      {openPast > 0 && <Notice tone="warn" title={`${openPast} missed time-out${openPast === 1 ? "" : "s"}`}>Past days without a time-out do not count toward your hours. Tell your coordinator if this was a mistake.</Notice>}

      {student && placement && approved && (
        <div className="grid-2">
          <Panel>
            <div className="clock-card">
              {query.success === "in" && record?.timeIn && !record.timeOut && <SuccessMark title={`Timed in at ${formatTime(record.timeIn)}`}>Saved with the server time.</SuccessMark>}
              <span className="muted">Manila time</span>
              <LiveClock />
              {record?.timeIn && !record.timeOut && <ElapsedTimer since={record.timeIn.toISOString()} />}
              {!record?.timeIn ? (
                <form action={recordAttendance}><SubmitButton name="action" value="in" className="button-lg" pendingText="Recording…"><LogIn aria-hidden="true" size={22} />Time in</SubmitButton></form>
              ) : !record.timeOut ? (
                <form action={recordAttendance}><SubmitButton name="action" value="out" variant="danger" className="button-lg" pendingText="Recording…"><LogOut aria-hidden="true" size={22} />Time out</SubmitButton></form>
              ) : (
                <SuccessMark title="Done for today">You worked {formatHours(hoursBetween(record.timeIn, record.timeOut))} hours. See you next shift!</SuccessMark>
              )}
              <p className="small">Shift starts at {placement.shiftStart}. Time-ins more than {placement.graceMinutes} minutes late are marked Late.</p>
            </div>
          </Panel>
          <Panel title="Today" actions={status && <StatusBadge status={status} />}>
            <DefinitionGrid items={[
              ["Time in", formatTime(record?.timeIn)],
              ["Time out", formatTime(record?.timeOut)],
              ["Hours", record?.timeOut ? formatHours(hoursBetween(record.timeIn, record.timeOut)) : "—"],
              ["Company", placement.company.name],
            ]} />
            <p className="small" style={{ marginTop: 16 }}>This is a manual web check-in. No biometric device is connected, so entries are marked as not device-verified.</p>
          </Panel>
        </div>
      )}
    </Shell>
  );
}
