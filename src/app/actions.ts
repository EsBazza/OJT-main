"use server";

import { AttendanceStatus, DocumentStatus, PlacementStatus, Role } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canonical, signPayload, signingPublicKeyPem } from "@/lib/signing";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase";
import { requireRole } from "@/lib/page-auth";

const passwordSchema = z.string().min(10).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9\s]/);
const reportSchema = z.object({ day: z.coerce.number().int().min(1).max(365), activities: z.string().trim().min(10).max(5000), skills: z.string().trim().min(2).max(2000), challenges: z.string().trim().min(2).max(2000) });

export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function supabaseLogin(form: FormData) {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(8) }).safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) redirect("/login?error=invalid");
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) redirect("/login?error=credentials");
  redirect("/");
}

export async function supabaseRegister(form: FormData) {
  const rawPassword = String(form.get("password") ?? "");
  const parsed = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email(), studentNumber: z.string().trim().min(3).max(40), program: z.string().trim().min(2).max(120), password: passwordSchema }).safeParse({ name: form.get("name"), email: form.get("email"), studentNumber: form.get("studentNumber"), program: form.get("program"), password: rawPassword });
  if (!parsed.success) {
    const passwordOk = passwordSchema.safeParse(rawPassword).success;
    redirect(passwordOk ? "/login?error=invalid" : "/login?error=register&reason=weak");
  }

  if (await prisma.student.findUnique({ where: { studentNumber: parsed.data.studentNumber } })) redirect("/login?error=register&reason=student-number");

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name, student_number: parsed.data.studentNumber, program: parsed.data.program } },
  });
  if (!error && data.user && data.user.identities?.length === 0) redirect("/login?error=register&reason=exists");
  if (error) {
    const code = error.code ?? "unknown";
    console.error("Supabase signup failed", { code, status: error.status });
    const reason = code.includes("already") || code.includes("exist") ? "exists" : code.includes("rate_limit") ? "rate" : code.includes("weak_password") ? "weak" : code.includes("signup_disabled") ? "disabled" : code.includes("database") || code === "unexpected_failure" ? "database" : "unknown";
    redirect(`/login?error=register&reason=${reason}`);
  }
  redirect("/login?registered=1");
}

export async function saveStudentProfile(form: FormData) {
  const { profile } = await requireRole([Role.STUDENT]);
  const parsed = z.object({ name: z.string().trim().min(2).max(100), studentNumber: z.string().trim().min(3).max(40), program: z.string().trim().min(2).max(120) }).safeParse({ name: form.get("name"), studentNumber: form.get("studentNumber"), program: form.get("program") });
  if (!parsed.success) redirect("/profile?error=validation");
  try {
    await prisma.$transaction(async (tx) => {
      await tx.userProfile.update({ where: { id: profile.id }, data: { name: parsed.data.name } });
      await tx.student.upsert({ where: { userId: profile.id }, create: { userId: profile.id, studentNumber: parsed.data.studentNumber, program: parsed.data.program }, update: { studentNumber: parsed.data.studentNumber, program: parsed.data.program } });
      await tx.auditLog.create({ data: { actorId: profile.id, action: "STUDENT_PROFILE_UPDATED", targetType: "user_profile", targetId: profile.id } });
    });
  } catch {
    redirect("/profile?error=student-number");
  }
  revalidatePath("/profile");
  redirect("/profile?saved=1");
}

export async function submitPlacement(form: FormData) {
  const { profile, student } = await requireRole([Role.STUDENT]);
  if (!student) redirect("/profile?error=complete");
  const parsed = z.object({ company: z.string().trim().min(2).max(160), address: z.string().trim().min(4).max(300) }).safeParse({ company: form.get("company"), address: form.get("address") });
  if (!parsed.success) redirect("/placement?error=validation");
  const current = await prisma.ojtPlacement.findUnique({ where: { studentId: student.id } });
  if (current && current.status !== PlacementStatus.REJECTED) redirect("/placement?error=already-submitted");
  const existingCompany = await prisma.company.findFirst({ where: { name: { equals: parsed.data.company, mode: "insensitive" } } });
  const company = existingCompany
    ? await prisma.company.update({ where: { id: existingCompany.id }, data: { address: parsed.data.address } })
    : await prisma.company.create({ data: { name: parsed.data.company, address: parsed.data.address, approved: false } });
  await prisma.ojtPlacement.upsert({ where: { studentId: student.id }, create: { studentId: student.id, companyId: company.id }, update: { companyId: company.id, supervisorId: null, status: PlacementStatus.PENDING, submittedAt: new Date(), decidedAt: null } });
  await prisma.auditLog.create({ data: { actorId: profile.id, action: "PLACEMENT_SUBMITTED", targetType: "placement", targetId: student.id, details: { company: company.name } } });
  revalidatePath("/placement");
  revalidatePath("/companies");
  redirect("/placement?success=submitted");
}

