import { IPdfProvider } from './providers/base';
import { DirectUrlProvider } from './providers/DirectUrlProvider';
import { UnpaywallProvider } from './providers/UnpaywallProvider';
import { LibraryItem } from '../db';

/**
 * PDF Fetcher Service
 * Handles PDF document fetching from various sources using Strategy Pattern
 */
export class PdfFetcherService {
  private providers: IPdfProvider[];

  constructor() {
    // Initialize providers in priority order (DirectUrlProvider first)
    this.providers = [
      new DirectUrlProvider(),
      new UnpaywallProvider()
    ];
  }

  /**
   * Attempts to fetch a PDF for the given library item
   * Tries each provider in order until one succeeds
   * @param item - The library item to fetch PDF for
   * @returns Promise resolving to PDF Blob if successful, null if all providers fail
   */
  async fetch(item: LibraryItem): Promise<Blob | null> {
    for (const provider of this.providers) {
      try {
        console.log(`Trying ${provider.name} provider for item: ${item.title}`);
        
        const result = await provider.fetch(item);
        
        if (result) {
          console.log(`Successfully fetched PDF using ${provider.name} provider`);
          return result;
        }
        
        console.log(`${provider.name} provider failed for item: ${item.title}`);
      } catch (error) {
        console.error(`Error in ${provider.name} provider:`, error);
        continue;
      }
    }

    console.log(`All providers failed for item: ${item.title}`);
    return null;
  }

  /**
   * Get list of available provider names
   */
  getAvailableProviders(): string[] {
    return this.providers.map(p => p.name);
  }
}

// Export singleton instance
export const pdfFetcherService = new PdfFetcherService();