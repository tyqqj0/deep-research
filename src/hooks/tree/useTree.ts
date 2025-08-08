// @/hooks/tree/useTree.ts

import { useTreeStore } from '../../store/tree/treeStore';
import { shallow } from 'zustand/shallow';

/**
 * Custom hook for interacting with the tree visualization state.
 *
 * This hook is primarily for "read" and "UI-state" operations. It mirrors
 * the state of the active research tree from the workspace and handles
 * UI interactions like node selection and path highlighting.
 *
 * @returns An object with the current tree's display state and UI action handlers.
 */
export const useTree = () => {
  const {
    treeId,
    nodes,
    rootNode,
    selectedNodeId,
    highlightedPath,
    selectNode,
    setHighlightedPath,
  } = useTreeStore(
    (state) => ({
      treeId: state.treeId,
      nodes: state.nodes,
      rootNode: state.rootNode,
      selectedNodeId: state.selectedNodeId,
      highlightedPath: state.highlightedPath,
      selectNode: state.selectNode,
      setHighlightedPath: state.setHighlightedPath,
    }),
    shallow
  );

  return {
    // Tree display state
    treeId,
    nodes,
    rootNode,

    // UI state
    selectedNodeId,
    highlightedPath,

    // UI actions
    selectNode,
    setHighlightedPath,
  };
};
