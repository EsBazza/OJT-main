import { AlarmClock, CheckCircle2, TriangleAlert } from "lucide-react";
import { niceMax, type DayCounts, type HoursRow, type RateRow } from "@/lib/analytics";
import { Table } from "./ui";

// Status series use the fixed status palette and always appear with an icon and a label.
const series = [
  { key: "present", label: "Present", icon: CheckCircle2, className: "fill-present" },
  { key: "late", label: "Late", icon: AlarmClock, className: "fill-late" },
  { key: "missed", label: "Missed time-out", icon: TriangleAlert, className: "fill-missed" },
] as const;

const shortDate = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
const label = (date: string) => shortDate.format(new Date(`${date}T00:00:00Z`));

// Rectangle with only its top corners rounded, so bars stay anchored to the baseline.
function topRounded(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height);
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
}

export function Legend() {
  return (
    <ul className="chart-legend">
      {series.map(({ key, label: name, icon: Icon, className }) => (
        <li key={key}><svg width="12" height="12" aria-hidden="true"><rect width="12" height="12" rx="3" className={className} /></svg><Icon aria-hidden="true" size={14} />{name}</li>
      ))}
    </ul>
  );
}

export function DailyAttendanceChart({ data }: { data: DayCounts[] }) {
  const width = 720;
  const height = 240;
  const pad = { top: 12, right: 8, bottom: 28, left: 32 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(1, ...data.map((day) => day.present + day.late + day.missed)));
  const slot = plotWidth / data.length;
  const barWidth = Math.max(4, Math.min(18, slot - 6));
  const y = (value: number) => pad.top + plotHeight - (value / max) * plotHeight;
  const ticks = [0, 1, 2, 3, 4].map((step) => (max / 4) * step);

  return (
    <figure className="chart">
      <Legend />
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label={`Daily attendance for the last ${data.length} days, stacked by status. See the data table for exact values.`}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className={tick === 0 ? "chart-baseline" : "chart-grid"} />
            <text x={pad.left - 6} y={y(tick) + 4} className="chart-tick" textAnchor="end">{tick}</text>
          </g>
        ))}
        {data.map((day, index) => {
          const x = pad.left + index * slot + (slot - barWidth) / 2;
          let base = 0;
          const segments = series.map(({ key, className }) => ({ key, className, value: day[key] })).filter((segment) => segment.value > 0);
          return (
            <g key={day.date} className="chart-group">
              <title>{`${label(day.date)}: ${day.present} present, ${day.late} late, ${day.missed} missed time-out`}</title>
              <rect x={pad.left + index * slot} y={pad.top} width={slot} height={plotHeight} className="chart-hit" />
              {segments.map((segment, segmentIndex) => {
                const top = y(base + segment.value);
                const bottom = y(base);
                base += segment.value;
                // A 2px surface gap separates stacked segments.
                const gap = segmentIndex > 0 ? 2 : 0;
                const segmentHeight = Math.max(0, bottom - top - gap);
                return segmentIndex === segments.length - 1
                  ? <path key={segment.key} d={topRounded(x, top, barWidth, segmentHeight, 4)} className={segment.className} />
                  : <rect key={segment.key} x={x} y={top} width={barWidth} height={segmentHeight} className={segment.className} />;
              })}
              {(index % 5 === 0 || index === data.length - 1) && <text x={x + barWidth / 2} y={height - 8} className="chart-tick" textAnchor="middle">{label(day.date)}</text>}
            </g>
          );
        })}
      </svg>
      <details className="chart-table">
        <summary>Show data table</summary>
        <Table caption="Daily attendance" headers={["Date", "Present", "Late", "Missed time-out"]} rows={[...data].reverse().map((day) => [label(day.date), String(day.present), String(day.late), String(day.missed)])} />
      </details>
    </figure>
  );
}

// Horizontal bars for one measure; values are printed in text color beside each bar.
export function BarList({ rows, max, format, target, caption }: { rows: { label: string; value: number; detail?: string }[]; max: number; format: (value: number) => string; target?: { value: number; label: string }; caption: string }) {
  const scale = Math.max(max, target?.value ?? 0, 0.0001);
  return (
    <figure className="chart">
      {target && <div className="chart-target-key"><span className="chart-target-swatch" aria-hidden="true" />{target.label}</div>}
      <ul className="bar-list" aria-label={caption}>
        {rows.map((row) => (
          <li key={row.label} title={`${row.label}: ${format(row.value)}${row.detail ? ` (${row.detail})` : ""}`}>
            <span className="bar-label">{row.label}</span>
            <span className="bar-track" aria-hidden="true">
              <span className="bar-fill" style={{ width: `${(row.value / scale) * 100}%` }} />
              {target && <span className="bar-target" style={{ left: `${(target.value / scale) * 100}%` }} />}
            </span>
            <span className="bar-value">{format(row.value)}{row.detail && <span className="muted"> · {row.detail}</span>}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function LateRateChart({ rows }: { rows: RateRow[] }) {
  return <BarList caption="Late rate by company" rows={rows.map((row) => ({ label: row.label, value: row.rate, detail: `${row.late} of ${row.total}` }))} max={Math.max(...rows.map((row) => row.rate), 0.25)} format={(value) => `${Math.round(value * 100)}%`} />;
}

export function HoursChart({ rows, required }: { rows: HoursRow[]; required: number }) {
  return <BarList caption="Hours rendered per student" rows={rows.map((row) => ({ label: row.label, value: row.hours, detail: `${Math.round((row.hours / required) * 100)}%` }))} max={Math.max(...rows.map((row) => row.hours), 1)} format={(value) => `${value.toFixed(1)} h`} target={{ value: required, label: `Required: ${required} h` }} />;
}
