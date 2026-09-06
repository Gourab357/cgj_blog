/*
  Upgrade already-deployed CGJ projects from Supabase-managed identity to
  Google identity plus application-managed sessions. This migration removes every
  policy and helper that relied on Supabase JWT claims. It is safe after the
  original schema migration and is a no-op for the final schema where applicable.
*/

ALTER TABLE public.admin_members ADD COLUMN IF NOT EXISTS google_subject text;

CREATE TABLE IF NOT EXISTS public.app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  google_subject text NOT NULL,
  email text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  invalidated_at timestamptz,
  last_seen_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.oauth_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash text NOT NULL UNIQUE,
  code_verifier text NOT NULL,
  nonce text NOT NULL,
  return_to text NOT NULL DEFAULT '/admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_members_google_subject_idx ON public.admin_members (google_subject) WHERE google_subject IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_sessions_token_hash_idx ON public.app_sessions(token_hash);
CREATE INDEX IF NOT EXISTS app_sessions_expires_at_idx ON public.app_sessions(expires_at);
CREATE INDEX IF NOT EXISTS oauth_transactions_expires_at_idx ON public.oauth_transactions(expires_at);

ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_admin_status" ON public.admin_members;
DROP POLICY IF EXISTS "admins_read_members" ON public.admin_members;
DROP POLICY IF EXISTS "admins_insert_members" ON public.admin_members;
DROP POLICY IF EXISTS "admins_update_members" ON public.admin_members;
DROP POLICY IF EXISTS "admins_delete_members" ON public.admin_members;

DROP POLICY IF EXISTS "admins_insert_authors" ON public.authors;
DROP POLICY IF EXISTS "admins_update_authors" ON public.authors;
DROP POLICY IF EXISTS "admins_delete_authors" ON public.authors;
DROP POLICY IF EXISTS "admins_insert_categories" ON public.categories;
DROP POLICY IF EXISTS "admins_update_categories" ON public.categories;
DROP POLICY IF EXISTS "admins_delete_categories" ON public.categories;
DROP POLICY IF EXISTS "admins_insert_tags" ON public.tags;
DROP POLICY IF EXISTS "admins_update_tags" ON public.tags;
DROP POLICY IF EXISTS "admins_delete_tags" ON public.tags;
DROP POLICY IF EXISTS "admins_read_all_posts" ON public.posts;
DROP POLICY IF EXISTS "admins_insert_posts" ON public.posts;
DROP POLICY IF EXISTS "admins_update_posts" ON public.posts;
DROP POLICY IF EXISTS "admins_delete_posts" ON public.posts;
DROP POLICY IF EXISTS "admins_insert_post_tags" ON public.post_tags;
DROP POLICY IF EXISTS "admins_update_post_tags" ON public.post_tags;
DROP POLICY IF EXISTS "admins_delete_post_tags" ON public.post_tags;
DROP POLICY IF EXISTS "admins_read_all_events" ON public.events;
DROP POLICY IF EXISTS "admins_insert_events" ON public.events;
DROP POLICY IF EXISTS "admins_update_events" ON public.events;
DROP POLICY IF EXISTS "admins_delete_events" ON public.events;
DROP POLICY IF EXISTS "admins_read_all_publications" ON public.publications;
DROP POLICY IF EXISTS "admins_insert_publications" ON public.publications;
DROP POLICY IF EXISTS "admins_update_publications" ON public.publications;
DROP POLICY IF EXISTS "admins_delete_publications" ON public.publications;
DROP POLICY IF EXISTS "admins_insert_site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "admins_update_site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "admins_delete_site_settings" ON public.site_settings;

DROP POLICY IF EXISTS "cgj_admin_upload_media" ON storage.objects;
DROP POLICY IF EXISTS "cgj_admin_update_media" ON storage.objects;
DROP POLICY IF EXISTS "cgj_admin_delete_media" ON storage.objects;

DROP POLICY IF EXISTS "public_read_authors" ON public.authors;
DROP POLICY IF EXISTS "public_read_categories" ON public.categories;
DROP POLICY IF EXISTS "public_read_tags" ON public.tags;
DROP POLICY IF EXISTS "public_read_published_posts" ON public.posts;
DROP POLICY IF EXISTS "public_read_post_tags" ON public.post_tags;
DROP POLICY IF EXISTS "public_read_published_events" ON public.events;
DROP POLICY IF EXISTS "public_read_published_publications" ON public.publications;
DROP POLICY IF EXISTS "public_read_site_settings" ON public.site_settings;

DROP FUNCTION IF EXISTS public.is_cgj_admin();

CREATE POLICY "public_read_authors" ON public.authors FOR SELECT TO anon USING (true);
CREATE POLICY "public_read_categories" ON public.categories FOR SELECT TO anon USING (true);
CREATE POLICY "public_read_tags" ON public.tags FOR SELECT TO anon USING (true);
CREATE POLICY "public_read_published_posts" ON public.posts FOR SELECT TO anon USING (status = 'published' AND published_at IS NOT NULL AND published_at <= now());
CREATE POLICY "public_read_post_tags" ON public.post_tags FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_tags.post_id AND posts.status = 'published' AND posts.published_at IS NOT NULL AND posts.published_at <= now()));
CREATE POLICY "public_read_published_events" ON public.events FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "public_read_published_publications" ON public.publications FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "public_read_site_settings" ON public.site_settings FOR SELECT TO anon USING (true);
