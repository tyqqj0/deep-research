// @/domains/literature/services/IMatchingEngine.ts

import { LibraryItem } from '../entities';

export interface IMatchingEngine {
  /**
   * Finds a potential duplicate for the given literature data.
   * @param literatureData - The data to check for duplicates.
   * @returns A matching LibraryItem if a duplicate is found, otherwise null.
   */
  findDuplicate(literatureData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<LibraryItem | null>;

  /**
   * Finds a matching literature item in the library for a given reference.
   * @param reference - The reference to find a match for.
   * @param sourceItemId - The ID of the item containing the reference, to avoid self-matching.
   * @returns A matching LibraryItem if found, otherwise null.
   */
  findMatchingLiterature(reference: any, sourceItemId?: string): Promise<LibraryItem | null>;
}

// Token for Dependency Injection
export const IMatchingEngine = Symbol('IMatchingEngine');
