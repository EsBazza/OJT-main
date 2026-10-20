-- Keep Supabase Auth as the source of account credentials. This trusted trigger
-- adds each new student profile and student record atomically after signup.
ALTER TABLE public.approval_records
  ADD COLUMN "approved_by_name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "company_name_snapshot" TEXT NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.ojt_prevent_signed_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.immutable THEN
    RAISE EXCEPTION 'Signed document versions cannot be deleted';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.immutable THEN
    RAISE EXCEPTION 'Signed document versions cannot be changed';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ojt_signed_version_immutable
BEFORE UPDATE OR DELETE ON public.document_versions
FOR EACH ROW EXECUTE FUNCTION public.ojt_prevent_signed_version_mutation();

CREATE OR REPLACE FUNCTION public.ojt_prevent_signature_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Digital signature records are immutable';
END;
$$;

CREATE TRIGGER ojt_signature_immutable
BEFORE UPDATE OR DELETE ON public.digital_signatures
FOR EACH ROW EXECUTE FUNCTION public.ojt_prevent_signature_mutation();

CREATE OR REPLACE FUNCTION public.ojt_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id text;
  student_number text;
  student_program text;
BEGIN
  profile_id := gen_random_uuid()::text;
  student_number := nullif(trim(NEW.raw_user_meta_data->>'student_number'), '');
  student_program := nullif(trim(NEW.raw_user_meta_data->>'program'), '');
  INSERT INTO public.user_profiles(id, auth_user_id, email, name, role, active)
  VALUES (
    profile_id,
    NEW.id::text,
    NEW.email,
    coalesce(nullif(trim(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1)),
    'STUDENT',
    true
  );

  IF student_number IS NOT NULL AND student_program IS NOT NULL THEN
    INSERT INTO public.students(id, user_id, student_number, program)
    VALUES (gen_random_uuid()::text, profile_id, student_number, student_program);
  END IF;

  RETURN NEW;
END;
$$;
