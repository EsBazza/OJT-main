"use server";

import { AttendanceStatus, DocumentStatus, PlacementStatus, Role } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dateFromString, dateToString, isDateString, manilaDate, manilaDateString } from "@/lib/format";
import { failed, fieldErrorsFrom, formValues, isUniqueViolation, succeeded, type FormState } from "@/lib/form-state";
import { requireRole } from "@/lib/page-auth";
import { attendanceStatusFor, canWithdraw, reportDayNumber } from "@/lib/policy";
import { notify } from "@/lib/notify";
import { prisma } from "@/lib/prisma";

const profileMessages = { name: "Enter your full name (2–100 characters).", studentNumber: "Use 3–40 letters, numbers, or dashes.", program: "Enter your program (2–120 characters)." };

export async function saveStudentProfile(_state: FormState, form: FormData): Promise<FormState> {
  const { profile, student } = await requireRole([Role.STUDENT]);
  const values = formValues(form, ["name", "studentNumber", "program"]);
  // The student number is fixed once recorded; only a first-time profile may set it.
  const parsed = z.object({
    name: z.string().trim().min(2).max(100),
    studentNumber: student ? z.string().optional() : z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9-]+$/),
    program: z.string().trim().min(2).max(120),
  }).safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrorsFrom(parsed.error, profileMessages) };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.userProfile.update({ where: { id: profile.id }, data: { name: parsed.data.name } });
      if (student) await tx.student.update({ where: { id: student.id }, data: { program: parsed.data.program } });
      else await tx.student.create({ data: { userId: profile.id, studentNumber: parsed.data.studentNumber!, program: parsed.data.program } });
      await tx.auditLog.create({ data: { actorId: profile.id, action: "STUDENT_PROFILE_UPDATED", targetType: "user_profile", targetId: profile.id } });
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { values, fieldErrors: { studentNumber: "This student number is already registered to another account." } };
    console.error("Profile save failed", error);
    return { values, error: "Your profile could not be saved. Try again in a moment." };
  }
  revalidatePath("/", "layout");
  return { success: "Profile saved." };
}

export async function submitPlacement(_state: FormState, form: FormData): Promise<FormState> {
  const { profile, student } = await requireRole([Role.STUDENT]);
  if (!student) redirect("/profile?error=complete");
  const values = formValues(form, ["company", "address"]);
  const parsed = z.object({ company: z.string().trim().min(2).max(160), address: z.string().trim().min(4).max(300) }).safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrorsFrom(parsed.error, { company: "Enter the company name (2–160 characters).", address: "Enter the work address (4–300 characters)." }) };
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.ojtPlacement.findUnique({ where: { studentId: student.id } });
      if (current && current.status !== PlacementStatus.REJECTED) throw new Error("ALREADY_SUBMITTED");
      // Students may propose a new company but never edit an existing company record.
      const existing = await tx.company.findFirst({ where: { name: { equals: parsed.data.company, mode: "insensitive" } } });
      const company = existing ?? await tx.company.create({ data: { name: parsed.data.company, address: parsed.data.address, approved: false } });
      await tx.ojtPlacement.upsert({ where: { studentId: student.id }, create: { studentId: student.id, companyId: company.id }, update: { companyId: company.id, supervisorId: null, status: PlacementStatus.PENDING, submittedAt: new Date(), decidedAt: null } });
      await tx.auditLog.create({ data: { actorId: profile.id, action: "PLACEMENT_SUBMITTED", targetType: "placement", targetId: student.id, details: { company: company.name, proposedAddress: parsed.data.address } } });
      const coordinators = await tx.userProfile.findMany({ where: { role: Role.COORDINATOR, active: true }, select: { id: true } });
      await notify(tx, coordinators.map((coordinator) => coordinator.id), { type: "PLACEMENT_SUBMITTED", title: `${profile.name} requested a placement`, body: company.name, href: "/companies" });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_SUBMITTED") return { values, error: "You already have a pending or approved placement." };
    console.error("Placement submit failed", error);
    return { values, error: "Your placement request could not be saved. Try again in a moment." };
  }
  revalidatePath("/placement");
  revalidatePath("/companies");
  redirect("/placement?success=submitted");
}

