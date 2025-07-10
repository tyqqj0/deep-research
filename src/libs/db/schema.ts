import { z } from 'zod';
import { LITERATURE_SOURCES } from './constants';

// Define and export ParsingStatus enum
export const ParsingStatusEnum = [
  'IDLE',
  'PENDING_PDF_FETCH',
  'PENDING_PARSE', // Legacy, can be removed later
  'AWAITING_MANUAL_UPLOAD',
  'PENDING_MINERU_SUBMISSION',
  'PARSING_IN_MINERU',
  'SUCCESS',
  'PARTIAL_SUCCESS',
  'FAILED',
  'PARSING_FAILED'
] as const;

// Zod Schema for LibraryItem
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
  publication: z.string().optional(),
  abstract: z.string().optional(),
  summary: z.string().optional(),
  zoteroKey: z.string().optional(),
  doi: z.string().optional(),
  url: z.string().url().optional(),
  pdfPath: z.string().optional(),
  mineruTaskId: z.string().optional(),
  parsingStatus: z.enum(ParsingStatusEnum).default('IDLE'),
  parsingProgress: z.object({
    extractedPages: z.number().int().min(0).optional(),
    totalPages: z.number().int().min(0).optional(),
    startTime: z.string().optional()
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date().optional()
});

// Zod Schema for MCTSNode
export const MCTSNodeSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
  parentId: z.string().uuid('Invalid UUID format').nullable(),
  libraryItemId: z.string().uuid('Invalid UUID format'),
  visits: z.number().int().min(0),
  wins: z.number()
});

// Zod Schema for LiteratureTree
export const LiteratureTreeSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
  name: z.string().min(1, 'Name is required'),
  rootNodeId: z.string().uuid('Invalid UUID format'),
  nodes: z.record(z.string().uuid(), MCTSNodeSchema),
  createdAt: z.date()
});

// Zod Schema for Citation
export const CitationSchema = z.object({
  id: z.number().int().positive().optional(), // Auto-increment ID
  sourceItemId: z.string().uuid('Invalid UUID format'),
  targetItemId: z.string().uuid('Invalid UUID format'),
  createdAt: z.date().default(() => new Date())
});

// Export types derived from schemas
export type LibraryItem = z.infer<typeof LibraryItemSchema>;
export type MCTSNode = z.infer<typeof MCTSNodeSchema>;
export type LiteratureTree = z.infer<typeof LiteratureTreeSchema>;
export type Citation = z.infer<typeof CitationSchema>;