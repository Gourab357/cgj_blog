/*
# Create CGJ editorial platform schema

The application, not Supabase Authentication, owns administrator sessions. Google
proves a person's identity; `admin_members` is the database allowlist that grants
editorial access. All private database and Storage writes are made by the trusted
application server with its service-role key. Browser clients receive no database
credentials and have no direct mutation policies.
*/

CREATE TABLE IF NOT EXISTS public.admin_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  google_subject text,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, role text, bio text,
  profile_image_url text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text NOT NULL UNIQUE,
  description text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, slug text NOT NULL UNIQUE,
  excerpt text, content text NOT NULL DEFAULT '', cover_image_url text, cover_image_alt text,
  author_id uuid REFERENCES public.authors(id) ON DELETE SET NULL, category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')), featured boolean NOT NULL DEFAULT false,
  published_at timestamptz, seo_title text, seo_description text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.post_tags (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE, tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, slug text NOT NULL UNIQUE, event_date date NOT NULL,
  location text, description text NOT NULL DEFAULT '', cover_image_url text, gallery_urls text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, slug text NOT NULL UNIQUE, description text NOT NULL DEFAULT '',
  cover_image_url text, file_url text, publication_date date, status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY, value jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_members_email_lower_idx ON public.admin_members (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS admin_members_google_subject_idx ON public.admin_members (google_subject) WHERE google_subject IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_sessions_token_hash_idx ON public.app_sessions(token_hash);
CREATE INDEX IF NOT EXISTS app_sessions_expires_at_idx ON public.app_sessions(expires_at);
CREATE INDEX IF NOT EXISTS oauth_transactions_expires_at_idx ON public.oauth_transactions(expires_at);
CREATE INDEX IF NOT EXISTS posts_status_published_at_idx ON public.posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS posts_category_id_idx ON public.posts(category_id);
CREATE INDEX IF NOT EXISTS posts_author_id_idx ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS events_status_event_date_idx ON public.events(status, event_date DESC);
CREATE INDEX IF NOT EXISTS publications_status_date_idx ON public.publications(status, publication_date DESC);

-- A row without google_subject is a deliberate one-time email bootstrap. The
-- application binds it to the verified Google subject on its first successful sign-in.
INSERT INTO public.admin_members (email, display_name) VALUES
  ('cgj@nusrlranchi.ac.in', 'CGJ administrator'),
  ('ankisha.vandana@nusrlranchi.ac.in', 'Ankisha Vandana')
ON CONFLICT DO NOTHING;

ALTER TABLE public.admin_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- The anonymous database role can read only the public catalogue. There are
-- intentionally no browser-side write policies: all editorial writes pass through
-- server endpoints that first verify the application session and allowlist.
CREATE POLICY "public_read_authors" ON public.authors FOR SELECT TO anon USING (true);
CREATE POLICY "public_read_categories" ON public.categories FOR SELECT TO anon USING (true);
CREATE POLICY "public_read_tags" ON public.tags FOR SELECT TO anon USING (true);
CREATE POLICY "public_read_published_posts" ON public.posts FOR SELECT TO anon USING (status = 'published' AND published_at IS NOT NULL AND published_at <= now());
CREATE POLICY "public_read_post_tags" ON public.post_tags FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_tags.post_id AND posts.status = 'published' AND posts.published_at IS NOT NULL AND posts.published_at <= now()));
CREATE POLICY "public_read_published_events" ON public.events FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "public_read_published_publications" ON public.publications FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "public_read_site_settings" ON public.site_settings FOR SELECT TO anon USING (true);
