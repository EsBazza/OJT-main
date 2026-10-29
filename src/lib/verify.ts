import { prisma } from "./prisma";
import { sameKey, trustedSigningKey, verifyDocument } from "./signing";

export async function loadSignedVersion(versionId: string) {
  return prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: {
      documentation: { include: { student: { include: { user: true, placement: { include: { company: true } } } } } },
      signatures: true,
      approvals: { orderBy: { createdAt: "desc" } },
    },
  });
}

export type LoadedVersion = NonNullable<Awaited<ReturnType<typeof loadSignedVersion>>>;

// Verifies a signed version against the server-trusted key and the signer's own approval.
export function verifyLoadedVersion(version: LoadedVersion) {
  const signature = version.signatures[0];
  if (!signature) return null;
  const approval = version.approvals.find((record) => record.decision === "APPROVED" && record.supervisorId === signature.signerId);
  const authorized = Boolean(approval && approval.approvedByName && approval.companyIdSnapshot && approval.createdAt <= signature.signedAt);
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
  return { result, signature, approval };
}
