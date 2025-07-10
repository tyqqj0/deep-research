import { pdfFetcherService } from './PdfFetcherService';
import { LibraryItem } from '../db';

/**
 * Example usage of the PDF Fetcher Service
 * This file demonstrates how to use the service with different providers
 */

// Example function to test the service
export async function testPdfFetcher() {
  // Test item with DOI (for Unpaywall)
  const itemWithDoi: LibraryItem = {
    id: 'test-uuid-1',
    title: 'Test Paper with DOI',
    authors: ['Test Author'],
    year: 2023,
    doi: '10.1038/nature12373', // Example DOI
    createdAt: new Date()
  };

  // Test item with direct PDF URL
  const itemWithUrl: LibraryItem = {
    id: 'test-uuid-2', 
    title: 'Test Paper with Direct URL',
    authors: ['Test Author'],
    year: 2023,
    url: 'https://example.com/paper.pdf', // Example PDF URL
    createdAt: new Date()
  };

  // Test item with no DOI or URL
  const itemWithoutSource: LibraryItem = {
    id: 'test-uuid-3',
    title: 'Test Paper without source',
    authors: ['Test Author'],
    year: 2023,
    createdAt: new Date()
  };

  console.log('Available providers:', pdfFetcherService.getAvailableProviders());

  console.log('\n=== Testing item with DOI ===');
  const result1 = await pdfFetcherService.fetch(itemWithDoi);
  console.log('Result 1:', result1 ? `PDF Blob (${result1.size} bytes)` : 'null');

  console.log('\n=== Testing item with direct URL ===');
  const result2 = await pdfFetcherService.fetch(itemWithUrl);
  console.log('Result 2:', result2 ? `PDF Blob (${result2.size} bytes)` : 'null');

  console.log('\n=== Testing item without source ===');
  const result3 = await pdfFetcherService.fetch(itemWithoutSource);
  console.log('Result 3:', result3 ? `PDF Blob (${result3.size} bytes)` : 'null');
}

// Uncomment to run the test
// testPdfFetcher().catch(console.error);