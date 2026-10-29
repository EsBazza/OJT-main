import type { Metadata } from "next";
import Link from "next/link";
import { PlacementStatus, Role } from "@/generated/prisma";
import { DefinitionGrid, Notice, PageHeader, Panel, Shell, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";
import { PlacementForm } from "./placement-form";

export const metadata: Metadata = { title: "Placement" };

export default async function Placement({ searchParams }: { searchParams: Promise<{ success?: string }> }) {
  const { role, user, student } = await requireRole([Role.STUDENT]);
  const query = await searchParams;
  const placement = student ? await prisma.ojtPlacement.findUnique({ where: { studentId: student.id }, include: { company: true } }) : null;
  const supervisor = placement?.supervisorId ? await prisma.userProfile.findUnique({ where: { id: placement.supervisorId }, select: { name: true } }) : null;
  const canSubmit = student && (!placement || placement.status === PlacementStatus.REJECTED);
  const companies = canSubmit ? await prisma.company.findMany({ where: { approved: true }, select: { name: true }, orderBy: { name: "asc" }, take: 300 }) : [];
  return (
    <Shell role={role} name={user.name}>
      <PageHeader eyebrow="Internship host" title="Company placement" description="Submit your host company and track its review." />
      {query.success && <Notice tone="success" title="Request submitted">Your coordinator will review it and assign your supervisor.</Notice>}
      {!student && <Notice tone="warn" title="Profile needed">Complete your <Link href="/profile">student profile</Link> before submitting a company.</Notice>}
      {placement && (
        <Panel title="Current placement" actions={<StatusBadge status={placement.status} />}>
          <DefinitionGrid items={[
            ["Company", placement.company.name],
            ["Address", placement.company.address ?? "Not provided"],
            ["Supervisor", supervisor?.name ?? "Assigned on approval"],
            ["Work schedule", placement.status === PlacementStatus.APPROVED ? `Starts ${placement.shiftStart} · ${placement.graceMinutes} min grace` : "Set on approval"],
            ["Submitted", formatDateTime(placement.submittedAt)],
            ["Decided", formatDateTime(placement.decidedAt)],
          ]} />
          {placement.status === PlacementStatus.REJECTED && <div style={{ marginTop: 16 }}><Notice tone="error" title="Request rejected">Submit a different company below, or ask your coordinator for details.</Notice></div>}
        </Panel>
      )}
      {canSubmit && <Panel title={placement ? "Submit a new request" : "Submit a placement request"}><PlacementForm companies={companies.map((company) => company.name)} /></Panel>}
    </Shell>
  );
}
