"use server";

import { DocumentStatus, Role } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failed, succeeded, type FormState } from "@/lib/form-state";
import { requireRole } from "@/lib/page-auth";
import { canReview, canSign } from "@/lib/policy";
import { notify } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { canonical, sameKey, signPayload, trustedSigningKey } from "@/lib/signing";

async function loadVersion(versionId: string) {
  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: {
      documentation: { include: { student: { include: { placement: { include: { company: true } } } } } },
      approvals: { orderBy: { createdAt: "desc" } },
      signatures: true,
    },
  });
  if (!version) return null;
  const latest = await prisma.documentVersion.findFirst({ where: { documentationId: version.documentationId }, orderBy: { version: "desc" }, select: { id: true } });
  return { version, latestVersionId: latest?.id ?? null };
}

const reviewErrors = { permission: "You are not authorized to act on this report.", stale: "This report changed since you opened it. The list has been refreshed.", "signing-key": "Signing key mismatch." };

// Returns a result instead of redirecting, so the review queue updates in place.
export async function reviewReport(_state: FormState, form: FormData): Promise<FormState> {
  const { profile } = await requireRole([Role.SUPERVISOR]);
  const remarks = String(form.get("remarks") ?? "");
  const parsed = z.object({ versionId: z.string().uuid(), decision: z.enum(["approve", "return"]), remarks: z.string().trim().max(2000) }).safeParse({ versionId: form.get("versionId"), decision: form.get("decision"), remarks });
  if (!parsed.success) return failed("The review request was incomplete.", { values: { remarks } });
  if (parsed.data.decision === "return" && parsed.data.remarks.length < 3) return failed("Add remarks before returning the report.", { values: { remarks }, fieldErrors: { remarks: "Tell the student what to change (at least 3 characters)." } });
  const loaded = await loadVersion(parsed.data.versionId);
  const assignment = await prisma.supervisorAssignment.findUnique({ where: { userId: profile.id } });
  if (!loaded) return failed(reviewErrors.permission);
  const { version, latestVersionId } = loaded;
  const placement = version.documentation.student.placement;
  const decision = canReview({
    actorId: profile.id,
    assignment,
    placement,
    version: { id: version.id, immutable: version.immutable, signed: version.signatures.length > 0, submittedAt: version.submittedAt },
    latestVersionId,
    documentStatus: version.documentation.status,
  });
  if (!decision.ok || !placement) {
    revalidatePath("/supervisor/signing");
    return failed(reviewErrors[decision.ok ? "permission" : decision.reason], { values: { remarks } });
  }
  try {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.dailyDocumentation.updateMany({ where: { id: version.documentationId, status: DocumentStatus.SUBMITTED }, data: { status: parsed.data.decision === "approve" ? DocumentStatus.APPROVED : DocumentStatus.RETURNED } });
      if (changed.count !== 1) throw new Error("REPORT_ALREADY_REVIEWED");
      await tx.approvalRecord.create({ data: { versionId: version.id, supervisorId: profile.id, approvedByName: profile.name, companyNameSnapshot: placement.company.name, companyIdSnapshot: placement.companyId, decision: parsed.data.decision === "approve" ? "APPROVED" : "RETURNED", remarks: parsed.data.remarks || null } });
      await tx.auditLog.create({ data: { actorId: profile.id, action: parsed.data.decision === "approve" ? "REPORT_APPROVED" : "REPORT_RETURNED", targetType: "document_version", targetId: version.id, details: { day: version.documentation.day, remarks: parsed.data.remarks } } });
      await notify(tx, [version.documentation.student.userId], parsed.data.decision === "approve"
        ? { type: "REPORT_APPROVED", title: `Day ${version.documentation.day} report approved`, body: parsed.data.remarks || `Approved by ${profile.name}.`, href: "/documentation" }
        : { type: "REPORT_RETURNED", title: `Day ${version.documentation.day} report needs changes`, body: parsed.data.remarks, href: "/documentation" });
    });
  } catch {
    revalidatePath("/supervisor/signing");
    return failed(reviewErrors.stale);
  }
  revalidatePath("/");
  revalidatePath("/documentation");
  revalidatePath("/supervisor/signing");
  const who = `Day ${version.documentation.day} report`;
  return succeeded(parsed.data.decision === "approve" ? `${who} approved.${assignment?.canSign ? " You can now sign it." : ""}` : `${who} returned to the student with your remarks.`);
}

export async function signApprovedReport(form: FormData) {
  const { profile } = await requireRole([Role.SUPERVISOR]);
  const parsed = z.object({ versionId: z.string().uuid(), confirm: z.literal("yes") }).safeParse({ versionId: form.get("versionId"), confirm: form.get("confirm") });
  if (!parsed.success) redirect("/supervisor/signing?error=confirm");
  const loaded = await loadVersion(parsed.data.versionId);
  const assignment = await prisma.supervisorAssignment.findUnique({ where: { userId: profile.id } });
  if (!loaded) redirect("/supervisor/signing?error=permission");
  const { version, latestVersionId } = loaded;
  const placement = version.documentation.student.placement;
  const approval = version.approvals.find((record) => record.decision === "APPROVED" && record.supervisorId === profile.id);
  const trustedKey = trustedSigningKey();
  const decision = canSign({
    actorId: profile.id,
    assignment,
    placement,
    version: { id: version.id, immutable: version.immutable, signed: version.signatures.length > 0, submittedAt: version.submittedAt },
    latestVersionId,
    documentStatus: version.documentation.status,
    approvedByActor: Boolean(approval),
    trustedKey,
    keysMatch: sameKey,
  });
  if (!decision.ok || !approval || !version.submittedAt || !trustedKey) redirect(`/supervisor/signing?error=${decision.ok ? "permission" : decision.reason}`);
  try {
    const payload = canonical({ id: version.id, studentId: version.documentation.studentId, day: version.documentation.day, version: version.version, activities: version.activities, skills: version.skills, challenges: version.challenges, company: approval.companyNameSnapshot, submittedAt: version.submittedAt.toISOString(), approvedBy: approval.approvedByName, approvedAt: approval.createdAt.toISOString() });
    const signed = signPayload(payload);
    await prisma.$transaction(async (tx) => {
      const changed = await tx.dailyDocumentation.updateMany({ where: { id: version.documentationId, status: DocumentStatus.APPROVED }, data: { status: DocumentStatus.SIGNED } });
      if (changed.count !== 1) throw new Error("REPORT_CHANGED");
      await tx.digitalSignature.create({ data: { versionId: version.id, signerId: profile.id, digest: signed.digest, signature: signed.signature, keyId: signed.keyId, publicKeyPem: trustedKey.publicKeyPem } });
      await tx.documentVersion.update({ where: { id: version.id }, data: { immutable: true } });
      await tx.auditLog.create({ data: { actorId: profile.id, action: "REPORT_SIGNED", targetType: "document_version", targetId: version.id, details: { day: version.documentation.day, keyId: signed.keyId, digest: signed.digest } } });
      await notify(tx, [version.documentation.student.userId], { type: "REPORT_SIGNED", title: `Day ${version.documentation.day} report signed`, body: `Digitally signed by ${profile.name}. You can download the signed PDF.`, href: "/documentation" });
    });
  } catch (error) {
    console.error("Report signing failed", error);
    redirect("/supervisor/signing?error=signing");
  }
  revalidatePath("/");
  revalidatePath("/supervisor/signing");
  revalidatePath("/verification");
  revalidatePath("/documentation");
  redirect("/supervisor/signing?success=signed");
}
