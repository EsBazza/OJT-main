import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma";
import { createSupabaseServer } from "./supabase";
import { prisma } from "./prisma";

async function loadProfile() {
  const supabase = await createSupabaseServer();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return { authUser: null, profile: null };
  const profile = await prisma.userProfile.findUnique({
    where: { authUserId: authUser.id },
    include: { student: true, supervisor: { include: { company: true } } },
  });
  return { authUser, profile };
}

// One lookup per request, shared by layouts, pages, and actions.
const sessionProfile = cache(loadProfile);

// For route handlers: returns null instead of redirecting.
export async function getSessionProfile() {
  const { profile } = await sessionProfile();
  return profile?.active ? profile : null;
}

export async function requireRole(allowed: Role[]) {
  const { authUser, profile } = await sessionProfile();
  if (!authUser) redirect("/login");
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
