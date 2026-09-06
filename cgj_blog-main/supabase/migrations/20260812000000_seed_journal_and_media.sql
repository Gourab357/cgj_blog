-- Add the original journal cards to the database so they can be managed in /admin.
INSERT INTO public.posts (title, slug, excerpt, content, cover_image_url, cover_image_alt, status, featured, published_at)
VALUES
  ('Gender Justice as a Practice of Everyday Constitutionalism', 'gender-justice-everyday-constitutionalism', 'A working note on how constitutional values can move from texts and classrooms into everyday spaces.', 'Gender justice is a practice: a way of asking who is heard, who is protected, and who gets to shape the rules that govern our shared lives.\n\nJustice becomes meaningful when it can be felt in the ordinary spaces where people learn, work, travel, and belong.', 'https://images.pexels.com/photos/8199159/pexels-photo-8199159.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Students in a classroom discussion', 'published', true, now()),
  ('Making Legal Awareness More Accessible', 'making-legal-awareness-more-accessible', 'What changes when legal knowledge is shared in familiar language, with patience, context, and attention to lived realities?', 'Legal awareness is most useful when it is shared in familiar language, with patience, context, and attention to lived realities.', 'https://images.pexels.com/photos/7396373/pexels-photo-7396373.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Workshop discussion', 'published', false, now()),
  ('Questions for a More Gender-Sensitive Campus', 'questions-for-a-more-gender-sensitive-campus', 'A prompt for continued conversation about safety, participation, care, and institutional responsibility in university life.', 'A more gender-sensitive campus begins with continued conversation about safety, participation, care, and institutional responsibility.', 'https://images.pexels.com/photos/32275471/pexels-photo-32275471.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Campus gathering', 'published', false, now())
ON CONFLICT (slug) DO NOTHING;

-- The application server uploads cover images using its service-role key. This public
-- bucket serves cover-image URLs only; there are intentionally no browser upload,
-- update, or delete policies.
INSERT INTO storage.buckets (id, name, public)
VALUES ('cgj-media', 'cgj-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;
