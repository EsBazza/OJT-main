-- Preserve the authorization and public-key material used when each signature was created.
ALTER TABLE public.approval_records
  ADD COLUMN "company_id_snapshot" TEXT NOT NULL DEFAULT '';

ALTER TABLE public.digital_signatures
  ADD COLUMN "public_key_pem" TEXT NOT NULL DEFAULT '';
