# OJT Monitor

OJT Monitor is a Supabase Auth and PostgreSQL backed internship tracking application. It uses Next.js App Router, Prisma, and server-side authorization. The application does not provide simulated login or demo records.

## Local setup

Requirements: Node.js 20.9 or newer and npm.

1. Install dependencies and copy `.env.example` to `.env.local`.
2. Set the Supabase project URL and publishable key. Set `DATABASE_URL` to the Supabase session pooler URI and `DIRECT_URL` to the direct database URI (or the connection string recommended for Prisma by Supabase).
3. Set `SIGNING_PRIVATE_KEY_PEM` and `SIGNING_KEY_ID` on the server. Generate a development key pair with `node scripts/generate-signing-key.mjs`; the public key is derived for supervisor setup and snapshotted with each signature. Keep the private key out of source control and never expose it with a `NEXT_PUBLIC_` prefix.
4. Generate Prisma Client and apply pending migrations:

   ```sh
   npx prisma generate
   npm run db:migrate
   ```

5. Start the app with `npm run dev` and open `http://localhost:3000`.

The migration script reads the database URLs from `.env.local` without printing them. When `DATABASE_URL` is a Supabase session pooler URI on port 5432, it uses that pooler for migrations so schema operations work on IPv4-only networks. Check migration status with `npm run db:status`.

Do not commit `.env.local`. Rotate any database password that has been shared outside a secret manager.

## Accounts and access

Student accounts register with a unique email and student number, program, and a password of at least 10 characters containing uppercase, lowercase, a number, and a special character. Supabase Auth stores the credentials; the Auth trigger creates the student profile and student record. Additional accounts can register with distinct emails and student numbers. Email confirmation behavior is controlled in Supabase Auth settings.

All self-service sign-ups receive the Student role. To bootstrap the first coordinator, an administrator must assign that role to a verified account in the Supabase SQL Editor:

```sql
update public.user_profiles
set role = 'COORDINATOR'::"Role"
where lower(email) = lower('YOUR_VERIFIED_EMAIL');
```

Coordinators can create company records, assign registered accounts as company supervisors, set whether they may sign, and review placement requests. Coordinator access itself is not self-service.

## Persisted workflows

- Supabase email/password registration, sign-in, session validation, and sign-out.
- Student profile onboarding and updates.
- Placement requests, coordinator decisions, and company supervisor assignment.
- Server-timestamped manual web attendance with a per-student, per-day uniqueness constraint.
- Versioned daily reports, supervisor review/return, approval records, and immutable signed versions.
- Ed25519 signatures over canonical report data, SHA-256 digests, and coordinator verification against the registered supervisor public key.
- Audit events for key account and workflow actions.

## Known hardware and service integrations

Attendance is a real database record but is currently a manual web check-in. No fingerprint reader or biometric provider is connected, and manual entries are explicitly marked unverified. Secure attachment storage is not configured. Email confirmation and delivery depend on the Supabase Auth email provider settings.

The server holds one Ed25519 signing key and records the authorized supervisor who approved and signed a report. This protects signed report content and verifies it against the trusted application key; it does not prove that the supervisor personally controlled that private key. Use per-supervisor managed keys or a KMS/HSM before relying on individual non-repudiation.

## Checks

```sh
npm test
npm run lint
npm run build
```
