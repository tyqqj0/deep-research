import { create } from 'zustand';
import { LibraryItem, LiteratureTree } from '../libs/db';
import { TreeController } from '../libs/tree/TreeController';
import { nanoid } from 'nanoid';

// Define State interface
interface LibraryState {
  items: LibraryItem[];
  trees: LiteratureTree[];
  activeTreeController: TreeController | null;
  isLoading: boolean;
  error: string | null;
  treeVersion: number; // Version number to trigger UI updates
}

// Define Actions interface
interface LibraryActions {
  initialize: () => Promise<void>;
  selectTree: (treeId: string) => Promise<void>;
  runMCTS: () => Promise<void>;
  addLibraryItem: (itemData: Omit<LibraryItem, 'id' | 'createdAt'>) => Promise<void>;
  clearError: () => void;
}

// Mock library service interface (to be replaced with actual service)
interface LibraryService {
  getAllLibraryItems: () => Promise<LibraryItem[]>;
  getAllTrees: () => Promise<LiteratureTree[]>;
  getTreeById: (treeId: string) => Promise<LiteratureTree | null>;
  addLibraryItem: (item: LibraryItem) => Promise<void>;
  saveTree: (tree: LiteratureTree) => Promise<void>;
}

// Mock library service implementation (temporary)
const mockLibraryService: LibraryService = {
  getAllLibraryItems: async () => {
    // Mock implementation - will be replaced with actual database calls
    return [];
  },
  getAllTrees: async () => {
    // Mock implementation - will be replaced with actual database calls
    return [];
  },
  getTreeById: async (treeId: string) => {
    // Mock implementation - will be replaced with actual database calls
    return null;
  },
  addLibraryItem: async (item: LibraryItem) => {
    // Mock implementation - will be replaced with actual database calls
    console.log('Adding library item:', item);
  },
  saveTree: async (tree: LiteratureTree) => {
    // Mock implementation - will be replaced with actual database calls
    console.log('Saving tree:', tree);
  }
};

// Create Zustand store
export const useLibraryStore = create<LibraryState & LibraryActions>((set, get) => ({
  // Initial state
  items: [],
  trees: [],
  activeTreeController: null,
  isLoading: false,
  error: null,
  treeVersion: 0,

  // Clear error action
  clearError: () => {
    set({ error: null });
  },

  // Initialize action
  initialize: async () => {
    try {
      set({ isLoading: true, error: null });
      
      const [items, trees] = await Promise.all([
        mockLibraryService.getAllLibraryItems(),
        mockLibraryService.getAllTrees()
      ]);
      
      set({ 
        items, 
        trees, 
        isLoading: false 
      });
    } catch (error) {
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
      
      const treeData = await mockLibraryService.getTreeById(treeId);
      
      if (!treeData) {
        throw new Error(`Tree with id ${treeId} not found`);
      }
      
      const newController = new TreeController(treeData, mockLibraryService);
      
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

  // Add library item action
  addLibraryItem: async (itemData: Omit<LibraryItem, 'id' | 'createdAt'>) => {
    try {
      set({ isLoading: true, error: null });
      
      const newItem: LibraryItem = {
        ...itemData,
        id: nanoid(),
        createdAt: new Date()
      };
      
      await mockLibraryService.addLibraryItem(newItem);
      
      // Refresh the items list
      const updatedItems = await mockLibraryService.getAllLibraryItems();
      
      set({ 
        items: updatedItems, 
        isLoading: false 
      });
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to add library item' 
      });
    }
  }
}));