export async function decidePlacement(form: FormData) {
  const { profile } = await requireRole([Role.COORDINATOR]);
  const parsed = z.object({ placementId: z.string().uuid(), decision: z.enum(["approve", "reject"]), supervisorId: z.string().optional() }).safeParse({ placementId: form.get("placementId"), decision: form.get("decision"), supervisorId: form.get("supervisorId") || undefined });
  if (!parsed.success) redirect("/companies?error=invalid");
  const placement = await prisma.ojtPlacement.findUnique({ where: { id: parsed.data.placementId }, include: { company: true } });
  if (!placement || placement.status !== PlacementStatus.PENDING) redirect("/companies?error=stale");
  let supervisorId: string | null = null;
  if (parsed.data.decision === "approve") {
    if (!parsed.data.supervisorId) redirect("/companies?error=supervisor");
    const assignment = await prisma.supervisorAssignment.findFirst({ where: { userId: parsed.data.supervisorId, companyId: placement.companyId, active: true } });
    if (!assignment) redirect("/companies?error=supervisor");
    supervisorId = assignment.userId;
  }
  try {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.ojtPlacement.updateMany({ where: { id: placement.id, status: PlacementStatus.PENDING }, data: { status: parsed.data.decision === "approve" ? PlacementStatus.APPROVED : PlacementStatus.REJECTED, supervisorId, decidedAt: new Date() } });
      if (changed.count !== 1) throw new Error("PLACEMENT_ALREADY_DECIDED");
      if (parsed.data.decision === "approve") await tx.company.update({ where: { id: placement.companyId }, data: { approved: true } });
      await tx.auditLog.create({ data: { actorId: profile.id, action: parsed.data.decision === "approve" ? "PLACEMENT_APPROVED" : "PLACEMENT_REJECTED", targetType: "placement", targetId: placement.id, details: { companyId: placement.companyId, supervisorId } } });
    });
  } catch {
    redirect("/companies?error=stale");
  }
  revalidatePath("/companies");
  revalidatePath("/placement");
  redirect("/companies?success=decided");
}

export async function createCompany(form: FormData) {
  const { profile } = await requireRole([Role.COORDINATOR]);
  const parsed = z.object({ name: z.string().trim().min(2).max(160), address: z.string().trim().min(4).max(300) }).safeParse({ name: form.get("name"), address: form.get("address") });
  if (!parsed.success) redirect("/users?error=company");
  const duplicate = await prisma.company.findFirst({ where: { name: { equals: parsed.data.name, mode: "insensitive" } } });
  if (duplicate) redirect("/users?error=duplicate-company");
  const company = await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({ data: { name: parsed.data.name, address: parsed.data.address, approved: false } });
    await tx.auditLog.create({ data: { actorId: profile.id, action: "COMPANY_CREATED", targetType: "company", targetId: created.id } });
    return created;
  });
  revalidatePath("/users");
  revalidatePath("/companies");
  redirect(`/users?success=company&company=${company.id}`);
}

export async function provisionSupervisor(form: FormData) {
  const { profile } = await requireRole([Role.COORDINATOR]);
  const parsed = z.object({ userId: z.string().uuid(), companyId: z.string().uuid(), canSign: z.enum(["true", "false"]) }).safeParse({ userId: form.get("userId"), companyId: form.get("companyId"), canSign: form.get("canSign") });
  if (!parsed.success) redirect("/users?error=provision");
  const [target, company] = await Promise.all([
    prisma.userProfile.findUnique({ where: { id: parsed.data.userId } }),
    prisma.company.findUnique({ where: { id: parsed.data.companyId } }),
  ]);
  if (!target || !company || !target.active || target.role === Role.COORDINATOR) redirect("/users?error=provision");
  const publicKeyPem = parsed.data.canSign === "true" ? signingPublicKeyPem() : null;
  const keyId = parsed.data.canSign === "true" ? process.env.SIGNING_KEY_ID : null;
  if (parsed.data.canSign === "true" && (!publicKeyPem || !keyId)) redirect("/users?error=signing-key");
  await prisma.$transaction(async (tx) => {
    await tx.userProfile.update({ where: { id: target.id }, data: { role: Role.SUPERVISOR } });
    await tx.supervisorAssignment.upsert({ where: { userId: target.id }, create: { userId: target.id, companyId: company.id, canSign: parsed.data.canSign === "true", publicKeyPem, keyId }, update: { companyId: company.id, canSign: parsed.data.canSign === "true", publicKeyPem, keyId, active: true } });
    await tx.auditLog.create({ data: { actorId: profile.id, action: "SUPERVISOR_PROVISIONED", targetType: "user_profile", targetId: target.id, details: { companyId: company.id, canSign: parsed.data.canSign === "true" } } });
  });
  revalidatePath("/users");
  revalidatePath("/companies");
  redirect("/users?success=supervisor");
}

