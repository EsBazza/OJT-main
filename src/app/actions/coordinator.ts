"use server";

import { PlacementStatus, Role } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failed, fieldErrorsFrom, formValues, succeeded, type FormState } from "@/lib/form-state";
import { requireRole } from "@/lib/page-auth";
import { canChangeAccount, canProvisionSupervisor, isValidShift } from "@/lib/policy";
import { notify } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { trustedSigningKey } from "@/lib/signing";

// These actions return a result instead of redirecting, so coordinator pages update in place.

export async function decidePlacement(_state: FormState, form: FormData): Promise<FormState> {
  const { profile } = await requireRole([Role.COORDINATOR]);
  const values = formValues(form, ["supervisorId", "shiftStart", "graceMinutes"]);
  const parsed = z.object({
    placementId: z.string().uuid(),
    decision: z.enum(["approve", "reject"]),
    supervisorId: z.string().uuid().optional(),
    shiftStart: z.string().refine(isValidShift).default("08:00"),
    graceMinutes: z.coerce.number().int().min(0).max(120).default(15),
  }).safeParse({ placementId: form.get("placementId"), decision: form.get("decision"), supervisorId: values.supervisorId || undefined, shiftStart: values.shiftStart || undefined, graceMinutes: values.graceMinutes || undefined });
  if (!parsed.success) return failed("Check the work schedule.", { values, fieldErrors: fieldErrorsFrom(parsed.error, { shiftStart: "Use a 24-hour time such as 08:00.", graceMinutes: "Use 0–120 minutes." }) });
  const placement = await prisma.ojtPlacement.findUnique({ where: { id: parsed.data.placementId }, include: { company: true, student: { include: { user: true } } } });
  if (!placement || placement.status !== PlacementStatus.PENDING) {
    revalidatePath("/companies");
    return failed("This request was already decided. The list has been refreshed.");
  }
  const approve = parsed.data.decision === "approve";
  let supervisorId: string | null = null;
  if (approve) {
    const assignment = parsed.data.supervisorId ? await prisma.supervisorAssignment.findFirst({ where: { userId: parsed.data.supervisorId, companyId: placement.companyId, active: true, user: { active: true, role: Role.SUPERVISOR } } }) : null;
    if (!assignment) return failed("Choose a supervisor before approving.", { values, fieldErrors: { supervisorId: "Choose an active supervisor at this company." } });
    supervisorId = assignment.userId;
  }
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
    revalidatePath("/companies");
    return failed("This request was already decided. The list has been refreshed.");
  }
  revalidatePath("/");
  revalidatePath("/companies");
  revalidatePath("/placement");
  return succeeded(approve ? `Approved ${placement.student.user.name} at ${placement.company.name}.` : `Rejected ${placement.student.user.name}'s request. They can submit another company.`);
}

export async function createCompany(_state: FormState, form: FormData): Promise<FormState> {
  const { profile } = await requireRole([Role.COORDINATOR]);
  const values = formValues(form, ["name", "address"]);
  const parsed = z.object({ name: z.string().trim().min(2).max(160), address: z.string().trim().min(4).max(300) }).safeParse(values);
  if (!parsed.success) return failed("Check the company details.", { values, fieldErrors: fieldErrorsFrom(parsed.error, { name: "Enter the company name (2–160 characters).", address: "Enter the address (4–300 characters)." }) });
  const duplicate = await prisma.company.findFirst({ where: { name: { equals: parsed.data.name, mode: "insensitive" } } });
  if (duplicate) return failed("That company already exists.", { values, fieldErrors: { name: "A company with this name is already registered." } });
  await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({ data: { name: parsed.data.name, address: parsed.data.address, approved: true } });
    await tx.auditLog.create({ data: { actorId: profile.id, action: "COMPANY_CREATED", targetType: "company", targetId: created.id, details: { name: created.name } } });
  });
  revalidatePath("/");
  revalidatePath("/users");
  revalidatePath("/companies");
  return succeeded(`${parsed.data.name} registered.`);
}

const provisionErrors = {
  provision: "Choose an active, non-coordinator account (not your own).",
  "student-activity": "That account already has student placement, attendance, or reports. Use a separate account for the supervisor.",
  "has-students": "This supervisor still has approved students at their current company. Finish or reassign those placements first.",
};

