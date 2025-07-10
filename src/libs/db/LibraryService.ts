import { db, LibraryItem, LiteratureTree } from './index';
import { LibraryItemSchema, ParsingStatusEnum } from './schema';
import { generateLibraryItemId } from '../utils/uuid';
import { pdfFetcherService } from '../fetching';
import { mineruService } from '../parsing';

type ParsingStatus = typeof ParsingStatusEnum[number];

export class LibraryService {
  private db = db;

  /**
   * Get all library items
   */
  async getAllLibraryItems(): Promise<LibraryItem[]> {
    try {
      const items = await this.db.library.orderBy('createdAt').reverse().toArray();
      return items;
    } catch (error) {
      console.error('Error getting all library items:', error);
      throw new Error('Failed to fetch library items');
    }
  }

  /**
   * Get library item by ID
   */
  async getLibraryItemById(id: string): Promise<LibraryItem | null> {
    try {
      const item = await this.db.library.get(id);
      return item || null;
    } catch (error) {
      console.error('Error getting library item by ID:', error);
      throw new Error('Failed to fetch library item');
    }
  }

  /**
   * Check for duplicate literature by title
   */
  async checkDuplicateByTitle(title: string): Promise<LibraryItem[]> {
    try {
      const duplicates = await this.db.library
        .where('title')
        .equalsIgnoreCase(title.trim())
        .toArray();
      return duplicates;
    } catch (error) {
      console.error('Error checking duplicates:', error);
      throw new Error('Failed to check duplicates');
    }
  }

  /**
   * Add new library item with duplicate check
   */
  async addLibraryItem(item: LibraryItem): Promise<{ success: boolean; duplicate?: LibraryItem[] }> {
    try {
      // Validate the item
      const validatedItem = LibraryItemSchema.parse(item);
      
      // Check for duplicates
      const duplicates = await this.checkDuplicateByTitle(validatedItem.title);
      
      if (duplicates.length > 0) {
        return {
          success: false,
          duplicate: duplicates
        };
      }
      
      // Add to database
      await this.db.library.add(validatedItem);
      return { success: true };
    } catch (error) {
      console.error('Error adding library item:', error);
      throw new Error('Failed to add library item');
    }
  }

  /**
   * Update library item
   */
  async updateLibraryItem(id: string, updates: Partial<LibraryItem>): Promise<void> {
    try {
      const existingItem = await this.getLibraryItemById(id);
      if (!existingItem) {
        throw new Error(`Library item with ID ${id} not found`);
      }

      const updatedItem: LibraryItem = {
        ...existingItem,
        ...updates,
        updatedAt: new Date()
      };

      // Validate the updated item
      const validatedItem = LibraryItemSchema.parse(updatedItem);
      
      // Update in database
      await this.db.library.update(id, validatedItem);
    } catch (error) {
      console.error('Error updating library item:', error);
      throw new Error('Failed to update library item');
    }
  }

  /**
   * Delete library item
   */
  async deleteLibraryItem(id: string): Promise<void> {
    try {
      const count = await this.db.library.where('id').equals(id).delete();
      if (count === 0) {
        throw new Error(`Library item with ID ${id} not found`);
      }
    } catch (error) {
      console.error('Error deleting library item:', error);
      throw new Error('Failed to delete library item');
    }
  }

  /**
   * Bulk delete library items
   */
  async bulkDeleteLibraryItems(ids: string[]): Promise<void> {
    try {
      await this.db.library.where('id').anyOf(ids).delete();
    } catch (error) {
      console.error('Error bulk deleting library items:', error);
      throw new Error('Failed to delete library items');
    }
  }

  /**
   * Search library items
   */
  async searchLibraryItems(query: string): Promise<LibraryItem[]> {
    try {
      const lowerQuery = query.toLowerCase();
      
      const items = await this.db.library
        .filter(item => 
          item.title.toLowerCase().includes(lowerQuery) ||
          item.authors.some(author => author.toLowerCase().includes(lowerQuery)) ||
          (item.publication && item.publication.toLowerCase().includes(lowerQuery)) ||
          (item.abstract && item.abstract.toLowerCase().includes(lowerQuery))
        )
        .toArray();
      
      return items;
    } catch (error) {
      console.error('Error searching library items:', error);
      throw new Error('Failed to search library items');
    }
  }

