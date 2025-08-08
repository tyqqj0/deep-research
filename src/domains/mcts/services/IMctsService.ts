// @/domains/mcts/services/IMctsService.ts

import { Workspace } from '../../workspace/entities/Workspace';

/**
 * MCTS Service Interface
 *
 * Defines the contract for high-level MCTS operations.
 * This service acts as the primary entry point for the application layer
 * to interact with the MCTS engine.
 */
export interface IMctsService {
  /**
   * Runs the MCTS algorithm for a specified number of iterations on the active workspace.
   * @param iterations - The number of iterations to run.
   * @returns The updated workspace after the run.
   */
  runContinuous(iterations: number): Promise<Workspace>;

  /**
   * Runs a single iteration of the MCTS algorithm on the active workspace.
   * @returns The updated workspace.
   */
  runSingleStep(): Promise<Workspace>;

  /**
   * Pauses an ongoing MCTS run.
   */
  pauseRun(): Promise<void>;

  /**
   * Resumes a paused MCTS run.
   */
  resumeRun(): Promise<Workspace>;

  /**
   * Gets the status of the current MCTS run for the active workspace.
   * @returns The MCTS status object, or null if no workspace is active.
   */
  getStatus(): Promise<{
    status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
    currentIteration: number;
    maxIterations: number;
  } | null>;
}

export const IMctsService = Symbol('IMctsService');
