"use server";

import { PlacementStatus, Role } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/page-auth";
import { canChangeAccount, canProvisionSupervisor, isValidShift } from "@/lib/policy";
import { notify } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { trustedSigningKey } from "@/lib/signing";

export async function decidePlacement(form: FormData) {
  const { profile } = await requireRole([Role.COORDINATOR]);
  const parsed = z.object({
    placementId: z.string().uuid(),
    decision: z.enum(["approve", "reject"]),
    supervisorId: z.string().uuid().optional(),
    shiftStart: z.string().refine(isValidShift).default("08:00"),
    graceMinutes: z.coerce.number().int().min(0).max(120).default(15),
  }).safeParse({ placementId: form.get("placementId"), decision: form.get("decision"), supervisorId: form.get("supervisorId") || undefined, shiftStart: form.get("shiftStart") || undefined, graceMinutes: form.get("graceMinutes") || undefined });
  if (!parsed.success) redirect("/companies?error=invalid");
  const placement = await prisma.ojtPlacement.findUnique({ where: { id: parsed.data.placementId }, include: { company: true, student: { include: { user: true } } } });
  if (!placement || placement.status !== PlacementStatus.PENDING) redirect("/companies?error=stale");
  let supervisorId: string | null = null;
  if (parsed.data.decision === "approve") {
    if (!parsed.data.supervisorId) redirect("/companies?error=supervisor");
    const assignment = await prisma.supervisorAssignment.findFirst({ where: { userId: parsed.data.supervisorId, companyId: placement.companyId, active: true, user: { active: true, role: Role.SUPERVISOR } } });
    if (!assignment) redirect("/companies?error=supervisor");
    supervisorId = assignment.userId;
  }
  const approve = parsed.data.decision === "approve";
  try {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.ojtPlacement.updateMany({ where: { id: placement.id, status: PlacementStatus.PENDING }, data: { status: approve ? PlacementStatus.APPROVED : PlacementStatus.REJECTED, supervisorId, decidedAt: new Date(), ...(approve ? { shiftStart: parsed.data.shiftStart, graceMinutes: parsed.data.graceMinutes } : {}) } });
      if (changed.count !== 1) throw new Error("PLACEMENT_ALREADY_DECIDED");
      if (approve) await tx.company.update({ where: { id: placement.companyId }, data: { approved: true } });
      await notify(tx, [placement.student.userId], approve
        ? { type: "PLACEMENT_APPROVED", title: "Your placement was approved", body: `${placement.company.name} · shift starts ${parsed.data.shiftStart}. You can now time in and submit reports.`, href: "/attendance" }
        : { type: "PLACEMENT_REJECTED", title: "Your placement request was not approved", body: `${placement.company.name}. Submit another company or contact your coordinator.`, href: "/placement" });
      if (approve) await notify(tx, [supervisorId], { type: "STUDENT_ASSIGNED", title: `New student assigned: ${placement.student.user.name}`, body: placement.company.name, href: "/supervisor/signing" });
      await tx.auditLog.create({ data: { actorId: profile.id, action: approve ? "PLACEMENT_APPROVED" : "PLACEMENT_REJECTED", targetType: "placement", targetId: placement.id, details: { companyId: placement.companyId, supervisorId, ...(approve ? { shiftStart: parsed.data.shiftStart, graceMinutes: parsed.data.graceMinutes } : {}) } } });
    });
  } catch {
    redirect("/companies?error=stale");
  }
  revalidatePath("/");
  revalidatePath("/companies");
  revalidatePath("/placement");
  redirect(`/companies?success=${approve ? "approved" : "rejected"}`);
}

export async function createCompany(form: FormData) {
  const { profile } = await requireRole([Role.COORDINATOR]);
  const parsed = z.object({ name: z.string().trim().min(2).max(160), address: z.string().trim().min(4).max(300) }).safeParse({ name: form.get("name"), address: form.get("address") });
  if (!parsed.success) redirect("/users?error=company");
  const duplicate = await prisma.company.findFirst({ where: { name: { equals: parsed.data.name, mode: "insensitive" } } });
  if (duplicate) redirect("/users?error=duplicate-company");
  await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({ data: { name: parsed.data.name, address: parsed.data.address, approved: true } });
    await tx.auditLog.create({ data: { actorId: profile.id, action: "COMPANY_CREATED", targetType: "company", targetId: created.id, details: { name: created.name } } });
  });
  revalidatePath("/users");
  revalidatePath("/companies");
  redirect("/users?success=company");
}

