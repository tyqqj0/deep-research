// src-refactored/domains/literature/entities/Citation.ts
import { z } from 'zod';

export const CitationSchema = z.object({
  id: z.string().uuid(), // Using UUID for consistency
  sourceItemId: z.string().uuid('Invalid UUID format for source item'),
  targetItemId: z.string().uuid('Invalid UUID format for target item'),
  createdAt: z.date().default(() => new Date())
});

export type Citation = z.infer<typeof CitationSchema>;