  /**
   * Get items by source
   */
  async getItemsBySource(source: string): Promise<LibraryItem[]> {
    try {
      const items = await this.db.library.where('source').equals(source).toArray();
      return items;
    } catch (error) {
      console.error('Error getting items by source:', error);
      throw new Error('Failed to fetch items by source');
    }
  }

  /**
   * Get items by year range
   */
  async getItemsByYearRange(startYear: number, endYear: number): Promise<LibraryItem[]> {
    try {
      const items = await this.db.library
        .where('year')
        .between(startYear, endYear, true, true)
        .toArray();
      return items;
    } catch (error) {
      console.error('Error getting items by year range:', error);
      throw new Error('Failed to fetch items by year range');
    }
  }

  /**
   * Get all literature trees
   */
  async getAllTrees(): Promise<LiteratureTree[]> {
    try {
      const trees = await this.db.literatureTrees.orderBy('createdAt').reverse().toArray();
      return trees;
    } catch (error) {
      console.error('Error getting all literature trees:', error);
      throw new Error('Failed to fetch literature trees');
    }
  }

  /**
   * Get literature tree by ID
   */
  async getTreeById(id: string): Promise<LiteratureTree | null> {
    try {
      const tree = await this.db.literatureTrees.get(id);
      return tree || null;
    } catch (error) {
      console.error('Error getting literature tree by ID:', error);
      throw new Error('Failed to fetch literature tree');
    }
  }

  /**
   * Save literature tree
   */
  async saveTree(tree: LiteratureTree): Promise<void> {
    try {
      await this.db.literatureTrees.put(tree);
    } catch (error) {
      console.error('Error saving literature tree:', error);
      throw new Error('Failed to save literature tree');
    }
  }

  /**
   * Delete literature tree
   */
  async deleteTree(id: string): Promise<void> {
    try {
      const count = await this.db.literatureTrees.where('id').equals(id).delete();
      if (count === 0) {
        throw new Error(`Literature tree with ID ${id} not found`);
      }
    } catch (error) {
      console.error('Error deleting literature tree:', error);
      throw new Error('Failed to delete literature tree');
    }
  }

  /**
   * Export library items as JSON
   */
  async exportLibraryAsJSON(): Promise<string> {
    try {
      const items = await this.getAllLibraryItems();
      return JSON.stringify(items, null, 2);
    } catch (error) {
      console.error('Error exporting library as JSON:', error);
      throw new Error('Failed to export library');
    }
  }