export async function provisionSupervisor(_state: FormState, form: FormData): Promise<FormState> {
  const { profile } = await requireRole([Role.COORDINATOR]);
  const values = formValues(form, ["userId", "companyId", "canSign"]);
  const parsed = z.object({ userId: z.string().uuid(), companyId: z.string().uuid(), canSign: z.enum(["true", "false"]) }).safeParse(values);
  if (!parsed.success) return failed("Choose an account and a company.", { values, fieldErrors: fieldErrorsFrom(parsed.error, { userId: "Choose an account.", companyId: "Choose a company.", canSign: "Choose a permission." }) });
  const [target, company, assignedActivePlacements] = await Promise.all([
    prisma.userProfile.findUnique({ where: { id: parsed.data.userId }, include: { supervisor: true, student: { include: { placement: true, _count: { select: { attendance: true, documents: true } } } } } }),
    prisma.company.findUnique({ where: { id: parsed.data.companyId } }),
    prisma.ojtPlacement.count({ where: { supervisorId: parsed.data.userId, status: PlacementStatus.APPROVED } }),
  ]);
  if (!company) return failed("That company no longer exists.", { values, fieldErrors: { companyId: "Choose another company." } });
  const student = target?.student;
  const decision = canProvisionSupervisor({
    actorId: profile.id,
    target,
    targetHasStudentActivity: Boolean(student && (student.placement || student._count.attendance > 0 || student._count.documents > 0)),
    currentCompanyId: target?.supervisor?.active ? target.supervisor.companyId : null,
    newCompanyId: company.id,
    assignedActivePlacements,
  });
  if (!decision.ok || !target) return failed(provisionErrors[decision.ok ? "provision" : decision.reason], { values, fieldErrors: { userId: provisionErrors[decision.ok ? "provision" : decision.reason] } });
  const canSign = parsed.data.canSign === "true";
  const trusted = canSign ? trustedSigningKey() : null;
  if (canSign && !trusted) return failed("Configure SIGNING_PRIVATE_KEY_PEM and SIGNING_KEY_ID on the server before granting signing permission.", { values });
  await prisma.$transaction(async (tx) => {
    await tx.userProfile.update({ where: { id: target.id }, data: { role: Role.SUPERVISOR } });
    const data = { companyId: company.id, canSign, publicKeyPem: trusted?.publicKeyPem ?? null, keyId: trusted?.keyId ?? null, active: true };
    await tx.supervisorAssignment.upsert({ where: { userId: target.id }, create: { userId: target.id, ...data }, update: data });
    await tx.auditLog.create({ data: { actorId: profile.id, action: "SUPERVISOR_PROVISIONED", targetType: "user_profile", targetId: target.id, details: { companyId: company.id, canSign } } });
  });
  revalidatePath("/");
  revalidatePath("/users");
  revalidatePath("/companies");
  return succeeded(`${target.name} is now a ${canSign ? "signing" : "review-only"} supervisor at ${company.name}.`);
}

export async function changeAccount(_state: FormState, form: FormData): Promise<FormState> {
  const { profile } = await requireRole([Role.COORDINATOR]);
  const parsed = z.object({ userId: z.string().uuid(), change: z.enum(["deactivate", "activate", "remove-supervisor"]) }).safeParse({ userId: form.get("userId"), change: form.get("change") });
  if (!parsed.success) return failed("That account change was not recognized.");
  const [target, assignedActivePlacements] = await Promise.all([
    prisma.userProfile.findUnique({ where: { id: parsed.data.userId } }),
    prisma.ojtPlacement.count({ where: { supervisorId: parsed.data.userId, status: PlacementStatus.APPROVED } }),
  ]);
  const decision = canChangeAccount({ actorId: profile.id, target, assignedActivePlacements, change: parsed.data.change });
  if (!decision.ok || !target) return failed(!decision.ok && decision.reason === "has-students" ? "This supervisor still has approved students. Reassign or finish those placements first." : "That account change is not allowed.");
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
  return succeeded(change === "remove-supervisor" ? `Removed supervisor access for ${target.name}.` : change === "activate" ? `${target.name} reactivated.` : `${target.name} deactivated. They can no longer sign in to OJT Monitor.`);
}
