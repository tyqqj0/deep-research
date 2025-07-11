import { create } from 'zustand';
import { liveQuery } from 'dexie';
import { LibraryItem, LiteratureTree, db } from '../libs/db';
import { LITERATURE_SOURCES, DEFAULT_LIBRARY_ITEM_SOURCE, LiteratureSource } from '../libs/db/constants';
import { libraryService } from '../libs/db/LibraryService';
import { libraryWorkflowService } from '../libs/library/LibraryWorkflowService';
import { TreeController } from '../libs/tree/TreeController';
import { zoteroService, ZoteroConfig, ZoteroSyncResult } from '../libs/zotero';
import { generateLibraryItemId } from '../libs/utils/uuid';

// Define State interface
interface LibraryState {
  items: LibraryItem[];
  trees: LiteratureTree[];
  activeTreeController: TreeController | null;
  isLoading: boolean;
  error: string | null;
  treeVersion: number; // Version number to trigger UI updates
  isInitialized: boolean;

  // Filtering and search
  sourceFilter: LiteratureSource | 'all';
  searchTerm: string;

  // Zotero integration
  zoteroConfig: ZoteroConfig | null;
  isZoteroConfigured: boolean;
  zoteroSyncResult: ZoteroSyncResult | null;

  // PDF upload and processing
  currentDetailItem: LibraryItem | null;
  isUploadingPdf: boolean;
  uploadProgress: Record<string, number>;

  // Auto-metadata extraction settings
  autoExtractMetadata: boolean;
}

