import { IPdfProvider } from './base';
import { LibraryItem } from '../../db';

/**
 * DirectUrlProvider fetches PDFs from direct URL links
 * Requires URL to be present and end with .pdf
 */
export class DirectUrlProvider implements IPdfProvider {
  name = 'direct-url';
  priority = 3; // 中等优先级

  canHandle(item: LibraryItem): boolean {
    return Boolean(item.url);
  }

  async fetchPdf(item: LibraryItem): Promise<Blob | null> {
    // Check if URL is available and ends with .pdf
    if (!item.url || !item.url.toLowerCase().endsWith('.pdf')) {
      return null;
    }

    try {
      // 通过代理下载 PDF
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(item.url)}`;
      console.log(`[DirectUrlProvider] Fetching via proxy: ${proxyUrl}`);
      const response = await fetch(proxyUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(
          `DirectUrlProvider proxy error for URL ${item.url}:`,
          errorData?.details || response.statusText
        );
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