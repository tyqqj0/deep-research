import { LibraryItem } from '../../db';

/**
 * Interface for PDF Provider strategies
 * Each provider implements a different strategy for fetching PDF documents
 */
export interface IPdfProvider {
  /** Unique name of the strategy (e.g. 'unpaywall', 'direct-url') */
  name: string;
  
  /** 
   * Attempts to fetch a PDF for the given library item
   * @param item - The library item to fetch PDF for
   * @returns Promise resolving to PDF Blob if successful, null if failed
   */
  fetch(item: LibraryItem): Promise<Blob | null>;
}