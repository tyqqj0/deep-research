// src-refactored/domains/literature/entities/Literature.ts
import { z } from 'zod';

// This could be moved to a shared constants file later
export const LITERATURE_SOURCES = {
  MANUAL: 'manual',
  SEARCH: 'search',
  IMPORT: 'import',
  KNOWLEDGE: 'knowledge',
  ZOTERO: 'zotero',
} as const;

// Schemas related to backend task status, can be moved to a shared types folder if used across domains
const ComponentStatusSchema = z.object({
  status: z.enum(['success', 'processing', 'failed', 'pending']),
  stage: z.string(),
  progress: z.number().min(0).max(100),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  error_info: z.object({}).nullable(),
  source: z.string().nullable(),
  attempts: z.number().min(0).max(3)
});

const LiteratureStatusSchema = z.object({
  literature_id: z.string(),
  overall_status: z.enum(['completed', 'processing', 'failed']),
  overall_progress: z.number().min(0).max(100),
  component_status: z.object({
    metadata: ComponentStatusSchema,
    content: ComponentStatusSchema,
    references: ComponentStatusSchema
  }),
  created_at: z.string(),
  updated_at: z.string()
});

const BackendTaskSchema = z.object({
  task_id: z.string(),
  execution_status: z.enum(['completed', 'processing', 'pending', 'failed']),
  result_type: z.enum(['created', 'duplicate']).nullable(),
  literature_id: z.string().nullable(),
  literature_status: LiteratureStatusSchema.nullable(),
  status: z.string(),
  overall_progress: z.number().min(0).max(100),
  current_stage: z.string().nullable(),
  resource_url: z.string().nullable(),
  error_info: z.object({}).nullable(),
  url_validation_status: z.enum(['success', 'failed']).nullable().optional(),
  url_validation_error: z.string().nullable().optional(),
  original_url: z.string().nullable().optional()
});

// Main LibraryItem Schema
export const LibraryItemSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
  title: z.string().min(1, 'Title is required'),
  authors: z.array(z.string()).min(1, 'At least one author is required'),
  year: z.number().int().min(1000).max(new Date().getFullYear() + 10),
  source: z.enum([
    LITERATURE_SOURCES.MANUAL,
    LITERATURE_SOURCES.SEARCH,
    LITERATURE_SOURCES.IMPORT,
    LITERATURE_SOURCES.KNOWLEDGE,
    LITERATURE_SOURCES.ZOTERO
  ]).optional(),
  publication: z.string().nullable().optional(),
  abstract: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  zoteroKey: z.string().nullable().optional(),
  doi: z.string().nullable().optional(),
  url: z.string().url().nullable().optional(),
  pdfPath: z.string().nullable().optional(),
  associatedSessions: z.array(z.string()).optional(),
  
  parsedContent: z.object({
    extractedText: z.string().nullable().optional(),
    extractedReferences: z.array(z.any()).optional(),
  }).optional(),
  
  backendTask: BackendTaskSchema.optional(),
  
  createdAt: z.date(),
  updatedAt: z.date().optional()
});

export type LibraryItem = z.infer<typeof LibraryItemSchema>;
export type BackendTask = z.infer<typeof BackendTaskSchema>;
