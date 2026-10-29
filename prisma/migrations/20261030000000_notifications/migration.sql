-- In-app notifications. Written only by trusted server code; users may read their own.
CREATE TABLE public.notifications (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES public.user_profiles("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "href" TEXT,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "notifications_user_id_read_at_idx" ON public.notifications("user_id", "read_at");
CREATE INDEX "notifications_user_id_created_at_idx" ON public.notifications("user_id", "created_at" DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_read_self ON public.notifications FOR SELECT
  USING ("user_id" IN (SELECT "id" FROM public.user_profiles WHERE "auth_user_id" = auth.uid()::text));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.notifications FROM anon, authenticated;
