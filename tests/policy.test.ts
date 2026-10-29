import { test } from "node:test";
import assert from "node:assert/strict";
import { attendanceStatusFor, canChangeAccount, canProvisionSupervisor, canReview, canSign, isValidShift, reportDayNumber, type ReviewInput, type SignInput } from "../src/lib/policy";

const key = { keyId: "k1", publicKeyPem: "PEM-A" };
const sameText = (a: string, b: string) => a === b;

function review(overrides: Partial<ReviewInput> = {}): ReviewInput {
  return {
    actorId: "sup-1",
    assignment: { companyId: "co-1", active: true, canSign: true, keyId: "k1", publicKeyPem: "PEM-A" },
    placement: { companyId: "co-1", supervisorId: "sup-1", status: "APPROVED" },
    version: { id: "v2", immutable: false, signed: false, submittedAt: new Date() },
    latestVersionId: "v2",
    documentStatus: "SUBMITTED",
    ...overrides,
  };
}

function sign(overrides: Partial<SignInput> = {}): SignInput {
  return { ...review({ documentStatus: "APPROVED" }), approvedByActor: true, trustedKey: key, keysMatch: sameText, ...overrides };
}

test("assigned supervisor may review the latest submitted version", () => assert.deepEqual(canReview(review()), { ok: true }));
test("rejects review of an older version after resubmission", () => assert.deepEqual(canReview(review({ version: { id: "v1", immutable: false, signed: false, submittedAt: new Date() } })), { ok: false, reason: "stale" }));
test("rejects review by another supervisor at the same company", () => assert.deepEqual(canReview(review({ actorId: "sup-2" })), { ok: false, reason: "permission" }));
test("rejects review by a supervisor at another company", () => assert.deepEqual(canReview(review({ assignment: { companyId: "co-2", active: true, canSign: true, keyId: "k1", publicKeyPem: "PEM-A" } })), { ok: false, reason: "permission" }));
test("rejects review by an inactive supervisor assignment", () => assert.deepEqual(canReview(review({ assignment: { companyId: "co-1", active: false, canSign: true, keyId: "k1", publicKeyPem: "PEM-A" } })), { ok: false, reason: "permission" }));
test("rejects review of a report that is not awaiting review", () => assert.deepEqual(canReview(review({ documentStatus: "APPROVED" })), { ok: false, reason: "stale" }));
test("rejects review of a signed version", () => assert.deepEqual(canReview(review({ version: { id: "v2", immutable: true, signed: true, submittedAt: new Date() } })), { ok: false, reason: "permission" }));

test("approving supervisor with a trusted key may sign the latest approved version", () => assert.deepEqual(canSign(sign()), { ok: true }));
test("rejects signing an older version", () => assert.deepEqual(canSign(sign({ latestVersionId: "v3" })), { ok: false, reason: "stale" }));
test("rejects signing by a supervisor who did not approve", () => assert.deepEqual(canSign(sign({ approvedByActor: false })), { ok: false, reason: "permission" }));
test("rejects signing by another supervisor at the same company", () => assert.deepEqual(canSign(sign({ actorId: "sup-2" })), { ok: false, reason: "permission" }));
test("rejects signing without sign permission", () => assert.deepEqual(canSign(sign({ assignment: { companyId: "co-1", active: true, canSign: false, keyId: "k1", publicKeyPem: "PEM-A" } })), { ok: false, reason: "permission" }));
test("rejects signing when the supervisor key is not the trusted key", () => assert.deepEqual(canSign(sign({ assignment: { companyId: "co-1", active: true, canSign: true, keyId: "k1", publicKeyPem: "PEM-B" } })), { ok: false, reason: "signing-key" }));
test("rejects signing when no trusted key is configured", () => assert.deepEqual(canSign(sign({ trustedKey: null })), { ok: false, reason: "signing-key" }));

test("validates 24-hour shift times", () => {
  assert.equal(isValidShift("08:00"), true);
  assert.equal(isValidShift("23:59"), true);
  assert.equal(isValidShift("24:00"), false);
  assert.equal(isValidShift("8:00"), false);
});

test("marks time-in within the grace period as present and after it as late (Manila time)", () => {
  // 08:15 and 08:16 Manila are 00:15 and 00:16 UTC.
  assert.equal(attendanceStatusFor(new Date("2026-10-29T00:15:00Z"), "08:00", 15), "PRESENT");
  assert.equal(attendanceStatusFor(new Date("2026-10-29T00:16:00Z"), "08:00", 15), "LATE");
  assert.equal(attendanceStatusFor(new Date("2026-10-28T23:30:00Z"), "08:00", 0), "PRESENT");
});

test("numbers report days by attended dates", () => {
  const dates = ["2026-10-29", "2026-10-27", "2026-10-28", "2026-10-28"];
  assert.equal(reportDayNumber(dates, "2026-10-27"), 1);
  assert.equal(reportDayNumber(dates, "2026-10-29"), 3);
  assert.equal(reportDayNumber(dates, "2026-10-30"), null);
});

const provision = { actorId: "coord", target: { id: "u1", role: "STUDENT", active: true }, targetHasStudentActivity: false, currentCompanyId: null, newCompanyId: "co-1", assignedActivePlacements: 0 };
test("allows giving supervisor access to a fresh account", () => assert.deepEqual(canProvisionSupervisor(provision), { ok: true }));
test("refuses to convert a student with OJT activity", () => assert.deepEqual(canProvisionSupervisor({ ...provision, targetHasStudentActivity: true }), { ok: false, reason: "student-activity" }));
test("refuses to move a supervisor who still has students to another company", () => assert.deepEqual(canProvisionSupervisor({ ...provision, target: { id: "u1", role: "SUPERVISOR", active: true }, currentCompanyId: "co-2", assignedActivePlacements: 2 }), { ok: false, reason: "has-students" }));
test("allows changing sign permission without moving company", () => assert.deepEqual(canProvisionSupervisor({ ...provision, target: { id: "u1", role: "SUPERVISOR", active: true }, currentCompanyId: "co-1", assignedActivePlacements: 2 }), { ok: true }));
test("refuses to provision coordinators or yourself", () => {
  assert.equal(canProvisionSupervisor({ ...provision, target: { id: "u1", role: "COORDINATOR", active: true } }).ok, false);
  assert.equal(canProvisionSupervisor({ ...provision, target: { id: "coord", role: "STUDENT", active: true } }).ok, false);
});

test("account changes protect coordinators, yourself, and assigned students", () => {
  assert.equal(canChangeAccount({ actorId: "coord", target: { id: "coord", role: "COORDINATOR" }, assignedActivePlacements: 0, change: "deactivate" }).ok, false);
  assert.equal(canChangeAccount({ actorId: "coord", target: { id: "c2", role: "COORDINATOR" }, assignedActivePlacements: 0, change: "deactivate" }).ok, false);
  assert.deepEqual(canChangeAccount({ actorId: "coord", target: { id: "s1", role: "SUPERVISOR" }, assignedActivePlacements: 1, change: "remove-supervisor" }), { ok: false, reason: "has-students" });
  assert.deepEqual(canChangeAccount({ actorId: "coord", target: { id: "s1", role: "SUPERVISOR" }, assignedActivePlacements: 1, change: "activate" }), { ok: true });
  assert.deepEqual(canChangeAccount({ actorId: "coord", target: { id: "st", role: "STUDENT" }, assignedActivePlacements: 0, change: "deactivate" }), { ok: true });
});
