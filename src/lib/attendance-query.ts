import type { Prisma } from "@/generated/prisma";
import { dateFromString, isDateString } from "./format";

export type AttendanceFilters = { dateFrom?: string; dateTo?: string; studentId?: string; companyId?: string };

// Shared by the coordinator report page and the attendance exports so both show the same rows.
export function attendanceWhere(filters: AttendanceFilters): Prisma.AttendanceRecordWhereInput {
  const from = isDateString(filters.dateFrom) ? dateFromString(filters.dateFrom) : undefined;
  const to = isDateString(filters.dateTo) ? dateFromString(filters.dateTo) : undefined;
  return {
    ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(filters.studentId ? { studentId: filters.studentId } : {}),
    ...(filters.companyId ? { student: { placement: { companyId: filters.companyId } } } : {}),
  };
}

export function filtersFrom(params: URLSearchParams | Record<string, string | undefined>): AttendanceFilters {
  const get = (key: string) => (params instanceof URLSearchParams ? params.get(key) : params[key]) || undefined;
  return { dateFrom: get("dateFrom"), dateTo: get("dateTo"), studentId: get("studentId"), companyId: get("companyId") };
}
