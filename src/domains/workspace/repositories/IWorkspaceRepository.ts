// @/domains/workspace/repositories/IWorkspaceRepository.ts

import { WorkspaceData } from '../entities/Workspace';

/**
 * Workspace Repository Interface
 * 
 * Defines the contract for all workspace data persistence operations.
 */
export interface IWorkspaceRepository {
  getById(id: string): Promise<WorkspaceData | null>;
  getAll(): Promise<WorkspaceData[]>;
  create(workspace: WorkspaceData): Promise<string>;
  update(workspace: WorkspaceData): Promise<void>;
  delete(id: string): Promise<void>;
  findByName(name: string): Promise<WorkspaceData[]>;
}

// Symbol for dependency injection
export const IWorkspaceRepository = Symbol('IWorkspaceRepository');
