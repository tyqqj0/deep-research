// @/domains/workspace/services/WorkspaceService.ts

import { inject, injectable, singleton } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { IWorkspaceService } from './IWorkspaceService';
import { IWorkspaceRepository } from '../repositories/IWorkspaceRepository';
import { ITreeService } from '../../tree/services/ITreeService';
import { Workspace, WorkspaceData } from '../entities/Workspace';
import { Logger } from '../../../infrastructure/logging/Logger';
import { ResearchTree } from '../../tree/entities/ResearchTree';
import { MCTSNode } from '../../tree/entities/ResearchTree';

@injectable()
@singleton() // Manage as a singleton to hold the active workspace state
export class WorkspaceService implements IWorkspaceService {
  private logger = Logger.getInstance();
  private activeWorkspaceId: string | null = null;

  constructor(
    @inject(IWorkspaceRepository) private repository: IWorkspaceRepository,
    @inject(ITreeService) private treeService: ITreeService
  ) {}

  async createWorkspace(
    name: string,
    researchTopic: string,
    rootLiteratureId: string
  ): Promise<Workspace> {
    try {
      this.logger.info('Creating new workspace', { name, researchTopic });

      // 1. Create the associated Research Tree
      const rootNodeData: Omit<MCTSNode, 'id'> = {
        parentId: null,
        literatureId: rootLiteratureId,
        visits: 0,
        wins: 0,
      };
      const newTree = await this.treeService.createTree(researchTopic, rootNodeData);

      // 2. Create the Workspace data object
      const workspaceData: WorkspaceData = {
        id: uuidv4(),
        name,
        treeId: newTree.id,
        researchTopic,
        createdAt: new Date(),
        updatedAt: new Date(),
        mcts: {
          status: 'idle',
          currentIteration: 0,
          maxIterations: 100, // Default value
          config: {}, // Default empty config
        },
      };

      // 3. Persist the new workspace
      await this.repository.create(workspaceData);

      const newWorkspace = new Workspace(workspaceData, newTree);
      this.logger.info('Workspace created successfully', { workspaceId: newWorkspace.id });
      return newWorkspace;

    } catch (error) {
      this.logger.error('Failed to create workspace', { name, error });
      throw new Error(`Failed to create workspace: ${error.message}`);
    }
  }

  async getWorkspace(id: string): Promise<Workspace | null> {
    try {
      const workspaceData = await this.repository.getById(id);
      if (!workspaceData) {
        return null;
      }

      const tree = await this.treeService.getTree(workspaceData.treeId);
      if (!tree) {
        this.logger.error('Workspace data consistency error: Tree not found for workspace', { workspaceId: id, treeId: workspaceData.treeId });
        throw new Error(`Data inconsistency: Tree with ID ${workspaceData.treeId} not found for workspace ${id}.`);
      }

      return new Workspace(workspaceData, tree);

    } catch (error) {
      this.logger.error('Failed to get workspace', { workspaceId: id, error });
      throw new Error(`Failed to get workspace: ${error.message}`);
    }
  }

  async getAllWorkspaces(): Promise<Workspace[]> {
    try {
      const workspacesData = await this.repository.getAll();
      const workspaces: Workspace[] = [];

      for (const data of workspacesData) {
        const tree = await this.treeService.getTree(data.treeId);
        if (tree) {
          workspaces.push(new Workspace(data, tree));
        } else {
           this.logger.warn('Skipping workspace with missing tree', { workspaceId: data.id, treeId: data.treeId });
        }
      }
      return workspaces;

    } catch (error) {
      this.logger.error('Failed to get all workspaces', { error });
      throw new Error(`Failed to get all workspaces: ${error.message}`);
    }
  }

  async updateWorkspace(workspace: Workspace): Promise<void> {
    try {
      const workspaceData = workspace.toJSON();
      workspaceData.updatedAt = new Date(); // Ensure updatedAt is current
      await this.repository.update(workspaceData);
      this.logger.info('Workspace updated', { workspaceId: workspace.id });
    } catch (error) {
      this.logger.error('Failed to update workspace', { workspaceId: workspace.id, error });
      throw new Error(`Failed to update workspace: ${error.message}`);
    }
  }

  async deleteWorkspace(id: string): Promise<void> {
    try {
       // It may be desirable to also delete the associated tree.
       // This is a business logic decision. For now, we only delete the workspace.
      await this.repository.delete(id);
      this.logger.info('Workspace deleted', { workspaceId: id });
    } catch (error) {
       this.logger.error('Failed to delete workspace', { workspaceId: id, error });
       throw new Error(`Failed to delete workspace: ${error.message}`);
    }
  }

  async activateWorkspace(workspaceId: string): Promise<void> {
    this.logger.info('Activating workspace', { workspaceId });
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace with ID ${workspaceId} not found.`);
    }
    this.activeWorkspaceId = workspaceId;
  }

  async getActiveWorkspace(): Promise<Workspace | null> {
    if (!this.activeWorkspaceId) {
      return null;
    }
    return this.getWorkspace(this.activeWorkspaceId);
  }
}
