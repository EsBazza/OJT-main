import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Inbox, Info, LogOut, ShieldCheck, XCircle, type LucideIcon } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import type { Role } from "@/generated/prisma";
import { initials, statusLabel, type Tone } from "@/lib/format";
import { pageCount } from "@/lib/pagination";
import { BottomNav, SideNav } from "./nav";
import { navFor } from "./nav-config";
import { ThemeToggle } from "./theme-toggle";

const roleNames: Record<Role, string> = { STUDENT: "Student", SUPERVISOR: "Supervisor", COORDINATOR: "Coordinator" };

function Brand() {
  return <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">O</span><span>OJT Monitor</span></Link>;
}

function Account({ name, role }: { name: string; role: Role }) {
  return (
    <div className="account">
      <div className="avatar" aria-hidden="true">{initials(name)}</div>
      <div className="account-text"><b>{name}</b><span>{roleNames[role]}</span></div>
      <ThemeToggle />
      <form action={signOut}><button className="icon-button" aria-label="Sign out" title="Sign out"><LogOut aria-hidden="true" size={18} /></button></form>
    </div>
  );
}

export function Shell({ role, name, children }: { role: Role; name: string; active?: string; children: React.ReactNode }) {
  const nav = navFor(role);
  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className="sidebar">
        <Brand />
        <SideNav items={nav.items} />
        <Account name={name} role={role} />
      </aside>
      <header className="topbar">
        <Brand />
        <Account name={name} role={role} />
      </header>
      <main id="main" className="main" tabIndex={-1}>{children}</main>
      <BottomNav primary={nav.primary} more={nav.more} />
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, note, tone, icon: Icon }: { label: string; value: React.ReactNode; note?: React.ReactNode; tone?: Tone; icon?: LucideIcon }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ""}`}>
      <div className="stat-top"><div className="stat-label">{label}</div>{Icon && <span className="stat-icon"><Icon aria-hidden="true" size={18} /></span>}</div>
      <div className="stat-value">{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}

// Circular progress that draws to its value when the page appears.
export function ProgressRing({ value, max, label }: { value: number; max: number; label: string }) {
  const radius = 70;
  const length = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className="ring" role="img" aria-label={`${label}: ${Math.round(ratio * 100)}%`}>
      <svg viewBox="0 0 168 168" aria-hidden="true">
        <defs><linearGradient id="ring-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#4da3ff" /><stop offset="100%" stopColor="#f5b700" /></linearGradient></defs>
        <circle className="ring-track" cx="84" cy="84" r={radius} />
        <circle className="ring-value" cx="84" cy="84" r={radius} strokeDasharray={length} strokeDashoffset={length * (1 - ratio)} style={{ "--ring-length": length } as React.CSSProperties} />
      </svg>
      <div className="ring-label" aria-hidden="true"><b>{Math.round(ratio * 100)}%</b><span>{label}</span></div>
    </div>
  );
}

// Confirmation that draws a check mark (time-in/out) or stamps a seal (signing).
export function SuccessMark({ title, children, variant = "check" }: { title: string; children?: React.ReactNode; variant?: "check" | "seal" }) {
  return (
    <div className="success-mark" role="status">
      {variant === "seal"
        ? <span className="seal" aria-hidden="true"><ShieldCheck size={36} /></span>
        : <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><circle className="success-circle" cx="32" cy="32" r="30" /><path className="success-check" d="M20 33 l8 8 l16 -18" /></svg>}
      <b>{title}</b>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

export function Stats({ children }: { children: React.ReactNode }) {
  return <div className="stats">{children}</div>;
}

// Kept for pages that still use the older name.
export const Card = Stat;

export function Panel({ title, actions, children, id }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section className="panel" id={id} aria-labelledby={title && id ? `${id}-title` : undefined}>
      {(title || actions) && <div className="panel-head">{title && <h2 id={id ? `${id}-title` : undefined}>{title}</h2>}{actions}</div>}
      {children}
    </section>
  );
}

export function Badge({ children, tone = "blue" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const { label, tone } = statusLabel(status);
  return <Badge tone={tone}>{label}</Badge>;
}

const noticeIcons = { info: Info, success: CheckCircle2, warn: AlertTriangle, error: XCircle };

export function Notice({ tone = "info", title, children }: { tone?: "info" | "success" | "warn" | "error"; title?: string; children: React.ReactNode }) {
  const Icon = noticeIcons[tone];
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon aria-hidden="true" size={20} />
      <div>{title && <b>{title}</b>}<div>{children}</div></div>
    </div>
  );
}

export function EmptyState({ title, children, action, icon: Icon = Inbox }: { title: string; children?: React.ReactNode; action?: React.ReactNode; icon?: LucideIcon }) {
  return <div className="empty"><span className="empty-icon" aria-hidden="true"><Icon size={28} strokeWidth={1.6} /></span><b>{title}</b>{children && <p className="muted">{children}</p>}{action}</div>;
}

// On narrow screens each row becomes a card; data-label supplies the column name.
export function Table({ headers, rows, caption }: { headers: string[]; rows: React.ReactNode[][]; caption?: string }) {
  return (
    <div className="table-wrap">
      <table className="table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead><tr>{headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column} data-label={headers[column]}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function DefinitionGrid({ items }: { items: [string, React.ReactNode][] }) {
  return <dl className="definitions">{items.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>;
}

export function Pagination({ page, total, size, href }: { page: number; total: number; size?: number; href: (page: number) => string }) {
  const pages = pageCount(total, size);
  if (total === 0) return null;
  const from = (page - 1) * (size ?? 25) + 1;
  const to = Math.min(total, page * (size ?? 25));
  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="muted">Showing {from}–{to} of {total}</span>
      <div className="pagination-links">
        {page > 1 ? <Link className="button button-ghost" href={href(page - 1)}><ChevronLeft aria-hidden="true" size={18} />Previous</Link> : <span className="button button-ghost" aria-disabled="true"><ChevronLeft aria-hidden="true" size={18} />Previous</span>}
        <span className="muted">Page {page} of {pages}</span>
        {page < pages ? <Link className="button button-ghost" href={href(page + 1)}>Next<ChevronRight aria-hidden="true" size={18} /></Link> : <span className="button button-ghost" aria-disabled="true">Next<ChevronRight aria-hidden="true" size={18} /></span>}
      </div>
    </nav>
  );
}

// Builds a URL that keeps the current filters and changes one value.
export function withQuery(path: string, query: Record<string, string | undefined>, changes: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...changes })) if (value !== undefined && value !== "" && key !== "success" && key !== "error") params.set(key, String(value));
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}
