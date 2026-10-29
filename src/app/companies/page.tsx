import type { Metadata } from "next";
import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { PlacementStatus, Role } from "@/generated/prisma";
import { decidePlacement } from "@/app/actions/coordinator";
import { SubmitButton } from "@/components/form";
import { Badge, DefinitionGrid, EmptyState, Notice, PageHeader, Panel, Shell } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Placements" };

const errors: Record<string, string> = {
  supervisor: "Choose an active supervisor assigned to this company before approving.",
  invalid: "Check the schedule: use a 24-hour start time (for example 08:00) and a grace period of 0–120 minutes.",
  stale: "This request was already decided or changed. The list has been refreshed.",
};

export default async function Companies({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { role, user } = await requireRole([Role.COORDINATOR]);
  const query = await searchParams;
  const placements = await prisma.ojtPlacement.findMany({ where: { status: PlacementStatus.PENDING }, include: { student: { include: { user: true } }, company: true }, orderBy: { submittedAt: "asc" } });
  const companyIds = [...new Set(placements.map((placement) => placement.companyId))];
  const supervisors = await prisma.supervisorAssignment.findMany({ where: { companyId: { in: companyIds }, active: true, user: { active: true, role: Role.SUPERVISOR } }, include: { user: true } });
  const proposedAddresses = await prisma.auditLog.findMany({ where: { action: "PLACEMENT_SUBMITTED", targetId: { in: placements.map((placement) => placement.studentId) } }, orderBy: { createdAt: "desc" } });
  const addressFor = (studentId: string) => {
    const details = proposedAddresses.find((entry) => entry.targetId === studentId)?.details as { proposedAddress?: string } | null;
    return details?.proposedAddress;
  };

  return (
    <Shell role={role} name={user.name}>
      <PageHeader eyebrow="Coordinator" title="Placement requests" description="Approve each request with a supervisor and work schedule, or reject it." actions={<Link className="button button-secondary" href="/users">Manage companies & supervisors</Link>} />
      {query.error && <Notice tone="error">{errors[query.error] ?? "The request could not be processed."}</Notice>}
      {query.success && <Notice tone="success">{query.success === "rejected" ? "Placement rejected. The student can submit another company." : "Placement approved."}</Notice>}

      {placements.length ? placements.map((placement) => {
        const options = supervisors.filter((supervisor) => supervisor.companyId === placement.companyId);
        const proposed = addressFor(placement.studentId);
        return (
          <Panel key={placement.id} title={placement.company.name} actions={placement.company.approved ? <Badge tone="green">Known company</Badge> : <Badge tone="amber">New company</Badge>}>
            <DefinitionGrid items={[
              ["Student", `${placement.student.user.name} · ${placement.student.studentNumber}`],
              ["Program", placement.student.program],
              ["Company address", placement.company.address ?? "Not provided"],
              ...(proposed && proposed !== placement.company.address ? [["Address given by student", proposed] as [string, string]] : []),
              ["Submitted", formatDateTime(placement.submittedAt)],
            ]} />
            <form action={decidePlacement} style={{ marginTop: 16 }}>
              <input type="hidden" name="placementId" value={placement.id} />
              <div className="filters">
                <div className="field">
                  <label htmlFor={`supervisor-${placement.id}`}>Supervisor</label>
                  <select id={`supervisor-${placement.id}`} name="supervisorId" defaultValue="">
                    <option value="">Choose supervisor</option>
                    {options.map((assignment) => <option key={assignment.userId} value={assignment.userId}>{assignment.user.name}{assignment.canSign ? " · can sign" : " · review only"}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`shift-${placement.id}`}>Shift starts</label>
                  <input id={`shift-${placement.id}`} name="shiftStart" type="time" defaultValue="08:00" />
                </div>
                <div className="field">
                  <label htmlFor={`grace-${placement.id}`}>Grace (minutes)</label>
                  <input id={`grace-${placement.id}`} name="graceMinutes" type="number" min={0} max={120} defaultValue={15} inputMode="numeric" />
                </div>
              </div>
              {!options.length && <p className="small" style={{ marginTop: 8 }}>No supervisor is assigned to this company yet. <Link href="/users">Assign one</Link> before approving.</p>}
              <div className="actions">
                <SubmitButton name="decision" value="approve" disabled={!options.length} pendingText="Approving…">Approve</SubmitButton>
                <SubmitButton name="decision" value="reject" variant="secondary" pendingText="Rejecting…">Reject</SubmitButton>
              </div>
            </form>
          </Panel>
        );
      }) : <Panel><EmptyState icon={BadgeCheck} title="No pending requests">New placement requests from students will appear here.</EmptyState></Panel>}
    </Shell>
  );
}
