import { NextResponse } from "next/server";
import { z } from "zod";
import { formatCalendarDate, formatDateTime, statusLabel } from "@/lib/format";
import { getSessionProfile } from "@/lib/page-auth";
import { PdfWriter, pdfResponse } from "@/lib/pdf";
import { canViewReport } from "@/lib/policy";
import { prisma } from "@/lib/prisma";
import { loadSignedVersion, verifyLoadedVersion } from "@/lib/verify";

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Sign in to download reports." }, { status: 401 });
  const { versionId } = await params;
  if (!z.string().uuid().safeParse(versionId).success) return NextResponse.json({ error: "Invalid report id" }, { status: 400 });

  const version = await loadSignedVersion(versionId);
  const student = version?.documentation.student;
  if (!version || !student || !canViewReport({ role: profile.role, actorId: profile.id, studentUserId: student.userId, assignedSupervisorId: student.placement?.supervisorId ?? null })) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const report = version.documentation;
  const verified = verifyLoadedVersion(version);
  const latestApproval = version.approvals[0];
  const signer = verified ? await prisma.userProfile.findUnique({ where: { id: verified.signature.signerId }, select: { name: true } }) : null;

  const pdf = await PdfWriter.create(`Daily report · Day ${report.day}`, `${student.user.name} · ${formatCalendarDate(report.reportDate, "full")}`);
  pdf.fields([
    ["Student", student.user.name],
    ["Student number", student.studentNumber],
    ["Program", student.program],
    ["Company", verified?.approval?.companyNameSnapshot ?? student.placement?.company.name ?? "—"],
    ["Report date", formatCalendarDate(report.reportDate)],
    ["Status", `${statusLabel(report.status).label} · version ${version.version}`],
  ]);
  pdf.heading("Activities completed");
  pdf.paragraph(version.activities);
  pdf.heading("Skills learned");
  pdf.paragraph(version.skills);
  pdf.heading("Challenges and response");
  pdf.paragraph(version.challenges);

  pdf.heading("Review");
  pdf.fields([
    ["Submitted", formatDateTime(version.submittedAt)],
    ["Decision", latestApproval ? `${latestApproval.decision === "APPROVED" ? "Approved" : "Returned"} by ${latestApproval.approvedByName}` : "Not reviewed yet"],
    ["Decided", formatDateTime(latestApproval?.createdAt)],
    ["Remarks", latestApproval?.remarks ?? "None"],
  ]);

  if (verified) {
    pdf.heading("Digital signature");
    pdf.fields([
      ["Signed by", signer?.name ?? "Unknown account"],
      ["Signed", formatDateTime(verified.signature.signedAt)],
      ["Key ID", verified.signature.keyId],
      ["Integrity check at download", `${verified.result.result} — ${verified.result.explanation}`],
    ]);
    pdf.paragraph("SHA-256 digest", { size: 8, color: "muted" });
    pdf.paragraph(verified.signature.digest, { mono: true, size: 8.5 });
    pdf.paragraph("Ed25519 signature (base64)", { size: 8, color: "muted" });
    pdf.paragraph(verified.signature.signature, { mono: true, size: 8.5 });
  } else {
    pdf.spacer();
    pdf.paragraph("This version has not been digitally signed. It is an unofficial copy.", { color: "muted" });
  }
  pdf.paragraph(`Generated ${formatDateTime(new Date())} by ${profile.name}.`, { size: 8, color: "muted" });

  await prisma.auditLog.create({ data: { actorId: profile.id, action: "REPORT_EXPORTED", targetType: "document_version", targetId: version.id, details: { day: report.day } } });
  return pdfResponse(await pdf.bytes(), `ojt-report-${student.studentNumber}-day-${report.day}.pdf`);
}
