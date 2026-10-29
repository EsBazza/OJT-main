// Pure authorization and workflow rules. Server actions load the records and call these, so the
// rules can be tested without a database.

export type Decision = { ok: true } | { ok: false; reason: "permission" | "stale" | "signing-key" };

const allow: Decision = { ok: true };
const deny = (reason: "permission" | "stale" | "signing-key"): Decision => ({ ok: false, reason });

type Assignment = { companyId: string; active: boolean; canSign: boolean; keyId: string | null; publicKeyPem: string | null } | null;
type Placement = { companyId: string; supervisorId: string | null; status: string } | null;
type VersionState = { id: string; immutable: boolean; signed: boolean; submittedAt: Date | null };

export type ReviewInput = {
  actorId: string;
  assignment: Assignment;
  placement: Placement;
  version: VersionState;
  latestVersionId: string | null;
  documentStatus: string;
};

// A supervisor may only act on the latest version of a report from a student assigned to them.
export function canReview(input: ReviewInput): Decision {
  const { actorId, assignment, placement, version } = input;
  if (!assignment?.active || !placement || placement.status !== "APPROVED") return deny("permission");
  if (placement.companyId !== assignment.companyId || placement.supervisorId !== actorId) return deny("permission");
  if (version.immutable || version.signed) return deny("permission");
  if (input.latestVersionId !== version.id || input.documentStatus !== "SUBMITTED") return deny("stale");
  return allow;
}

export type SignInput = Omit<ReviewInput, "documentStatus"> & {
  documentStatus: string;
  approvedByActor: boolean;
  trustedKey: { keyId: string; publicKeyPem: string } | null;
  keysMatch: (a: string, b: string) => boolean;
};

export function canSign(input: SignInput): Decision {
  const { actorId, assignment, placement, version } = input;
  if (!assignment?.active || !assignment.canSign || !placement || placement.status !== "APPROVED") return deny("permission");
  if (placement.companyId !== assignment.companyId || placement.supervisorId !== actorId) return deny("permission");
  if (version.immutable || version.signed || !version.submittedAt || !input.approvedByActor) return deny("permission");
  if (input.latestVersionId !== version.id || input.documentStatus !== "APPROVED") return deny("stale");
  const trusted = input.trustedKey;
  if (!trusted || !assignment.keyId || !assignment.publicKeyPem || assignment.keyId !== trusted.keyId || !input.keysMatch(assignment.publicKeyPem, trusted.publicKeyPem)) return deny("signing-key");
  return allow;
}

export function isValidShift(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

// Minutes after midnight in Asia/Manila for the given instant.
export function manilaMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function attendanceStatusFor(timeIn: Date, shiftStart: string, graceMinutes: number): "PRESENT" | "LATE" {
  if (!isValidShift(shiftStart)) return "PRESENT";
  const [hour, minute] = shiftStart.split(":").map(Number);
  return manilaMinutes(timeIn) > hour * 60 + minute + Math.max(0, graceMinutes) ? "LATE" : "PRESENT";
}

// The OJT day number is the position of the date among the student's attended dates.
export function reportDayNumber(attendedDates: string[], date: string): number | null {
  const sorted = [...new Set(attendedDates)].sort();
  const index = sorted.indexOf(date);
  return index === -1 ? null : index + 1;
}

export type ProvisionInput = {
  actorId: string;
  target: { id: string; role: string; active: boolean } | null;
  targetHasStudentActivity: boolean;
  currentCompanyId: string | null;
  newCompanyId: string;
  assignedActivePlacements: number;
};

export type ProvisionDecision = { ok: true } | { ok: false; reason: "provision" | "student-activity" | "has-students" };

export function canProvisionSupervisor(input: ProvisionInput): ProvisionDecision {
  const { target } = input;
  if (!target || !target.active || target.role === "COORDINATOR" || target.id === input.actorId) return { ok: false, reason: "provision" };
  if (target.role === "STUDENT" && input.targetHasStudentActivity) return { ok: false, reason: "student-activity" };
  if (input.currentCompanyId && input.currentCompanyId !== input.newCompanyId && input.assignedActivePlacements > 0) return { ok: false, reason: "has-students" };
  return { ok: true };
}

export type AccountChangeInput = {
  actorId: string;
  target: { id: string; role: string } | null;
  assignedActivePlacements: number;
  change: "deactivate" | "activate" | "remove-supervisor";
};

export function canChangeAccount(input: AccountChangeInput): { ok: true } | { ok: false; reason: "account" | "has-students" } {
  const { target } = input;
  if (!target || target.id === input.actorId || target.role === "COORDINATOR") return { ok: false, reason: "account" };
  if (input.change === "remove-supervisor" && target.role !== "SUPERVISOR") return { ok: false, reason: "account" };
  if (input.change !== "activate" && target.role === "SUPERVISOR" && input.assignedActivePlacements > 0) return { ok: false, reason: "has-students" };
  return { ok: true };
}

// Who may download a report: its student, the supervisor assigned to that student, or a coordinator.
export function canViewReport(input: { role: string; actorId: string; studentUserId: string; assignedSupervisorId: string | null }): boolean {
  if (input.role === "COORDINATOR") return true;
  if (input.role === "STUDENT") return input.studentUserId === input.actorId;
  if (input.role === "SUPERVISOR") return input.assignedSupervisorId === input.actorId;
  return false;
}
