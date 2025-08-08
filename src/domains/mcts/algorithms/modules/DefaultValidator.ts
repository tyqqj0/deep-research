// @/domains/mcts/algorithms/modules/DefaultValidator.ts

import { injectable } from 'tsyringe';
import { IValidator, MCTSContext, ValidationResult } from '../interfaces';
import { TreeNode } from '../../../tree/entities/ResearchTree';
import { LibraryItem } from '../../../literature/entities/Literature';
import { Logger } from '../../../../infrastructure/logging/Logger';

/**
 * Default implementation of the Validator module.
 * Validates if a new literature item is appropriate for expanding a node.
 */
@injectable()
export class DefaultValidator implements IValidator {
  private logger = Logger.getInstance();

  constructor() {
    this.logger.info('DefaultValidator initialized');
  }

  async validateExpansion(
    parentNode: TreeNode, 
    newLiterature: LibraryItem, 
    context: MCTSContext
  ): Promise<ValidationResult> {
    this.logger.debug('Validating expansion', { 
      parentNodeId: parentNode.id, 
      literatureId: newLiterature.id 
    });
    
    // In a real implementation, this would perform sophisticated validation
    // to determine if this literature item represents a meaningful expansion.
    // Checks might include:
    // 1. Is this literature already in the tree?
    // 2. Is it sufficiently different from existing nodes?
    // 3. Is it relevant to the research topic?
    // 4. Does it have sufficient quality?
    
    // For this simple implementation, we'll just do a basic check
    // to see if this literature is already in the current path
    
    // Get the current path from root to parent
    const path = this.getPathToNode(parentNode.id, context.tree);
    
    // Check if this literature is already in the path
    const isDuplicate = path.some(node => {
      const nodeLiterature = context.tree.getNodeLiterature(node.id);
      return nodeLiterature && nodeLiterature.id === newLiterature.id;
    });
    
    if (isDuplicate) {
      return {
        isValid: false,
        score: 0,
        reasoning: 'Literature is already in the current research path'
      };
    }
    
    // For testing, we'll return a random score between 0.6 and 1.0
    // In a real implementation, this would be a calculated relevance score
    const score = 0.6 + Math.random() * 0.4;
    
    return {
      isValid: true,
      score,
      reasoning: 'Literature appears relevant and is not a duplicate'
    };
  }
  
  /**
   * Helper method to get the path from root to a specified node.
   */
  private getPathToNode(nodeId: string, tree: any): TreeNode[] {
    const path: TreeNode[] = [];
    let currentNodeId = nodeId;
    
    while (currentNodeId) {
      const currentNode = tree.getNode(currentNodeId);
      if (!currentNode) break;
      
      path.unshift(currentNode); // Add to front of array
      
      if (currentNode.id === tree.rootId) break; // Reached the root
      currentNodeId = currentNode.parentId;
    }
    
    return path;
  }
}