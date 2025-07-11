import Dexie, { Table } from 'dexie';
import { LiteratureSource } from './constants';

// TypeScript Interfaces
export interface LibraryItem {
  id: string; // UUID
  title: string;
  authors: string[];
  year: number;
  source?: LiteratureSource; // 来源类型
  publication?: string;
  abstract?: string;
  summary?: string;
  zoteroKey?: string;
  doi?: string;
  url?: string;
  pdfPath?: string;
  mineruTaskId?: string;
  parsingStatus?: 'IDLE' | 'PENDING_PDF_FETCH' | 'PENDING_PARSE' | 'AWAITING_MANUAL_UPLOAD' | 'PENDING_MINERU_SUBMISSION' | 'PARSING_IN_MINERU' | 'SUCCESS' | 'PENDING_REFERENCE_EXTRACTION' | 'EXTRACTING_REFERENCES' | 'PARTIAL_SUCCESS' | 'FAILED' | 'PARSING_FAILED';
  parsingProgress?: {
    extractedPages?: number;
    totalPages?: number;
    startTime?: string;
  };
  // 解析结果内容
  parsedContent?: {
    extractedText?: string; // 提取的文本内容（Markdown格式）
    extractedMetadata?: Record<string, any>; // 提取的元数据
    extractedReferences?: any[]; // 提取的引用
    parsedAt?: Date; // 解析时间
    fullZipUrl?: string; // 完整ZIP文件的URL（用于下载）
  };
  createdAt: Date;
  updatedAt?: Date; // 添加更新时间
}

export interface MCTSNode {
  id: string; // UUID
  parentId: string | null;
  libraryItemId: string; // References LibraryItem.id
  visits: number;
  wins: number; // Represents simulation "value" or "score"
}

export interface LiteratureTree {
  id: string; // UUID
  name: string;
  rootNodeId: string;
  nodes: { [nodeId: string]: MCTSNode }; // Object with nodeId as key and MCTSNode as value
  createdAt: Date;
}

export interface Citation {
  id?: number; // Auto-increment ID
  sourceItemId: string; // UUID
  targetItemId: string; // UUID
  createdAt: Date;
}

// Dexie Database Class
export class MyDatabase extends Dexie {
  // Tables
  library!: Table<LibraryItem, string>;
  literatureTrees!: Table<LiteratureTree, string>;
  citations!: Table<Citation, number>;

  constructor() {
    super('literatureDB');

    // Define schemas - Version 1
    this.version(1).stores({
      library: '++id, title, *authors, year, source, publication, zoteroKey, createdAt', // Multi-index for search
      literatureTrees: '++id, name, createdAt' // id auto-increment, name indexed
    });

    // Version 2 - Add new fields and citations table
    this.version(2).stores({
      library: '++id, title, *authors, year, source, publication, zoteroKey, doi, url, pdfPath, parsingStatus, createdAt', // Added new fields
      literatureTrees: '++id, name, createdAt',
      citations: '++id, [sourceItemId+targetItemId], sourceItemId, targetItemId' // New citations table
    }).upgrade(trans => {
      // Upgrade existing library items to have default parsingStatus
      return trans.library.toCollection().modify(item => {
        if (!item.parsingStatus) {
          item.parsingStatus = 'IDLE';
        }
      });
    });

    // Version 3 - Add mineruTaskId field
    this.version(3).stores({
      library: '++id, title, *authors, year, source, publication, zoteroKey, doi, url, pdfPath, mineruTaskId, parsingStatus, createdAt', // Added mineruTaskId
      literatureTrees: '++id, name, createdAt',
      citations: '++id, [sourceItemId+targetItemId], sourceItemId, targetItemId'
    }).upgrade(trans => {
      // Upgrade existing library items to have default parsingStatus
      return trans.library.toCollection().modify(item => {
        if (!item.parsingStatus) {
          item.parsingStatus = 'IDLE';
        }
      });
    });
  }
}

// Export singleton instance
export const db = new MyDatabase();

// Export constants and types
export * from './constants';