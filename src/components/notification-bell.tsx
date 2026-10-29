import Link from "next/link";
import { Bell } from "lucide-react";
import { unreadCount } from "@/lib/notify";
import { getSessionProfile } from "@/lib/page-auth";

// Server-rendered bell; the count refreshes on every navigation and after notification actions.
export async function NotificationBell() {
  const profile = await getSessionProfile();
  if (!profile) return null;
  const count = await unreadCount(profile.id);
  const label = count ? `Notifications, ${count} unread` : "Notifications";
  return (
    <Link href="/notifications" className={`icon-button bell${count ? " has-unread" : ""}`} aria-label={label} title={label}>
      <Bell aria-hidden="true" size={18} />
      {count > 0 && <span className="bell-badge" aria-hidden="true">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}
