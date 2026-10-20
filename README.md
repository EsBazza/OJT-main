# Secure OJT and Internship Monitoring System

Academic prototype using Next.js App Router, TypeScript, Tailwind CSS, Supabase PostgreSQL/Auth, Prisma, and Node.js Ed25519/SHA-256.

## Current implementation scope

This workspace was empty. It now contains a navigable Next.js demo with role-based sample dashboards, student profile/placement/attendance/documentation pages, supervisor review and signing, coordinator verification, reports, company approvals, audit and user views. Sample pages and the attendance scan are explicitly labeled demo data/simulation. Demo records are held in process memory and reset when the server restarts; they are not a substitute for database persistence. The Prisma schema and initial SQL migration describe the intended persistent data model and database access policies.

Demo login uses an HttpOnly role cookie for an academic walkthrough. It is not Supabase authentication and is not a production security boundary. Before deployment, connect the Supabase Auth flow, provision coordinator/supervisor roles administratively, and replace demo actions with database transactions that enforce authorization on each request. The database tables have RLS enabled in the migration; review policies against your institution's final workflow before applying.

## Requirements

- Node.js 20.9 or newer and npm
- Supabase project for persistent authentication/database use

## Setup

```sh
npm install
cp .env.example .env.local
```

For the walkthrough, set `DEMO_MODE=true`. For Supabase, fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` (pooled connection), and `DIRECT_URL` (direct connection). Supabase Auth trigger creates new accounts with the Student role. Assign Coordinator and Supervisor roles only through trusted administrative SQL/tooling, and create matching Student/Company/SupervisorAssignment rows.

Generate a local Ed25519 keypair:

```sh
node scripts/generate-signing-key.mjs
```

Copy the PEM values from the ignored `.signing-keys.local` into server-only environment secrets. Never prefix signing keys with `NEXT_PUBLIC_`. Production should use a managed KMS/HSM, key rotation, key revocation records, and a controlled public-key trust registry.

Apply schema and migration:

```sh
npx prisma generate
npx prisma migrate deploy
```

Or during local schema iteration use `npx prisma migrate dev --name init`. The SQL migration includes a Supabase Auth profile trigger and starter RLS policies. Test policies with separate student, supervisor, and coordinator accounts before using real records. The `public_key_pem` is a public key; private signing keys are never a database field.

Start the app:

```sh
npm run dev
```

Open `http://localhost:3000`, then choose a demo role. Demo login is not a real authentication mechanism. HTTPS must be configured at the production hosting layer.

## Signature design

`src/lib/signing.ts` builds a fixed-order JSON representation of a document version, hashes it with SHA-256, and signs it using Node's Ed25519 implementation. The signing key is read from a server environment variable. The verification endpoint requires a coordinator demo session, reloads the exact in-memory version, recomputes the digest and checks key ID, signer authorization, and signature. Supported outcomes are VALID, DOCUMENT CHANGED, INVALID SIGNATURE, SIGNER NOT AUTHORIZED, SIGNING KEY NOT TRUSTED, and VERIFICATION ERROR. A VALID result establishes payload integrity and key trust, not a person's real-world identity.

The current demo store is not durable, and the second sample report has no cryptographic signature initially. Sign a report after reviewing it to exercise verification. In production, persist each document version and signature in one database transaction, make signed versions immutable with database constraints/privileges, store trusted public keys with signer authorization history, and write audit events transactionally.

## Tests and checks

```sh
npm test
npm run lint
npm run build
```

The signature test suite covers valid signatures, content modification, invalid signatures, and an unauthorized signer. The fingerprint page only simulates the user action; it does not read biometric hardware or store biometric data. Attendance timestamps, configurable schedules, persistent duplicate prevention, private attachment storage, full version persistence, and complete RLS-backed role workflows require backend integration before real use.
