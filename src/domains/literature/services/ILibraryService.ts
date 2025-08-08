// src-refactored/domains/literature/services/ILibraryService.ts

import { LibraryItem, Citation } from '../entities';

/**
 * Interface for the Library Service.
 * This defines the contract for the business logic related to the literature domain.
 */
export interface ILibraryService {
  /**
   * Intelligently adds or updates a literature item, including duplicate checks.
   * @param literatureData - The data for the new or updated literature item.
   * @returns The final ID of the added or merged item.
   */
  addOrUpdateFromAPI(literatureData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;

  /**
   * Updates an existing item, performing a duplicate check if key fields are changed.
   * @param id - The ID of the item to update.
   * @param updateData - The data to update.
   */
  updateWithDuplicateCheck(id: string, updateData: Partial<LibraryItem>): Promise<void>;

  /**
   * Deletes an item and all its related citations.
   * @param id - The ID of the item to delete.
   */
  deleteLibraryItem(id: string): Promise<void>;

  /**
   * Links citations for a newly parsed item.
   * @param itemId - The ID of the item to link citations for.
   */
  linkCitationsForItem(itemId: string): Promise<void>;
  
  /**
   * Bidirectionally links a new item with the entire existing library.
   * @param newItemId - The ID of the new item.
   */
  linkNewItemBidirectionally(newItemId: string): Promise<void>;

  /**
   * Manually creates a citation link between two items.
   * @param sourceItemId - The ID of the source item.
   * @param targetItemId - The ID of the target item.
   */
  createManualCitationLink(sourceItemId: string, targetItemId: string): Promise<boolean>;

  // ... other high-level business logic methods can be added here
}

// Token for Dependency Injection
export const ILibraryService = Symbol('ILibraryService');
