-- All application writes go through trusted server code (Prisma). Browser clients holding the
-- public Supabase key must not be able to insert or change workflow rows through the REST API.
DROP POLICY IF EXISTS students_update_self ON public.students;
DROP POLICY IF EXISTS placements_student_submit ON public.ojt_placements;
DROP POLICY IF EXISTS docs_student_create ON public.daily_documentations;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;

-- Prisma's migration history is internal and must not be readable through the REST API.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public._prisma_migrations FROM anon, authenticated';
  END IF;
END $$;

-- Placement work schedule, used to mark late time-ins.
ALTER TABLE public.ojt_placements
  ADD COLUMN "shift_start" TEXT NOT NULL DEFAULT '08:00',
  ADD COLUMN "grace_minutes" INTEGER NOT NULL DEFAULT 15;

-- Daily reports are tied to an attended calendar date. Existing rows keep a null date.
ALTER TABLE public.daily_documentations
  ADD COLUMN "report_date" DATE;
CREATE UNIQUE INDEX "daily_documentations_student_id_report_date_key"
  ON public.daily_documentations("student_id", "report_date");

-- Keep profile emails in step with Supabase Auth when a user changes their address.
CREATE OR REPLACE FUNCTION public.ojt_sync_user_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email IS NOT NULL THEN
    UPDATE public.user_profiles SET email = NEW.email WHERE auth_user_id = NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ojt_auth_user_email_changed ON auth.users;
CREATE TRIGGER ojt_auth_user_email_changed
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.ojt_sync_user_email();
