// @/infrastructure/database/repositories/DexieWorkspaceRepository.ts

import { injectable } from 'tsyringe';
import { IWorkspaceRepository } from '@/domains/workspace/repositories/IWorkspaceRepository';
import { WorkspaceData } from '@/domains/workspace/entities/Workspace';
import { db } from '@/infrastructure/database/dexie/connection';
import { Logger } from '../../logging/Logger';

@injectable()
export class DexieWorkspaceRepository implements IWorkspaceRepository {
  private logger = Logger.getInstance();

  async getById(id: string): Promise<WorkspaceData | null> {
    try {
      this.logger.debug('Fetching workspace by ID', { workspaceId: id });
      const workspace = await db.workspaces.get(id);
      return workspace ? this.mapToWorkspaceData(workspace) : null;
    } catch (error) {
      this.logger.error('Failed to fetch workspace by ID', { workspaceId: id, error });
      throw new Error(`Failed to fetch workspace with ID: ${id}`);
    }
  }

  async getAll(): Promise<WorkspaceData[]> {
    try {
      this.logger.debug('Fetching all workspaces');
      const workspaces = await db.workspaces.toArray();
      return workspaces.map(this.mapToWorkspaceData);
    } catch (error) {
      this.logger.error('Failed to fetch all workspaces', { error });
      throw new Error('Failed to fetch workspaces');
    }
  }

  async create(workspace: WorkspaceData): Promise<string> {
    try {
      this.logger.debug('Creating new workspace', { workspaceId: workspace.id });
      await db.workspaces.add(this.mapToDbObject(workspace));
      return workspace.id;
    } catch (error) {
      this.logger.error('Failed to create workspace', { workspaceId: workspace.id, error });
      throw new Error('Failed to create workspace');
    }
  }

  async update(workspace: WorkspaceData): Promise<void> {
    try {
      this.logger.debug('Updating workspace', { workspaceId: workspace.id });
      await db.workspaces.put(this.mapToDbObject(workspace));
    } catch (error) {
      this.logger.error('Failed to update workspace', { workspaceId: workspace.id, error });
      throw new Error('Failed to update workspace');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      this.logger.debug('Deleting workspace', { workspaceId: id });
      await db.workspaces.delete(id);
    } catch (error) {
      this.logger.error('Failed to delete workspace', { workspaceId: id, error });
      throw new Error('Failed to delete workspace');
    }
  }

  async findByName(name: string): Promise<WorkspaceData[]> {
    try {
      this.logger.debug('Finding workspaces by name', { name });
      const workspaces = await db.workspaces.where('name').equalsIgnoreCase(name).toArray();
      return workspaces.map(this.mapToWorkspaceData);
    } catch (error) {
      this.logger.error('Failed to find workspaces by name', { name, error });
      throw new Error('Failed to find workspaces by name');
    }
  }

  private mapToWorkspaceData(dbObject: any): WorkspaceData {
    return {
      id: dbObject.id,
      name: dbObject.name,
      treeId: dbObject.treeId,
      researchTopic: dbObject.researchTopic,
      createdAt: dbObject.createdAt,
      updatedAt: dbObject.updatedAt,
      mcts: dbObject.mcts || {
        status: 'idle',
        currentIteration: 0,
        maxIterations: 50,
        config: {},
      },
    };
  }
  
  private mapToDbObject(workspaceData: WorkspaceData): any {
    return {
      id: workspaceData.id,
      name: workspaceData.name,
      treeId: workspaceData.treeId,
      researchTopic: workspaceData.researchTopic,
      createdAt: workspaceData.createdAt,
      updatedAt: workspaceData.updatedAt,
      mcts: workspaceData.mcts,
    };
  }
}