// Define Actions interface
interface LibraryActions {
  // Core actions
  initialize: () => Promise<void>;
  startRealTimeUpdates: () => () => void; // 返回cleanup函数
  selectTree: (treeId: string) => Promise<void>;
  runMCTS: () => Promise<void>;
  addLibraryItem: (itemData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ success: boolean; itemId?: string; duplicate?: LibraryItem[]; error?: string }>;
  addLibraryItems: (itemsData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<any>;
  updateLibraryItem: (id: string, itemData: Partial<LibraryItem>) => Promise<void>;
  deleteLibraryItem: (id: string) => Promise<void>;
  deleteLibraryItems: (ids: string[]) => Promise<void>;
  clearError: () => void;

  // Search and filtering
  setSourceFilter: (source: LiteratureSource | 'all') => void;
  setSearchTerm: (term: string) => void;
  getFilteredItems: () => LibraryItem[];

  // Zotero integration
  configureZotero: (config: ZoteroConfig) => Promise<boolean>;
  syncWithZotero: () => Promise<ZoteroSyncResult>;
  clearZoteroConfig: () => void;

  // PDF upload and processing
  setCurrentDetailItem: (item: LibraryItem | null) => void;
  uploadPdfForItem: (itemId: string, file: File) => Promise<void>;
  bulkUploadPdfs: (files: File[]) => Promise<void>;

  // Auto-metadata extraction settings
  setAutoExtractMetadata: (enabled: boolean) => void;

  // ✏️ 引文编辑功能
  updateExtractedReference: (itemId: string, referenceIndex: number, updatedReference: any) => Promise<void>;
  addExtractedReference: (itemId: string, newReference: any) => Promise<void>;

  // 🔗 手动链接功能
  createManualCitationLink: (sourceItemId: string, targetItemId: string) => Promise<boolean>;
}

// Use the real library service

// Create Zustand store
export const useLibraryStore = create<LibraryState & LibraryActions>((set, get) => ({
  // Initial state
  items: [],
  trees: [],
  activeTreeController: null,
  isLoading: false,
  error: null,
  treeVersion: 0,
  isInitialized: false,

  // Filtering and search
  sourceFilter: 'all',
  searchTerm: '',

  // Zotero integration
  zoteroConfig: null,
  isZoteroConfigured: false,
  zoteroSyncResult: null,

  // PDF upload and processing
  currentDetailItem: null,
  isUploadingPdf: false,
  uploadProgress: {},

  // Auto-metadata extraction settings
  autoExtractMetadata: true, // 默认启用

  // Clear error action
  clearError: () => {
    set({ error: null });
  },

  // Initialize action
  initialize: async () => {
    try {
      set({ isLoading: true, error: null });

      // TODO: 从全局设置系统加载配置
      // 临时从localStorage加载autoExtractMetadata设置
      try {
        const savedSetting = localStorage.getItem('library.autoExtractMetadata');
        if (savedSetting !== null) {
          set({ autoExtractMetadata: JSON.parse(savedSetting) });
        }
      } catch (error) {
        console.warn('Failed to load autoExtractMetadata setting from localStorage:', error);
      }

      const [items, trees] = await Promise.all([
        libraryService.getAllLibraryItems(),
        libraryService.getAllTrees()
      ]);

      set({
        items,
        trees,
        isLoading: false,
        isInitialized: true
      });

      // 自动启动实时更新
      get().startRealTimeUpdates();

    } catch (error) {
      console.error('LibraryStore: Initialization failed:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize library',
        isInitialized: true // also mark as initialized on failure to prevent re-initializing loop
      });
    }
  },

  // 启动实时数据更新监听
  startRealTimeUpdates: () => {
    console.log('📡 Subscribing to real-time library updates with liveQuery...');

    const observable = liveQuery(() => libraryService.getAllLibraryItems());

    const subscription = observable.subscribe({
      next: (updatedItems) => {
        // liveQuery is efficient and only triggers on actual data changes in Dexie.
        // It's better than polling as it avoids unnecessary checks and provides
        // instant updates. We no longer need to check for "processing items"
        // because any relevant change (like status update) will be caught.
        console.log(`🔄 Library updated via liveQuery. Total items: ${updatedItems.length}`);
        set({ items: updatedItems });
      },
      error: (error) => {
        console.error('Error in real-time library subscription:', error);
        set({ error: error instanceof Error ? error.message : 'Live subscription failed' });
      }
    });

    console.log('✅ Real-time updates subscription successful.');

    // The returned function should be called by a component's cleanup logic (e.g., useEffect)
    // to prevent memory leaks.
    return () => {
      subscription.unsubscribe();
      console.log('📡 Real-time updates subscription stopped.');
    };
  },

  // Select tree action
  selectTree: async (treeId: string) => {
    try {
      set({ isLoading: true, error: null });

      const treeData = await libraryService.getTreeById(treeId);

      if (!treeData) {
        throw new Error(`Tree with id ${treeId} not found`);
      }

      const newController = new TreeController(treeData, libraryService);

      set({
        activeTreeController: newController,
        isLoading: false,
        treeVersion: get().treeVersion + 1
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to select tree'
      });
    }
  },

  // Run MCTS action
  runMCTS: async () => {
    try {
      const { activeTreeController } = get();

      if (!activeTreeController) {
        throw new Error('No active tree controller. Please select a tree first.');
      }

      set({ isLoading: true, error: null });

      // Run MCTS simulation
      activeTreeController.runSimulation();

      // Save the updated tree
      await activeTreeController.save();

      // Update the tree version to trigger UI updates
      set({
        isLoading: false,
        treeVersion: get().treeVersion + 1
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to run MCTS simulation'
      });
    }
  },

  // Add multiple library items in batch using createFromMetadata
  addLibraryItems: async (itemsData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    try {
      set({ isLoading: true, error: null });

      const results = [];
      const totalFiles = itemsData.length;

      for (let i = 0; i < totalFiles; i++) {
        const itemData = itemsData[i];

        try {
          // Use createFromMetadata to enable background processing for each item
          const itemId = await libraryWorkflowService.createFromMetadata({
            ...itemData,
            source: itemData.source || DEFAULT_LIBRARY_ITEM_SOURCE
          });

          results.push({
            success: true,
            itemId,
            title: itemData.title
          });

          console.log(`[LibraryStore] Created item ${i + 1}/${totalFiles}: ${itemData.title}`);
        } catch (error) {
          console.error(`[LibraryStore] Failed to create item: ${itemData.title}`, error);
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            title: itemData.title
          });
        }
      }

      // Refresh the items list once after all additions
      const updatedItems = await libraryService.getAllLibraryItems();

      console.log('[LibraryStore] addLibraryItems completed, refreshed with', updatedItems.length, 'total items');

      set({
        items: updatedItems,
        isLoading: false
      });

      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      return {
        success: true,
        results,
        totalAdded: successCount,
        totalErrors: errorCount,
        itemsAdded: successCount, // For Zotero compatibility
        itemsSkipped: errorCount  // For Zotero compatibility
      };
    } catch (error) {
      console.error('[LibraryStore] addLibraryItems error:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to add library items'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add library items',
        results: [],
        totalAdded: 0,
        totalErrors: itemsData.length
      };
    }
  },

