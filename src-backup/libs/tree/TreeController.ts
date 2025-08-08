import { LiteratureTree, MCTSNode } from '../db';
import { generateNodeId } from '../utils/uuid';
import { treeService } from './TreeService';

export class TreeController {
  private tree: LiteratureTree;
  private service: any;

  constructor(rawTree: LiteratureTree, libraryService: any) {
    this.tree = rawTree;
    this.service = libraryService;
  }

  // Basic tree operation methods
  getNode(nodeId: string): MCTSNode | undefined {
    return this.tree.nodes[nodeId];
  }

  getChildren(nodeId: string): MCTSNode[] {
    return Object.values(this.tree.nodes).filter(node => node.parentId === nodeId);
  }

  findBestChild(nodeId: string, explorationConstant = 1.41): MCTSNode | null {
    const children = this.getChildren(nodeId);
    if (children.length === 0) return null;

    const parentNode = this.getNode(nodeId);
    if (!parentNode) return null;

    let bestChild: MCTSNode | null = null;
    let bestUCTValue = -Infinity;

    for (const child of children) {
      if (child.visits === 0) {
        // Unvisited nodes have infinite UCT value
        return child;
      }

      // UCT formula: exploitation + exploration
      const exploitation = child.wins / child.visits;
      const exploration = explorationConstant * Math.sqrt(Math.log(parentNode.visits) / child.visits);
      const uctValue = exploitation + exploration;

      if (uctValue > bestUCTValue) {
        bestUCTValue = uctValue;
        bestChild = child;
      }
    }

    return bestChild;
  }

  addChild(parentId: string, newItemId: string): MCTSNode {
    const newNode: MCTSNode = {
      id: generateNodeId(),
      parentId,
      libraryItemId: newItemId,
      visits: 0,
      wins: 0
    };

    this.tree.nodes[newNode.id] = newNode;
    return newNode;
  }

  // MCTS algorithm flow methods
  runSimulation(): void {
    const selectedNode = this._selectNode();
    const expandedNode = this._expandNode(selectedNode);
    const simulationResult = this._simulate(expandedNode);
    this._backpropagate(expandedNode, simulationResult);
  }

  private _selectNode(): MCTSNode {
    let currentNode = this.getNode(this.tree.rootNodeId);
    if (!currentNode) {
      throw new Error('Root node not found');
    }

    // Navigate down the tree using UCT until we find a leaf or expandable node
    while (true) {
      const children = this.getChildren(currentNode.id);
      
      // If this is a leaf node (no children), return it
      if (children.length === 0) {
        return currentNode;
      }

      // Find the best child using UCT
      const bestChild = this.findBestChild(currentNode.id);
      if (!bestChild) {
        return currentNode;
      }

      // Check if we can expand this node (has unvisited children potential)
      // For now, we'll assume we can always expand by adding new literature items
      if (bestChild.visits === 0) {
        return currentNode; // Return parent for expansion
      }

      currentNode = bestChild;
    }
  }

  private _expandNode(node: MCTSNode): MCTSNode {
    // For demonstration, we'll create a new child with a random literature item ID
    // In a real implementation, this would be based on available literature items
    const newItemId = `item_${generateNodeId()}`;
    return this.addChild(node.id, newItemId);
  }

  private _simulate(node: MCTSNode): number {
    // Simple random simulation - returns a value between 0 and 1
    return Math.random();
  }

  private _backpropagate(startNode: MCTSNode, result: number): void {
    let currentNode: MCTSNode | undefined = startNode;

    while (currentNode) {
      // Update visit count
      currentNode.visits += 1;
      
      // Update wins (add the simulation result)
      currentNode.wins += result;

      // Move to parent node
      if (currentNode.parentId === null) {
        break;
      }
      currentNode = this.getNode(currentNode.parentId);
    }
  }

  // 🎯 持久化方法 - 保存树到数据库
  async save(): Promise<void> {
    try {
      await treeService.updateTree(this.tree);
      console.log(`💾 [TreeController] 树已保存到数据库: ${this.tree.id}`);
    } catch (error) {
      console.error(`❌ [TreeController] 保存树失败:`, error);
      throw error;
    }
  }
}