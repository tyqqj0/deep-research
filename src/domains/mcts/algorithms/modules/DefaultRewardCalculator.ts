// @/domains/mcts/algorithms/modules/DefaultRewardCalculator.ts

import { injectable } from 'tsyringe';
import { IRewardCalculator, MCTSContext, ValidationResult } from '../interfaces';
import { TreeNode } from '../../../tree/entities/ResearchTree';
import { Logger } from '../../../../infrastructure/logging/Logger';

/**
 * Default implementation of the RewardCalculator module.
 * Calculates the reward value for a node expansion.
 */
@injectable()
export class DefaultRewardCalculator implements IRewardCalculator {
  private logger = Logger.getInstance();

  constructor() {
    this.logger.info('DefaultRewardCalculator initialized');
  }

  async calculateReward(
    expandedNode: TreeNode, 
    validationResult: ValidationResult, 
    context: MCTSContext
  ): Promise<number> {
    this.logger.debug('Calculating reward', { 
      nodeId: expandedNode.id, 
      validationScore: validationResult.score 
    });
    
    // In a real implementation, this would consider multiple factors:
    // 1. Validation score (relevance, quality)
    // 2. Citation importance (citation count, journal impact)
    // 3. Novelty (how different from existing nodes)
    // 4. Depth in the tree (potentially)
    // 5. Alignment with research goals
    
    // For this simple implementation, we'll primarily use the validation score
    // with a small random factor to introduce some exploration
    
    // Get the literature for this node
    const literature = context.tree.getNodeLiterature(expandedNode.id);
    
    // Base reward is the validation score
    let reward = validationResult.score;
    
    // Add some weight based on literature attributes if available
    if (literature) {
      // Consider citation count if available (normalized to 0-0.2 range)
      const citationFactor = literature.citationCount 
        ? Math.min(literature.citationCount / 100, 0.2) 
        : 0;
      
      // Consider recency if available (newer is better, 0-0.1 range)
      const currentYear = new Date().getFullYear();
      const publicationYear = literature.year ? parseInt(literature.year) : currentYear;
      const recencyFactor = Math.max(0, Math.min((publicationYear - 2000) / 200, 0.1));
      
      // Add these factors to the reward
      reward += citationFactor + recencyFactor;
    }
    
    // Add a small random factor (0-0.1) to prevent getting stuck in local optima
    const randomFactor = Math.random() * 0.1;
    reward += randomFactor;
    
    // Ensure reward is in 0-1 range
    reward = Math.max(0, Math.min(reward, 1));
    
    return reward;
  }
}