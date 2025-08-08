// @/domains/workspace/entities/Workspace.ts

import { z } from 'zod';
import { ResearchTree } from '../../tree/entities/ResearchTree';

// Define Zod schema for validation
export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  treeId: z.string().uuid(),
  researchTopic: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),

  // MCTS algorithm settings and state
  mcts: z.object({
    status: z.enum(['idle', 'running', 'paused', 'completed', 'failed']),
    currentIteration: z.number().int().min(0),
    maxIterations: z.number().int().min(1),
    config: z.any(), // Will be replaced by a proper MCTS config schema
  }),
});

export type WorkspaceData = z.infer<typeof WorkspaceSchema>;

/**
 * Represents a research workspace/session.
 * 
 * This class encapsulates the state of a single research task,
 * including its associated research tree and MCTS algorithm state.
 * It acts as the central coordinator for a research session.
 */
export class Workspace {
  public readonly id: string;
  public name: string;
  public readonly treeId: string;
  public researchTopic: string;
  public readonly createdAt: Date;
  public updatedAt: Date;
  public mcts: WorkspaceData['mcts'];

  private tree: ResearchTree;

  constructor(data: WorkspaceData, tree: ResearchTree) {
    // Validate data on construction
    WorkspaceSchema.parse(data);

    if (data.treeId !== tree.id) {
      throw new Error('Workspace treeId does not match the provided ResearchTree entity.');
    }

    this.id = data.id;
    this.name = data.name;
    this.treeId = data.treeId;
    this.researchTopic = data.researchTopic;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.mcts = data.mcts;
    this.tree = tree;
  }

  public getTree(): ResearchTree {
    return this.tree;
  }

  public startMctsRun(maxIterations?: number): void {
    if (this.mcts.status === 'running') {
      throw new Error('MCTS run is already in progress.');
    }
    this.mcts.status = 'running';
    this.mcts.currentIteration = 0;
    if (maxIterations) {
      this.mcts.maxIterations = maxIterations;
    }
    this.updatedAt = new Date();
  }

  public pauseMctsRun(): void {
    if (this.mcts.status !== 'running') {
      throw new Error('No MCTS run is currently active.');
    }
    this.mcts.status = 'paused';
    this.updatedAt = new Date();
  }

  public completeMctsRun(): void {
    this.mcts.status = 'completed';
    this.updatedAt = new Date();
  }

  public toJSON(): WorkspaceData {
    return {
      id: this.id,
      name: this.name,
      treeId: this.treeId,
      researchTopic: this.researchTopic,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      mcts: this.mcts,
    };
  }
}
