import type { Metadata } from "next";
import { Download, ShieldCheck } from "lucide-react";
import { Role } from "@/generated/prisma";
import { DefinitionGrid, EmptyState, Notice, PageHeader, Pagination, Panel, Shell, withQuery } from "@/components/ui";
import { CopyDigest, VerifyButton } from "@/components/verify-button";
import { formatCalendarDate, formatDateTime } from "@/lib/format";
import { pageArgs, parsePage } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Verify signatures" };

export default async function Verification({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { role, user } = await requireRole([Role.COORDINATOR]);
  const query = await searchParams;
  const page = parsePage(query.page);
  const size = 10;
  const [signatures, total] = await Promise.all([
    prisma.digitalSignature.findMany({
      include: { version: { include: { documentation: { include: { student: { include: { user: true } } } }, approvals: { where: { decision: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 1 } } } },
      orderBy: { signedAt: "desc" },
      ...pageArgs(page, size),
    }),
    prisma.digitalSignature.count(),
  ]);
  const signers = await prisma.userProfile.findMany({ where: { id: { in: [...new Set(signatures.map((item) => item.signerId))] } }, select: { id: true, name: true } });
  const signerName = new Map(signers.map((signer) => [signer.id, signer.name]));

  return (
    <Shell role={role} name={user.name}>
      <PageHeader eyebrow="Integrity" title="Verify signatures" description="Check that a signed report has not changed and was signed with the server's trusted key by the approving supervisor." />
      <Notice tone="info">A valid result proves the report content is unchanged since signing. All supervisors sign through one server key, so it does not prove which person physically pressed Sign — the audit log records that.</Notice>
      {signatures.length ? signatures.map((signature) => {
        const version = signature.version;
        const report = version.documentation;
        const approval = version.approvals[0];
        return (
          <Panel key={signature.id} title={`${report.student.user.name} · Day ${report.day}`}>
            <DefinitionGrid items={[
              ["Report date", formatCalendarDate(report.reportDate)],
              ["Version", String(version.version)],
              ["Company at approval", approval?.companyNameSnapshot ?? "—"],
              ["Signed by", signerName.get(signature.signerId) ?? "Unknown account"],
              ["Signed", formatDateTime(signature.signedAt)],
              ["Key ID", <code key="k">{signature.keyId}</code>],
            ]} />
            <div style={{ margin: "16px 0" }}><span className="label">SHA-256 digest</span><CopyDigest value={signature.digest} /></div>
            <a className="button button-ghost" style={{ marginBottom: 12, paddingLeft: 0 }} href={`/api/export/report/${version.id}`}><Download aria-hidden="true" size={18} />Download signed PDF</a>
            <VerifyButton documentId={version.id} />
          </Panel>
        );
      }) : <Panel><EmptyState icon={ShieldCheck} title="No signed reports yet">Reports appear here after a supervisor signs them.</EmptyState></Panel>}
      <Pagination page={page} total={total} size={size} href={(next) => withQuery("/verification", query, { page: next })} />
    </Shell>
  );
}
