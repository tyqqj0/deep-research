// @/store/workspace/workspaceStore.ts

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Workspace } from '../../domains/workspace/entities/Workspace';
import { IWorkspaceService } from '../../domains/workspace/services/IWorkspaceService';
import { IMctsService } from '../../domains/mcts/services/IMctsService';
import container from '../../infrastructure/di/container';

// Resolve services from the DI container
const workspaceService = container.resolve<IWorkspaceService>(IWorkspaceService);
const mctsService = container.resolve<IMctsService>(IMctsService);

// ==================== State & Actions Interface ====================

export interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;
}

export interface WorkspaceActions {
  // Workspace management
  loadWorkspaces: () => Promise<void>;
  createWorkspace: (name: string, researchTopic: string, rootLiteratureId: string) => Promise<Workspace | null>;
  activateWorkspace: (workspaceId: string) => Promise<void>;
  
  // MCTS operations on the active workspace
  runMctsContinuous: (iterations: number) => Promise<void>;
  runMctsSingleStep: () => Promise<void>;
  pauseMcts: () => Promise<void>;
}

// ==================== Store Implementation ====================

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()(
  devtools(
    (set, get) => ({
      // Initial State
      workspaces: [],
      activeWorkspace: null,
      isLoading: false,
      error: null,

      // --- Actions ---

      // Load all available workspaces
      loadWorkspaces: async () => {
        try {
          set({ isLoading: true, error: null });
          const workspaces = await workspaceService.getAllWorkspaces();
          set({ workspaces, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },

      // Create a new workspace
      createWorkspace: async (name, researchTopic, rootLiteratureId) => {
        try {
          set({ isLoading: true, error: null });
          const newWorkspace = await workspaceService.createWorkspace(name, researchTopic, rootLiteratureId);
          set((state) => ({
            workspaces: [...state.workspaces, newWorkspace],
            isLoading: false,
          }));
          return newWorkspace;
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          return null;
        }
      },

      // Set a workspace as the active one
      activateWorkspace: async (workspaceId: string) => {
        try {
          set({ isLoading: true, error: null });
          await workspaceService.activateWorkspace(workspaceId);
          const activeWorkspace = await workspaceService.getActiveWorkspace();
          set({ activeWorkspace, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },

      // Run MCTS continuously on the active workspace
      runMctsContinuous: async (iterations: number) => {
        const { activeWorkspace } = get();
        if (!activeWorkspace) {
          set({ error: 'No active workspace to run MCTS on.' });
          return;
        }
        try {
          set({ isLoading: true, error: null });
          const updatedWorkspace = await mctsService.runContinuous(iterations);
          set({ activeWorkspace: updatedWorkspace, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },

      // Run a single MCTS step
      runMctsSingleStep: async () => {
         const { activeWorkspace } = get();
        if (!activeWorkspace) {
          set({ error: 'No active workspace to run MCTS on.' });
          return;
        }
        try {
          set({ isLoading: true, error: null });
          const updatedWorkspace = await mctsService.runSingleStep();
          set({ activeWorkspace: updatedWorkspace, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },
      
      // Pause the current MCTS run
      pauseMcts: async () => {
        try {
          set({ isLoading: true, error: null });
          await mctsService.pauseRun();
          const activeWorkspace = await workspaceService.getActiveWorkspace();
          set({ activeWorkspace, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },
    }),
    { name: 'WorkspaceStore' }
  )
);
