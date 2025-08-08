// @/hooks/workspace/useWorkspace.ts

import { useWorkspaceStore } from '../../store/workspace/workspaceStore';
import { shallow } from 'zustand/shallow';

/**
 * Custom hook for interacting with the workspace domain.
 *
 * This hook provides a simplified and stable interface for UI components
 * to access workspace data and perform actions, abstracting away the
 * underlying zustand store.
 *
 * @returns An object with the current workspace state and action handlers.
 */
export const useWorkspace = () => {
  // Use a selector with shallow comparison to prevent unnecessary re-renders.
  // Components will only re-render if the properties they subscribe to change.
  const {
    workspaces,
    activeWorkspace,
    isLoading,
    error,
    loadWorkspaces,
    createWorkspace,
    activateWorkspace,
    runMctsContinuous,
    runMctsSingleStep,
    pauseMcts,
  } = useWorkspaceStore(
    (state) => ({
      workspaces: state.workspaces,
      activeWorkspace: state.activeWorkspace,
      isLoading: state.isLoading,
      error: state.error,
      loadWorkspaces: state.loadWorkspaces,
      createWorkspace: state.createWorkspace,
      activateWorkspace: state.activateWorkspace,
      runMctsContinuous: state.runMctsContinuous,
      runMctsSingleStep: state.runMctsSingleStep,
      pauseMcts: state.pauseMcts,
    }),
    shallow
  );

  return {
    // State
    workspaces,
    activeWorkspace,
    isLoading,
    error,

    // Actions
    loadWorkspaces,
    createWorkspace,
    activateWorkspace,
    runMctsContinuous,
    runMctsSingleStep,
    pauseMcts,
  };
};
