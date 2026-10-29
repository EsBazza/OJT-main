import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { attendanceDisplayStatus, isDateString, manilaDateString } from "../src/lib/format";
import { canonical, digest, sameKey, trustedSigningKey, verifyDocument, type VerifiableDocument } from "../src/lib/signing";

const server = generateKeyPairSync("ed25519");
const attacker = generateKeyPairSync("ed25519");
const pem = (key: typeof server.publicKey) => key.export({ type: "spki", format: "pem" }).toString();

process.env.SIGNING_PRIVATE_KEY_PEM = server.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
delete process.env.SIGNING_PUBLIC_KEY_PEM;
process.env.SIGNING_KEY_ID = "server-key";

function forgedDocument(): VerifiableDocument {
  const base = { id: "v1", studentId: "s1", day: 1, version: 1, activities: "Tampered activities text", skills: "x", challenges: "y", company: "Co", submittedAt: "2026-10-29T00:00:00.000Z", approvedBy: "Sup", approvedAt: "2026-10-29T01:00:00.000Z" };
  const payload = canonical(base);
  return { ...base, signedAt: "2026-10-29T02:00:00.000Z", signer: "Sup", approvedForCompany: true, keyId: "server-key", digest: digest(payload), signature: sign(null, Buffer.from(payload), attacker.privateKey).toString("base64") };
}

test("trusted key is derived from server configuration", () => {
  const trusted = trustedSigningKey();
  assert.ok(trusted);
  assert.equal(trusted.keyId, "server-key");
  assert.ok(sameKey(trusted.publicKeyPem, pem(server.publicKey)));
});

test("a signature made with an attacker key is not trusted even if its own key is stored beside it", () => {
  const trusted = trustedSigningKey()!;
  const storedAttackerKey = pem(attacker.publicKey);
  // The route only passes the stored key through when it matches the server's trusted key.
  const publicKeyPem = sameKey(storedAttackerKey, trusted.publicKeyPem) ? trusted.publicKeyPem : "";
  const result = verifyDocument(forgedDocument(), { publicKeyPem, keyId: trusted.keyId, authorizedSigner: true });
  assert.equal(result.result, "SIGNING KEY NOT TRUSTED");
});

test("an attacker signature fails even when checked against the trusted key", () => {
  const trusted = trustedSigningKey()!;
  assert.equal(verifyDocument(forgedDocument(), { ...trusted, authorizedSigner: true }).result, "INVALID SIGNATURE");
});

test("sameKey treats malformed keys as different", () => assert.equal(sameKey("not a key", pem(server.publicKey)), false));

test("date strings must be real calendar dates", () => {
  assert.equal(isDateString("2026-02-28"), true);
  assert.equal(isDateString("2026-02-30"), false);
  assert.equal(isDateString("2026-2-3"), false);
  assert.equal(isDateString(undefined), false);
});

test("Manila date rolls over at Manila midnight", () => {
  assert.equal(manilaDateString(new Date("2026-10-28T15:59:00Z")), "2026-10-28");
  assert.equal(manilaDateString(new Date("2026-10-28T16:00:00Z")), "2026-10-29");
});

test("open time-ins from earlier days show as missed time-outs", () => {
  const today = new Date("2026-10-29T00:00:00Z");
  const timeIn = new Date("2026-10-28T00:00:00Z");
  assert.equal(attendanceDisplayStatus({ date: new Date("2026-10-28T00:00:00Z"), status: "PRESENT", timeIn, timeOut: null }, today), "INCOMPLETE");
  assert.equal(attendanceDisplayStatus({ date: today, status: "PRESENT", timeIn, timeOut: null }, today), "IN_PROGRESS");
  assert.equal(attendanceDisplayStatus({ date: today, status: "LATE", timeIn, timeOut: new Date() }, today), "LATE");
});
