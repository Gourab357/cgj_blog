-- CMS additions that are used only by the trusted application server.
CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE,
  public_url text NOT NULL UNIQUE,
  alt_text text,
  content_type text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 5242880),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_assets_created_at_idx ON public.media_assets(created_at DESC);
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.replace_post_tags(p_post_id uuid, p_tag_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_count integer := cardinality(coalesce(p_tag_ids, '{}'::uuid[]));
  existing_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.posts WHERE id = p_post_id) THEN
    RAISE EXCEPTION 'Post does not exist';
  END IF;

  IF requested_count <> cardinality(ARRAY(SELECT DISTINCT unnest(coalesce(p_tag_ids, '{}'::uuid[])))) THEN
    RAISE EXCEPTION 'Tag ids must be unique';
  END IF;

  SELECT count(*) INTO existing_count FROM public.tags WHERE id = ANY(coalesce(p_tag_ids, '{}'::uuid[]));
  IF existing_count <> requested_count THEN
    RAISE EXCEPTION 'One or more tags do not exist';
  END IF;

  DELETE FROM public.post_tags WHERE post_id = p_post_id;
  INSERT INTO public.post_tags (post_id, tag_id)
  SELECT p_post_id, tag_id FROM unnest(coalesce(p_tag_ids, '{}'::uuid[])) AS tag_id;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_post_tags(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_post_tags(uuid, uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_set_updated_at ON public.posts;
CREATE TRIGGER posts_set_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
