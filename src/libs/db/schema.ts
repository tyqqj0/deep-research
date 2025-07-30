import { z } from 'zod';
import { LITERATURE_SOURCES } from './constants';

// 🚀 新的后端任务响应结构定义
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
  result_type: z.enum(['created', 'duplicate']).nullable(), // 🎯 允许 null 值，在任务完成前为 null
  literature_id: z.string().nullable(),
  literature_status: LiteratureStatusSchema.nullable(),
  status: z.string(),
  overall_progress: z.number().min(0).max(100),
  current_stage: z.string().nullable(),
  resource_url: z.string().nullable(),
  error_info: z.object({}).nullable(),
  // 🔗 URL验证相关字段
  url_validation_status: z.enum(['success', 'failed']).nullable().optional(),
  url_validation_error: z.string().nullable().optional(),
  original_url: z.string().nullable().optional()
});

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
  publication: z.string().nullable().optional(),
  abstract: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  zoteroKey: z.string().nullable().optional(),
  doi: z.string().nullable().optional(),
  url: z.string().url().nullable().optional(),
  pdfPath: z.string().nullable().optional(),
  topics: z.array(z.string()).optional(), // 🏷️ 话题/关键词标签

  // 🚀 解析内容字段 - 存储从后端解析的引文数据
  parsedContent: z.object({
    extractedText: z.string().nullable().optional(),
    extractedReferences: z.array(z.any()).optional(), // 从PDF解析出的引文列表
    // 可以在未来扩展其他解析内容，如摘要、关键词等
  }).optional(),

  // 🚀 新的后端集成字段 - 单一数据源
  backendTask: BackendTaskSchema.optional(), // 后端任务的完整状态信息
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

// 🚀 新的后端任务相关类型
export type BackendTask = z.infer<typeof BackendTaskSchema>;
export type LiteratureStatus = z.infer<typeof LiteratureStatusSchema>;
export type ComponentStatus = z.infer<typeof ComponentStatusSchema>;