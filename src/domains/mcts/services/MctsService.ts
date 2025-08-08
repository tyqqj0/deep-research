// @/domains/mcts/services/MctsService.ts

import { inject, injectable } from 'tsyringe';
import { IMctsService } from './IMctsService';
import { IWorkspaceService } from '../../workspace/services/IWorkspaceService';
import { SGMCTSController } from '../controller/SGMCTSController';
import { Workspace } from '../../workspace/entities/Workspace';
import { Logger } from '../../../infrastructure/logging/Logger';

@injectable()
export class MctsService implements IMctsService {
  private logger = Logger.getInstance();

  constructor(
    @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
    @inject(SGMCTSController) private mctsController: SGMCTSController
  ) {}

  async runContinuous(iterations: number): Promise<Workspace> {
    const workspace = await this.getActiveWorkspaceOrFail();
    
    this.logger.info('Starting continuous MCTS run', { workspaceId: workspace.id, iterations });
    workspace.startMctsRun(iterations);
    await this.workspaceService.updateWorkspace(workspace);

    // This loop would be more complex in a real-world scenario,
    // with proper handling for pausing, resuming, and stopping.
    for (let i = 0; i < iterations; i++) {
      if (workspace.mcts.status !== 'running') {
        this.logger.info('MCTS run interrupted', { status: workspace.mcts.status });
        break;
      }
      await this.mctsController.runSingleIteration(workspace);
    }

    if (workspace.mcts.status === 'running') {
      workspace.completeMctsRun();
      await this.workspaceService.updateWorkspace(workspace);
    }
    
    this.logger.info('Continuous MCTS run finished.', { workspaceId: workspace.id });
    return workspace;
  }

  async runSingleStep(): Promise<Workspace> {
    const workspace = await this.getActiveWorkspaceOrFail();
    
    this.logger.info('Running single MCTS step', { workspaceId: workspace.id });
    workspace.startMctsRun(workspace.mcts.maxIterations); // Ensure status is 'running'
    
    await this.mctsController.runSingleIteration(workspace);

    // After a single step, we might want to pause it immediately.
    workspace.pauseMctsRun();
    await this.workspaceService.updateWorkspace(workspace);
    
    return workspace;
  }

  async pauseRun(): Promise<void> {
    const workspace = await this.getActiveWorkspaceOrFail();
    if (workspace.mcts.status === 'running') {
      workspace.pauseMctsRun();
      await this.workspaceService.updateWorkspace(workspace);
      this.logger.info('MCTS run paused', { workspaceId: workspace.id });
    }
  }

  async resumeRun(): Promise<Workspace> {
    const workspace = await this.getActiveWorkspaceOrFail();
    if (workspace.mcts.status === 'paused') {
      workspace.startMctsRun(); // Resets status to 'running'
      return this.runContinuous(workspace.mcts.maxIterations - workspace.mcts.currentIteration);
    }
    return workspace;
  }

  async getStatus(): Promise<{
    status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
    currentIteration: number;
    maxIterations: number;
  } | null> {
    const workspace = await this.workspaceService.getActiveWorkspace();
    if (!workspace) {
      return null;
    }
    return workspace.mcts;
  }

  private async getActiveWorkspaceOrFail(): Promise<Workspace> {
    const workspace = await this.workspaceService.getActiveWorkspace();
    if (!workspace) {
      this.logger.error('No active workspace found for MCTS operation.');
      throw new Error('No active workspace. Please activate a workspace before running MCTS.');
    }
    return workspace;
  }
}
