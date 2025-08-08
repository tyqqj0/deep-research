// @/domains/workspace/services/IWorkspaceService.ts

import { Workspace } from '../entities/Workspace';
import { ResearchTree } from '../../tree/entities/ResearchTree';

/**
 * Workspace Service Interface
 *
 * Defines the contract for workspace business logic operations.
 * This service manages the lifecycle of workspaces (research sessions).
 */
export interface IWorkspaceService {
  /**
   * Creates a new workspace with a new research tree.
   * @param name - The name of the workspace.
   * @param researchTopic - The initial research topic.
   * @param rootLiteratureId - The ID of the root literature item for the new tree.
   * @returns The newly created Workspace entity.
   */
  createWorkspace(
    name: string,
    researchTopic: string,
    rootLiteratureId: string
  ): Promise<Workspace>;

  /**
   * Gets a single workspace by its ID.
   * @param id - The ID of the workspace.
   * @returns The Workspace entity or null if not found.
   */
  getWorkspace(id: string): Promise<Workspace | null>;

  /**
   * Gets all available workspaces.
   * @returns An array of Workspace entities.
   */
  getAllWorkspaces(): Promise<Workspace[]>;

  /**
   * Updates an existing workspace.
   * @param workspace - The Workspace entity with updated data.
   */
  updateWorkspace(workspace: Workspace): Promise<void>;

  /**
   * Deletes a workspace. Note: This might also involve deleting the associated tree.
   * @param id - The ID of the workspace to delete.
   */
  deleteWorkspace(id: string): Promise<void>;

  /**
   * Activates a workspace, making it the current one for operations.
   * @param workspaceId - The ID of the workspace to activate.
   */
  activateWorkspace(workspaceId: string): Promise<void>;

  /**
   * Gets the currently active workspace.
   * @returns The active Workspace entity or null if none is active.
   */
  getActiveWorkspace(): Promise<Workspace | null>;
}

// Symbol for dependency injection
export const IWorkspaceService = Symbol('IWorkspaceService');
