// @/infrastructure/database/dexie/schema.ts

import { LibraryItem, Citation } from '@/domains/literature/entities';
import { ResearchTreeData } from '@/domains/tree/entities';
import { WorkspaceData } from '@/domains/workspace/entities';

/**
 * Re-exporting domain entities for use in Dexie table definitions.
 * This keeps our database schema aligned with our domain models.
 */
export type {
  LibraryItem,
  Citation,
  ResearchTreeData,
  WorkspaceData,
};
