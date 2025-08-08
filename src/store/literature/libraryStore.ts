// @/store/literature/libraryStore.ts

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { LibraryItem, Citation } from '../../domains/literature/entities/Literature';
import { ILibraryService } from '../../domains/literature/services/ILibraryService';
import container from '../../infrastructure/di/container';

// Resolve the service from the DI container
const libraryService = container.resolve<ILibraryService>(ILibraryService);

// ==================== State & Actions Interface ====================

export interface LibraryState {
  items: LibraryItem[];
  citations: Citation[];
  isLoading: boolean;
  error: string | null;
}

export interface LibraryActions {
  loadLibrary: () => Promise<void>;
  addItem: (itemData: Omit<LibraryItem, 'id'>) => Promise<LibraryItem | null>;
  updateItem: (itemId: string, updates: Partial<LibraryItem>) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  linkCitationsForItem: (itemId: string) => Promise<void>;
}

// ==================== Store Implementation ====================

export const useLibraryStore = create<LibraryState & LibraryActions>()(
  devtools(
    (set, get) => ({
      // Initial State
      items: [],
      citations: [],
      isLoading: false,
      error: null,

      // --- Actions ---

      // Load all library items and citations
      loadLibrary: async () => {
        try {
          set({ isLoading: true, error: null });
          const [items, citations] = await Promise.all([
            libraryService.getAllItems(),
            libraryService.getAllCitations(),
          ]);
          set({ items, citations, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },

      // Add a new item to the library
      addItem: async (itemData) => {
        try {
          set({ isLoading: true, error: null });
          const newItem = await libraryService.addItem(itemData);
          set((state) => ({
            items: [...state.items, newItem],
            isLoading: false,
          }));
          return newItem;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return null;
        }
      },

      // Update an existing item
      updateItem: async (itemId, updates) => {
        try {
          set({ isLoading: true, error: null });
          await libraryService.updateItem(itemId, updates);
          // Refresh the entire library to get the updated item
          await get().loadLibrary();
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },
      
      // Delete an item
      deleteItem: async (itemId: string) => {
        try {
          set({ isLoading: true, error: null });
          await libraryService.deleteItem(itemId);
          set((state) => ({
            items: state.items.filter(item => item.id !== itemId),
            isLoading: false,
          }));
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },
      
      // Trigger citation linking for an item
      linkCitationsForItem: async (itemId: string) => {
        try {
          set({ isLoading: true, error: null });
          await libraryService.linkCitationsForItem(itemId);
          // Refresh citations to reflect new links
          const citations = await libraryService.getAllCitations();
          set({ citations, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },
    }),
    { name: 'LibraryStore' }
  )
);
