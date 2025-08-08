// @/domains/mcts/algorithms/interfaces.ts

import { ResearchTree, TreeNode } from '../../tree/entities/ResearchTree';
import { Workspace } from '../../workspace/entities/Workspace';
import { LibraryItem } from '../../literature/entities/Literature';

// ==================== Core Data Types & Context ====================

/**
 * Defines the context for a single MCTS iteration.
 * It's created by the controller and passed to the algorithm modules.
 * This is much simpler than the old context, as most information
 * is now available within the Workspace and ResearchTree entities.
 */
export interface MCTSContext {
  workspace: Workspace;
  tree: ResearchTree;
}

/**
 * Represents the final result of one full MCTS iteration.
 */
export interface MCTSIterationResult {
  selectedNode: TreeNode;
  expandedNodes: TreeNode[];
  reward: number;
  executionTimeMs: number;
}

/**
 * Configuration for the MCTS algorithm itself.
 */
export interface MCTSConfig {
  explorationConstant: number; // UCT 'c' parameter
  maxIterations: number;
  maxDepth: number;
  batchSize: number; // How many nodes to expand at once
}


// ==================== Atomic Algorithm Module Interfaces ====================
// These interfaces directly correspond to the modules defined in the architecture.

/**
 * 🧠 The Thinker: Generates new research directions from a given node.
 */
export interface IThinker {
  generateDirections(node: TreeNode, context: MCTSContext): Promise<ResearchDirection[]>;
}
export const IThinker = Symbol('IThinker');

export interface ResearchDirection {
  title: string;
  description: string;
  keywords: string[];
}

/**
 * ✍️ The Formulator: Translates a research direction into concrete search queries.
 */
export interface IFormulator {
  formulateQueries(direction: ResearchDirection, context: MCTSContext): Promise<SearchQuery[]>;
}
export const IFormulator = Symbol('IFormulator');

export interface SearchQuery {
  queryText: string;
  queryType: 'semantic' | 'keyword';
}

/**
 * 📚 The Citer: Uses search queries to find relevant literature.
 */
export interface ICiter {
  findCitations(queries: SearchQuery[], context: MCTSContext): Promise<LibraryItem[]>;
}
export const ICiter = Symbol('ICiter');

/**
 * 🎯 The Locator: Selects the most promising node for expansion.
 */
export interface ILocator {
  selectNode(tree: ResearchTree, context: MCTSContext): Promise<TreeNode>;
}
export const ILocator = Symbol('ILocator');

/**
 * ✅ The Validator: Assesses the quality and relevance of a potential new node.
 */
export interface IValidator {
  validateExpansion(
    parentNode: TreeNode, 
    newLiterature: LibraryItem, 
    context: MCTSContext
  ): Promise<ValidationResult>;
}
export const IValidator = Symbol('IValidator');

export interface ValidationResult {
  isValid: boolean;
  score: number;
  reasoning?: string;
}

/**
 * 🏆 The RewardCalculator: Calculates the reward for a new expansion.
 */
export interface IRewardCalculator {
  calculateReward(
    expandedNode: TreeNode, 
    validationResult: ValidationResult, 
    context: MCTSContext
  ): Promise<number>;
}
export const IRewardCalculator = Symbol('IRewardCalculator');


// ==================== Algorithm Factory Interface ====================

/**
 * 🏭 Creates instances of algorithm modules based on configuration.
 * This allows for different strategies to be swapped in and out.
 */
export interface IAlgorithmFactory {
  createThinker(config: any): IThinker;
  createFormulator(config: any): IFormulator;
  createCiter(config: any): ICiter;
  createLocator(config: any): ILocator;
  createValidator(config: any): IValidator;
  createRewardCalculator(config: any): IRewardCalculator;
}

export const IAlgorithmFactory = Symbol('IAlgorithmFactory');
