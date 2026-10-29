"use server";

import { DocumentStatus, Role } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
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

export async function reviewReport(form: FormData) {
  const { profile } = await requireRole([Role.SUPERVISOR]);
  const parsed = z.object({ versionId: z.string().uuid(), decision: z.enum(["approve", "return"]), remarks: z.string().trim().max(2000) }).safeParse({ versionId: form.get("versionId"), decision: form.get("decision"), remarks: form.get("remarks") ?? "" });
  if (!parsed.success) redirect("/supervisor/signing?error=invalid");
  if (parsed.data.decision === "return" && parsed.data.remarks.length < 3) redirect("/supervisor/signing?error=remarks");
  const loaded = await loadVersion(parsed.data.versionId);
  const assignment = await prisma.supervisorAssignment.findUnique({ where: { userId: profile.id } });
  if (!loaded) redirect("/supervisor/signing?error=permission");
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
  if (!decision.ok || !placement) redirect(`/supervisor/signing?error=${decision.ok ? "permission" : decision.reason}`);
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
    redirect("/supervisor/signing?error=stale");
  }
  revalidatePath("/");
  revalidatePath("/documentation");
  revalidatePath("/supervisor/signing");
  redirect(`/supervisor/signing?success=${parsed.data.decision === "approve" ? "approved" : "returned"}`);
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
