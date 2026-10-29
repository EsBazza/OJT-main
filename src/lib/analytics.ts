import { attendanceDisplayStatus, dateFromString, dateToString, hoursBetween } from "./format";

type Row = { date: Date; status: string; timeIn: Date | null; timeOut: Date | null };

export type DayCounts = { date: string; present: number; late: number; missed: number };

// Classifies a record as present, late, or a missed time-out for charts.
export function attendanceBucket(row: Row, today: Date): "present" | "late" | "missed" {
  if (attendanceDisplayStatus(row, today) === "INCOMPLETE") return "missed";
  return row.status === "LATE" ? "late" : "present";
}

// One entry per calendar day ending at `end`, including days with no records.
export function dailyCounts(rows: Row[], end: Date, days: number, today = end): DayCounts[] {
  const byDate = new Map<string, DayCounts>();
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = dateToString(new Date(end.getTime() - offset * 86_400_000));
    byDate.set(date, { date, present: 0, late: 0, missed: 0 });
  }
  for (const row of rows) {
    const entry = byDate.get(dateToString(row.date));
    if (entry && row.timeIn) entry[attendanceBucket(row, today)] += 1;
  }
  return [...byDate.values()];
}

export type RateRow = { label: string; late: number; total: number; rate: number };

export function lateRateBy(rows: (Row & { group: string | null })[], limit = 10): RateRow[] {
  const groups = new Map<string, { late: number; total: number }>();
  for (const row of rows) {
    if (!row.group || !row.timeIn) continue;
    const entry = groups.get(row.group) ?? { late: 0, total: 0 };
    entry.total += 1;
    if (row.status === "LATE") entry.late += 1;
    groups.set(row.group, entry);
  }
  return [...groups.entries()].map(([label, value]) => ({ label, ...value, rate: value.total ? value.late / value.total : 0 }))
    .sort((a, b) => b.rate - a.rate || b.total - a.total || a.label.localeCompare(b.label)).slice(0, limit);
}

export type HoursRow = { label: string; hours: number };

export function hoursBy(rows: (Row & { group: string })[]): HoursRow[] {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.group, (totals.get(row.group) ?? 0) + hoursBetween(row.timeIn, row.timeOut));
  return [...totals.entries()].map(([label, hours]) => ({ label, hours })).sort((a, b) => b.hours - a.hours || a.label.localeCompare(b.label));
}

// A rounded maximum for an axis, so gridlines land on whole numbers.
export function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => value <= candidate * 4) ?? magnitude * 10;
  return step * 4;
}

export type CalendarCell = { date: string; day: number; inMonth: boolean; isToday: boolean; future: boolean };

// Weeks (Sunday first) covering the month; cells outside the month pad the first and last week.
export function monthGrid(year: number, month: number, today: string): CalendarCell[][] {
  const first = dateFromString(`${year}-${String(month).padStart(2, "0")}-01`);
  const start = new Date(first.getTime() - first.getUTCDay() * 86_400_000);
  const weeks: CalendarCell[][] = [];
  let cursor = start;
  do {
    const week: CalendarCell[] = [];
    for (let index = 0; index < 7; index++) {
      const date = dateToString(cursor);
      week.push({ date, day: cursor.getUTCDate(), inMonth: cursor.getUTCMonth() === month - 1, isToday: date === today, future: date > today });
      cursor = new Date(cursor.getTime() + 86_400_000);
    }
    weeks.push(week);
  } while (cursor.getUTCMonth() === month - 1);
  return weeks;
}

export function parseMonth(value: string | undefined, fallback: string): { year: number; month: number } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value ?? "");
  const [year, month] = match ? [Number(match[1]), Number(match[2])] : fallback.split("-").slice(0, 2).map(Number);
  return { year, month };
}

export function shiftMonth(year: number, month: number, delta: number): string {
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}
