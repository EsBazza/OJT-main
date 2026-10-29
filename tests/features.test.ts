import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyCounts, hoursBy, lateRateBy, monthGrid, niceMax, parseMonth, shiftMonth } from "../src/lib/analytics";
import { csvField, toCsv } from "../src/lib/csv";
import { canViewReport } from "../src/lib/policy";
import { safeHref } from "../src/lib/url";

const day = (date: string) => new Date(`${date}T00:00:00Z`);
const at = (iso: string) => new Date(iso);

test("report downloads are limited to the student, their supervisor, and coordinators", () => {
  const report = { studentUserId: "student-1", assignedSupervisorId: "sup-1" };
  assert.equal(canViewReport({ ...report, role: "STUDENT", actorId: "student-1" }), true);
  assert.equal(canViewReport({ ...report, role: "STUDENT", actorId: "student-2" }), false);
  assert.equal(canViewReport({ ...report, role: "SUPERVISOR", actorId: "sup-1" }), true);
  assert.equal(canViewReport({ ...report, role: "SUPERVISOR", actorId: "sup-2" }), false);
  assert.equal(canViewReport({ ...report, role: "COORDINATOR", actorId: "anyone" }), true);
});

test("CSV fields are quoted and spreadsheet formulas are neutralized", () => {
  assert.equal(csvField('Say "hi"'), '"Say ""hi"""');
  assert.equal(csvField("=HYPERLINK(\"x\")"), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvField("+1"), '"\'+1"');
  assert.equal(csvField(null), '""');
  assert.ok(toCsv(["a"], [["b"]]).startsWith("﻿\"a\"\r\n\"b\""));
});

test("notification links must stay on this site", () => {
  assert.equal(safeHref("/documentation"), "/documentation");
  assert.equal(safeHref("//evil.example"), null);
  assert.equal(safeHref("https://evil.example"), null);
  assert.equal(safeHref("/\\evil.example"), null);
  assert.equal(safeHref(null), null);
});

test("daily counts cover every day and bucket each status", () => {
  const today = day("2026-10-30");
  const rows = [
    { date: day("2026-10-30"), status: "PRESENT", timeIn: at("2026-10-30T00:00:00Z"), timeOut: null },
    { date: day("2026-10-29"), status: "LATE", timeIn: at("2026-10-29T01:00:00Z"), timeOut: at("2026-10-29T09:00:00Z") },
    { date: day("2026-10-28"), status: "PRESENT", timeIn: at("2026-10-28T00:00:00Z"), timeOut: null },
    { date: day("2026-10-01"), status: "PRESENT", timeIn: at("2026-10-01T00:00:00Z"), timeOut: at("2026-10-01T08:00:00Z") },
  ];
  const counts = dailyCounts(rows, today, 3);
  assert.deepEqual(counts.map((entry) => entry.date), ["2026-10-28", "2026-10-29", "2026-10-30"]);
  assert.deepEqual(counts[0], { date: "2026-10-28", present: 0, late: 0, missed: 1 });
  assert.deepEqual(counts[1], { date: "2026-10-29", present: 0, late: 1, missed: 0 });
  assert.deepEqual(counts[2], { date: "2026-10-30", present: 1, late: 0, missed: 0 });
});

test("late rate and hours aggregate per group and sort", () => {
  const base = { date: day("2026-10-29"), timeIn: at("2026-10-29T00:00:00Z"), timeOut: at("2026-10-29T08:00:00Z") };
  const rates = lateRateBy([{ ...base, status: "LATE", group: "A" }, { ...base, status: "PRESENT", group: "A" }, { ...base, status: "PRESENT", group: "B" }, { ...base, status: "LATE", group: null }]);
  assert.deepEqual(rates.map((row) => [row.label, row.rate]), [["A", 0.5], ["B", 0]]);
  const hours = hoursBy([{ ...base, status: "PRESENT", group: "X" }, { ...base, status: "PRESENT", group: "X" }, { ...base, status: "PRESENT", group: "Y" }]);
  assert.deepEqual(hours, [{ label: "X", hours: 16 }, { label: "Y", hours: 8 }]);
});

test("axis maximum rounds up to a readable number", () => {
  assert.equal(niceMax(3), 4);
  assert.equal(niceMax(7), 8);
  assert.equal(niceMax(23), 40);
  assert.ok(niceMax(130) >= 130);
});

test("month grid starts on Sunday and covers the whole month", () => {
  const weeks = monthGrid(2026, 10, "2026-10-30");
  assert.equal(weeks[0][0].date, "2026-09-27");
  assert.equal(weeks[0][4].date, "2026-10-01");
  assert.ok(weeks.every((week) => week.length === 7));
  const days = weeks.flat().filter((cell) => cell.inMonth);
  assert.equal(days.length, 31);
  assert.equal(days.find((cell) => cell.isToday)?.date, "2026-10-30");
  assert.equal(days.find((cell) => cell.date === "2026-10-31")?.future, true);
});

test("month navigation parses and wraps across years", () => {
  assert.deepEqual(parseMonth("2026-02", "2026-10-30"), { year: 2026, month: 2 });
  assert.deepEqual(parseMonth("2026-13", "2026-10-30"), { year: 2026, month: 10 });
  assert.equal(shiftMonth(2026, 1, -1), "2025-12");
  assert.equal(shiftMonth(2026, 12, 1), "2027-01");
});

test("students can withdraw only their own latest report before review", async () => {
  const { canWithdraw } = await import("../src/lib/policy");
  const base = { actorId: "student-1", studentUserId: "student-1", documentStatus: "SUBMITTED", latestVersionId: "v2", versionId: "v2", hasDecision: false };
  assert.equal(canWithdraw(base), true);
  assert.equal(canWithdraw({ ...base, actorId: "student-2" }), false);
  assert.equal(canWithdraw({ ...base, documentStatus: "APPROVED" }), false);
  assert.equal(canWithdraw({ ...base, versionId: "v1" }), false);
  assert.equal(canWithdraw({ ...base, hasDecision: true }), false);
});
