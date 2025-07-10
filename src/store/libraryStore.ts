import { create } from 'zustand';
import { LibraryItem, LiteratureTree } from '../libs/db';
import { LITERATURE_SOURCES, DEFAULT_LIBRARY_ITEM_SOURCE, LiteratureSource } from '../libs/db/constants';
import { libraryService } from '../libs/db/LibraryService';
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
}

// Define Actions interface
interface LibraryActions {
  // Core actions
  initialize: () => Promise<void>;
  selectTree: (treeId: string) => Promise<void>;
  runMCTS: () => Promise<void>;
  addLibraryItem: (itemData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
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

  // Clear error action
  clearError: () => {
    set({ error: null });
  },

  // Initialize action
  initialize: async () => {
    try {
      set({ isLoading: true, error: null });
      
      const [items, trees] = await Promise.all([
        libraryService.getAllLibraryItems(),
        libraryService.getAllTrees()
      ]);
      
      set({ 
        items, 
        trees, 
        isLoading: false 
      });
      
    } catch (error) {
      console.error('LibraryStore: Initialization failed:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to initialize library' 
      });
    }
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

  // Add multiple library items in batch
  addLibraryItems: async (itemsData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    try {
      set({ isLoading: true, error: null });
      
      const results = [];
      
      for (const itemData of itemsData) {
        const newItem: LibraryItem = {
          ...itemData,
          id: generateLibraryItemId(),
          source: itemData.source || DEFAULT_LIBRARY_ITEM_SOURCE,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const result = await libraryService.addLibraryItem(newItem);
        results.push({ item: newItem, result });
      }
      
      // Refresh the items list once after all additions
      const updatedItems = await libraryService.getAllLibraryItems();
      
      console.log('[LibraryStore] addLibraryItems updating state with', updatedItems.length, 'items');
      
      set({ 
        items: updatedItems, 
        isLoading: false 
      });
      
      return {
        success: true,
        results,
        totalAdded: results.filter(r => r.result.success).length,
        totalDuplicates: results.filter(r => !r.result.success).length
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
        results: []
      };
    }
  },

  // Add library item action
  addLibraryItem: async (itemData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      set({ isLoading: true, error: null });
      
      const newItem: LibraryItem = {
        ...itemData,
        id: generateLibraryItemId(),
        source: itemData.source || DEFAULT_LIBRARY_ITEM_SOURCE,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await libraryService.addLibraryItem(newItem);
      
      if (!result.success) {
        // Handle duplicate case
        set({ 
          isLoading: false, 
          error: `Literature "${itemData.title}" already exists. Found ${result.duplicate?.length} duplicate(s).` 
        });
        return { success: false, duplicate: result.duplicate };
      }
      
      // Refresh the items list
      const updatedItems = await libraryService.getAllLibraryItems();
      
      set({ 
        items: updatedItems, 
        isLoading: false 
      });
      
      return { success: true };
    } catch (error) {
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
      
      await libraryService.uploadPdfForExistingItem(itemId, file);
      
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
        
        await libraryService.createFromPdfUpload(file);
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
  }
}));