export async function recordAttendance(form: FormData) {
  const { profile, student } = await requireRole([Role.STUDENT]);
  if (!student) redirect("/profile?error=complete");
  const action = z.enum(["in", "out"]).safeParse(form.get("action"));
  if (!action.success) redirect("/attendance?error=invalid");
  const placement = await prisma.ojtPlacement.findUnique({ where: { studentId: student.id } });
  if (placement?.status !== PlacementStatus.APPROVED) redirect("/attendance?error=no-placement");
  const date = manilaDate();
  const now = new Date();
  let error: string | null = null;
  try {
    if (action.data === "in") {
      const status = attendanceStatusFor(now, placement.shiftStart, placement.graceMinutes) === "LATE" ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
      // The unique (student, date) constraint rejects a second time-in, including double clicks.
      const record = await prisma.attendanceRecord.create({ data: { studentId: student.id, date, timeIn: now, status, deviceId: "web", method: "manual-web", verification: false } });
      await prisma.auditLog.create({ data: { actorId: profile.id, action: "ATTENDANCE_TIME_IN", targetType: "attendance_record", targetId: record.id, details: { status } } });
    } else {
      const changed = await prisma.attendanceRecord.updateMany({ where: { studentId: student.id, date, timeIn: { not: null }, timeOut: null }, data: { timeOut: now } });
      if (changed.count !== 1) error = "not-checked-in";
      else {
        const record = await prisma.attendanceRecord.findUniqueOrThrow({ where: { studentId_date: { studentId: student.id, date } } });
        await prisma.auditLog.create({ data: { actorId: profile.id, action: "ATTENDANCE_TIME_OUT", targetType: "attendance_record", targetId: record.id } });
      }
    }
  } catch (caught) {
    if (!isUniqueViolation(caught)) console.error("Attendance save failed", caught);
    error = isUniqueViolation(caught) ? "already-in" : "save";
  }
  revalidatePath("/");
  revalidatePath("/attendance");
  revalidatePath("/attendance/history");
  redirect(error ? `/attendance?error=${error}` : `/attendance?success=${action.data}`);
}

const reportMessages = { date: "Choose a date you attended.", activities: "Describe your activities (10–5000 characters).", skills: "List the skills you used or learned (2–2000 characters).", challenges: "Describe a challenge and your response (2–2000 characters)." };

