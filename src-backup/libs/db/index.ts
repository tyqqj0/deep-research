import Dexie, { Table } from 'dexie';
import { LiteratureSource } from './constants';

// 🚀 导入新的类型定义用于本地使用
import type {
  LibraryItem,
  MCTSNode,
  LiteratureTree,
  Citation,
  BackendTask,
  LiteratureStatus,
  ComponentStatus
} from './schema';

// 🚀 重新导出类型定义
export type {
  LibraryItem,
  MCTSNode,
  LiteratureTree,
  Citation,
  BackendTask,
  LiteratureStatus,
  ComponentStatus
};

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
      // 🗑️ 旧的升级逻辑，保持兼容性
      return Promise.resolve();
    });

    // Version 3 - Add mineruTaskId field (Legacy)
    this.version(3).stores({
      library: '++id, title, *authors, year, source, publication, zoteroKey, doi, url, pdfPath, mineruTaskId, parsingStatus, createdAt', // Added mineruTaskId
      literatureTrees: '++id, name, createdAt',
      citations: '++id, [sourceItemId+targetItemId], sourceItemId, targetItemId'
    }).upgrade(trans => {
      // 🗑️ 旧的升级逻辑，保持兼容性
      return Promise.resolve();
    });

    // Version 4 - Add backend integration fields (Legacy)
    this.version(4).stores({
      library: '++id, title, *authors, year, source, publication, zoteroKey, doi, url, pdfPath, mineruTaskId, backendTaskId, backendLiteratureId, parsingStatus, createdAt', // Added backend fields
      literatureTrees: '++id, name, createdAt',
      citations: '++id, [sourceItemId+targetItemId], sourceItemId, targetItemId'
    }).upgrade(trans => {
      // 🗑️ 旧的升级逻辑，保持兼容性
      return Promise.resolve();
    });

    // Version 5 - 🚀 新的后端集成架构 (重构版)
    this.version(5).stores({
      library: '++id, title, *authors, year, source, publication, zoteroKey, doi, url, pdfPath, createdAt', // 移除旧字段，使用新的backendTask结构
      literatureTrees: '++id, name, createdAt',
      citations: '++id, [sourceItemId+targetItemId], sourceItemId, targetItemId'
    }).upgrade(trans => {
      // 🚀 迁移到新的数据结构
      return trans.table('library').toCollection().modify((item: any) => {
        // 清理旧字段
        delete item.parsingStatus;
        delete item.parsingProgress;
        delete item.mineruTaskId;
        delete item.backendTaskId;
        delete item.backendLiteratureId;
        delete item.backendStatus;
        delete item.parsedContent;

        // 确保有必需字段
        if (!item.createdAt) {
          item.createdAt = new Date();
        }
      });
    });

    // Version 6 - 🔗 恢复引文管理功能 (引文数据支持)
    this.version(6).stores({
      library: '++id, title, *authors, year, source, publication, zoteroKey, doi, url, pdfPath, createdAt', // 保持相同的索引结构
      literatureTrees: '++id, name, createdAt',
      citations: '++id, [sourceItemId+targetItemId], sourceItemId, targetItemId'
    }).upgrade(trans => {
      // 🔗 为引文管理系统做准备，不删除任何现有数据
      // parsedContent 字段将在后端数据同步时填充
      console.log('🔗 Database upgraded to version 6 - Citation management ready');
      return Promise.resolve();
    });

    // Version 7 - 🏷️ 添加话题管理支持 (Topics Support)
    this.version(7).stores({
      library: '++id, title, *authors, year, source, publication, zoteroKey, doi, url, pdfPath, *topics, createdAt', // 添加topics多值索引
      literatureTrees: '++id, name, createdAt',
      citations: '++id, [sourceItemId+targetItemId], sourceItemId, targetItemId'
    }).upgrade(trans => {
      // 🏷️ 为话题管理功能做准备，向后兼容现有数据
      console.log('🏷️ Database upgraded to version 7 - Topics support added');
      return Promise.resolve();
    });
  }
}

// Export singleton instance
export const db = new MyDatabase();

// Export constants and types
export * from './constants';