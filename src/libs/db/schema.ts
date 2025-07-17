import { z } from 'zod';
import { LITERATURE_SOURCES } from './constants';

// Define and export ParsingStatus enum - 简化后端集成版本
export const ParsingStatusEnum = [
  'IDLE',                    // 空闲状态
  'PENDING',                 // 等待后端处理
  'PROCESSING',              // 后端处理中
  'SUCCESS',                 // 处理成功
  'PARTIAL_SUCCESS',         // 部分成功
  'FAILED',                  // 处理失败

  // 🔄 保留的Zotero和手动上传状态
  'AWAITING_MANUAL_UPLOAD',  // 等待手动上传PDF
  'PENDING_PDF_FETCH',       // 等待PDF抓取（主要用于Zotero）

  // 🗑️ 以下状态将在后续版本中移除（向后兼容）
  'PENDING_PARSE',           // Legacy
  'PENDING_MINERU_SUBMISSION', // Legacy
  'PARSING_IN_MINERU',       // Legacy
  'PENDING_METADATA_EXTRACTION', // Legacy
  'PENDING_REFERENCE_EXTRACTION', // Legacy
  'EXTRACTING_REFERENCES',   // Legacy
  'PARSING_FAILED'           // Legacy
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

  // 🌐 后端集成字段
  backendTaskId: z.string().optional(),        // 后端任务ID
  backendLiteratureId: z.string().optional(),  // 后端文献ID
  backendStatus: z.object({
    overall_status: z.enum(['processing', 'success', 'partial_success', 'failed']),
    components: z.object({
      metadata: z.object({
        status: z.enum(['pending', 'processing', 'success', 'failed', 'waiting']),
        stage: z.string(),
        progress: z.number().min(0).max(100),
        source: z.string().optional(),
        next_action: z.string().optional(),
        error_info: z.object({
          error_message: z.string()
        }).optional()
      }),
      content: z.object({
        status: z.enum(['pending', 'processing', 'success', 'failed', 'waiting']),
        stage: z.string(),
        progress: z.number().min(0).max(100),
        source: z.string().optional(),
        next_action: z.string().optional(),
        error_info: z.object({
          error_message: z.string()
        }).optional()
      }),
      references: z.object({
        status: z.enum(['pending', 'processing', 'success', 'failed', 'waiting']),
        stage: z.string(),
        progress: z.number().min(0).max(100),
        source: z.string().optional(),
        next_action: z.string().optional(),
        error_info: z.object({
          error_message: z.string()
        }).optional()
      })
    })
  }).optional(),

  // 🗑️ Legacy字段（向后兼容，将来会移除）
  mineruTaskId: z.string().optional(),
  parsingStatus: z.enum(ParsingStatusEnum).default('IDLE'),
  parsingProgress: z.object({
    extractedPages: z.number().int().min(0).optional(),
    totalPages: z.number().int().min(0).optional(),
    startTime: z.string().optional()
  }).optional(),
  // 解析结果内容
  parsedContent: z.object({
    extractedText: z.string().optional(), // 提取的文本内容（Markdown格式）
    extractedMetadata: z.record(z.any()).optional(), // 提取的元数据
    extractedReferences: z.array(z.any()).optional(), // 提取的引用
    parsedAt: z.date().optional(), // 解析时间
    fullZipUrl: z.string().optional() // 完整ZIP文件的URL（用于下载）
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