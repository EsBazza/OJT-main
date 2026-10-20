import Link from "next/link";
import { signOut } from "@/app/actions";
import type { Role } from "@/generated/prisma";

const links = [
  { name: "Dashboard", href: "/", roles: ["STUDENT", "SUPERVISOR", "COORDINATOR"] },
  { name: "My profile", href: "/profile", roles: ["STUDENT"] },
  { name: "Company placement", href: "/placement", roles: ["STUDENT"] },
  { name: "Fingerprint attendance", href: "/attendance", roles: ["STUDENT"] },
  { name: "Attendance history", href: "/attendance/history", roles: ["STUDENT", "COORDINATOR"] },
  { name: "Daily documentation", href: "/documentation", roles: ["STUDENT", "SUPERVISOR"] },
  { name: "Review & signing", href: "/supervisor/signing", roles: ["SUPERVISOR"] },
  { name: "Company approvals", href: "/companies", roles: ["COORDINATOR"] },
  { name: "Signature verification", href: "/verification", roles: ["COORDINATOR"] },
  { name: "Reports", href: "/reports", roles: ["COORDINATOR"] },
  { name: "Audit logs", href: "/audit", roles: ["COORDINATOR"] },
  { name: "User & roles", href: "/users", roles: ["COORDINATOR"] },
];

export function Shell({ role, name, active, children }: { role: Role; name: string; active: string; children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="site-header">
        <Link className="brand" href="/"><span className="brand-mark">O</span>OJT Monitor</Link>
        <nav className="site-nav" aria-label="Main navigation">
          {links.filter((link) => link.roles.includes(role)).map((link) => (
            <Link key={link.href} className={link.name === active ? "active" : ""} href={link.href}>{link.name}</Link>
          ))}
        </nav>
        <div className="header-account">
          <div className="top-user">
            <div className="avatar">{name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
            <div><b>{name}</b><div className="small">{role.toLowerCase()}</div></div>
          </div>
          <form action={signOut}><button className="signout-button">Sign out</button></form>
        </div>
      </header>
      <main className="main">
        <div className="content">{children}</div>
      </main>
    </div>
  );
}

export function Card({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="card"><div className="card-label">{label}</div><div className="card-value">{value}</div><div className="card-note">{note}</div></div>;
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel"><h2>{title}</h2>{children}</section>;
}

export function Badge({ children, tone = "blue" }: { children: React.ReactNode; tone?: "green" | "amber" | "red" | "blue" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
