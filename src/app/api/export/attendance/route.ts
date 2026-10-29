import { NextResponse } from "next/server";
import { Role, type Prisma } from "@/generated/prisma";
import { attendanceWhere, filtersFrom } from "@/lib/attendance-query";
import { toCsv } from "@/lib/csv";
import { attendanceDisplayStatus, formatCalendarDate, formatDateTime, formatHours, formatTime, hoursBetween, manilaDate, manilaDateString, statusLabel } from "@/lib/format";
import { getSessionProfile } from "@/lib/page-auth";
import { PdfWriter, csvResponse, pdfResponse } from "@/lib/pdf";
import { prisma } from "@/lib/prisma";

const MAX_ROWS = 10_000;

export async function GET(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sign in to export attendance." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const format = params.get("format") === "csv" ? "csv" : "pdf";
  const filters = filtersFrom(params);

  // Students only ever export their own records; supervisors only their assigned students.
  let scope: Prisma.AttendanceRecordWhereInput;
  if (profile.role === Role.STUDENT) {
    if (!profile.student) return NextResponse.json({ error: "Complete your profile first." }, { status: 400 });
    scope = attendanceWhere({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, studentId: profile.student.id });
  } else if (profile.role === Role.SUPERVISOR) {
    scope = { AND: [attendanceWhere(filters), { student: { placement: { supervisorId: profile.id } } }] };
  } else {
    scope = attendanceWhere(filters);
  }

  const records = await prisma.attendanceRecord.findMany({ where: scope, include: { student: { include: { user: true, placement: { include: { company: true } } } } }, orderBy: [{ date: "asc" }, { timeIn: "asc" }], take: MAX_ROWS });
  const today = manilaDate();
  const rows = records.map((record) => ({
    name: record.student.user.name,
    number: record.student.studentNumber,
    company: record.student.placement?.company.name ?? "",
    date: formatCalendarDate(record.date),
    isoDate: record.date.toISOString().slice(0, 10),
    timeIn: formatTime(record.timeIn),
    timeOut: formatTime(record.timeOut),
    hours: record.timeOut ? formatHours(hoursBetween(record.timeIn, record.timeOut)) : "",
    status: statusLabel(attendanceDisplayStatus(record, today)).label,
    method: record.verification ? "Verified device" : "Manual web",
  }));
  const stamp = manilaDateString();
  await prisma.auditLog.create({ data: { actorId: profile.id, action: "ATTENDANCE_EXPORTED", targetType: "attendance", targetId: profile.id, details: { format, rows: rows.length } } });

  if (format === "csv") {
    return csvResponse(toCsv(["Student", "Student number", "Company", "Date", "Time in", "Time out", "Hours", "Status", "Method"], rows.map((row) => [row.name, row.number, row.company, row.isoDate, row.timeIn, row.timeOut, row.hours, row.status, row.method])), `ojt-attendance-${stamp}.csv`);
  }

  const totalHours = records.reduce((sum, record) => sum + hoursBetween(record.timeIn, record.timeOut), 0);
  const single = profile.role === Role.STUDENT;
  const range = filters.dateFrom || filters.dateTo ? `${filters.dateFrom ?? "start"} to ${filters.dateTo ?? "today"}` : "All dates";
  const pdf = await PdfWriter.create("Attendance summary", single ? `${profile.name} · ${range}` : `${range} · ${rows.length} records`);
  pdf.fields([
    ["Records", String(rows.length)],
    ["Hours rendered", `${formatHours(totalHours)} h`],
    ["Late", String(rows.filter((row) => row.status === "Late").length)],
    ["Missed time-outs", String(rows.filter((row) => row.status === "Missed time-out").length)],
  ]);
  pdf.heading("Daily records");
  if (rows.length) {
    pdf.table(
      single ? ["Date", "Time in", "Time out", "Hours", "Status"] : ["Student", "Company", "Date", "In", "Out", "Hours", "Status"],
      rows.map((row) => single ? [row.date, row.timeIn, row.timeOut, row.hours || "—", row.status] : [row.name, row.company || "—", row.date, row.timeIn, row.timeOut, row.hours || "—", row.status]),
      single ? [0.26, 0.17, 0.17, 0.14, 0.26] : [0.2, 0.2, 0.15, 0.1, 0.1, 0.09, 0.16],
    );
  } else {
    pdf.paragraph("No attendance records match this export.", { color: "muted" });
  }
  if (records.length === MAX_ROWS) pdf.paragraph(`Only the first ${MAX_ROWS} records are included. Narrow the date range for a complete export.`, { color: "muted" });
  pdf.paragraph(`Generated ${formatDateTime(new Date())} by ${profile.name}. Times are in Manila time.`, { size: 8, color: "muted" });
  return pdfResponse(await pdf.bytes(), `ojt-attendance-${single && profile.student ? profile.student.studentNumber + "-" : ""}${stamp}.pdf`);
}
