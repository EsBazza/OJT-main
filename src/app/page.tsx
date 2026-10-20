import Link from "next/link";
import { Role } from "@/generated/prisma";
import { Badge, Card, Panel, Shell, Table } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

function time(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(value) : "—";
}

export default async function Home() {
  const { role, user, profile, student } = await requireRole([Role.STUDENT, Role.SUPERVISOR, Role.COORDINATOR]);
  let cards: [string, string, string][] = [];
  let attendanceRows: React.ReactNode[][] = [];
  let reportRows: React.ReactNode[][] = [];

  if (role === Role.STUDENT) {
    const [recentAttendance, reportCount, placement] = await Promise.all([
      student ? prisma.attendanceRecord.findMany({ where: { studentId: student.id }, orderBy: { date: "desc" }, take: 5, include: { student: { include: { user: true } } } }) : [],
      student ? prisma.dailyDocumentation.count({ where: { studentId: student.id } }) : 0,
      student ? prisma.ojtPlacement.findUnique({ where: { studentId: student.id }, include: { company: true } }) : null,
    ]);
    const allAttendance = student ? await prisma.attendanceRecord.findMany({ where: { studentId: student.id, timeIn: { not: null }, timeOut: { not: null } }, select: { timeIn: true, timeOut: true } }) : [];
    const totalHours = allAttendance.reduce((sum, row) => sum + (row.timeOut!.getTime() - row.timeIn!.getTime()) / 3_600_000, 0);
    cards = [["Recorded hours", totalHours.toFixed(1), "From complete attendance records"], ["Daily reports", String(reportCount), "Saved in your account"], ["Placement", placement?.status ?? "Not submitted", placement?.company.name ?? "Submit a host company"], ["Student profile", student ? "Complete" : "Needs details", student?.program ?? "Add your student number and program"]];
    attendanceRows = recentAttendance.map((row) => [new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(row.date), time(row.timeIn), time(row.timeOut), <Badge tone={row.timeOut ? "green" : "amber"}>{row.timeOut ? row.status : "In progress"}</Badge>]);
    const reports = student ? await prisma.dailyDocumentation.findMany({ where: { studentId: student.id }, include: { versions: { orderBy: { version: "desc" }, take: 1 } }, orderBy: { day: "desc" }, take: 5 }) : [];
    reportRows = reports.map((report) => [String(report.day), report.versions[0]?.submittedAt ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(report.versions[0].submittedAt) : "Draft", <Badge tone={report.status === "SIGNED" ? "green" : "blue"}>{report.status}</Badge>]);
  } else if (role === Role.SUPERVISOR) {
    const assignment = profile.supervisor;
    const [assigned, pending, signed] = await Promise.all([
      assignment ? prisma.ojtPlacement.count({ where: { companyId: assignment.companyId, supervisorId: profile.id, status: "APPROVED" } }) : 0,
      assignment ? prisma.dailyDocumentation.count({ where: { status: "SUBMITTED", student: { placement: { companyId: assignment.companyId, supervisorId: profile.id } } } }) : 0,
      assignment ? prisma.digitalSignature.count({ where: { signerId: profile.id } }) : 0,
    ]);
    cards = [["Assigned students", String(assigned), assignment?.company.name ?? "No company assignment"], ["Reports awaiting review", String(pending), "Submitted by assigned students"], ["Reports signed", String(signed), "Recorded signatures"], ["Signing authority", assignment?.canSign ? "Active" : "Unavailable", "Based on your company assignment"]];
    const recent = assignment ? await prisma.dailyDocumentation.findMany({ where: { student: { placement: { companyId: assignment.companyId, supervisorId: profile.id } } }, include: { student: { include: { user: true, placement: { include: { company: true } } } } }, orderBy: { updatedAt: "desc" }, take: 5 }) : [];
    reportRows = recent.map((report) => [report.student.user.name, `Day ${report.day}`, <Badge tone={report.status === "SIGNED" ? "green" : report.status === "SUBMITTED" ? "amber" : "blue"}>{report.status}</Badge>]);
  } else {
    const [students, pendingPlacements, attendanceToday, reportsPending] = await Promise.all([
      prisma.student.count({ where: { user: { role: Role.STUDENT, active: true } } }),
      prisma.ojtPlacement.count({ where: { status: "PENDING" } }),
      prisma.attendanceRecord.count({ where: { date: new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date()) + "T00:00:00.000Z") } }),
      prisma.dailyDocumentation.count({ where: { status: "SUBMITTED" } }),
    ]);
    cards = [["Students", String(students), "Registered student profiles"], ["Placement requests", String(pendingPlacements), "Awaiting coordinator decision"], ["Attendance today", String(attendanceToday), "Saved attendance records"], ["Reports to review", String(reportsPending), "Submitted reports"]];
    const recentAttendance = await prisma.attendanceRecord.findMany({ where: { student: { user: { role: Role.STUDENT, active: true } } }, orderBy: { date: "desc" }, include: { student: { include: { user: true, placement: { include: { company: true } } } } }, take: 5 });
    attendanceRows = recentAttendance.map((row) => [row.student.user.name, row.student.placement?.company.name ?? "—", new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(row.date), time(row.timeIn), <Badge tone={row.status === "ABSENT" ? "red" : row.status === "LATE" ? "amber" : "green"}>{row.status}</Badge>]);
    const recentReports = await prisma.dailyDocumentation.findMany({ where: { status: { in: ["SUBMITTED", "APPROVED", "SIGNED"] } }, include: { student: { include: { user: true } }, versions: { orderBy: { version: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" }, take: 5 });
    reportRows = recentReports.map((report) => [report.student.user.name, `Day ${report.day}`, <Badge tone={report.status === "SIGNED" ? "green" : report.status === "SUBMITTED" ? "amber" : "blue"}>{report.status}</Badge>]);
  }

  return (
    <Shell role={role} name={user.name} active="Dashboard">
      <div className="heading-row"><div><div className="eyebrow">{role.toLowerCase()} workspace</div><h1 className="page-title">Welcome, {user.name.split(" ")[0]}</h1><div className="subtle">Your OJT activity, backed by your account records.</div></div></div>
      {role === Role.STUDENT && !student && <div className="notice warn">Complete your student profile before submitting placement, attendance, or reports. <Link href="/profile"><b>Open profile</b></Link></div>}
      <div className="cards">{cards.map(([label, value, note]) => <Card key={label} label={label} value={value} note={note} />)}</div>
      <div className="grid-2">
        {attendanceRows.length > 0 && <Panel title={role === Role.STUDENT ? "Recent attendance" : "Recent attendance records"}><Table headers={role === Role.STUDENT ? ["Date", "Time in", "Time out", "Status"] : ["Student", "Company", "Date", "Time in", "Status"]} rows={attendanceRows} /></Panel>}
        <Panel title={role === Role.STUDENT ? "My recent reports" : role === Role.SUPERVISOR ? "Recent assigned reports" : "Recent reports"}>
          {reportRows.length ? <Table headers={role === Role.STUDENT ? ["Day", "Submitted", "Status"] : ["Student", "Day", "Status"]} rows={reportRows} /> : <div className="empty">No reports have been submitted yet.</div>}
          <Link className="button" style={{ display: "inline-block", marginTop: 14 }} href={role === Role.SUPERVISOR ? "/supervisor/signing" : "/documentation"}>{role === Role.SUPERVISOR ? "Review reports" : "Open documentation"}</Link>
        </Panel>
      </div>
    </Shell>
  );
}