export async function provisionSupervisor(form: FormData) {
  const { profile } = await requireRole([Role.COORDINATOR]);
  const parsed = z.object({ userId: z.string().uuid(), companyId: z.string().uuid(), canSign: z.enum(["true", "false"]) }).safeParse({ userId: form.get("userId"), companyId: form.get("companyId"), canSign: form.get("canSign") });
  if (!parsed.success) redirect("/users?error=provision");
  const [target, company, assignedActivePlacements] = await Promise.all([
    prisma.userProfile.findUnique({ where: { id: parsed.data.userId }, include: { supervisor: true, student: { include: { placement: true, _count: { select: { attendance: true, documents: true } } } } } }),
    prisma.company.findUnique({ where: { id: parsed.data.companyId } }),
    prisma.ojtPlacement.count({ where: { supervisorId: parsed.data.userId, status: PlacementStatus.APPROVED } }),
  ]);
  if (!company) redirect("/users?error=provision");
  const student = target?.student;
  const decision = canProvisionSupervisor({
    actorId: profile.id,
    target,
    targetHasStudentActivity: Boolean(student && (student.placement || student._count.attendance > 0 || student._count.documents > 0)),
    currentCompanyId: target?.supervisor?.active ? target.supervisor.companyId : null,
    newCompanyId: company.id,
    assignedActivePlacements,
  });
  if (!decision.ok || !target) redirect(`/users?error=${decision.ok ? "provision" : decision.reason}`);
  const canSign = parsed.data.canSign === "true";
  const trusted = canSign ? trustedSigningKey() : null;
  if (canSign && !trusted) redirect("/users?error=signing-key");
  await prisma.$transaction(async (tx) => {
    await tx.userProfile.update({ where: { id: target.id }, data: { role: Role.SUPERVISOR } });
    const data = { companyId: company.id, canSign, publicKeyPem: trusted?.publicKeyPem ?? null, keyId: trusted?.keyId ?? null, active: true };
    await tx.supervisorAssignment.upsert({ where: { userId: target.id }, create: { userId: target.id, ...data }, update: data });
    await tx.auditLog.create({ data: { actorId: profile.id, action: "SUPERVISOR_PROVISIONED", targetType: "user_profile", targetId: target.id, details: { companyId: company.id, canSign } } });
  });
  revalidatePath("/users");
  revalidatePath("/companies");
  redirect("/users?success=supervisor");
}

export async function changeAccount(form: FormData) {
  const { profile } = await requireRole([Role.COORDINATOR]);
  const parsed = z.object({ userId: z.string().uuid(), change: z.enum(["deactivate", "activate", "remove-supervisor"]) }).safeParse({ userId: form.get("userId"), change: form.get("change") });
  if (!parsed.success) redirect("/users?error=account");
  const [target, assignedActivePlacements] = await Promise.all([
    prisma.userProfile.findUnique({ where: { id: parsed.data.userId } }),
    prisma.ojtPlacement.count({ where: { supervisorId: parsed.data.userId, status: PlacementStatus.APPROVED } }),
  ]);
  const decision = canChangeAccount({ actorId: profile.id, target, assignedActivePlacements, change: parsed.data.change });
  if (!decision.ok || !target) redirect(`/users?error=${decision.ok ? "account" : decision.reason}`);
  const change = parsed.data.change;
  await prisma.$transaction(async (tx) => {
    if (change === "remove-supervisor") {
      await tx.supervisorAssignment.updateMany({ where: { userId: target.id }, data: { active: false, canSign: false } });
      await tx.userProfile.update({ where: { id: target.id }, data: { role: Role.STUDENT } });
    } else {
      await tx.userProfile.update({ where: { id: target.id }, data: { active: change === "activate" } });
    }
    await tx.auditLog.create({ data: { actorId: profile.id, action: change === "remove-supervisor" ? "SUPERVISOR_REMOVED" : change === "activate" ? "ACCOUNT_ACTIVATED" : "ACCOUNT_DEACTIVATED", targetType: "user_profile", targetId: target.id } });
  });
  revalidatePath("/users");
  redirect(`/users?success=${change}`);
}
