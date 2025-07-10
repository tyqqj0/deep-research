import { IPdfProvider } from './base';
import { LibraryItem } from '../../db';

interface UnpaywallResponse {
  doi: string;
  is_oa: boolean;
  best_oa_location: {
    url_for_pdf?: string;
    host_type: string;
  } | null;
}

/**
 * UnpaywallProvider fetches PDFs using the Unpaywall API
 * Requires DOI to be present in the LibraryItem
 */
export class UnpaywallProvider implements IPdfProvider {
  name = 'unpaywall';
  
  private readonly EMAIL = 'research@example.com'; // TODO: Make configurable
  private readonly BASE_URL = 'https://api.unpaywall.org/v2';

  async fetch(item: LibraryItem): Promise<Blob | null> {
    // Check if DOI is available
    if (!item.doi) {
      return null;
    }

    try {
      // Query Unpaywall API
      const response = await fetch(`${this.BASE_URL}/${item.doi}?email=${this.EMAIL}`);
      
      if (!response.ok) {
        return null;
      }

      const data: UnpaywallResponse = await response.json();
      
      // Check if there's an available PDF URL
      if (!data.best_oa_location?.url_for_pdf) {
        return null;
      }

      // Download the PDF
      const pdfResponse = await fetch(data.best_oa_location.url_for_pdf);
      
      if (!pdfResponse.ok) {
        return null;
      }

      // Verify content type
      const contentType = pdfResponse.headers.get('content-type');
      if (!contentType?.includes('application/pdf')) {
        return null;
      }

      return await pdfResponse.blob();
      
    } catch (error) {
      console.error(`UnpaywallProvider error for DOI ${item.doi}:`, error);
      return null;
    }
  }
}