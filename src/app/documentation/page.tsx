import type { Metadata } from "next";
import { NotebookPen } from "lucide-react";
import Link from "next/link";
import { DocumentStatus, PlacementStatus, Role } from "@/generated/prisma";
import { EmptyState, Notice, PageHeader, Pagination, Panel, Shell, StatusBadge, withQuery } from "@/components/ui";
import { dateToString, formatCalendarDate, formatDateTime } from "@/lib/format";
import { pageArgs, parsePage } from "@/lib/pagination";
import { reportDayNumber } from "@/lib/policy";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";
import { ReportForm, type ReportOption } from "./report-form";

export const metadata: Metadata = { title: "Daily reports" };

const flow = [DocumentStatus.SUBMITTED, DocumentStatus.APPROVED, DocumentStatus.SIGNED] as const;
const flowLabels = { SUBMITTED: "Submitted", APPROVED: "Approved", SIGNED: "Signed" };

function Progress({ status }: { status: DocumentStatus }) {
  const reached = status === DocumentStatus.RETURNED ? 0 : flow.indexOf(status as (typeof flow)[number]);
  return (
    <ol className="timeline" aria-label="Report progress">
      {flow.map((step, index) => {
        const state = status === DocumentStatus.RETURNED && index === 1 ? "problem" : index <= reached ? "done" : index === reached + 1 ? "current" : "todo";
        return <li key={step} data-state={state}>{status === DocumentStatus.RETURNED && index === 1 ? "Returned" : flowLabels[step]}</li>;
      })}
    </ol>
  );
}

export default async function Documentation({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; page?: string }> }) {
  const { role, user, profile, student } = await requireRole([Role.STUDENT, Role.SUPERVISOR]);
  const query = await searchParams;
  const page = parsePage(query.page);
  const where = role === Role.STUDENT ? { studentId: student?.id ?? "" } : { student: { placement: { supervisorId: profile.id } } };
  const [reports, total] = await Promise.all([
    prisma.dailyDocumentation.findMany({ where, include: { student: { include: { user: true } }, versions: { orderBy: { version: "desc" }, take: 1, include: { approvals: { orderBy: { createdAt: "desc" }, take: 1 } } } }, orderBy: [{ reportDate: { sort: "desc", nulls: "last" } }, { day: "desc" }], ...pageArgs(page, 20) }),
    prisma.dailyDocumentation.count({ where }),
  ]);

  let options: ReportOption[] = [];
  let placementApproved = false;
  if (role === Role.STUDENT && student) {
    const [placement, attended, existing] = await Promise.all([
      prisma.ojtPlacement.findUnique({ where: { studentId: student.id } }),
      prisma.attendanceRecord.findMany({ where: { studentId: student.id, timeIn: { not: null } }, select: { date: true }, orderBy: { date: "desc" } }),
      prisma.dailyDocumentation.findMany({ where: { studentId: student.id }, include: { versions: { orderBy: { version: "desc" }, take: 1, include: { approvals: { orderBy: { createdAt: "desc" }, take: 1 } } } } }),
    ]);
    placementApproved = placement?.status === PlacementStatus.APPROVED;
    const dates = attended.map((row) => dateToString(row.date));
    const byDate = new Map(existing.filter((doc) => doc.reportDate).map((doc) => [dateToString(doc.reportDate!), doc]));
    options = dates.flatMap((date) => {
      const doc = byDate.get(date);
      if (doc && doc.status !== DocumentStatus.RETURNED && doc.status !== DocumentStatus.DRAFT) return [];
      const version = doc?.versions[0];
      return [{ date, label: formatCalendarDate(new Date(`${date}T00:00:00Z`), "medium"), day: reportDayNumber(dates, date) ?? 0, returned: doc?.status === DocumentStatus.RETURNED, activities: version?.activities ?? "", skills: version?.skills ?? "", challenges: version?.challenges ?? "", remarks: version?.approvals[0]?.remarks ?? null }];
    });
  }

  const errors: Record<string, string> = { "no-placement": "Your placement must be approved before submitting reports." };
  return (
    <Shell role={role} name={user.name}>
      <PageHeader eyebrow="OJT journal" title={role === Role.STUDENT ? "Daily reports" : "Report history"} description={role === Role.STUDENT ? "Submit one report for each day you attend. Signed reports cannot be changed." : "All reports from students assigned to you."} actions={role === Role.SUPERVISOR ? <Link className="button button-primary" href="/supervisor/signing">Open review queue</Link> : undefined} />
      {query.error && <Notice tone="error">{errors[query.error] ?? "The action could not be completed."}</Notice>}
      {query.success && <Notice tone="success" title="Report submitted">Your supervisor has been notified in their review queue.</Notice>}

      {role === Role.STUDENT && (
        !student ? <Notice tone="warn" title="Profile needed">Complete your <Link href="/profile">student profile</Link> first.</Notice>
        : !placementApproved ? <Notice tone="warn" title="Placement not approved">You can submit reports once your <Link href="/placement">placement</Link> is approved.</Notice>
        : options.length ? <Panel title="Write a report"><ReportForm options={options} /></Panel>
        : <Panel title="Write a report"><EmptyState title="Nothing to report right now" action={<Link className="button button-secondary" href="/attendance">Go to attendance</Link>}>Every attended day already has a report. Time in on your next working day to write another.</EmptyState></Panel>
      )}

      <Panel title={role === Role.STUDENT ? "My reports" : "Reports"} actions={<span className="muted">{total} total</span>}>
        {reports.length ? reports.map((report) => {
          const version = report.versions[0];
          const remark = version?.approvals[0]?.remarks;
          return (
            <article key={report.id} className="report">
              <div className="report-head">
                <h3 style={{ margin: 0 }}>{role === Role.SUPERVISOR ? `${report.student.user.name} · ` : ""}Day {report.day}{report.reportDate ? ` · ${formatCalendarDate(report.reportDate)}` : ""}</h3>
                <StatusBadge status={report.status} />
              </div>
              <Progress status={report.status} />
              {version && <>
                <p className="small" style={{ marginTop: 8 }}>Version {version.version} · submitted {formatDateTime(version.submittedAt)}</p>
                {remark && <div className="remark"><b>Supervisor remarks:</b> {remark}</div>}
                <h3>Activities</h3><p className="report-body">{version.activities}</p>
                <div className="form-grid"><div><h3>Skills</h3><p className="report-body">{version.skills}</p></div><div><h3>Challenges</h3><p className="report-body">{version.challenges}</p></div></div>
              </>}
            </article>
          );
        }) : <EmptyState icon={NotebookPen} title="No reports yet">{role === Role.STUDENT ? "Your submitted reports will appear here." : "Reports from your assigned students will appear here."}</EmptyState>}
      </Panel>
      <Pagination page={page} total={total} size={20} href={(next) => withQuery("/documentation", query, { page: next })} />
    </Shell>
  );
}