  // Add library item action
  addLibraryItem: async (itemData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      set({ isLoading: true, error: null });

      // Use createFromMetadata to enable background processing
      const itemId = await libraryWorkflowService.createFromMetadata({
        ...itemData,
        source: itemData.source || DEFAULT_LIBRARY_ITEM_SOURCE
      });

      // Refresh the items list
      const updatedItems = await libraryService.getAllLibraryItems();

      set({
        items: updatedItems,
        isLoading: false
      });

      return { success: true, itemId };
    } catch (error) {
      // Handle duplicate case (thrown by createFromMetadata)
      if (error instanceof Error && error.message.includes('Duplicate item found')) {
        set({
          isLoading: false,
          error: error.message
        });
        return { success: false, duplicate: [] };
      }

      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to add library item'
      });
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add library item' };
    }
  },

  // Update library item action
  updateLibraryItem: async (id: string, itemData: Partial<LibraryItem>) => {
    try {
      set({ isLoading: true, error: null });

      const { items } = get();
      const existingItem = items.find(item => item.id === id);

      if (!existingItem) {
        throw new Error(`Library item with id ${id} not found`);
      }

      const updatedItem: LibraryItem = {
        ...existingItem,
        ...itemData,
        updatedAt: new Date()
      };

      await libraryService.updateLibraryItem(id, itemData);

      // Update items list
      const updatedItems = items.map(item =>
        item.id === id ? updatedItem : item
      );

      set({
        items: updatedItems,
        isLoading: false
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update library item'
      });
    }
  },

  // Delete library item action
  deleteLibraryItem: async (id: string) => {
    try {
      set({ isLoading: true, error: null });

      await libraryService.deleteLibraryItem(id);

      // Update local state
      const { items } = get();
      const updatedItems = items.filter(item => item.id !== id);

      set({
        items: updatedItems,
        isLoading: false
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to delete library item'
      });
    }
  },

  // Delete multiple library items in batch
  deleteLibraryItems: async (ids: string[]) => {
    try {
      set({ isLoading: true, error: null });

      console.log(`[LibraryStore] Batch deleting ${ids.length} items`);

      // Delete all items in parallel for better performance
      const deletePromises = ids.map(id => libraryService.deleteLibraryItem(id));
      await Promise.all(deletePromises);

      // Update local state in one operation
      const { items } = get();
      const updatedItems = items.filter(item => !ids.includes(item.id));

      console.log(`[LibraryStore] Batch delete completed. ${updatedItems.length} items remaining`);

      set({
        items: updatedItems,
        isLoading: false
      });
    } catch (error) {
      console.error('[LibraryStore] Batch delete error:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to delete library items'
      });
    }
  },

  // Search and filtering actions
  setSourceFilter: (source: LiteratureSource | 'all') => {
    set({ sourceFilter: source });
  },

  setSearchTerm: (term: string) => {
    set({ searchTerm: term });
  },

  getFilteredItems: () => {
    const { items, sourceFilter, searchTerm } = get();

    let filtered = items;

    // Filter by source
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(item => item.source === sourceFilter);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(term) ||
        item.authors.some(author => author.toLowerCase().includes(term)) ||
        item.publication?.toLowerCase().includes(term) ||
        item.abstract?.toLowerCase().includes(term)
      );
    }

    return filtered;
  },

  // Zotero integration actions
  configureZotero: async (config: ZoteroConfig) => {
    try {
      set({ isLoading: true, error: null });

      zoteroService.setConfig(config);
      const isConnected = await zoteroService.testConnection();

      if (isConnected) {
        set({
          zoteroConfig: config,
          isZoteroConfigured: true,
          isLoading: false
        });
        return true;
      } else {
        throw new Error('Failed to connect to Zotero');
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to configure Zotero'
      });
      return false;
    }
  },

  syncWithZotero: async () => {
    try {
      set({ isLoading: true, error: null });

      if (!get().isZoteroConfigured) {
        throw new Error('Zotero not configured');
      }

      const { items } = get();
      const syncResult = await zoteroService.syncItems(items);

      if (syncResult.success) {
        // Refresh items list after sync
        const updatedItems = await libraryService.getAllLibraryItems();
        set({
          items: updatedItems,
          zoteroSyncResult: syncResult,
          isLoading: false
        });
      } else {
        throw new Error(syncResult.errors.join('; '));
      }

      return syncResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync with Zotero';
      set({
        isLoading: false,
        error: errorMessage,
        zoteroSyncResult: {
          success: false,
          itemsAdded: 0,
          itemsUpdated: 0,
          itemsSkipped: 0,
          errors: [errorMessage]
        }
      });
      return get().zoteroSyncResult!;
    }
  },

  clearZoteroConfig: () => {
    set({
      zoteroConfig: null,
      isZoteroConfigured: false,
      zoteroSyncResult: null
    });
  },

  // PDF upload and processing actions
  setCurrentDetailItem: (item: LibraryItem | null) => {
    set({ currentDetailItem: item });
  },

  uploadPdfForItem: async (itemId: string, file: File) => {
    try {
      set({ isUploadingPdf: true, error: null });

      await libraryWorkflowService.uploadPdfForExistingItem(itemId, file);

      // Refresh the items list
      const updatedItems = await libraryService.getAllLibraryItems();
      set({
        items: updatedItems,
        isUploadingPdf: false
      });
    } catch (error) {
      set({
        isUploadingPdf: false,
        error: error instanceof Error ? error.message : 'Failed to upload PDF'
      });
    }
  },

  bulkUploadPdfs: async (files: File[]) => {
    try {
      set({ isUploadingPdf: true, error: null });

      const totalFiles = files.length;
      const { uploadProgress } = get();

      for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        const tempId = `upload_${i}`;

        // Update progress
        set({
          uploadProgress: {
            ...uploadProgress,
            [tempId]: ((i + 1) / totalFiles) * 100
          }
        });

        await libraryWorkflowService.createFromPdfUpload(file);
      }

      // Refresh the items list
      const updatedItems = await libraryService.getAllLibraryItems();
      set({
        items: updatedItems,
        isUploadingPdf: false,
        uploadProgress: {}
      });
    } catch (error) {
      set({
        isUploadingPdf: false,
        error: error instanceof Error ? error.message : 'Failed to upload PDFs',
        uploadProgress: {}
      });
    }
  },

  // Auto-metadata extraction settings
  setAutoExtractMetadata: (enabled: boolean) => {
    set({ autoExtractMetadata: enabled });
    // TODO: 将此设置移动到全局设置系统中
    // 应该持久化到localStorage或设置数据库中
    try {
      localStorage.setItem('library.autoExtractMetadata', JSON.stringify(enabled));
    } catch (error) {
      console.warn('Failed to save autoExtractMetadata setting to localStorage:', error);
    }
  },

  // ✏️ 更新引文信息
  updateExtractedReference: async (itemId: string, referenceIndex: number, updatedReference: any) => {
    try {
      set({ isLoading: true, error: null });

      await libraryService.updateExtractedReference(itemId, referenceIndex, updatedReference);

      // 刷新文献列表以反映更新
      const updatedItems = await libraryService.getAllLibraryItems();
      set({
        items: updatedItems,
        isLoading: false
      });

      console.log(`[LibraryStore] Updated reference ${referenceIndex} for item ${itemId}`);
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update reference'
      });
      throw error;
    }
  },

  // ➕ 添加新引文信息
  addExtractedReference: async (itemId: string, newReference: any) => {
    try {
      set({ isLoading: true, error: null });

      await libraryService.addExtractedReference(itemId, newReference);

      // 刷新文献列表以反映更新
      const updatedItems = await libraryService.getAllLibraryItems();
      set({
        items: updatedItems,
        isLoading: false
      });

      console.log(`[LibraryStore] Added new reference for item ${itemId}`);
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to add reference'
      });
      throw error;
    }
  },

  // 🔗 创建手动引文链接
  createManualCitationLink: async (sourceItemId: string, targetItemId: string) => {
    try {
      set({ isLoading: true, error: null });

      const success = await libraryService.createManualCitationLink(sourceItemId, targetItemId);

      set({ isLoading: false });

      if (success) {
        console.log(`[LibraryStore] Created manual citation link: ${sourceItemId} -> ${targetItemId}`);
      } else {
        console.log(`[LibraryStore] Citation link already exists: ${sourceItemId} -> ${targetItemId}`);
      }

      return success;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create citation link'
      });
      throw error;
    }
  }
}));