export async function submitDailyReport(form: FormData) {
  const { profile, student } = await requireRole([Role.STUDENT]);
  if (!student) redirect("/profile?error=complete");
  const placement = await prisma.ojtPlacement.findUnique({ where: { studentId: student.id } });
  if (placement?.status !== PlacementStatus.APPROVED) redirect("/documentation?error=no-placement");
  const parsed = reportSchema.safeParse({ day: form.get("day"), activities: form.get("activities"), skills: form.get("skills"), challenges: form.get("challenges") });
  if (!parsed.success) redirect("/documentation?error=validation");
  try {
    await prisma.$transaction(async (tx) => {
      let documentation = await tx.dailyDocumentation.findUnique({ where: { studentId_day: { studentId: student.id, day: parsed.data.day } } });
      if (documentation && documentation.status !== DocumentStatus.DRAFT && documentation.status !== DocumentStatus.RETURNED) throw new Error("REPORT_LOCKED");
      if (!documentation) documentation = await tx.dailyDocumentation.create({ data: { studentId: student.id, day: parsed.data.day } });
      const previous = await tx.documentVersion.findFirst({ where: { documentationId: documentation.id }, orderBy: { version: "desc" } });
      const version = await tx.documentVersion.create({ data: { documentationId: documentation.id, version: (previous?.version ?? 0) + 1, activities: parsed.data.activities, skills: parsed.data.skills, challenges: parsed.data.challenges, submittedAt: new Date() } });
      await tx.dailyDocumentation.update({ where: { id: documentation.id }, data: { status: DocumentStatus.SUBMITTED } });
      await tx.auditLog.create({ data: { actorId: profile.id, action: "REPORT_SUBMITTED", targetType: "document_version", targetId: version.id, details: { day: parsed.data.day, version: version.version } } });
    });
  } catch (error) {
    redirect(error instanceof Error && error.message === "REPORT_LOCKED" ? "/documentation?error=locked" : "/documentation?error=save");
  }
  revalidatePath("/");
  revalidatePath("/documentation");
  revalidatePath("/supervisor/signing");
  redirect("/documentation?success=submitted");
}

export async function reviewReport(form: FormData) {
  const { profile } = await requireRole([Role.SUPERVISOR]);
  const parsed = z.object({ versionId: z.string().uuid(), decision: z.enum(["approve", "return"]), remarks: z.string().trim().max(2000) }).safeParse({ versionId: form.get("versionId"), decision: form.get("decision"), remarks: form.get("remarks") });
  if (!parsed.success) redirect("/supervisor/signing?error=invalid");
  const version = await prisma.documentVersion.findUnique({ where: { id: parsed.data.versionId }, include: { documentation: { include: { student: { include: { placement: { include: { company: true } } } } } }, signatures: true } });
  const assignment = await prisma.supervisorAssignment.findFirst({ where: { userId: profile.id, active: true } });
  const placement = version?.documentation.student.placement;
  if (!version || !assignment || !placement || placement.companyId !== assignment.companyId || version.immutable || version.signatures.length > 0) redirect("/supervisor/signing?error=permission");
  if (version.documentation.status !== DocumentStatus.SUBMITTED) redirect("/supervisor/signing?error=stale");
  try {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.dailyDocumentation.updateMany({ where: { id: version.documentationId, status: DocumentStatus.SUBMITTED }, data: { status: parsed.data.decision === "approve" ? DocumentStatus.APPROVED : DocumentStatus.RETURNED } });
      if (changed.count !== 1) throw new Error("REPORT_ALREADY_REVIEWED");
      await tx.approvalRecord.create({ data: { versionId: version.id, supervisorId: profile.id, approvedByName: profile.name, companyNameSnapshot: placement.company.name, companyIdSnapshot: placement.companyId, decision: parsed.data.decision === "approve" ? "APPROVED" : "RETURNED", remarks: parsed.data.remarks || null } });
      await tx.auditLog.create({ data: { actorId: profile.id, action: parsed.data.decision === "approve" ? "REPORT_APPROVED" : "REPORT_RETURNED", targetType: "document_version", targetId: version.id, details: { remarks: parsed.data.remarks } } });
    });
  } catch {
    redirect("/supervisor/signing?error=stale");
  }
  revalidatePath("/documentation");
  revalidatePath("/supervisor/signing");
  redirect("/supervisor/signing?success=reviewed");
}

