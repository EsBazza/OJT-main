import type { Metadata } from "next";
import { Role } from "@/generated/prisma";
import { Notice, PageHeader, Panel, Shell } from "@/components/ui";
import { requireRole } from "@/lib/page-auth";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "My profile" };

export default async function Profile({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { role, user, student } = await requireRole([Role.STUDENT]);
  const query = await searchParams;
  return (
    <Shell role={role} name={user.name}>
      <PageHeader eyebrow="Student account" title="My profile" description="Keep your name and program up to date." />
      {query.error === "complete" && <Notice tone="warn" title="Profile needed">Complete your profile before using placement, attendance, or reports.</Notice>}
      <Panel title="Profile details">
        <ProfileForm name={user.name} email={user.email} studentNumber={student?.studentNumber ?? null} program={student?.program ?? ""} />
      </Panel>
    </Shell>
  );
}
