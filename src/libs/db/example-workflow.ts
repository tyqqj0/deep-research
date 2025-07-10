import { libraryService } from './LibraryService';
import { LibraryItem } from './index';

/**
 * Example demonstrating the new non-blocking workflow
 * This shows how the createFromMetadata method works
 */

export async function demonstrateNewWorkflow() {
  console.log('=== Demonstrating New Non-Blocking Workflow ===\n');

  // Example 1: Create item with DOI (should trigger Unpaywall fetch)
  console.log('1. Creating item with DOI...');
  const metadata1: Partial<LibraryItem> = {
    title: 'Example Paper with DOI',
    authors: ['John Doe', 'Jane Smith'],
    year: 2023,
    doi: '10.1038/nature12373',
    source: 'MANUAL'
  };

  const itemId1 = await libraryService.createFromMetadata(metadata1);
  console.log(`✅ Item created immediately with ID: ${itemId1}`);
  console.log('📤 Background PDF processing started (non-blocking)\n');

  // Example 2: Create item with direct PDF URL
  console.log('2. Creating item with direct PDF URL...');
  const metadata2: Partial<LibraryItem> = {
    title: 'Example Paper with PDF URL',
    authors: ['Alice Johnson'],
    year: 2024,
    url: 'https://example.com/paper.pdf',
    source: 'MANUAL'
  };

  const itemId2 = await libraryService.createFromMetadata(metadata2);
  console.log(`✅ Item created immediately with ID: ${itemId2}`);
  console.log('📤 Background PDF processing started (non-blocking)\n');

  // Example 3: Create item with no PDF source
  console.log('3. Creating item without PDF source...');
  const metadata3: Partial<LibraryItem> = {
    title: 'Example Paper without PDF source',
    authors: ['Bob Wilson'],
    year: 2024,
    abstract: 'This paper has no DOI or PDF URL',
    source: 'MANUAL'
  };

  const itemId3 = await libraryService.createFromMetadata(metadata3);
  console.log(`✅ Item created immediately with ID: ${itemId3}`);
  console.log('📤 Background processing started (will likely fail)\n');

  console.log('=== All items created instantly! ===');
  console.log('Background processing continues asynchronously...');
  console.log('Check the parsing status of these items after a few seconds.\n');

  // Demonstrate status checking after some delay
  setTimeout(async () => {
    console.log('=== Checking status after 5 seconds ===');
    try {
      const item1 = await libraryService.getLibraryItemById(itemId1);
      const item2 = await libraryService.getLibraryItemById(itemId2);
      const item3 = await libraryService.getLibraryItemById(itemId3);

      console.log(`Item 1 status: ${item1?.parsingStatus} (DOI: ${item1?.doi})`);
      console.log(`Item 2 status: ${item2?.parsingStatus} (URL: ${item2?.url})`);
      console.log(`Item 3 status: ${item3?.parsingStatus} (No source)`);
    } catch (error) {
      console.error('Error checking item status:', error);
    }
  }, 5000);

  return { itemId1, itemId2, itemId3 };
}

// Example of how to use the atomic operations directly
export async function demonstrateAtomicOperations() {
  console.log('\n=== Demonstrating Atomic Operations ===\n');

  // Create an item first
  const metadata: Partial<LibraryItem> = {
    title: 'Test Item for Atomic Operations',
    authors: ['Test Author'],
    year: 2024
  };

  const itemId = await libraryService.createFromMetadata(metadata);
  console.log(`Created item: ${itemId}`);

  // Wait a moment then demonstrate atomic operations
  setTimeout(async () => {
    try {
      // Update parsing status
      console.log('Updating parsing status...');
      await libraryService.updateParsingStatus(itemId, 'PENDING_PARSE');
      
      // Simulate linking a PDF (with dummy blob)
      console.log('Linking PDF...');
      const dummyBlob = new Blob(['fake pdf content'], { type: 'application/pdf' });
      await libraryService.linkPdfToItem(itemId, dummyBlob);
      
      // Check final status
      const finalItem = await libraryService.getLibraryItemById(itemId);
      console.log(`Final item status: ${finalItem?.parsingStatus}`);
      console.log(`PDF path: ${finalItem?.pdfPath}`);
    } catch (error) {
      console.error('Error in atomic operations:', error);
    }
  }, 1000);
}

// Uncomment to run the examples
// demonstrateNewWorkflow().catch(console.error);
// demonstrateAtomicOperations().catch(console.error);