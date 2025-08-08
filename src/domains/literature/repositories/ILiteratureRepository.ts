// src-refactored/domains/literature/repositories/ILiteratureRepository.ts

import { LibraryItem, Citation } from '../entities';

/**
 * Interface for the Literature Repository.
 * This defines the contract for data access operations related to the literature domain.
 * It is completely decoupled from the underlying database technology (e.g., Dexie).
 */
export interface ILiteratureRepository {
  getAllItems(): Promise<LibraryItem[]>;
  getItemById(id: string): Promise<LibraryItem | null>;
  getItemsBySource(source: string): Promise<LibraryItem[]>;
  getItemsByYearRange(startYear: number, endYear: number): Promise<LibraryItem[]>;
  getItemsByTopic(topic: string): Promise<LibraryItem[]>;
  
  findItemByDoi(doi: string): Promise<LibraryItem | null>;
  findItemByUrl(url: string): Promise<LibraryItem | null>;

  addItem(item: LibraryItem): Promise<string>;
  updateItem(id: string, updates: Partial<LibraryItem>): Promise<void>;
  deleteItem(id: string): Promise<void>;
  
  getAllCitations(): Promise<Array<{ source: string; target: string }>>;
  getCitationsBySource(sourceItemId: string): Promise<Citation[]>;
  getCitationsByTarget(targetItemId: string): Promise<Citation[]>;
  addCitation(citation: Omit<Citation, 'id' | 'createdAt'>): Promise<void>;
  deleteCitation(sourceItemId: string, targetItemId: string): Promise<void>;

  clearAll(): Promise<void>;
}

// Token for Dependency Injection
export const ILiteratureRepository = Symbol('ILiteratureRepository');
