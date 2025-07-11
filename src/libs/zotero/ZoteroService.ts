import { LibraryItem } from '../db';
import { LITERATURE_SOURCES } from '../db/constants';
import { generateLibraryItemId } from '../utils/uuid';
import type { ZoteroConfig, ZoteroItem, ZoteroSyncResult, ZoteroApiResponse, ZoteroUserInfo, ZoteroCollection, ZoteroGroup, ZoteroLibrary } from './types';

export class ZoteroService {
  private config: ZoteroConfig | null = null;
  private baseUrl = 'https://api.zotero.org';
  private useProxy = false;
  private userInfo: ZoteroUserInfo | null = null;
  private collections: ZoteroCollection[] = [];
  private groups: ZoteroGroup[] = [];
  private availableLibraries: ZoteroLibrary[] = [];
  private currentLibrary: ZoteroLibrary | null = null;
  private storageKey = 'zotero-config';

  constructor(config?: ZoteroConfig) {
    if (config) {
      this.config = config;
    } else {
      this.loadFromStorage();
    }
    // Always start with direct API attempts, let makeRequest handle proxy fallback
    this.useProxy = false;
    console.log(`[ZoteroService] Initialized with proxy disabled, will auto-fallback if needed`);
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
        useProxy: this.useProxy,
        currentLibrary: this.currentLibrary
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
        this.currentLibrary = config.currentLibrary || null;
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
    this.availableLibraries = [];
    this.currentLibrary = null;
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
   * Get available libraries (personal + groups)
   */
  async getAvailableLibraries(): Promise<ZoteroLibrary[]> {
    if (!this.isConfigured()) {
      throw new Error('Zotero not configured');
    }

    try {
      // Get user info first
      const userInfo = await this.getUserInfo();
      if (userInfo.error) {
        throw new Error(`Failed to get user info: ${userInfo.error}`);
      }

      const libraries: ZoteroLibrary[] = [];

      // Add personal library
      libraries.push({
        id: userInfo.userID || 'current',
        name: `${userInfo.username || userInfo.displayName || 'Personal'} Library`,
        type: 'user',
        isPersonal: true
      });

      // Add group libraries
      const groups = await this.fetchGroups();
      groups.forEach(group => {
        libraries.push({
          id: group.id,
          name: group.name,
          type: 'group',
          isPersonal: false,
          groupInfo: group
        });
      });

      this.availableLibraries = libraries;

      // Restore current library if it exists in the available libraries
      if (this.currentLibrary) {
        const matchedLibrary = libraries.find(lib => lib.id === this.currentLibrary!.id);
        if (matchedLibrary) {
          this.currentLibrary = matchedLibrary; // Use the fresh library object
          console.log(`[ZoteroService] Restored current library: ${this.currentLibrary.name}`);
        } else {
          console.warn(`[ZoteroService] Previously selected library ${this.currentLibrary.id} not found, resetting to default`);
          this.currentLibrary = null;
        }
      }

      // Set default to personal library if none selected
      if (!this.currentLibrary) {
        this.currentLibrary = libraries[0];
        this.saveToStorage(); // Save the default library selection
        console.log(`[ZoteroService] Set default library: ${this.currentLibrary.name}`);
      }

      return libraries;
    } catch (error) {
      console.error('Failed to get available libraries:', error);
      throw error;
    }
  }

  /**
   * Switch to a different library
   */
  async switchLibrary(libraryId: string): Promise<ZoteroCollection[]> {
    const library = this.availableLibraries.find(lib => lib.id === libraryId);
    if (!library) {
      throw new Error(`Library with ID ${libraryId} not found`);
    }

    this.currentLibrary = library;
    this.saveToStorage(); // Save the current library selection

    // Fetch collections for the selected library
    return await this.fetchCollectionsForLibrary(library);
  }

  /**
   * Fetch collections from Zotero for a specific library
   */
  async fetchCollectionsForLibrary(library: ZoteroLibrary): Promise<ZoteroCollection[]> {
    if (!this.isConfigured()) {
      throw new Error('Zotero not configured');
    }

    try {
      const endpoint = library.isPersonal
        ? `/users/${library.id}/collections`
        : `/groups/${library.id}/collections`;

      const response = await this.makeRequest(endpoint);

      if (response.success) {
        const rawCollections = Array.isArray(response.data) ? response.data : [];

        // Debug logging
        console.log(`[ZoteroService] Raw collections response:`, rawCollections);

        const collections = rawCollections.map(item => {
          const collection = {
            key: item.data?.key || item.key,
            version: item.data?.version || item.version,
            name: item.data?.name || item.name || 'Untitled Collection',
            parentCollection: item.data?.parentCollection || item.parentCollection,
            itemsCount: item.meta?.numItems || item.itemsCount
          };

          // Debug each collection
          console.log(`[ZoteroService] Collection "${collection.name}":`, {
            key: collection.key,
            itemsCount: collection.itemsCount,
            rawMeta: item.meta,
            rawData: item.data
          });

          return collection;
        });

        // Update cached collections if this is the current library
        if (this.currentLibrary?.id === library.id) {
          this.collections = collections;
        }

        return collections;
      }

      throw new Error(response.error || 'Failed to fetch collections');
    } catch (error) {
      console.error('Failed to fetch Zotero collections:', error);
      throw error;
    }
  }

  /**
   * Fetch collections from current library
   */
  async fetchCollections(): Promise<ZoteroCollection[]> {
    if (!this.currentLibrary) {
      // Get available libraries first
      await this.getAvailableLibraries();
    }

    if (!this.currentLibrary) {
      throw new Error('No library selected');
    }

    return await this.fetchCollectionsForLibrary(this.currentLibrary);
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
        const rawGroups = Array.isArray(response.data) ? response.data : [];
        this.groups = rawGroups.map(item => ({
          id: item.data?.id || item.id,
          name: item.data?.name || item.name || 'Untitled Group',
          description: item.data?.description || item.description,
          type: item.data?.type || item.type || 'Private',
          access: item.data?.access || item.access || 'private',
          library: item.library || {
            type: 'group',
            id: item.data?.id || item.id,
            name: item.data?.name || item.name || 'Untitled Group'
          }
        }));
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
   * Get available libraries
   */
  getCachedLibraries(): ZoteroLibrary[] {
    return this.availableLibraries;
  }

  /**
   * Get actual count of regular items in a collection
   * This provides the accurate count by filtering out notes and attachments
   */
  async getActualItemCount(collectionKey?: string): Promise<number> {
    try {
      const items = await this.fetchItems(1000, collectionKey); // Fetch up to 1000 items
      return items.length;
    } catch (error) {
      console.error('Failed to get actual item count:', error);
      return 0;
    }
  }

  /**
   * Get current library
   */
  getCurrentLibrary(): ZoteroLibrary | null {
    return this.currentLibrary;
  }

  /**
   * Set current library
   */
  setCurrentLibrary(library: ZoteroLibrary): void {
    this.currentLibrary = library;
    this.saveToStorage(); // Save the current library selection
  }

  /**
   * Test Zotero API connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Zotero not configured' };
    }

    try {
      // Use /keys/current to validate API key (makeRequest handles proxy fallback automatically)
      const response = await this.makeRequest('/keys/current');

      if (response.success) {
        // Store user ID from the response for future use
        if (response.data?.userID && this.config && !this.config.userId) {
          this.config.userId = response.data.userID.toString();
        }
        return {
          success: true,
          details: {
            method: this.useProxy ? 'proxy' : 'direct',
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
   * Fetch items from Zotero with pagination support
   * Note: Collection metadata shows total count including notes/attachments,
   * but this method filters to only regular items (books, articles, etc.)
   */
  async fetchItems(limit = 100, collectionKey?: string): Promise<ZoteroItem[]> {
    console.log(`[ZoteroService] ========== FETCH ITEMS START ==========`);
    console.log(`[ZoteroService] Parameters: limit=${limit}, collectionKey=${collectionKey}`);

    if (!this.isConfigured()) {
      console.log(`[ZoteroService] ERROR: Zotero not configured`);
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

      // Use current library for fetching items
      const library = this.currentLibrary;
      if (!library) {
        throw new Error('No library selected');
      }

      let endpoint: string;
      if (library.isPersonal) {
        endpoint = collectionKey
          ? `/users/${library.id}/collections/${collectionKey}/items`
          : `/users/${library.id}/items`;
      } else {
        endpoint = collectionKey
          ? `/groups/${library.id}/collections/${collectionKey}/items`
          : `/groups/${library.id}/items`;
      }

      // Debug logging
      console.log(`[ZoteroService] Fetching items from: ${endpoint}`);
      console.log(`[ZoteroService] Collection key: ${collectionKey || 'all'}`);
      console.log(`[ZoteroService] Library: ${library.name} (${library.isPersonal ? 'personal' : 'group'})`);

      // Fetch all items with pagination
      const allItems = await this.fetchAllItemsWithPagination(endpoint, limit);

      // Filter out non-regular items (notes, attachments, etc.)
      const regularItems = allItems.filter(item => {
        const itemType = item.data?.itemType || item.itemType;
        console.log(`[ZoteroService] Item type check: data.itemType="${item.data?.itemType}", itemType="${item.itemType}"`);
        return itemType !== 'note' && itemType !== 'attachment';
      });

      console.log(`[ZoteroService] Total items fetched: ${allItems.length}`);
      console.log(`[ZoteroService] After filtering: ${regularItems.length} regular items`);

      // Debug: Print the first few items to understand the structure
      if (allItems.length > 0) {
        console.log(`[ZoteroService] First item structure:`, JSON.stringify(allItems[0], null, 2));
        if (allItems.length > 1) {
          console.log(`[ZoteroService] Second item structure:`, JSON.stringify(allItems[1], null, 2));
        }
      }

      // Debug: Print the first regular item to see what we're working with
      if (regularItems.length > 0) {
        console.log(`[ZoteroService] First regular item:`, JSON.stringify(regularItems[0], null, 2));
      }

      if (collectionKey) {
        const collection = this.collections.find(c => c.key === collectionKey);
        if (collection) {
          console.log(`[ZoteroService] Collection "${collection.name}" metadata shows ${collection.itemsCount} items`);
          console.log(`[ZoteroService] Actually fetched ${regularItems.length} regular items`);
        }
      }

      console.log(`[ZoteroService] ========== FETCH ITEMS END ==========`);
      return regularItems;
    } catch (error) {
      console.error(`[ZoteroService] EXCEPTION in fetchItems:`, error);
      throw error;
    }
  }

  /**
   * Fetch all items using pagination
   */
  private async fetchAllItemsWithPagination(endpoint: string, limit: number): Promise<ZoteroItem[]> {
    const allItems: ZoteroItem[] = [];
    let start = 0;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore) {
      pageCount++;
      console.log(`[ZoteroService] Fetching page ${pageCount} (start=${start}, limit=${limit})`);

      const url = `${endpoint}?limit=${limit}&start=${start}`;
      const response = await this.makeRequest(url);

      if (!response.success) {
        console.log(`[ZoteroService] API Request failed:`, response.error);
        console.log(`[ZoteroService] Full response:`, response);
        throw new Error(response.error || 'Failed to fetch items');
      }

      const items = Array.isArray(response.data) ? response.data : [];
      console.log(`[ZoteroService] Page ${pageCount} fetched ${items.length} items`);

      allItems.push(...items);

      // Check if we have more items to fetch
      // Zotero returns less than the limit when we've reached the end
      hasMore = items.length === limit;
      start += limit;

      // Safety check to avoid infinite loops
      if (pageCount > 100) {
        console.warn(`[ZoteroService] Reached maximum page count (100), stopping pagination`);
        break;
      }
    }

    console.log(`[ZoteroService] Pagination complete: ${pageCount} pages, ${allItems.length} total items`);
    return allItems;
  }

  /**
   * Convert Zotero item to LibraryItem
   */
  convertToLibraryItem(zoteroItem: ZoteroItem): LibraryItem {
    console.log(`[ZoteroService] Converting item to LibraryItem:`, JSON.stringify(zoteroItem, null, 2));

    // Try both structures: direct fields and data object
    const data = zoteroItem.data || zoteroItem;

    const title = data.title || zoteroItem.title || 'Untitled';
    const creators = data.creators || zoteroItem.creators || [];
    const date = data.date || zoteroItem.date;
    const publicationTitle = data.publicationTitle || zoteroItem.publicationTitle;
    const abstractNote = data.abstractNote || zoteroItem.abstractNote;
    const dateAdded = data.dateAdded || zoteroItem.dateAdded;
    const dateModified = data.dateModified || zoteroItem.dateModified;

    // 🔗 提取更多字段：URL、DOI、ISBN 等
    const url = data.url || zoteroItem.url;
    const doi = data.DOI || data.doi || zoteroItem.DOI || zoteroItem.doi;
    const isbn = data.ISBN || data.isbn || zoteroItem.ISBN || zoteroItem.isbn;
    const issn = data.ISSN || data.issn || zoteroItem.ISSN || zoteroItem.issn;
    const volume = data.volume || zoteroItem.volume;
    const issue = data.issue || zoteroItem.issue;
    const pages = data.pages || zoteroItem.pages;
    const publisher = data.publisher || zoteroItem.publisher;
    const place = data.place || zoteroItem.place;
    const series = data.series || zoteroItem.series;
    const language = data.language || zoteroItem.language;
    const extra = data.extra || zoteroItem.extra;

    console.log(`[ZoteroService] Extracted data:`, {
      title,
      creators,
      date,
      publicationTitle,
      abstractNote,
      url,
      doi,
      isbn,
      issn,
      volume,
      issue,
      pages,
      publisher,
      place,
      series,
      language,
      extra,
      dateAdded,
      dateModified
    });

    const authors = creators?.map((creator: any) => {
      if (creator.name) return creator.name;
      return `${creator.firstName || ''} ${creator.lastName || ''}`.trim();
    }).filter(Boolean) || [];

    // Ensure at least one author (required by schema)
    if (authors.length === 0) {
      authors.push('Unknown Author');
    }

    const year = date ? this.extractYear(date) : new Date().getFullYear();

    const libraryItem = {
      id: generateLibraryItemId(),
      title,
      authors,
      year,
      source: LITERATURE_SOURCES.ZOTERO,
      publication: publicationTitle || undefined,
      abstract: abstractNote || undefined,
      url: url || undefined,
      doi: doi || undefined,
      // 🔗 添加更多元数据字段到 extra 信息中
      ...(isbn && { isbn }),
      ...(issn && { issn }),
      ...(volume && { volume }),
      ...(issue && { issue }),
      ...(pages && { pages }),
      ...(publisher && { publisher }),
      ...(place && { place }),
      ...(series && { series }),
      ...(language && { language }),
      ...(extra && { extra }),
      zoteroKey: zoteroItem.key || undefined,
      createdAt: new Date(dateAdded || Date.now()),
      updatedAt: new Date(dateModified || Date.now())
    };

    console.log(`[ZoteroService] Final LibraryItem:`, libraryItem);

    return libraryItem;
  }

  /**
   * Sync items from Zotero to library
   */
  async syncItems(existingItems: LibraryItem[] = [], collectionKey?: string): Promise<ZoteroSyncResult> {
    console.log(`[ZoteroService] ========== SYNC ITEMS START ==========`);
    console.log(`[ZoteroService] Sync parameters: existingItems=${existingItems.length}, collectionKey=${collectionKey}`);

    const result: ZoteroSyncResult = {
      success: false,
      itemsAdded: 0,
      itemsUpdated: 0,
      itemsSkipped: 0,
      errors: []
    };

    try {
      console.log(`[ZoteroService] Calling fetchItems...`);
      const zoteroItems = await this.fetchItems(100, collectionKey);
      console.log(`[ZoteroService] fetchItems returned ${zoteroItems.length} items`);
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
   * Make API request to Zotero with automatic proxy fallback
   */
  private async makeRequest(endpoint: string): Promise<ZoteroApiResponse> {
    if (!this.config) {
      throw new Error('Zotero not configured');
    }

    console.log(`[ZoteroService] Making request to: ${endpoint} (useProxy: ${this.useProxy})`);

    // Try direct API call first (if not already using proxy)
    let response = await this.makeDirectRequest(endpoint);

    // If direct call fails with network error, try proxy automatically
    if (!response.success && !this.useProxy && response.error?.includes('Network error')) {
      console.log(`[ZoteroService] Direct API failed, trying proxy mode...`);
      const originalUseProxy = this.useProxy;
      this.useProxy = true;

      try {
        response = await this.makeDirectRequest(endpoint);
        console.log(`[ZoteroService] Proxy API Response success: ${response.success}`);

        if (response.success) {
          console.log(`[ZoteroService] Proxy mode worked! Keeping proxy enabled.`);
          this.saveToStorage(); // Save proxy preference
        } else {
          console.log(`[ZoteroService] Proxy mode also failed, restoring original setting`);
          this.useProxy = originalUseProxy;
        }
      } catch (proxyError) {
        console.log(`[ZoteroService] Proxy mode exception:`, proxyError);
        this.useProxy = originalUseProxy;
      }
    }

    return response;
  }

  /**
   * Make direct API request without fallback logic
   */
  private async makeDirectRequest(endpoint: string): Promise<ZoteroApiResponse> {
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

  /**
   * 📎 获取文献的 PDF 附件
   * @param itemKey - Zotero 文献的 key
   * @returns Promise<Blob | null> - PDF 文件的 Blob，如果没有找到则返回 null
   */
  async getPdfAttachment(itemKey: string): Promise<Blob | null> {
    if (!this.isConfigured()) {
      throw new Error('Zotero not configured');
    }

    try {
      const library = this.currentLibrary;
      if (!library) {
        throw new Error('No library selected');
      }

      // 1. 获取文献的所有附件信息
      const attachmentsEndpoint = library.isPersonal
        ? `/users/${library.id}/items/${itemKey}/children`
        : `/groups/${library.id}/items/${itemKey}/children`;

      console.log(`[ZoteroService] Fetching attachments for item ${itemKey}`);
      const attachmentsResponse = await this.makeRequest(attachmentsEndpoint);

      if (!attachmentsResponse.success) {
        console.error(`[ZoteroService] Failed to fetch attachments:`, attachmentsResponse.error);
        return null;
      }

      const attachments = Array.isArray(attachmentsResponse.data) ? attachmentsResponse.data : [];
      console.log(`[ZoteroService] Found ${attachments.length} attachments`);

      const pdfAttachment = attachments.find(attachment => {
        const data = attachment.data || attachment;
        return data.contentType === 'application/pdf' || data.filename?.toLowerCase().endsWith('.pdf');
      });

      if (!pdfAttachment) {
        console.log(`[ZoteroService] No PDF attachment found for item ${itemKey}`);
        return null;
      }

      // 2. 获取 PDF 文件的真实下载链接 (该请求会返回一个重定向)
      const attachmentKey = pdfAttachment.key || pdfAttachment.data?.key;
      if (!attachmentKey) {
        console.log(`[ZoteroService] PDF attachment has no key`);
        return null;
      }

      const fileEndpoint = library.isPersonal
        ? `/users/${library.id}/items/${attachmentKey}/file`
        : `/groups/${library.id}/items/${attachmentKey}/file`;

      const fileUrl = `${this.config?.baseUrl || this.baseUrl}${fileEndpoint}`;

      // 3. 使用我们的后端代理来下载文件，避免CORS问题
      const proxyUrl = `/api/zotero-download?url=${encodeURIComponent(fileUrl)}`;
      console.log(`[ZoteroService] Downloading PDF via proxy: ${proxyUrl}`);

      const response = await fetch(proxyUrl, {
        headers: {
          // 将API密钥通过特定头传递给我们的代理
          'X-Zotero-API-Key': this.config?.apiKey || ''
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ details: response.statusText }));
        throw new Error(`Failed to download file via proxy: ${errorData.details || response.statusText}`);
      }

      const blob = await response.blob();
      console.log(`[ZoteroService] PDF attachment downloaded successfully for item ${itemKey} (${blob.size} bytes)`);
      return blob;
    } catch (error) {
      console.error(`[ZoteroService] Error getting PDF attachment:`, error);
      return null;
    }
  }

  // This method is intended to be called from a server-side proxy
  // to circumvent CORS issues when the browser tries to download the file directly.
  async downloadFile(url: string, apiKey: string): Promise<Response> {
    if (!apiKey) {
      throw new Error('Zotero API key is not provided for download.');
    }
    const headers = {
      'Authorization': `Bearer ${apiKey}`
      // 注意：文件下载请求不需要 'Zotero-API-Version' 头，加上它有时会导致重定向问题
    };

    // Important: We are fetching the raw URL here, not a proxied one.
    // This method runs on the server, so it can make direct requests.
    const response = await fetch(url, {
      method: 'GET',
      headers: new Headers(headers),
      redirect: 'follow' // Explicitly follow redirects
    });

    if (!response.ok) {
      let errorText = 'Unknown error';
      try {
        errorText = await response.text();
      } catch (e) {
        // ignore
      }
      throw new Error(`Failed to download file from Zotero: ${response.statusText}. Body: ${errorText}`);
    }

    return response;
  }
}

// Export singleton instance
export const zoteroService = new ZoteroService();