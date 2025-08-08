// @/infrastructure/database/dexie/connection.ts

import Dexie, { Table } from 'dexie';
import type { LibraryItem, Citation, ResearchTreeData, WorkspaceData } from './schema';

/**
 * Defines the structure of our Dexie database.
 * Each property represents a table in the IndexedDB.
 */
export class MyDatabase extends Dexie {
  // Define tables
  library!: Table<LibraryItem, string>;
  citations!: Table<Citation, string>;
  literatureTrees!: Table<ResearchTreeData, string>;
  workspaces!: Table<WorkspaceData, string>; // New table for workspaces

  constructor() {
    super('DeepResearchDB'); // Renamed DB for the new architecture

    // Define the database schema.
    // This is version 1 of our new, refactored schema.
    this.version(1).stores({
      library: '++id, title, *authors, year, doi, url, *topics',
      citations: '++id, [sourceItemId+targetItemId], sourceItemId, targetItemId',
      literatureTrees: '++id, name, createdAt',
      workspaces: '++id, name, treeId, createdAt',
    });
  }
}

// Create and export a singleton instance of the database.
export const db = new MyDatabase();
