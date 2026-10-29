import type { Metadata } from "next";
import { AlertTriangle, BadgeCheck, Bell, BellOff, Building2, CheckCheck, FileSignature, FileText, UserPlus, type LucideIcon } from "lucide-react";
import { Role } from "@/generated/prisma";
import { markAllNotificationsRead, openNotification } from "@/app/actions/notifications";
import { SubmitButton } from "@/components/form";
import { EmptyState, PageHeader, Pagination, Panel, Shell, withQuery } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { pageArgs, parsePage } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Notifications" };

const kinds: Record<string, { icon: LucideIcon; tone: string }> = {
  PLACEMENT_SUBMITTED: { icon: Building2, tone: "blue" },
  PLACEMENT_APPROVED: { icon: BadgeCheck, tone: "green" },
  PLACEMENT_REJECTED: { icon: AlertTriangle, tone: "red" },
  STUDENT_ASSIGNED: { icon: UserPlus, tone: "blue" },
  REPORT_SUBMITTED: { icon: FileText, tone: "blue" },
  REPORT_APPROVED: { icon: BadgeCheck, tone: "green" },
  REPORT_RETURNED: { icon: AlertTriangle, tone: "amber" },
  REPORT_SIGNED: { icon: FileSignature, tone: "green" },
};

export default async function Notifications({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { role, user } = await requireRole([Role.STUDENT, Role.SUPERVISOR, Role.COORDINATOR]);
  const query = await searchParams;
  const page = parsePage(query.page);
  const where = { userId: user.id };
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, ...pageArgs(page, 30) }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, readAt: null } }),
  ]);

  return (
    <Shell role={role} name={user.name}>
      <PageHeader eyebrow="Inbox" title="Notifications" description={unread ? `${unread} unread` : "You're all caught up."} actions={unread > 0 ? <form action={markAllNotificationsRead}><SubmitButton variant="secondary" pendingText="Marking…"><CheckCheck aria-hidden="true" size={18} />Mark all as read</SubmitButton></form> : undefined} />
      <Panel>
        {items.length ? (
          <ul className="inbox">
            {items.map((item) => {
              const kind = kinds[item.type] ?? { icon: Bell, tone: "gray" };
              const Icon = kind.icon;
              return (
                <li key={item.id}>
                  <form action={openNotification}>
                    <input type="hidden" name="id" value={item.id} />
                    <button className={`inbox-item${item.readAt ? "" : " is-unread"}`}>
                      <span className={`inbox-icon tone-${kind.tone}`} aria-hidden="true"><Icon size={18} /></span>
                      <span className="inbox-text">
                        <b>{item.title}</b>
                        {item.body && <span className="inbox-body">{item.body}</span>}
                        <span className="inbox-time">{formatDateTime(item.createdAt)}</span>
                      </span>
                      {!item.readAt && <span className="inbox-dot"><span className="sr-only">Unread</span></span>}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        ) : <EmptyState icon={BellOff} title="No notifications yet">Updates about placements and reports will appear here.</EmptyState>}
      </Panel>
      <Pagination page={page} total={total} size={30} href={(next) => withQuery("/notifications", query, { page: next })} />
    </Shell>
  );
}
