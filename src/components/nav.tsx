"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { BadgeCheck, Building2, ChartColumn, Clock, FileText, History, House, ListChecks, MoreHorizontal, PenLine, ShieldCheck, User, Users } from "lucide-react";
import type { IconName, NavItem } from "./nav-config";

const icons: Record<IconName, typeof House> = {
  home: House, user: User, building: Building2, clock: Clock, history: History, file: FileText,
  pen: PenLine, check: BadgeCheck, shield: ShieldCheck, chart: ChartColumn, list: ListChecks, users: Users,
};

// Every page is its own nav entry, so an exact match is enough.
function isActive(pathname: string, href: string) {
  return pathname === href;
}

function NavLink({ item, pathname, className }: { item: NavItem; pathname: string; className: string }) {
  const Icon = icons[item.icon];
  const active = isActive(pathname, item.href);
  return (
    <Link href={item.href} className={className} aria-current={active ? "page" : undefined}>
      <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
      <span>{item.name}</span>
    </Link>
  );
}

export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="side-nav" aria-label="Main navigation">
      {items.map((item) => <NavLink key={`${item.href}-${item.name}`} item={item} pathname={pathname} className="side-link" />)}
    </nav>
  );
}

export function BottomNav({ primary, more }: { primary: NavItem[]; more: NavItem[] }) {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  // Close the "More" sheet after navigating.
  useEffect(() => { if (menu.current) menu.current.open = false; }, [pathname]);
  const moreActive = more.some((item) => isActive(pathname, item.href));
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {primary.map((item) => <NavLink key={`${item.href}-${item.name}`} item={item} pathname={pathname} className="bottom-link" />)}
      {more.length > 0 && (
        <details className="more-menu" ref={menu}>
          <summary className="bottom-link" aria-current={moreActive ? "page" : undefined}>
            <MoreHorizontal aria-hidden="true" size={20} strokeWidth={1.8} />
            <span>More</span>
          </summary>
          <div className="more-sheet">
            {more.map((item) => <NavLink key={`${item.href}-${item.name}`} item={item} pathname={pathname} className="side-link" />)}
          </div>
        </details>
      )}
    </nav>
  );
}
