import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { z } from "zod";
import { requireRole } from "@/lib/page-auth";
import { prisma } from "@/lib/prisma";
import { verifyDocument } from "@/lib/signing";

export async function POST(request: Request) {
  let profileId: string;
  try {
    ({ profile: { id: profileId } } = await requireRole([Role.COORDINATOR]));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = z.object({ documentId: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid document id" }, { status: 400 });

  const version = await prisma.documentVersion.findUnique({
    where: { id: parsed.data.documentId },
    include: {
      documentation: { include: { student: { include: { placement: { include: { company: true } } } } } },
      signatures: true,
      approvals: { where: { decision: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const signature = version?.signatures[0];
  if (!version || !signature || !version.documentation.student.placement?.company) return NextResponse.json({ error: "Signed document not found" }, { status: 404 });
  const approval = version.approvals[0];
  const signer = await prisma.userProfile.findUnique({ where: { id: signature.signerId }, select: { name: true } });
  const authorized = Boolean(approval && approval.supervisorId === signature.signerId && approval.companyIdSnapshot === version.documentation.student.placement.companyId && approval.approvedByName);
  const result = verifyDocument({
    id: version.id,
    studentId: version.documentation.studentId,
    day: version.documentation.day,
    version: version.version,
    activities: version.activities,
    skills: version.skills,
    challenges: version.challenges,
    company: approval?.companyNameSnapshot ?? version.documentation.student.placement.company.name,
    submittedAt: version.submittedAt?.toISOString() ?? "",
    approvedBy: approval?.approvedByName ?? "",
    approvedAt: approval?.createdAt.toISOString() ?? "",
    signedAt: signature.signedAt.toISOString(),
    signer: approval?.approvedByName ?? "",
    approvedForCompany: authorized,
    keyId: signature.keyId,
    digest: signature.digest,
    signature: signature.signature,
  }, { publicKeyPem: signature.publicKeyPem, keyId: signature.keyId, authorizedSigner: authorized });

  await prisma.auditLog.create({ data: { actorId: profileId, action: "SIGNATURE_VERIFIED", targetType: "document_version", targetId: version.id, details: { result: result.result, digest: result.digest } } });
  return NextResponse.json(result);
}
