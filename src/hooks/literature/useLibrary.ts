// @/hooks/literature/useLibrary.ts

import { useLibraryStore } from '../../store/literature/libraryStore';
import { shallow } from 'zustand/shallow';

/**
 * Custom hook for interacting with the literature/library domain.
 *
 * Provides a clean interface for UI components to access the global
 * literature library and perform related actions.
 *
 * @returns An object with the current library state and action handlers.
 */
export const useLibrary = () => {
  const {
    items,
    citations,
    isLoading,
    error,
    loadLibrary,
    addItem,
    updateItem,
    deleteItem,
    linkCitationsForItem,
  } = useLibraryStore(
    (state) => ({
      items: state.items,
      citations: state.citations,
      isLoading: state.isLoading,
      error: state.error,
      loadLibrary: state.loadLibrary,
      addItem: state.addItem,
      updateItem: state.updateItem,
      deleteItem: state.deleteItem,
      linkCitationsForItem: state.linkCitationsForItem,
    }),
    shallow
  );

  return {
    // State
    items,
    citations,
    isLoading,
    error,

    // Actions
    loadLibrary,
    addItem,
    updateItem,
    deleteItem,
    linkCitationsForItem,
  };
};
