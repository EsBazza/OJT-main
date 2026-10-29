export default function Loading() {
  return (
    <div className="main" role="status" aria-label="Loading">
      <div className="skeleton" style={{ height: 36, width: "40%", marginBottom: 24 }} />
      <div className="stats">{[0, 1, 2, 3].map((item) => <div key={item} className="skeleton" style={{ height: 104 }} />)}</div>
      <div className="skeleton" style={{ height: 280 }} />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
