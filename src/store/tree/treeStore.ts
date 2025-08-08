// @/store/tree/treeStore.ts

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { ResearchTree, TreeNode } from '../../domains/tree/entities/ResearchTree';
import { useWorkspaceStore } from '../workspace/workspaceStore';

// ==================== State & Actions Interface ====================

// This store is a "read-only" mirror of the active tree.
// It primarily holds data for visualization purposes.
export interface TreeState {
  // Mirrored from the active ResearchTree entity
  treeId: string | null;
  nodes: TreeNode[];
  rootNode: TreeNode | null;
  
  // UI-specific state
  selectedNodeId: string | null;
  highlightedPath: string[];
}

export interface TreeActions {
  // Actions to manipulate the UI state, not the tree data itself
  selectNode: (nodeId: string | null) => void;
  setHighlightedPath: (path: string[]) => void;
}

// ==================== Store Implementation ====================

export const useTreeStore = create<TreeState & TreeActions>()(
  devtools(
    (set, get) => ({
      // Initial State
      treeId: null,
      nodes: [],
      rootNode: null,
      selectedNodeId: null,
      highlightedPath: [],

      // --- Actions ---
      
      selectNode: (nodeId) => {
        set({ selectedNodeId: nodeId });
        // Optionally, also set the highlighted path to the root
        const tree = get().getTreeFromActiveWorkspace();
        if (tree && nodeId) {
          const path = tree.getPathToNode(nodeId).map(n => n.id);
          set({ highlightedPath: path });
        } else {
          set({ highlightedPath: [] });
        }
      },
      
      setHighlightedPath: (path) => {
        set({ highlightedPath: path });
      },

      // Helper function to get the tree from the workspace store
      getTreeFromActiveWorkspace: () => {
        const { activeWorkspace } = useWorkspaceStore.getState();
        return activeWorkspace ? activeWorkspace.getTree() : null;
      }
    }),
    { name: 'TreeStore' }
  )
);

// ==================== Synchronization with WorkspaceStore ====================

// This is the key to keeping the treeStore in sync.
// We subscribe to the workspaceStore, and whenever the active workspace changes,
// we update the treeStore with the new tree's data.
useWorkspaceStore.subscribe(
  (workspaceState) => workspaceState.activeWorkspace,
  (activeWorkspace) => {
    const { set, getState } = useTreeStore;
    const currentTreeId = getState().treeId;

    if (activeWorkspace) {
      const tree = activeWorkspace.getTree();
      if (tree.id !== currentTreeId) {
        set({
          treeId: tree.id,
          nodes: Array.from(tree.toJSON().nodes.values()),
          rootNode: tree.getRootNode(),
          selectedNodeId: null, // Reset selection when tree changes
          highlightedPath: [],
        });
      }
    } else if (currentTreeId) {
      // If active workspace is cleared, clear the tree store
      set({
        treeId: null,
        nodes: [],
        rootNode: null,
        selectedNodeId: null,
        highlightedPath: [],
      });
    }
  }
);
