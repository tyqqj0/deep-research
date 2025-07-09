import { LibraryItem } from '../db';
import { LITERATURE_SOURCES } from '../db/constants';
import { generateLibraryItemId } from '../utils/uuid';
import type { ZoteroConfig, ZoteroItem, ZoteroSyncResult, ZoteroApiResponse } from './types';

export class ZoteroService {
  private config: ZoteroConfig | null = null;
  private baseUrl = 'https://api.zotero.org';

  constructor(config?: ZoteroConfig) {
    if (config) {
      this.config = config;
    }
  }

  /**
   * Set Zotero API configuration
   */
  setConfig(config: ZoteroConfig): void {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || this.baseUrl
    };
  }

  /**
   * Check if Zotero is configured
   */
  isConfigured(): boolean {
    return this.config !== null && !!this.config.apiKey;
  }

  /**
   * Test Zotero API connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new Error('Zotero not configured');
    }

    try {
      const response = await this.makeRequest('/users/current');
      return response.success;
    } catch (error) {
      console.error('Zotero connection test failed:', error);
      return false;
    }
  }

  /**
   * Fetch items from Zotero
   */
  async fetchItems(limit = 100): Promise<ZoteroItem[]> {
    if (!this.isConfigured()) {
      throw new Error('Zotero not configured');
    }

    try {
      const endpoint = this.config!.groupId 
        ? `/groups/${this.config!.groupId}/items`
        : `/users/${this.config!.userId || 'current'}/items`;

      const response = await this.makeRequest(`${endpoint}?limit=${limit}`);
      
      if (response.success) {
        return Array.isArray(response.data) ? response.data : [];
      }
      
      throw new Error(response.error || 'Failed to fetch items');
    } catch (error) {
      console.error('Failed to fetch Zotero items:', error);
      throw error;
    }
  }

  /**
   * Convert Zotero item to LibraryItem
   */
  convertToLibraryItem(zoteroItem: ZoteroItem): LibraryItem {
    const authors = zoteroItem.creators?.map(creator => {
      if (creator.name) return creator.name;
      return `${creator.firstName || ''} ${creator.lastName || ''}`.trim();
    }).filter(Boolean) || [];

    const year = zoteroItem.date ? this.extractYear(zoteroItem.date) : new Date().getFullYear();

    return {
      id: generateLibraryItemId(),
      title: zoteroItem.title || 'Untitled',
      authors,
      year,
      source: LITERATURE_SOURCES.ZOTERO,
      publication: zoteroItem.publicationTitle,
      abstract: zoteroItem.abstractNote,
      zoteroKey: zoteroItem.key,
      createdAt: new Date(zoteroItem.dateAdded || Date.now()),
      updatedAt: new Date(zoteroItem.dateModified || Date.now())
    };
  }

  /**
   * Sync items from Zotero to library
   */
  async syncItems(existingItems: LibraryItem[] = []): Promise<ZoteroSyncResult> {
    const result: ZoteroSyncResult = {
      success: false,
      itemsAdded: 0,
      itemsUpdated: 0,
      itemsSkipped: 0,
      errors: []
    };

    try {
      const zoteroItems = await this.fetchItems();
      const existingZoteroKeys = new Set(
        existingItems
          .filter(item => item.zoteroKey)
          .map(item => item.zoteroKey!)
      );

      const newItems: LibraryItem[] = [];
      const updatedItems: LibraryItem[] = [];

      for (const zoteroItem of zoteroItems) {
        try {
          const libraryItem = this.convertToLibraryItem(zoteroItem);
          
          if (existingZoteroKeys.has(zoteroItem.key)) {
            // Item exists, check if it needs updating
            const existingItem = existingItems.find(item => item.zoteroKey === zoteroItem.key);
            if (existingItem && this.shouldUpdate(existingItem, zoteroItem)) {
              updatedItems.push({ ...existingItem, ...libraryItem });
              result.itemsUpdated++;
            } else {
              result.itemsSkipped++;
            }
          } else {
            // New item
            newItems.push(libraryItem);
            result.itemsAdded++;
          }
        } catch (error) {
          result.errors.push(`Failed to process item ${zoteroItem.key}: ${error}`);
        }
      }

      result.success = true;
      return result;
    } catch (error) {
      result.errors.push(`Sync failed: ${error}`);
      return result;
    }
  }

  /**
   * Make API request to Zotero
   */
  private async makeRequest(endpoint: string): Promise<ZoteroApiResponse> {
    if (!this.config) {
      throw new Error('Zotero not configured');
    }

    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { data, success: true };
    } catch (error) {
      return { 
        data: null, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Extract year from date string
   */
  private extractYear(dateString: string): number {
    const match = dateString.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : new Date().getFullYear();
  }

  /**
   * Check if item should be updated
   */
  private shouldUpdate(existingItem: LibraryItem, zoteroItem: ZoteroItem): boolean {
    // Compare modification dates
    if (existingItem.updatedAt && zoteroItem.dateModified) {
      const existingDate = new Date(existingItem.updatedAt);
      const zoteroDate = new Date(zoteroItem.dateModified);
      return zoteroDate > existingDate;
    }
    return false;
  }
}

// Export singleton instance
export const zoteroService = new ZoteroService();