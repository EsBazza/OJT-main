import { cache } from "react";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "./prisma";

export type NotificationInput = { type: string; title: string; body?: string | null; href?: string };

// Creates one notification per recipient inside the caller's transaction, so it commits with the action.
export async function notify(tx: Prisma.TransactionClient, userIds: (string | null | undefined)[], input: NotificationInput) {
  const recipients = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (!recipients.length) return;
  await tx.notification.createMany({ data: recipients.map((userId) => ({ userId, type: input.type, title: input.title.slice(0, 200), body: input.body?.slice(0, 500) ?? null, href: input.href })) });
}

export const unreadCount = cache(async (userId: string) => prisma.notification.count({ where: { userId, readAt: null } }));
