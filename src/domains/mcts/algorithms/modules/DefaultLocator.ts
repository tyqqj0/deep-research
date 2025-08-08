// @/domains/mcts/algorithms/modules/DefaultLocator.ts

import { injectable } from 'tsyringe';
import { ILocator, MCTSContext } from '../interfaces';
import { ResearchTree, TreeNode } from '../../../tree/entities/ResearchTree';
import { Logger } from '../../../../infrastructure/logging/Logger';

/**
 * Default implementation of the Locator module.
 * Implements the UCT (Upper Confidence Bound for Trees) selection strategy.
 */
@injectable()
export class DefaultLocator implements ILocator {
  private logger = Logger.getInstance();
  private explorationConstant = 1.414; // Standard UCT exploration constant (sqrt(2))

  constructor() {
    this.logger.info('DefaultLocator initialized');
  }

  async selectNode(tree: ResearchTree, context: MCTSContext): Promise<TreeNode> {
    this.logger.debug('Selecting node for expansion');
    
    const rootNode = tree.getNode(tree.rootId);
    if (!rootNode) {
      throw new Error('Root node not found in tree');
    }
    
    // If the tree only has a root node, return it
    const children = tree.getChildNodes(rootNode.id);
    if (children.length === 0) {
      return rootNode;
    }
    
    // Otherwise, perform UCT selection from the root
    return this.selectBestNodeUCT(rootNode, tree);
  }
  
  /**
   * Recursively selects the best node using UCT algorithm.
   * This is a simple implementation of the standard UCT formula.
   */
  private selectBestNodeUCT(parentNode: TreeNode, tree: ResearchTree): TreeNode {
    const children = tree.getChildNodes(parentNode.id);
    
    // If node has no children, return it
    if (children.length === 0) {
      return parentNode;
    }
    
    // If any child has no visits, select it (exploration)
    const unvisitedChild = children.find(child => child.visits === 0);
    if (unvisitedChild) {
      return unvisitedChild;
    }
    
    // Otherwise, calculate UCT values for all children
    let bestChild: TreeNode | null = null;
    let bestUCTValue = -Infinity;
    
    for (const child of children) {
      // UCT formula: (wins/visits) + C * sqrt(ln(parentVisits) / visits)
      const exploitation = child.wins / child.visits;
      const exploration = this.explorationConstant * Math.sqrt(Math.log(parentNode.visits) / child.visits);
      const uctValue = exploitation + exploration;
      
      if (uctValue > bestUCTValue) {
        bestUCTValue = uctValue;
        bestChild = child;
      }
    }
    
    if (!bestChild) {
      throw new Error('Failed to select best child node');
    }
    
    // Recursively select from the best child
    return this.selectBestNodeUCT(bestChild, tree);
  }
}