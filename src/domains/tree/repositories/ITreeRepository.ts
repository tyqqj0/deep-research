// @/domains/tree/repositories/ITreeRepository.ts

import { ResearchTree, ResearchTreeData } from '../entities/ResearchTree';

/**
 * Tree Repository Interface
 * 
 * Defines the contract for all tree data persistence operations.
 * This follows the same pattern as ILiteratureRepository, providing
 * complete separation between domain logic and data storage.
 */
export interface ITreeRepository {
  // Tree CRUD operations
  getAllTrees(): Promise<ResearchTreeData[]>;
  getTreeById(id: string): Promise<ResearchTreeData | null>;
  createTree(tree: ResearchTreeData): Promise<string>;
  updateTree(tree: ResearchTreeData): Promise<void>;
  deleteTree(id: string): Promise<void>;

  // Tree statistics
  getTreeCount(): Promise<number>;
  getTreesByCreationDate(startDate: Date, endDate?: Date): Promise<ResearchTreeData[]>;
}

// Symbol for dependency injection
export const ITreeRepository = Symbol('ITreeRepository');