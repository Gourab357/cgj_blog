-- Add the second CGJ administrator bootstrap identity. On each account's first
-- verified Google sign-in, the application binds this row to its stable Google sub.
INSERT INTO public.admin_members (email, display_name, is_active) VALUES
  ('cgj@nusrlranchi.ac.in', 'CGJ administrator', true),
  ('ankisha.vandana@nusrlranchi.ac.in', 'Ankisha Vandana', true)
ON CONFLICT DO NOTHING;