export async function signApprovedReport(form: FormData) {
  const { profile } = await requireRole([Role.SUPERVISOR]);
  const parsed = z.object({ versionId: z.string().uuid() }).safeParse({ versionId: form.get("versionId") });
  if (!parsed.success) redirect("/supervisor/signing?error=invalid");
  const version = await prisma.documentVersion.findUnique({ where: { id: parsed.data.versionId }, include: { documentation: { include: { student: { include: { user: true, placement: { include: { company: true } } } } } }, approvals: { orderBy: { createdAt: "desc" } }, signatures: true } });
  const assignment = await prisma.supervisorAssignment.findFirst({ where: { userId: profile.id, active: true, canSign: true } });
  const approval = version?.approvals.find((record) => record.decision === "APPROVED" && record.supervisorId === profile.id);
  if (!version || !assignment || version.documentation.student.placement?.companyId !== assignment.companyId || version.documentation.status !== DocumentStatus.APPROVED || version.immutable || version.signatures.length > 0 || !approval || !version.submittedAt || !version.documentation.student.placement?.company) redirect("/supervisor/signing?error=permission");
  const signerPublicKey = assignment.publicKeyPem;
  if (!assignment.keyId || assignment.keyId !== process.env.SIGNING_KEY_ID || !signerPublicKey || signerPublicKey !== signingPublicKeyPem()) redirect("/supervisor/signing?error=signing-key");
  try {
    const payload = canonical({ id: version.id, studentId: version.documentation.studentId, day: version.documentation.day, version: version.version, activities: version.activities, skills: version.skills, challenges: version.challenges, company: approval.companyNameSnapshot, submittedAt: version.submittedAt.toISOString(), approvedBy: approval.approvedByName, approvedAt: approval.createdAt.toISOString() });
    const signed = signPayload(payload);
    await prisma.$transaction(async (tx) => {
      await tx.digitalSignature.create({ data: { versionId: version.id, signerId: profile.id, digest: signed.digest, signature: signed.signature, keyId: signed.keyId, publicKeyPem: signerPublicKey } });
      await tx.documentVersion.update({ where: { id: version.id }, data: { immutable: true } });
      await tx.dailyDocumentation.update({ where: { id: version.documentationId }, data: { status: DocumentStatus.SIGNED } });
      await tx.auditLog.create({ data: { actorId: profile.id, action: "REPORT_SIGNED", targetType: "document_version", targetId: version.id, details: { keyId: signed.keyId, digest: signed.digest } } });
    });
  } catch {
    redirect("/supervisor/signing?error=signing");
  }
  revalidatePath("/supervisor/signing");
  revalidatePath("/verification");
  revalidatePath("/documentation");
  redirect("/supervisor/signing?success=signed");
}

function manilaDate(now = new Date()): Date {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return new Date(`${date}T00:00:00.000Z`);
}

export async function recordAttendance(form: FormData) {
  const { profile, student } = await requireRole([Role.STUDENT]);
  if (!student) redirect("/profile?error=complete");
  const action = z.enum(["in", "out"]).safeParse(form.get("action"));
  if (!action.success) redirect("/attendance?error=invalid");
  const placement = await prisma.ojtPlacement.findUnique({ where: { studentId: student.id } });
  if (placement?.status !== PlacementStatus.APPROVED) redirect("/attendance?error=no-placement");
  const date = manilaDate();
  const existing = await prisma.attendanceRecord.findUnique({ where: { studentId_date: { studentId: student.id, date } } });
  if (action.data === "in") {
    if (existing?.timeIn) redirect("/attendance?error=already-in");
    const record = existing
      ? await prisma.attendanceRecord.update({ where: { id: existing.id }, data: { timeIn: new Date(), status: AttendanceStatus.PRESENT } })
      : await prisma.attendanceRecord.create({ data: { studentId: student.id, date, timeIn: new Date(), status: AttendanceStatus.PRESENT, deviceId: "web", method: "manual-web", verification: false } });
    await prisma.auditLog.create({ data: { actorId: profile.id, action: "ATTENDANCE_TIME_IN", targetType: "attendance_record", targetId: record.id } });
  } else {
    if (!existing?.timeIn || existing.timeOut) redirect("/attendance?error=not-checked-in");
    const record = await prisma.attendanceRecord.update({ where: { id: existing.id }, data: { timeOut: new Date() } });
    await prisma.auditLog.create({ data: { actorId: profile.id, action: "ATTENDANCE_TIME_OUT", targetType: "attendance_record", targetId: record.id } });
  }
  revalidatePath("/attendance");
  revalidatePath("/attendance/history");
  redirect("/attendance?success=recorded");
}
