import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { z } from "zod";
import { getSessionProfile } from "@/lib/page-auth";
import { prisma } from "@/lib/prisma";
import { sameKey, trustedSigningKey, verifyDocument } from "@/lib/signing";

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sign in to verify signatures." }, { status: 401 });
  if (profile.role !== Role.COORDINATOR) return NextResponse.json({ error: "Only coordinators can verify signatures." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = z.object({ documentId: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid document id" }, { status: 400 });

  const version = await prisma.documentVersion.findUnique({
    where: { id: parsed.data.documentId },
    include: {
      documentation: { include: { student: { include: { placement: { include: { company: true } } } } } },
      signatures: true,
      approvals: { where: { decision: "APPROVED" }, orderBy: { createdAt: "desc" } },
    },
  });
  const signature = version?.signatures[0];
  if (!version || !signature) return NextResponse.json({ error: "Signed document not found" }, { status: 404 });

  // The approval must come from the account that signed, for the company recorded at approval time.
  const approval = version.approvals.find((record) => record.supervisorId === signature.signerId);
  const authorized = Boolean(approval && approval.approvedByName && approval.companyIdSnapshot && approval.createdAt <= signature.signedAt);

  // Trust comes from server configuration; the key copy stored beside the signature must match it.
  const trusted = trustedSigningKey();
  const storedKeyTrusted = Boolean(trusted && sameKey(signature.publicKeyPem, trusted.publicKeyPem));

  const result = verifyDocument({
    id: version.id,
    studentId: version.documentation.studentId,
    day: version.documentation.day,
    version: version.version,
    activities: version.activities,
    skills: version.skills,
    challenges: version.challenges,
    company: approval?.companyNameSnapshot ?? "",
    submittedAt: version.submittedAt?.toISOString() ?? "",
    approvedBy: approval?.approvedByName ?? "",
    approvedAt: approval?.createdAt.toISOString() ?? "",
    signedAt: signature.signedAt.toISOString(),
    signer: approval?.approvedByName ?? "",
    approvedForCompany: authorized,
    keyId: signature.keyId,
    digest: signature.digest,
    signature: signature.signature,
  }, { publicKeyPem: storedKeyTrusted ? trusted!.publicKeyPem : "", keyId: trusted?.keyId ?? "", authorizedSigner: authorized });

  await prisma.auditLog.create({ data: { actorId: profile.id, action: "SIGNATURE_VERIFIED", targetType: "document_version", targetId: version.id, details: { result: result.result, digest: result.digest } } });
  return NextResponse.json(result);
}
