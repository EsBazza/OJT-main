import Link from "next/link";
import { AlarmClock, ArrowRight, BadgeCheck, Building2, CalendarCheck, Check, ClipboardList, Clock, FileSignature, FileWarning, Hourglass, PenLine, Users } from "lucide-react";
import { DocumentStatus, PlacementStatus, Role } from "@/generated/prisma";
import { DefinitionGrid, EmptyState, Notice, PageHeader, Panel, ProgressRing, Shell, Stat, Stats, StatusBadge, Table } from "@/components/ui";
import { attendanceDisplayStatus, formatCalendarDate, formatHours, formatTime, hoursBetween, manilaDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

// Required OJT hours vary by program; set OJT_REQUIRED_HOURS on the server to change it.
const requiredHours = Math.max(1, Number(process.env.OJT_REQUIRED_HOURS) || 486);

function NextStep({ title, description, href, action }: { title: string; description: string; href?: string; action?: string }) {
  return (
    <section className="next-step" aria-label="Next step">
      <div><h2>{title}</h2><p>{description}</p></div>
      {href && action && <Link className="button button-primary" href={href}>{action}<ArrowRight aria-hidden="true" size={18} /></Link>}
    </section>
  );
}

function Steps({ steps }: { steps: { label: string; detail: string; state: "done" | "current" | "todo" }[] }) {
  return (
    <ol className="steps" style={{ "--step-count": steps.length } as React.CSSProperties}>
      {steps.map((step, index) => (
        <li key={step.label} className="step" data-state={step.state} aria-current={step.state === "current" ? "step" : undefined}>
          <span className="step-dot" aria-hidden="true">{step.state === "done" ? <Check size={16} strokeWidth={3} /> : index + 1}</span>
          <div><b>{step.label}</b><span>{step.detail}</span><span className="sr-only">{step.state === "done" ? " (complete)" : step.state === "current" ? " (current step)" : ""}</span></div>
        </li>
      ))}
    </ol>
  );
}

async function StudentDashboard({ student }: { student: { id: string } | null }) {
  const today = manilaDate();
  const [placement, attendance, todayRecord, reports, todayReport] = student ? await Promise.all([
    prisma.ojtPlacement.findUnique({ where: { studentId: student.id }, include: { company: true } }),
    prisma.attendanceRecord.findMany({ where: { studentId: student.id }, orderBy: { date: "desc" }, select: { date: true, status: true, timeIn: true, timeOut: true } }),
    prisma.attendanceRecord.findUnique({ where: { studentId_date: { studentId: student.id, date: today } } }),
    prisma.dailyDocumentation.findMany({ where: { studentId: student.id }, orderBy: [{ reportDate: "desc" }, { day: "desc" }], take: 5 }),
    prisma.dailyDocumentation.findUnique({ where: { studentId_reportDate: { studentId: student.id, reportDate: today } } }),
  ]) : [null, [], null, [], null];
  const signedCount = student ? await prisma.dailyDocumentation.count({ where: { studentId: student.id, status: DocumentStatus.SIGNED } }) : 0;
  const totalHours = attendance.reduce((sum, row) => sum + hoursBetween(row.timeIn, row.timeOut), 0);
  const approved = placement?.status === PlacementStatus.APPROVED;
  const completedDays = attendance.filter((row) => row.timeIn && row.timeOut).length;
  const averagePerDay = completedDays ? totalHours / completedDays : 0;
  const remaining = Math.max(0, requiredHours - totalHours);
  const daysLeft = averagePerDay ? Math.ceil(remaining / averagePerDay) : 0;

  const steps = [
    { label: "Profile", detail: student ? "Complete" : "Add your details", state: student ? "done" : "current" },
    { label: "Placement request", detail: placement && placement.status !== PlacementStatus.REJECTED ? "Submitted" : placement ? "Rejected — resubmit" : "Not submitted", state: placement && placement.status !== PlacementStatus.REJECTED ? "done" : student ? "current" : "todo" },
    { label: "Coordinator approval", detail: approved ? placement.company.name : placement?.status === PlacementStatus.PENDING ? "Waiting for review" : "After you submit", state: approved ? "done" : placement?.status === PlacementStatus.PENDING ? "current" : "todo" },
    { label: "Attendance & reports", detail: attendance.length ? `${attendance.length} days recorded` : "Start on your first day", state: attendance.length ? "done" : approved ? "current" : "todo" },
  ] as const;

  let next: React.ReactNode;
  if (!student) next = <NextStep title="Complete your profile" description="Add your student number and program to get started." href="/profile" action="Open profile" />;
  else if (!placement || placement.status === PlacementStatus.REJECTED) next = <NextStep title={placement ? "Submit a new placement" : "Submit your host company"} description={placement ? "Your previous request was rejected. Submit another company for review." : "Tell your coordinator where you will do your OJT."} href="/placement" action="Submit placement" />;
  else if (placement.status === PlacementStatus.PENDING) next = <NextStep title="Placement under review" description={`Your request for ${placement.company.name} is waiting for your coordinator.`} href="/placement" action="View request" />;
  else if (!todayRecord?.timeIn) next = <NextStep title="Time in for today" description={`Your shift starts at ${placement.shiftStart}.`} href="/attendance" action="Time in" />;
  else if (!todayRecord.timeOut) next = <NextStep title="You are timed in" description={`Since ${formatTime(todayRecord.timeIn)}. Remember to time out before you leave.`} href="/attendance" action="Time out" />;
  else if (!todayReport || todayReport.status === DocumentStatus.RETURNED) next = <NextStep title={todayReport ? "Today's report was returned" : "Write today's report"} description={todayReport ? "Your supervisor asked for changes. Update and resubmit it." : "Describe what you did, learned, and any challenges."} href="/documentation" action={todayReport ? "Update report" : "Write report"} />;
  else next = <NextStep title="All set for today" description="Attendance and report are done. Good work!" />;

  return (
    <>
      {next}
      <Panel title="Your OJT progress"><Steps steps={[...steps]} /></Panel>
      {approved && (
        <Panel title="OJT hours">
          <div className="hours">
            <ProgressRing value={totalHours} max={requiredHours} label="of required hours" />
            <DefinitionGrid items={[
              ["Rendered", `${formatHours(totalHours)} h`],
              ["Required", `${requiredHours} h`],
              ["Remaining", `${formatHours(remaining)} h`],
              ["Average per day", completedDays ? `${formatHours(averagePerDay)} h` : "—"],
              ["Estimated days left", remaining <= 0 ? "Complete!" : completedDays ? `About ${daysLeft} working days` : "After your first full day"],
            ]} />
          </div>
        </Panel>
      )}
      <Stats>
        <Stat icon={Clock} label="Hours rendered" value={formatHours(totalHours)} note="Completed time-in/out pairs" />
        <Stat icon={CalendarCheck} label="Days attended" value={attendance.filter((row) => row.timeIn).length} note={`${attendance.filter((row) => row.status === "LATE").length} late`} tone="amber" />
        <Stat icon={FileSignature} label="Reports signed" value={`${signedCount}`} note="Digitally signed by supervisor" tone="green" />
        <Stat icon={Building2} label="Placement" value={<StatusBadge status={placement?.status ?? "DRAFT"} />} note={placement?.company.name ?? "Not submitted"} />
      </Stats>
      <div className="grid-2">
        <Panel title="Recent attendance" actions={<Link href="/attendance/history">View all</Link>}>
          {attendance.length ? <Table headers={["Date", "Time in", "Time out", "Status"]} rows={attendance.slice(0, 5).map((row) => [formatCalendarDate(row.date), formatTime(row.timeIn), formatTime(row.timeOut), <StatusBadge key="s" status={attendanceDisplayStatus(row, today)} />])} /> : <EmptyState title="No attendance yet">Your time-ins will appear here.</EmptyState>}
        </Panel>
        <Panel title="Recent reports" actions={<Link href="/documentation">View all</Link>}>
          {reports.length ? <Table headers={["Day", "Date", "Status"]} rows={reports.map((report) => [`Day ${report.day}`, formatCalendarDate(report.reportDate), <StatusBadge key="s" status={report.status} />])} /> : <EmptyState title="No reports yet">Submit a report after each day you attend.</EmptyState>}
        </Panel>
      </div>
    </>
  );
}

async function SupervisorDashboard({ profileId, assignment }: { profileId: string; assignment: { companyId: string; canSign: boolean; active: boolean; company: { name: string } } | null }) {
  if (!assignment?.active) return <Notice tone="warn" title="No company assignment">Your account is not assigned to a company yet. Contact your OJT coordinator.</Notice>;
  const scope = { student: { placement: { companyId: assignment.companyId, supervisorId: profileId } } };
  const [assigned, awaitingReview, awaitingSignature, signed, recent] = await Promise.all([
    prisma.ojtPlacement.count({ where: { companyId: assignment.companyId, supervisorId: profileId, status: PlacementStatus.APPROVED } }),
    prisma.dailyDocumentation.count({ where: { ...scope, status: DocumentStatus.SUBMITTED } }),
    prisma.dailyDocumentation.count({ where: { ...scope, status: DocumentStatus.APPROVED } }),
    prisma.digitalSignature.count({ where: { signerId: profileId } }),
    prisma.dailyDocumentation.findMany({ where: scope, include: { student: { include: { user: true } } }, orderBy: { updatedAt: "desc" }, take: 6 }),
  ]);
  const waiting = awaitingReview + (assignment.canSign ? awaitingSignature : 0);
  return (
    <>
      {waiting > 0
        ? <NextStep title={`${waiting} report${waiting === 1 ? "" : "s"} need your attention`} description={`${awaitingReview} awaiting review${assignment.canSign ? ` · ${awaitingSignature} awaiting signature` : ""}`} href="/supervisor/signing" action="Review now" />
        : <NextStep title="You're all caught up" description="No reports are waiting for you right now." />}
      <Stats>
        <Stat icon={Users} label="Assigned students" value={assigned} note={assignment.company.name} />
        <Stat icon={ClipboardList} label="Awaiting review" value={awaitingReview} tone="amber" />
        <Stat icon={PenLine} label="Awaiting signature" value={awaitingSignature} note={assignment.canSign ? "You can sign" : "Review-only access"} />
        <Stat icon={BadgeCheck} label="Signed by you" value={signed} tone="green" />
      </Stats>
      <Panel title="Recent activity" actions={<Link href="/documentation">Report history</Link>}>
        {recent.length ? <Table headers={["Student", "Day", "Date", "Status"]} rows={recent.map((report) => [report.student.user.name, `Day ${report.day}`, formatCalendarDate(report.reportDate), <StatusBadge key="s" status={report.status} />])} /> : <EmptyState title="No reports yet">Reports from your assigned students will appear here.</EmptyState>}
      </Panel>
    </>
  );
}

async function CoordinatorDashboard() {
  const today = manilaDate();
  const [companies, supervisors, approvedPlacements, students, pendingPlacements, timedInToday, awaitingSupervisors, missedTimeouts, recentAttendance] = await Promise.all([
    prisma.company.count(),
    prisma.supervisorAssignment.count({ where: { active: true, user: { active: true } } }),
    prisma.ojtPlacement.count({ where: { status: PlacementStatus.APPROVED } }),
    prisma.student.count({ where: { user: { role: Role.STUDENT, active: true } } }),
    prisma.ojtPlacement.count({ where: { status: PlacementStatus.PENDING } }),
    prisma.attendanceRecord.count({ where: { date: today, timeIn: { not: null } } }),
    prisma.dailyDocumentation.count({ where: { status: { in: [DocumentStatus.SUBMITTED, DocumentStatus.APPROVED] } } }),
    prisma.attendanceRecord.count({ where: { date: { lt: today }, timeIn: { not: null }, timeOut: null } }),
    prisma.attendanceRecord.findMany({ orderBy: [{ date: "desc" }, { timeIn: "desc" }], include: { student: { include: { user: true, placement: { include: { company: true } } } } }, take: 8 }),
  ]);
  // First-run guide, shown until the coordinator has completed each setup step once.
  const setup = [
    { label: "Register a company", detail: companies ? `${companies} registered` : "Users & companies page", state: companies ? "done" : "current" },
    { label: "Assign a supervisor", detail: supervisors ? `${supervisors} active` : "Give a registered account supervisor access", state: supervisors ? "done" : companies ? "current" : "todo" },
    { label: "Approve a placement", detail: approvedPlacements ? `${approvedPlacements} approved` : pendingPlacements ? `${pendingPlacements} waiting` : "Students submit requests first", state: approvedPlacements ? "done" : supervisors ? "current" : "todo" },
  ] as const;
  const setupDone = setup.every((step) => step.state === "done");
  return (
    <>
      {!setupDone && (
        <Panel title="Get started" actions={<Link className="button button-secondary" href={!companies || !supervisors ? "/users" : "/companies"}>{!companies ? "Register a company" : !supervisors ? "Assign a supervisor" : "Review placements"}</Link>}>
          <p className="muted" style={{ marginBottom: 16 }}>Set up OJT Monitor in three steps. This guide disappears once each step is done.</p>
          <Steps steps={[...setup]} />
        </Panel>
      )}
      {pendingPlacements > 0 && <NextStep title={`${pendingPlacements} placement request${pendingPlacements === 1 ? "" : "s"} to review`} description="Approve each with a supervisor and work schedule, or reject it." href="/companies" action="Review placements" />}
      <Stats>
        <Stat icon={Users} label="Active students" value={students} />
        <Stat icon={AlarmClock} label="Timed in today" value={timedInToday} tone="green" />
        <Stat icon={Hourglass} label="Reports with supervisors" value={awaitingSupervisors} note="Awaiting review or signature" tone="amber" />
        <Stat icon={FileWarning} label="Missed time-outs" value={missedTimeouts} note="Past days without time-out" tone="red" />
      </Stats>
      <Panel title="Latest attendance" actions={<Link href="/reports">Attendance report</Link>}>
        {recentAttendance.length ? <Table headers={["Student", "Company", "Date", "Time in", "Status"]} rows={recentAttendance.map((row) => [row.student.user.name, row.student.placement?.company.name ?? "—", formatCalendarDate(row.date), formatTime(row.timeIn), <StatusBadge key="s" status={attendanceDisplayStatus(row, today)} />])} /> : <EmptyState title="No attendance yet" />}
      </Panel>
    </>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { role, user, profile, student } = await requireRole([Role.STUDENT, Role.SUPERVISOR, Role.COORDINATOR]);
  const query = await searchParams;
  const roleTitle = { STUDENT: "Student", SUPERVISOR: "Supervisor", COORDINATOR: "Coordinator" }[role];
  return (
    <Shell role={role} name={user.name}>
      <PageHeader eyebrow={`${roleTitle} dashboard`} title={`Welcome, ${user.name.split(" ")[0]}`} description={formatCalendarDate(manilaDate(), "full")} />
      {query.error === "permission" && <Notice tone="error" title="Page not available">Your account does not have access to that page.</Notice>}
      {role === Role.STUDENT && <StudentDashboard student={student} />}
      {role === Role.SUPERVISOR && <SupervisorDashboard profileId={profile.id} assignment={profile.supervisor} />}
      {role === Role.COORDINATOR && <CoordinatorDashboard />}
    </Shell>
  );
}
