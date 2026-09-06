import 'server-only';

import { z } from 'zod';

export type Category = { id: string; name: string; slug: string; description: string | null };
export type Tag = { id: string; name: string; slug: string };

const identityFields = {
  name: z.string().trim().min(1, 'A name is required.').max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens.').max(80),
};

export const categoryInputSchema = z.object({
  ...identityFields,
  description: z.string().trim().max(500).transform((value) => value || null),
});

export const tagInputSchema = z.object(identityFields);
