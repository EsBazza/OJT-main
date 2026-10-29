"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeHref } from "@/lib/url";
import { getSessionProfile } from "@/lib/page-auth";
import { prisma } from "@/lib/prisma";

export async function openNotification(form: FormData) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) redirect("/notifications");
  // Scoped to the signed-in user, so one user cannot read or clear another's notifications.
  const notification = await prisma.notification.findFirst({ where: { id: id.data, userId: profile.id } });
  if (!notification) redirect("/notifications");
  if (!notification.readAt) await prisma.notification.update({ where: { id: notification.id }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
  redirect(safeHref(notification.href) ?? "/notifications");
}

export async function markAllNotificationsRead() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  await prisma.notification.updateMany({ where: { userId: profile.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
  redirect("/notifications");
}
