import { z } from 'zod';

// Zod Schema for LibraryItem
export const LibraryItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Title is required'),
  authors: z.array(z.string()).min(1, 'At least one author is required'),
  year: z.number().int().min(1000).max(new Date().getFullYear() + 10),
  publication: z.string().min(1, 'Publication is required'),
  zoteroKey: z.string().optional(),
  createdAt: z.date()
});

// Zod Schema for MCTSNode
export const MCTSNodeSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  libraryItemId: z.string().uuid(),
  visits: z.number().int().min(0),
  wins: z.number()
});

// Zod Schema for LiteratureTree
export const LiteratureTreeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  rootNodeId: z.string().uuid(),
  nodes: z.record(z.string().uuid(), MCTSNodeSchema),
  createdAt: z.date()
});

// Export types derived from schemas
export type LibraryItem = z.infer<typeof LibraryItemSchema>;
export type MCTSNode = z.infer<typeof MCTSNodeSchema>;
export type LiteratureTree = z.infer<typeof LiteratureTreeSchema>;