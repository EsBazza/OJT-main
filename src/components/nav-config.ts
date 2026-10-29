import type { Role } from "@/generated/prisma";

export type IconName = "home" | "user" | "building" | "clock" | "history" | "file" | "pen" | "check" | "shield" | "chart" | "list" | "users" | "trend" | "bell";

export type NavItem = { name: string; href: string; icon: IconName; roles: Role[]; primary?: Role[] };

// `primary` items fill the mobile bottom bar (max four); the rest go under "More".
export const navItems: NavItem[] = [
  { name: "Dashboard", href: "/", icon: "home", roles: ["STUDENT", "SUPERVISOR", "COORDINATOR"], primary: ["STUDENT", "SUPERVISOR", "COORDINATOR"] },
  { name: "Attendance", href: "/attendance", icon: "clock", roles: ["STUDENT"], primary: ["STUDENT"] },
  { name: "Daily reports", href: "/documentation", icon: "file", roles: ["STUDENT"], primary: ["STUDENT"] },
  { name: "Review & sign", href: "/supervisor/signing", icon: "pen", roles: ["SUPERVISOR"], primary: ["SUPERVISOR"] },
  { name: "Report history", href: "/documentation", icon: "file", roles: ["SUPERVISOR"], primary: ["SUPERVISOR"] },
  { name: "Placements", href: "/companies", icon: "check", roles: ["COORDINATOR"], primary: ["COORDINATOR"] },
  { name: "Attendance", href: "/reports", icon: "chart", roles: ["COORDINATOR"], primary: ["COORDINATOR"] },
  { name: "Users & companies", href: "/users", icon: "users", roles: ["COORDINATOR"], primary: ["COORDINATOR"] },
  { name: "Attendance history", href: "/attendance/history", icon: "history", roles: ["STUDENT"] },
  { name: "Placement", href: "/placement", icon: "building", roles: ["STUDENT"] },
  { name: "My profile", href: "/profile", icon: "user", roles: ["STUDENT"], primary: ["STUDENT"] },
  { name: "Analytics", href: "/analytics", icon: "trend", roles: ["COORDINATOR"] },
  { name: "Verify signatures", href: "/verification", icon: "shield", roles: ["COORDINATOR"] },
  { name: "Audit log", href: "/audit", icon: "list", roles: ["COORDINATOR"] },
  { name: "Notifications", href: "/notifications", icon: "bell", roles: ["STUDENT", "SUPERVISOR", "COORDINATOR"] },
];

export function navFor(role: Role) {
  const items = navItems.filter((item) => item.roles.includes(role));
  return { items, primary: items.filter((item) => item.primary?.includes(role)).slice(0, 4), more: items.filter((item) => !item.primary?.includes(role)) };
}