  /**
   * Import library items from JSON
   */
  async importLibraryFromJSON(jsonData: string): Promise<{ added: number; errors: string[] }> {
    const result = { added: 0, errors: [] as string[] };
    
    try {
      const items = JSON.parse(jsonData) as LibraryItem[];
      
      if (!Array.isArray(items)) {
        throw new Error('Invalid JSON format: expected array of items');
      }

      for (const item of items) {
        try {
          // Generate new ID to avoid conflicts
          const itemWithNewId: LibraryItem = {
            ...item,
            id: generateLibraryItemId(),
            createdAt: new Date(item.createdAt),
            updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
          };

          await this.addLibraryItem(itemWithNewId);
          result.added++;
        } catch (error) {
          result.errors.push(`Failed to import item "${item.title}": ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Import failed: ${error}`);
    }

    return result;
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    totalItems: number;
    totalTrees: number;
    itemsBySource: Record<string, number>;
    itemsByYear: Record<number, number>;
  }> {
    try {
      const [items, trees] = await Promise.all([
        this.getAllLibraryItems(),
        this.getAllTrees()
      ]);

      const itemsBySource: Record<string, number> = {};
      const itemsByYear: Record<number, number> = {};

      items.forEach(item => {
        const source = item.source || 'unknown';
        itemsBySource[source] = (itemsBySource[source] || 0) + 1;
        
        itemsByYear[item.year] = (itemsByYear[item.year] || 0) + 1;
      });

      return {
        totalItems: items.length,
        totalTrees: trees.length,
        itemsBySource,
        itemsByYear
      };
    } catch (error) {
      console.error('Error getting statistics:', error);
      throw new Error('Failed to get statistics');
    }
  }

  /**
   * Clear all data (use with caution)
   */
  async clearAllData(): Promise<void> {
    try {
      await Promise.all([
        this.db.library.clear(),
        this.db.literatureTrees.clear()
      ]);
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw new Error('Failed to clear data');
    }
  }

  /**
   * Private method to create item record with validation and duplicate check
   */
  private async _createItemRecord(metadata: Partial<LibraryItem>): Promise<string> {
    try {
      // Generate ID if not provided
      const itemId = metadata.id || generateLibraryItemId();
      
      // Create complete item with defaults
      const item: LibraryItem = {
        id: itemId,
        title: metadata.title || '',
        authors: metadata.authors || [],
        year: metadata.year || new Date().getFullYear(),
        source: metadata.source,
        publication: metadata.publication,
        abstract: metadata.abstract,
        summary: metadata.summary,
        zoteroKey: metadata.zoteroKey,
        doi: metadata.doi,
        url: metadata.url,
        pdfPath: metadata.pdfPath,
        parsingStatus: metadata.parsingStatus || 'IDLE',
        createdAt: new Date(),
        updatedAt: metadata.updatedAt
      };

      // Validate the item
      const validatedItem = LibraryItemSchema.parse(item);
      
      // Check for duplicates if title is provided
      if (validatedItem.title) {
        const duplicates = await this.checkDuplicateByTitle(validatedItem.title);
        if (duplicates.length > 0) {
          throw new Error(`Duplicate item found: ${validatedItem.title}`);
        }
      }
      
      // Add to database
      await this.db.library.add(validatedItem);
      return itemId;
    } catch (error) {
      console.error('Error creating item record:', error);
      throw new Error('Failed to create item record');
    }
  }

  /**
   * Update parsing status for an item
   */
  async updateParsingStatus(itemId: string, status: ParsingStatus): Promise<void> {
    try {
      const existingItem = await this.getLibraryItemById(itemId);
      if (!existingItem) {
        throw new Error(`Library item with ID ${itemId} not found`);
      }

      await this.db.library.update(itemId, {
        parsingStatus: status,
        updatedAt: new Date()
      });
      
      console.log(`Updated parsing status for item ${itemId} to ${status}`);
    } catch (error) {
      console.error('Error updating parsing status:', error);
      throw new Error('Failed to update parsing status');
    }
  }

  /**
   * Link PDF data to an item (stores placeholder reference)
   */
  async linkPdfToItem(itemId: string, pdfData: Blob): Promise<void> {
    try {
      const existingItem = await this.getLibraryItemById(itemId);
      if (!existingItem) {
        throw new Error(`Library item with ID ${itemId} not found`);
      }

      // For now, just store a placeholder reference
      // TODO: Implement actual Blob storage in IndexedDB
      const pdfPath = `indexeddb_blob_ref_${itemId}`;
      
      await this.db.library.update(itemId, {
        pdfPath,
        updatedAt: new Date()
      });
      
      console.log(`Linked PDF to item ${itemId}, size: ${pdfData.size} bytes`);
    } catch (error) {
      console.error('Error linking PDF to item:', error);
      throw new Error('Failed to link PDF to item');
    }
  }

  /**
   * Private method to trigger background PDF processing
   */
  private async triggerBackgroundProcessing(itemId: string): Promise<void> {
    try {
      console.log(`Starting background processing for item ${itemId}`);
      
      // Get the item from database
      const item = await this.getLibraryItemById(itemId);
      if (!item) {
        throw new Error(`Item ${itemId} not found`);
      }

      // Try to fetch PDF using the PDF fetcher service
      const pdfBlob = await pdfFetcherService.fetch(item);
      
      if (pdfBlob) {
        // Successfully got PDF - save to disk and trigger Mineru processing
        const pdfPath = await this.savePdfToDisk(itemId, pdfBlob);
        
        // Update database with PDF path and set status to pending Mineru submission
        await this.db.library.update(itemId, {
          pdfPath,
          parsingStatus: 'PENDING_MINERU_SUBMISSION',
          updatedAt: new Date()
        });
        
        console.log(`Successfully fetched PDF for item ${itemId}, starting Mineru processing`);
        
        // Trigger Mineru processing asynchronously (non-blocking)
        void this.triggerMineruProcessing(itemId, pdfBlob);
      } else {
        // Failed to get PDF - set status to awaiting manual upload
        await this.updateParsingStatus(itemId, 'AWAITING_MANUAL_UPLOAD');
        console.log(`PDF fetch failed for item ${itemId}, awaiting manual upload`);
      }
    } catch (error) {
      console.error(`Background processing failed for item ${itemId}:`, error);
      try {
        // Set status to failed on any error
        await this.updateParsingStatus(itemId, 'FAILED');
      } catch (statusError) {
        console.error(`Failed to update status to FAILED for item ${itemId}:`, statusError);
      }
    }
  }

  /**
   * Create library item from metadata with non-blocking background processing
   */
  async createFromMetadata(metadata: Partial<LibraryItem>): Promise<string> {
    try {
      // Create the item record with initial status
      const itemId = await this._createItemRecord({
        ...metadata,
        parsingStatus: 'PENDING_PDF_FETCH'
      });
      
      // Trigger background processing without waiting (non-blocking)
      void this.triggerBackgroundProcessing(itemId);
      
      console.log(`Created item ${itemId}, background processing started`);
      return itemId;
    } catch (error) {
      console.error('Error creating item from metadata:', error);
      throw new Error('Failed to create item from metadata');
    }
  }

  /**
   * Private method to trigger Mineru processing
   */
  private async triggerMineruProcessing(itemId: string, pdfBlob: Blob): Promise<void> {
    try {
      console.log(`Starting Mineru processing for item ${itemId}`);
      
      // Get the item from database
      const item = await this.getLibraryItemById(itemId);
      if (!item) {
        throw new Error(`Item ${itemId} not found`);
      }

      // Submit task to Mineru
      const taskId = await mineruService.submitTaskFromFile(item, pdfBlob);
      
      // Update database with Mineru task ID and set status to parsing in Mineru
      await this.db.library.update(itemId, {
        mineruTaskId: taskId,
        parsingStatus: 'PARSING_IN_MINERU',
        updatedAt: new Date()
      });
      
      console.log(`Mineru task submitted for item ${itemId}, task_id: ${taskId}`);
      
      // Wait for Mineru processing to complete
      const parsedData = await mineruService.pollTaskResult(taskId);
      
      // Process the parsed data and extract citations
      await this.linkCitations(itemId, parsedData.references || []);
      
      // Update status to success
      await this.updateParsingStatus(itemId, 'SUCCESS');
      
      console.log(`Mineru processing completed successfully for item ${itemId}`);
      
    } catch (error) {
      console.error(`Mineru processing failed for item ${itemId}:`, error);
      try {
        // Set status to parsing failed on any error
        await this.updateParsingStatus(itemId, 'PARSING_FAILED');
      } catch (statusError) {
        console.error(`Failed to update status to PARSING_FAILED for item ${itemId}:`, statusError);
      }
    }
  }

  /**
   * Save PDF to disk/storage and return path
   * TODO: Implement actual PDF storage logic
   */
  private async savePdfToDisk(itemId: string, pdfBlob: Blob): Promise<string> {
    // For now, return a placeholder path
    // In a real implementation, you would:
    // 1. Save the blob to a file system or cloud storage
    // 2. Return the actual path/URL
    const pdfPath = `pdfs/${itemId}.pdf`;
    
    console.log(`Saving PDF for item ${itemId}, size: ${pdfBlob.size} bytes`);
    // TODO: Implement actual saving logic
    
    return pdfPath;
  }

  /**
   * Create library item from PDF upload with immediate processing
   */
  async createFromPdfUpload(pdfFile: File): Promise<string> {
    try {
      // Create basic item record with PDF file name as title
      const itemId = await this._createItemRecord({
        title: pdfFile.name.replace(/\.pdf$/i, ''),
        authors: ['Unknown'],
        year: new Date().getFullYear(),
        parsingStatus: 'PENDING_MINERU_SUBMISSION',
        source: 'MANUAL'
      });
      
      // Convert File to Blob for processing
      const pdfBlob = new Blob([await pdfFile.arrayBuffer()], { type: 'application/pdf' });
      
      // Save PDF and update path
      const pdfPath = await this.savePdfToDisk(itemId, pdfBlob);
      await this.db.library.update(itemId, {
        pdfPath,
        updatedAt: new Date()
      });
      
      console.log(`Created item ${itemId} from PDF upload, starting Mineru processing`);
      
      // Trigger Mineru processing asynchronously (non-blocking)
      void this.triggerMineruProcessing(itemId, pdfBlob);
      
      return itemId;
    } catch (error) {
      console.error('Error creating item from PDF upload:', error);
      throw new Error('Failed to create item from PDF upload');
    }
  }

  /**
   * Upload PDF for existing item that is awaiting manual upload
   */
  async uploadPdfForExistingItem(itemId: string, pdfFile: File): Promise<void> {
    try {
      const existingItem = await this.getLibraryItemById(itemId);
      if (!existingItem) {
        throw new Error(`Library item with ID ${itemId} not found`);
      }

      // Convert File to Blob for processing
      const pdfBlob = new Blob([await pdfFile.arrayBuffer()], { type: 'application/pdf' });
      
      // Save PDF and update item
      const pdfPath = await this.savePdfToDisk(itemId, pdfBlob);
      await this.db.library.update(itemId, {
        pdfPath,
        parsingStatus: 'PENDING_MINERU_SUBMISSION',
        updatedAt: new Date()
      });
      
      console.log(`Uploaded PDF for existing item ${itemId}, starting Mineru processing`);
      
      // Trigger Mineru processing asynchronously (non-blocking)
      void this.triggerMineruProcessing(itemId, pdfBlob);
      
    } catch (error) {
      console.error('Error uploading PDF for existing item:', error);
      throw new Error('Failed to upload PDF for existing item');
    }
  }

  /**
   * Get citation relationships for an item
   */
  async getCitationRelationships(itemId: string): Promise<{
    references: LibraryItem[];
    citedBy: LibraryItem[];
  }> {
    try {
      // Get references (items this item cites)
      const referenceCitations = await this.db.citations
        .where('sourceItemId')
        .equals(itemId)
        .toArray();
      
      const references = await Promise.all(
        referenceCitations.map(citation => this.db.library.get(citation.targetItemId))
      );
      
      // Get cited by (items that cite this item)
      const citedByCitations = await this.db.citations
        .where('targetItemId')
        .equals(itemId)
        .toArray();
      
      const citedBy = await Promise.all(
        citedByCitations.map(citation => this.db.library.get(citation.sourceItemId))
      );
      
      return {
        references: references.filter(Boolean) as LibraryItem[],
        citedBy: citedBy.filter(Boolean) as LibraryItem[]
      };
    } catch (error) {
      console.error('Error getting citation relationships:', error);
      throw new Error('Failed to get citation relationships');
    }
  }

  /**
   * Link citations to the library item
   * TODO: Implement citation linking logic
   */
  private async linkCitations(itemId: string, references: any[]): Promise<void> {
    try {
      console.log(`Linking ${references.length} citations for item ${itemId}`);
      
      // TODO: Implement citation processing logic
      // This would typically involve:
      // 1. Processing the references array
      // 2. Creating citation records in the database
      // 3. Linking them to the source item
      
      for (const reference of references) {
        // Process each reference and create citation records
        // await this.createCitationRecord(itemId, reference);
      }
      
      console.log(`Successfully linked citations for item ${itemId}`);
    } catch (error) {
      console.error(`Error linking citations for item ${itemId}:`, error);
      // Don't throw here, as this is not critical for the main workflow
    }
  }
}

// Export singleton instance
export const libraryService = new LibraryService();