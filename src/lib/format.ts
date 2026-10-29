const zone = "Asia/Manila";

export function manilaDateString(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// Calendar dates are stored as UTC midnight of the Manila date.
export function manilaDate(now = new Date()): Date {
  return dateFromString(manilaDateString(now));
}

export function dateFromString(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function dateToString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function isDateString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(dateFromString(value).getTime()) && dateToString(dateFromString(value)) === value;
}

export function formatDate(value: Date | null | undefined): string {
  return value ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: zone }).format(value) : "—";
}

export function formatCalendarDate(value: Date | null | undefined, style: "medium" | "full" = "medium"): string {
  return value ? new Intl.DateTimeFormat("en-PH", { dateStyle: style, timeZone: "UTC" }).format(value) : "—";
}

export function formatTime(value: Date | null | undefined): string {
  return value ? new Intl.DateTimeFormat("en-PH", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(value) : "—";
}

export function formatDateTime(value: Date | null | undefined): string {
  return value ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: zone }).format(value) : "—";
}

export function hoursBetween(start: Date | null, end: Date | null): number {
  return start && end ? Math.max(0, (end.getTime() - start.getTime()) / 3_600_000) : 0;
}

export function formatHours(hours: number): string {
  return hours.toFixed(1);
}

export type Tone = "green" | "amber" | "red" | "blue" | "gray";

const statusLabels: Record<string, [string, Tone]> = {
  PENDING: ["Pending review", "amber"],
  APPROVED: ["Approved", "green"],
  REJECTED: ["Rejected", "red"],
  PRESENT: ["Present", "green"],
  LATE: ["Late", "amber"],
  ABSENT: ["Absent", "red"],
  INCOMPLETE: ["Missed time-out", "red"],
  IN_PROGRESS: ["Timed in", "blue"],
  DRAFT: ["Draft", "gray"],
  SUBMITTED: ["Awaiting review", "amber"],
  RETURNED: ["Returned", "red"],
  SIGNED: ["Signed", "green"],
  COORDINATOR_REVIEWED: ["Reviewed", "green"],
};

export function statusLabel(status: string): { label: string; tone: Tone } {
  const [label, tone] = statusLabels[status] ?? [status.charAt(0) + status.slice(1).toLowerCase().replaceAll("_", " "), "gray" as Tone];
  return { label, tone };
}

// An open time-in from an earlier day can no longer be closed and is shown as incomplete.
export function attendanceDisplayStatus(record: { date: Date; status: string; timeIn: Date | null; timeOut: Date | null }, today = manilaDate()): string {
  if (record.timeIn && !record.timeOut) return record.date.getTime() < today.getTime() ? "INCOMPLETE" : "IN_PROGRESS";
  return record.status;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "?";
}
