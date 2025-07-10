import { IPdfProvider } from './base';
import { LibraryItem } from '../../db';

/**
 * DirectUrlProvider fetches PDFs from direct URL links
 * Requires URL to be present and end with .pdf
 */
export class DirectUrlProvider implements IPdfProvider {
  name = 'direct-url';

  async fetch(item: LibraryItem): Promise<Blob | null> {
    // Check if URL is available and ends with .pdf
    if (!item.url || !item.url.toLowerCase().endsWith('.pdf')) {
      return null;
    }

    try {
      // Download the PDF directly
      const response = await fetch(item.url);
      
      if (!response.ok) {
        return null;
      }

      // Verify content type (if provided by server)
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('application/pdf')) {
        return null;
      }

      return await response.blob();
      
    } catch (error) {
      console.error(`DirectUrlProvider error for URL ${item.url}:`, error);
      return null;
    }
  }
}