import { LibraryItem } from '../db';
import { LITERATURE_SOURCES } from '../db/constants';
import { generateLibraryItemId } from '../utils/uuid';
import type { ZoteroConfig, ZoteroItem, ZoteroSyncResult, ZoteroApiResponse, ZoteroUserInfo, ZoteroCollection, ZoteroGroup } from './types';

export class ZoteroService {
  private config: ZoteroConfig | null = null;
  private baseUrl = 'https://api.zotero.org';
  private useProxy = false;
  private userInfo: ZoteroUserInfo | null = null;
  private collections: ZoteroCollection[] = [];
  private groups: ZoteroGroup[] = [];
  private storageKey = 'zotero-config';

  constructor(config?: ZoteroConfig) {
    if (config) {
      this.config = config;
    } else {
      this.loadFromStorage();
    }
  }

  /**
   * Set Zotero API configuration
   */
  setConfig(config: ZoteroConfig & { useProxy?: boolean }): void {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || this.baseUrl
    };
    this.useProxy = config.useProxy || false;
    this.saveToStorage();
  }

  /**
   * Save configuration to localStorage
   */
  private saveToStorage(): void {
    if (this.config) {
      localStorage.setItem(this.storageKey, JSON.stringify({
        ...this.config,
        useProxy: this.useProxy
      }));
    }
  }

  /**
   * Load configuration from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const config = JSON.parse(stored);
        this.config = {
          apiKey: config.apiKey,
          userId: config.userId,
          groupId: config.groupId,
          baseUrl: config.baseUrl || this.baseUrl
        };
        this.useProxy = config.useProxy || false;
      }
    } catch (error) {
      console.error('Failed to load Zotero config from storage:', error);
    }
  }

  /**
   * Clear stored configuration
   */
  clearStorage(): void {
    localStorage.removeItem(this.storageKey);
    this.config = null;
    this.userInfo = null;
    this.collections = [];
    this.groups = [];
  }

  /**
   * Get stored configuration
   */
  getStoredConfig(): ZoteroConfig | null {
    return this.config;
  }

  /**
   * Check if Zotero is configured
   */
  isConfigured(): boolean {
    return this.config !== null && !!this.config.apiKey;
  }

  /**
   * Get user information from API key
   */
  async getUserInfo(): Promise<ZoteroUserInfo & { error?: string }> {
    try {
      const response = await this.makeRequest('/keys/current');
      if (response.success && response.data) {
        this.userInfo = {
          userID: response.data.userID?.toString(),
          username: response.data.username,
          displayName: response.data.displayName,
          email: response.data.email
        };
        return this.userInfo;
      }
      return { error: response.error || 'Failed to get user info' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get cached user info
   */
  getCachedUserInfo(): ZoteroUserInfo | null {
    return this.userInfo;
  }

  /**
   * Fetch collections from Zotero
   */
  async fetchCollections(): Promise<ZoteroCollection[]> {
    if (!this.isConfigured()) {
      throw new Error('Zotero not configured');
    }

    try {
      // Ensure we have user ID
      let userId = this.config!.userId;
      if (!userId) {
        const userInfo = await this.getUserInfo();
        if (userInfo.error) {
          throw new Error(`Failed to get user ID: ${userInfo.error}`);
        }
        userId = userInfo.userID;
      }

      const endpoint = this.config!.groupId 
        ? `/groups/${this.config!.groupId}/collections`
        : `/users/${userId}/collections`;

      const response = await this.makeRequest(endpoint);
      
      if (response.success) {
        this.collections = Array.isArray(response.data) ? response.data : [];
        return this.collections;
      }
      
      throw new Error(response.error || 'Failed to fetch collections');
    } catch (error) {
      console.error('Failed to fetch Zotero collections:', error);
      throw error;
    }
  }

  /**
   * Fetch groups from Zotero
   */
  async fetchGroups(): Promise<ZoteroGroup[]> {
    if (!this.isConfigured()) {
      throw new Error('Zotero not configured');
    }

    try {
      // Ensure we have user ID
      let userId = this.config!.userId;
      if (!userId) {
        const userInfo = await this.getUserInfo();
        if (userInfo.error) {
          throw new Error(`Failed to get user ID: ${userInfo.error}`);
        }
        userId = userInfo.userID;
      }

      const endpoint = `/users/${userId}/groups`;
      const response = await this.makeRequest(endpoint);
      
      if (response.success) {
        this.groups = Array.isArray(response.data) ? response.data : [];
        return this.groups;
      }
      
      throw new Error(response.error || 'Failed to fetch groups');
    } catch (error) {
      console.error('Failed to fetch Zotero groups:', error);
      throw error;
    }
  }

  /**
   * Get cached collections
   */
  getCachedCollections(): ZoteroCollection[] {
    return this.collections;
  }

  /**
   * Get cached groups
   */
  getCachedGroups(): ZoteroGroup[] {
    return this.groups;
  }

  /**
   * Test Zotero API connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Zotero not configured' };
    }

    try {

      // Try direct API call first - use /keys/current to validate API key
      let response = await this.makeRequest('/keys/current');
      
      // If direct call fails with network error, try proxy
      if (!response.success && !this.useProxy && response.error?.includes('Network error')) {
        const originalUseProxy = this.useProxy;
        this.useProxy = true;
        
        try {
          response = await this.makeRequest('/keys/current');
          
          if (response.success) {
            return { 
              success: true, 
              details: { 
                method: 'proxy',
                message: 'Direct API failed, but proxy worked. Consider enabling proxy mode.',
                userData: response.data
              }
            };
          }
        } finally {
          this.useProxy = originalUseProxy;
        }
      }
      
      if (response.success) {
        // Store user ID from the response for future use
        if (response.data?.userID && !this.config?.userId) {
          this.config.userId = response.data.userID.toString();
        }
        return { 
          success: true,
          details: {
            userData: response.data
          }
        };
      } else {
        return { 
          success: false, 
          error: response.error || 'Unknown error',
          details: response
        };
      }
    } catch (error) {
      console.error('Zotero connection test failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      };
    }
  }

  /**
   * Fetch items from Zotero
   */
  async fetchItems(limit = 100, collectionKey?: string): Promise<ZoteroItem[]> {
    if (!this.isConfigured()) {
      throw new Error('Zotero not configured');
    }

    try {
      // Ensure we have user ID
      let userId = this.config!.userId;
      if (!userId) {
        const userInfo = await this.getUserInfo();
        if (userInfo.error) {
          throw new Error(`Failed to get user ID: ${userInfo.error}`);
        }
        userId = userInfo.userID;
        if (!userId) {
          throw new Error('Could not determine user ID from API key');
        }
        // Store for future use
        this.config!.userId = userId;
      }

      let endpoint: string;
      if (this.config!.groupId) {
        endpoint = collectionKey 
          ? `/groups/${this.config!.groupId}/collections/${collectionKey}/items`
          : `/groups/${this.config!.groupId}/items`;
      } else {
        endpoint = collectionKey 
          ? `/users/${userId}/collections/${collectionKey}/items`
          : `/users/${userId}/items`;
      }

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
  async syncItems(existingItems: LibraryItem[] = [], collectionKey?: string): Promise<ZoteroSyncResult> {
    const result: ZoteroSyncResult = {
      success: false,
      itemsAdded: 0,
      itemsUpdated: 0,
      itemsSkipped: 0,
      errors: []
    };

    try {
      const zoteroItems = await this.fetchItems(100, collectionKey);
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
      result.newItems = newItems;
      result.updatedItems = updatedItems;
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

    // Use proxy if enabled, otherwise direct API call
    const url = this.useProxy 
      ? `/api/zotero${endpoint}` 
      : `${this.config.baseUrl}${endpoint}`;
      
    const headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'Zotero-API-Version': '3'
    };


    try {
      const fetchOptions: RequestInit = {
        headers,
        method: 'GET'
      };
      
      // Only set CORS mode for direct API calls
      if (!this.useProxy) {
        fetchOptions.mode = 'cors';
      }
      
      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        let errorText = '';
        try {
          const responseData = await response.json();
          errorText = responseData.error || responseData.details || response.statusText;
        } catch (e) {
          try {
            errorText = await response.text();
          } catch (e2) {
            // Unable to read error response
          }
        }
        
        const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        return {
          data: null,
          success: false,
          error: errorMessage,
          details: {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
            proxy: this.useProxy
          }
        };
      }

      const data = await response.json();
      return { data, success: true };
    } catch (error) {
      // If direct API call fails with network error, suggest trying proxy
      if (!this.useProxy && error instanceof Error && error.message.includes('fetch')) {
        return {
          data: null,
          success: false,
          error: `Network error: ${error.message}. Try enabling proxy mode.`,
          details: {
            error,
            suggestion: 'Enable proxy mode to bypass CORS/network issues'
          }
        };
      }
      
      return { 
        data: null, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
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