import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma";
import { createSupabaseServer } from "./supabase";
import { prisma } from "./prisma";

export async function requireRole(allowed: Role[]) {
  const supabase = await createSupabaseServer();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const profile = await prisma.userProfile.findUnique({
    where: { authUserId: authUser.id },
    include: { student: true, supervisor: { include: { company: true } } },
  });

  if (!profile || !profile.active) redirect("/login?error=profile");
  if (!allowed.includes(profile.role)) redirect("/?error=permission");

  return {
    role: profile.role,
    user: { id: profile.id, name: profile.name, email: profile.email, role: profile.role },
    profile,
    student: profile.student,
    supervisor: profile.supervisor,
  };
}
