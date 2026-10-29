import Link from "next/link";

export default function NotFound() {
  return (
    <main className="center-page">
      <div className="stack" style={{ justifyItems: "center", maxWidth: 480 }}>
        <div className="eyebrow">404</div>
        <h1 style={{ color: "var(--color-heading)" }}>Page not found</h1>
        <p className="muted">The page you are looking for does not exist or has moved.</p>
        <Link className="button button-primary" href="/">Go to dashboard</Link>
      </div>
    </main>
  );
}
