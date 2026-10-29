import type { Metadata } from "next";
import { CheckCheck } from "lucide-react";
import { DocumentStatus, Role } from "@/generated/prisma";
import { EmptyState, Notice, PageHeader, Panel, Shell, StatusBadge, SuccessMark } from "@/components/ui";
import { formatCalendarDate, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";
import { ReviewForm } from "./review-form";
import { SignForm } from "./sign-form";

export const metadata: Metadata = { title: "Review & sign" };

const errors: Record<string, string> = {
  invalid: "The review request was incomplete.",
  confirm: "Tick the confirmation box before signing.",
  permission: "You are not authorized to act on this report.",
  stale: "This report changed since you opened the page. Check the latest version below.",
  signing: "The signature could not be saved. Confirm the signing key is configured on the server.",
  "signing-key": "Your signing key does not match the server's trusted key. Ask your coordinator to update your supervisor access.",
};


function Section({ title, current, previous }: { title: string; current: string; previous?: string }) {
  const changed = previous !== undefined && previous !== current;
  return (
    <div>
      <h3>{title}{changed && <span className="changed">Changed</span>}</h3>
      <p className="report-body">{current}</p>
      {changed && <details className="previous"><summary>Show previous version</summary><div>{previous}</div></details>}
    </div>
  );
}

export default async function Signing({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const { role, user, profile } = await requireRole([Role.SUPERVISOR]);
  const query = await searchParams;
  const assignment = profile.supervisor?.active ? profile.supervisor : null;
  const statuses = assignment?.canSign ? [DocumentStatus.SUBMITTED, DocumentStatus.APPROVED] : [DocumentStatus.SUBMITTED];
  const reports = assignment ? await prisma.dailyDocumentation.findMany({
    where: { status: { in: statuses }, student: { placement: { companyId: assignment.companyId, supervisorId: profile.id } } },
    include: { student: { include: { user: true } }, versions: { orderBy: { version: "desc" }, take: 2 } },
    orderBy: [{ status: "desc" }, { updatedAt: "asc" }],
    take: 50,
  }) : [];

  return (
    <Shell role={role} name={user.name}>
      <PageHeader eyebrow="Supervisor" title="Review & sign" description="Approve or return each report, then sign approved reports. Only the latest version can be reviewed." />
      {query.error && <Notice tone="error">{errors[query.error] ?? "The action could not be completed."}</Notice>}
      {query.success === "signed" && <Panel><SuccessMark variant="seal" title="Report signed">The report is now sealed and can no longer be changed.</SuccessMark></Panel>}
      {!assignment && <Notice tone="warn" title="No company assignment">Your account is not assigned to a company yet. Contact your OJT coordinator.</Notice>}
      {assignment && !assignment.canSign && <Notice tone="info">You have review-only access. A signing supervisor at your company signs approved reports.</Notice>}

      {assignment && (reports.length ? reports.map((report) => {
        const [version, previous] = report.versions;
        if (!version) return null;
        const label = `${report.student.user.name}'s Day ${report.day} report`;
        return (
          <Panel key={report.id} title={`${report.student.user.name} · Day ${report.day}`} actions={<StatusBadge status={report.status} />}>
            <p className="small">{report.reportDate ? `${formatCalendarDate(report.reportDate)} · ` : ""}Student no. {report.student.studentNumber} · Version {version.version}, submitted {formatDateTime(version.submittedAt)}</p>
            <Section title="Activities" current={version.activities} previous={previous?.activities} />
            <div className="form-grid">
              <Section title="Skills" current={version.skills} previous={previous?.skills} />
              <Section title="Challenges" current={version.challenges} previous={previous?.challenges} />
            </div>
            {report.status === DocumentStatus.SUBMITTED && (
              <ReviewForm versionId={version.id} label={label} />
            )}
            {report.status === DocumentStatus.APPROVED && assignment.canSign && <SignForm versionId={version.id} label={label} />}
          </Panel>
        );
      }) : <Panel><EmptyState icon={CheckCheck} title="Nothing to review">New reports from your assigned students will appear here.</EmptyState></Panel>)}
    </Shell>
  );
}
