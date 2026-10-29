import type { Metadata } from "next";
import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { PlacementStatus, Role } from "@/generated/prisma";
import { Badge, DefinitionGrid, EmptyState, PageHeader, Panel, Shell } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";
import { DecisionForm } from "./decision-form";

export const metadata: Metadata = { title: "Placements" };

export default async function Companies() {
  const { role, user } = await requireRole([Role.COORDINATOR]);
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
            <div style={{ marginTop: 16 }}>
              <DecisionForm placementId={placement.id} student={placement.student.user.name} company={placement.company.name} supervisors={options.map((assignment) => ({ id: assignment.userId, label: `${assignment.user.name}${assignment.canSign ? " · can sign" : " · review only"}` }))} />
            </div>
          </Panel>
        );
      }) : <Panel><EmptyState icon={BadgeCheck} title="No pending requests">New placement requests from students will appear here.</EmptyState></Panel>}
    </Shell>
  );
}
