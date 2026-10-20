import { Role } from "@/generated/prisma";
import { recordAttendance } from "@/app/actions";
import { Badge, Panel, Shell } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

function todayInManila() {
  const value = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return new Date(`${value}T00:00:00.000Z`);
}
function clock(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(value) : "Not recorded";
}

export default async function Attendance({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { role, user, student } = await requireRole([Role.STUDENT]);
  const query = await searchParams;
  const record = student ? await prisma.attendanceRecord.findUnique({ where: { studentId_date: { studentId: student.id, date: todayInManila() } } }) : null;
  const placement = student ? await prisma.ojtPlacement.findUnique({ where: { studentId: student.id }, include: { company: true } }) : null;
  const duration = record?.timeIn && record.timeOut ? Math.max(0, (record.timeOut.getTime() - record.timeIn.getTime()) / 3_600_000).toFixed(2) : "—";
  const errorText: Record<string, string> = { "no-placement": "Your placement must be approved before recording attendance.", "already-in": "You already recorded time-in today.", "not-checked-in": "Record time-in before time-out.", invalid: "Invalid attendance action.", complete: "Complete your student profile first." };
  return <Shell role={role} name={user.name} active="Fingerprint attendance">
    <div className="heading-row"><div><div className="eyebrow">Attendance</div><h1 className="page-title">Daily attendance</h1><p className="subtle">{new Intl.DateTimeFormat("en-PH", { dateStyle: "full", timeZone: "Asia/Manila" }).format(new Date())}</p></div></div>
    <div className="notice warn">This records a manual web check-in. No fingerprint reader or biometric verification is connected, so this entry is not biometric-verified.</div>
    {query.error && <div className="notice error" style={{ marginTop: 14 }}>{errorText[query.error] ?? "Attendance could not be saved."}</div>}
    {query.success && <div className="notice success" style={{ marginTop: 14 }}>Attendance saved to your account.</div>}
    {!student && <div className="notice error" style={{ marginTop: 14 }}>Complete your student profile before using attendance.</div>}
    {student && <div className="grid-2" style={{ marginTop: 16 }}>
      <Panel title="Your attendance"><p><b>{user.name}</b> · {student.studentNumber}</p><p className="subtle">{placement?.company.name ?? "No company placement"}</p><p>Placement <Badge tone={placement?.status === "APPROVED" ? "green" : "amber"}>{placement?.status ?? "Not submitted"}</Badge></p><div className="form-grid"><div><span className="small">Time in</span><div><b>{clock(record?.timeIn ?? null)}</b></div></div><div><span className="small">Time out</span><div><b>{clock(record?.timeOut ?? null)}</b></div></div><div><span className="small">Recorded hours</span><div><b>{duration}</b></div></div><div><span className="small">Verification</span><div><b>{record?.verification ? "Verified" : record ? "Manual, not verified" : "No record"}</b></div></div></div>
        {placement?.status === "APPROVED" && <div className="actions">{!record?.timeIn ? <form action={recordAttendance}><button className="button" name="action" value="in">Record time in</button></form> : !record.timeOut ? <form action={recordAttendance}><button className="button secondary" name="action" value="out">Record time out</button></form> : <span className="notice success">Today’s attendance is complete.</span>}</div>}
      </Panel>
      <Panel title="How attendance is recorded"><p className="subtle">Each student can record one time-in and one time-out per Manila calendar day. The server timestamps and stores the event in the attendance database.</p><p className="small">A production biometric device integration will need a supported scanner and a trusted device service.</p></Panel>
    </div>}
  </Shell>;
}
