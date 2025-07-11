import { LibraryItem } from '../../db';

/**
 * Interface for PDF Provider strategies
 * Each provider implements a different strategy for fetching PDF documents
 */
export interface IPdfProvider {
  /** Unique name of the strategy (e.g. 'unpaywall', 'direct-url') */
  name: string;

  /** Priority of this provider (lower number = higher priority) */
  priority: number;

  /** 
   * Checks if this provider can handle the given library item
   * @param item - The library item to check
   * @returns true if this provider can handle the item
   */
  canHandle(item: LibraryItem): boolean;

  /** 
   * Attempts to fetch a PDF for the given library item
   * @param item - The library item to fetch PDF for
   * @returns Promise resolving to PDF Blob if successful, null if failed
   */
  fetchPdf(item: LibraryItem): Promise<Blob | null>;
}