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

// Dexie Database Class
export class MyDatabase extends Dexie {
  // Tables
  library!: Table<LibraryItem, string>;
  literatureTrees!: Table<LiteratureTree, string>;

  constructor() {
    super('literatureDB');
    
    // Define schemas
    this.version(1).stores({
      library: '++id, title, *authors, year, source, publication, zoteroKey, createdAt', // Multi-index for search
      literatureTrees: '++id, name, createdAt' // id auto-increment, name indexed
    });
  }
}

// Export singleton instance
export const db = new MyDatabase();

// Export constants and types
export * from './constants';