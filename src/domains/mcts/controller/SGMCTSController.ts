// @/domains/mcts/controller/SGMCTSController.ts

import { inject, injectable } from 'tsyringe';
import { IThinker, IFormulator, ICiter, ILocator, IValidator, IRewardCalculator, MCTSContext } from '../algorithms/interfaces';
import { IWorkspaceService } from '../../workspace/services/IWorkspaceService';
import { ResearchTree, TreeNode } from '../../tree/entities/ResearchTree';
import { Workspace } from '../../workspace/entities/Workspace';
import { LibraryItem } from '../../literature/entities/Literature';
import { Logger } from '../../../infrastructure/logging/Logger';

/**
 * Self-Guiding Monte Carlo Tree Search (SG-MCTS) Controller
 * 
 * This class orchestrates the entire MCTS process for a given workspace.
 * It uses dependency injection to compose the specific algorithm modules
 * and executes the main MCTS loop (Select, Expand, Evaluate, Backpropagate).
 */
@injectable()
export class SGMCTSController {
  private logger = Logger.getInstance();

  constructor(
    // Algorithm modules are injected
    @inject('IThinker') private thinker: IThinker,
    @inject('IFormulator') private formulator: IFormulator,
    @inject('ICiter') private citer: ICiter,
    @inject('ILocator') private locator: ILocator,
    @inject('IValidator') private validator: IValidator,
    @inject('IRewardCalculator') private rewardCalculator: IRewardCalculator,
    // Domain services are injected
    @inject(IWorkspaceService) private workspaceService: IWorkspaceService
  ) {}

  /**
   * Runs a single, complete iteration of the MCTS algorithm.
   * @param workspace - The workspace containing the tree and state.
   * @returns The node that was expanded during this iteration.
   */
  public async runSingleIteration(workspace: Workspace): Promise<TreeNode | null> {
    const tree = workspace.getTree();
    const context: MCTSContext = { workspace, tree };
    
    this.logger.info('Starting MCTS iteration', { workspaceId: workspace.id, iteration: workspace.mcts.currentIteration });

    try {
      // 1. SELECTION: Use the Locator to find the most promising node to expand.
      const selectedNode = await this.locator.selectNode(tree, context);
      this.logger.debug('Node selected', { nodeId: selectedNode.id });

      // 2. EXPANSION: Generate new child nodes for the selected node.
      const expandedNodes = await this.expand(selectedNode, context);
      if (expandedNodes.length === 0) {
        this.logger.warn('Expansion phase yielded no new nodes.', { selectedNodeId: selectedNode.id });
        // Optionally handle this case, e.g., by marking the node as fully explored.
        return null;
      }
      this.logger.debug('Expansion complete', { expandedCount: expandedNodes.length });

      // 3. EVALUATION & BACKPROPAGATION: For each new node, validate, calculate reward, and backpropagate.
      for (const newNode of expandedNodes) {
        // Create a validation result (in a real scenario, this would be more complex)
        const validationResult = { isValid: true, score: 0.8 }; 
        const reward = await this.rewardCalculator.calculateReward(newNode, validationResult, context);
        this.logger.debug('Reward calculated', { nodeId: newNode.id, reward });
        
        // 4. BACKPROPAGATION: Update the statistics of the tree from the new node up to the root.
        tree.backpropagate(newNode.id, reward);
        this.logger.debug('Backpropagation complete', { startNodeId: newNode.id });
      }

      // 5. Update workspace state
      workspace.mcts.currentIteration++;
      await this.workspaceService.updateWorkspace(workspace);

      this.logger.info('MCTS iteration completed successfully.', { workspaceId: workspace.id });
      return expandedNodes[0]; // Return the first expanded node as a representative result

    } catch (error) {
      this.logger.error('MCTS iteration failed', { workspaceId: workspace.id, error });
      // Here you would also update the workspace status to 'failed'
      throw error;
    }
  }

  /**
   * The expansion phase, which is a multi-step process (Think -> Formulate -> Cite).
   * @param parentNode - The node to expand from.
   * @param context - The current MCTS context.
   * @returns An array of new, validated, and created TreeNodes.
   */
  private async expand(parentNode: TreeNode, context: MCTSContext): Promise<TreeNode[]> {
    const tree = context.tree;
    const newNodes: TreeNode[] = [];

    // Step 2a: THINK - Generate new research directions.
    const directions = await this.thinker.generateDirections(parentNode, context);

    for (const direction of directions) {
      // Step 2b: FORMULATE - Create search queries from the direction.
      const queries = await this.formulator.formulateQueries(direction, context);

      // Step 2c: CITE - Find relevant literature using the queries.
      const literatureItems = await this.citer.findCitations(queries, context);

      for (const item of literatureItems) {
        // Step 2d: VALIDATE - Check if this is a valid and valuable expansion.
        const validationResult = await this.validator.validateExpansion(parentNode, item, context);
        if (validationResult.isValid) {
          
          // If valid, create a new node in the tree.
          const newNodeData: Omit<TreeNode, 'id'> = {
            parentId: parentNode.id,
            literatureId: item.id,
            visits: 0,
            wins: 0,
          };
          // The tree service would handle the actual creation and return the full TreeNode
          // For now, we'll simulate this.
          const newNode: TreeNode = { id: `new_node_${Math.random()}`, ...newNodeData };
          tree.addNode(newNode);
          newNodes.push(newNode);
        }
      }
    }

    return newNodes;
  }
}