export async function submitDailyReport(_state: FormState, form: FormData): Promise<FormState> {
  const { profile, student } = await requireRole([Role.STUDENT]);
  if (!student) redirect("/profile?error=complete");
  const placement = await prisma.ojtPlacement.findUnique({ where: { studentId: student.id } });
  if (placement?.status !== PlacementStatus.APPROVED) redirect("/documentation?error=no-placement");
  const values = formValues(form, ["date", "activities", "skills", "challenges"]);
  const parsed = z.object({
    date: z.string().refine(isDateString).refine((value) => value <= manilaDateString()),
    activities: z.string().trim().min(10).max(5000),
    skills: z.string().trim().min(2).max(2000),
    challenges: z.string().trim().min(2).max(2000),
  }).safeParse(values);
  if (!parsed.success) return { values, fieldErrors: fieldErrorsFrom(parsed.error, reportMessages) };

  const attended = await prisma.attendanceRecord.findMany({ where: { studentId: student.id, timeIn: { not: null } }, select: { date: true } });
  const day = reportDayNumber(attended.map((row) => dateToString(row.date)), parsed.data.date);
  if (!day) return { values, fieldErrors: { date: "You can only report on a day you timed in. Choose a date from your attendance." } };
  const reportDate = dateFromString(parsed.data.date);

  try {
    await prisma.$transaction(async (tx) => {
      let documentation = await tx.dailyDocumentation.findUnique({ where: { studentId_reportDate: { studentId: student.id, reportDate } } });
      if (!documentation) {
        // Reports saved before dates were required only have a day number; adopt a matching one.
        const legacy = await tx.dailyDocumentation.findUnique({ where: { studentId_day: { studentId: student.id, day } } });
        if (legacy && legacy.reportDate) throw new Error("DAY_CONFLICT");
        documentation = legacy
          ? await tx.dailyDocumentation.update({ where: { id: legacy.id }, data: { reportDate } })
          : await tx.dailyDocumentation.create({ data: { studentId: student.id, day, reportDate } });
      }
      if (documentation.status !== DocumentStatus.DRAFT && documentation.status !== DocumentStatus.RETURNED) throw new Error("REPORT_LOCKED");
      const previous = await tx.documentVersion.findFirst({ where: { documentationId: documentation.id }, orderBy: { version: "desc" } });
      const version = await tx.documentVersion.create({ data: { documentationId: documentation.id, version: (previous?.version ?? 0) + 1, activities: parsed.data.activities, skills: parsed.data.skills, challenges: parsed.data.challenges, submittedAt: new Date() } });
      const changed = await tx.dailyDocumentation.updateMany({ where: { id: documentation.id, status: { in: [DocumentStatus.DRAFT, DocumentStatus.RETURNED] } }, data: { status: DocumentStatus.SUBMITTED } });
      if (changed.count !== 1) throw new Error("REPORT_LOCKED");
      await tx.auditLog.create({ data: { actorId: profile.id, action: "REPORT_SUBMITTED", targetType: "document_version", targetId: version.id, details: { day: documentation.day, date: parsed.data.date, version: version.version } } });
      await notify(tx, [placement.supervisorId], { type: "REPORT_SUBMITTED", title: `${profile.name} ${version.version > 1 ? "resubmitted" : "submitted"} Day ${documentation.day}`, body: `Report for ${parsed.data.date} is waiting for your review.`, href: "/supervisor/signing" });
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "REPORT_LOCKED") return { values, fieldErrors: { date: "The report for this date is already submitted, approved, or signed." } };
    if (code === "DAY_CONFLICT" || isUniqueViolation(error)) return { values, error: "An older report already uses this day number. Ask your coordinator to review your report history." };
    console.error("Report submit failed", error);
    return { values, error: "Your report could not be saved. Try again in a moment." };
  }
  revalidatePath("/");
  revalidatePath("/documentation");
  revalidatePath("/supervisor/signing");
  redirect("/documentation?success=submitted");
}

export async function withdrawReport(_state: FormState, form: FormData): Promise<FormState> {
  const { profile } = await requireRole([Role.STUDENT]);
  const versionId = z.string().uuid().safeParse(form.get("versionId"));
  if (!versionId.success) return failed("That report was not found.");
  const version = await prisma.documentVersion.findUnique({ where: { id: versionId.data }, include: { documentation: { include: { student: true } }, _count: { select: { approvals: true } } } });
  const latest = version ? await prisma.documentVersion.findFirst({ where: { documentationId: version.documentationId }, orderBy: { version: "desc" }, select: { id: true } }) : null;
  if (!version || !canWithdraw({ actorId: profile.id, studentUserId: version.documentation.student.userId, documentStatus: version.documentation.status, latestVersionId: latest?.id ?? null, versionId: version.id, hasDecision: version._count.approvals > 0 })) {
    revalidatePath("/documentation");
    return failed("This report can no longer be withdrawn. Your supervisor may have already reviewed it.");
  }
  // Conditional update: if the supervisor acts at the same moment, only one of them wins.
  const changed = await prisma.dailyDocumentation.updateMany({ where: { id: version.documentationId, status: DocumentStatus.SUBMITTED }, data: { status: DocumentStatus.DRAFT } });
  if (changed.count !== 1) {
    revalidatePath("/documentation");
    return failed("This report can no longer be withdrawn. Your supervisor may have already reviewed it.");
  }
  await prisma.auditLog.create({ data: { actorId: profile.id, action: "REPORT_WITHDRAWN", targetType: "document_version", targetId: version.id, details: { day: version.documentation.day } } });
  revalidatePath("/");
  revalidatePath("/documentation");
  revalidatePath("/supervisor/signing");
  return succeeded(`Day ${version.documentation.day} report withdrawn. Edit it above and resubmit when ready.`);
}
