// @/domains/tree/services/TreeService.ts

import { inject, injectable } from 'tsyringe';
import { ITreeService } from './ITreeService';
import { ITreeRepository } from '../repositories/ITreeRepository';
import { ResearchTree, ResearchTreeData, TreeNode } from '../entities/ResearchTree';
import { Logger } from '../../../infrastructure/logging/Logger';
import { v4 as uuidv4 } from 'uuid';

@injectable()
export class TreeService implements ITreeService {
  private logger = Logger.getInstance();

  constructor(
    @inject(ITreeRepository) private repository: ITreeRepository
  ) {}

  async createTree(name: string, rootNodeData: Omit<TreeNode, 'id'>): Promise<ResearchTree> {
    try {
      const treeId = uuidv4();
      const rootNodeId = uuidv4();

      // Create the root node
      const rootNode: TreeNode = {
        id: rootNodeId,
        ...rootNodeData
      };

      // Create the tree data
      const treeData: ResearchTreeData = {
        id: treeId,
        name,
        rootNodeId,
        nodes: { [rootNodeId]: rootNode },
        createdAt: new Date()
      };

      // Save to repository
      await this.repository.createTree(treeData);

      // Return as ResearchTree entity
      const tree = new ResearchTree(treeData);
      this.logger.info('Tree created successfully', { treeId, name });
      return tree;
    } catch (error) {
      this.logger.error('Failed to create tree', { name, error });
      throw new Error(`Failed to create tree: ${error.message}`);
    }
  }

  async getTree(id: string): Promise<ResearchTree | null> {
    try {
      const treeData = await this.repository.getTreeById(id);
      if (!treeData) {
        return null;
      }

      return new ResearchTree(treeData);
    } catch (error) {
      this.logger.error('Failed to get tree', { treeId: id, error });
      throw new Error(`Failed to get tree: ${error.message}`);
    }
  }

  async getAllTrees(): Promise<ResearchTree[]> {
    try {
      const treesData = await this.repository.getAllTrees();
      return treesData.map(data => new ResearchTree(data));
    } catch (error) {
      this.logger.error('Failed to get all trees', { error });
      throw new Error(`Failed to get all trees: ${error.message}`);
    }
  }

  async updateTree(tree: ResearchTree): Promise<void> {
    try {
      const treeData = tree.toJSON();
      await this.repository.updateTree(treeData);
      this.logger.info('Tree updated successfully', { treeId: tree.id });
    } catch (error) {
      this.logger.error('Failed to update tree', { treeId: tree.id, error });
      throw new Error(`Failed to update tree: ${error.message}`);
    }
  }

  async deleteTree(id: string): Promise<void> {
    try {
      await this.repository.deleteTree(id);
      this.logger.info('Tree deleted successfully', { treeId: id });
    } catch (error) {
      this.logger.error('Failed to delete tree', { treeId: id, error });
      throw new Error(`Failed to delete tree: ${error.message}`);
    }
  }

  async addNode(treeId: string, parentNodeId: string, nodeData: Omit<TreeNode, 'id' | 'parentId'>): Promise<TreeNode> {
    try {
      const tree = await this.getTree(treeId);
      if (!tree) {
        throw new Error(`Tree with ID ${treeId} not found`);
      }

      const newNode: TreeNode = {
        id: uuidv4(),
        parentId: parentNodeId,
        ...nodeData
      };

      tree.addNode(newNode);
      await this.updateTree(tree);

      this.logger.info('Node added to tree', { treeId, nodeId: newNode.id, parentNodeId });
      return newNode;
    } catch (error) {
      this.logger.error('Failed to add node to tree', { treeId, parentNodeId, error });
      throw new Error(`Failed to add node to tree: ${error.message}`);
    }
  }

  async updateNodeStats(treeId: string, nodeId: string, visits: number, wins: number): Promise<void> {
    try {
      const tree = await this.getTree(treeId);
      if (!tree) {
        throw new Error(`Tree with ID ${treeId} not found`);
      }

      tree.updateNodeStats(nodeId, visits, wins);
      await this.updateTree(tree);

      this.logger.debug('Node stats updated', { treeId, nodeId, visits, wins });
    } catch (error) {
      this.logger.error('Failed to update node stats', { treeId, nodeId, error });
      throw new Error(`Failed to update node stats: ${error.message}`);
    }
  }

  async deleteNode(treeId: string, nodeId: string): Promise<void> {
    try {
      const tree = await this.getTree(treeId);
      if (!tree) {
        throw new Error(`Tree with ID ${treeId} not found`);
      }

      // Get all descendants that will be deleted
      const descendants = this.getNodeAndDescendants(tree, nodeId);

      // Remove all nodes
      for (const node of descendants) {
        tree.deleteNode(node.id);
      }

      await this.updateTree(tree);
      this.logger.info('Node and descendants deleted', { treeId, nodeId, deletedCount: descendants.length });
    } catch (error) {
      this.logger.error('Failed to delete node', { treeId, nodeId, error });
      throw new Error(`Failed to delete node: ${error.message}`);
    }
  }

  async moveNode(treeId: string, nodeId: string, newParentId: string): Promise<void> {
    try {
      const tree = await this.getTree(treeId);
      if (!tree) {
        throw new Error(`Tree with ID ${treeId} not found`);
      }

      const node = tree.getNode(nodeId);
      if (!node) {
        throw new Error(`Node ${nodeId} not found in tree`);
      }

      const newParent = tree.getNode(newParentId);
      if (!newParent) {
        throw new Error(`New parent node ${newParentId} not found in tree`);
      }

      // Prevent moving root node
      if (nodeId === tree.rootNodeId) {
        throw new Error('Cannot move root node');
      }

      // Prevent circular references
      if (this.isNodeDescendant(tree, newParentId, nodeId)) {
        throw new Error('Cannot move node to its own descendant');
      }

      // Update the parent
      node.parentId = newParentId;
      await this.updateTree(tree);

      this.logger.info('Node moved successfully', { treeId, nodeId, newParentId });
    } catch (error) {
      this.logger.error('Failed to move node', { treeId, nodeId, newParentId, error });
      throw new Error(`Failed to move node: ${error.message}`);
    }
  }

  async getChildren(treeId: string, parentId: string): Promise<TreeNode[]> {
    try {
      const tree = await this.getTree(treeId);
      if (!tree) {
        throw new Error(`Tree with ID ${treeId} not found`);
      }

      return tree.getChildren(parentId);
    } catch (error) {
      this.logger.error('Failed to get children', { treeId, parentId, error });
      throw new Error(`Failed to get children: ${error.message}`);
    }
  }

  async getPathToNode(treeId: string, nodeId: string): Promise<TreeNode[]> {
    try {
      const tree = await this.getTree(treeId);
      if (!tree) {
        throw new Error(`Tree with ID ${treeId} not found`);
      }

      return this.getPathFromRoot(tree, nodeId);
    } catch (error) {
      this.logger.error('Failed to get path to node', { treeId, nodeId, error });
      throw new Error(`Failed to get path to node: ${error.message}`);
    }
  }

  async getTreeStats(treeId: string): Promise<{ totalNodes: number; maxDepth: number; totalVisits: number; averageWinRate: number; }> {
    try {
      const tree = await this.getTree(treeId);
      if (!tree) {
        throw new Error(`Tree with ID ${treeId} not found`);
      }

      return this.calculateTreeStats(tree);
    } catch (error) {
      this.logger.error('Failed to get tree stats', { treeId, error });
      throw new Error(`Failed to get tree stats: ${error.message}`);
    }
  }

  async validateTree(tree: ResearchTree): Promise<boolean> {
    try {
      // Check if root node exists
      const rootNode = tree.getRootNode();
      if (!rootNode) {
        return false;
      }

      // Check if root node has no parent
      if (rootNode.parentId !== null) {
        return false;
      }

      // Check for orphaned nodes and circular references
      const visited = new Set<string>();
      const recursiveStack = new Set<string>();

      const validateNode = (nodeId: string): boolean => {
        if (recursiveStack.has(nodeId)) {
          return false; // Circular reference detected
        }

        if (visited.has(nodeId)) {
          return true; // Already validated
        }

        const node = tree.getNode(nodeId);
        if (!node) {
          return false; // Node doesn't exist
        }

        visited.add(nodeId);
        recursiveStack.add(nodeId);

        // Validate children
        const children = tree.getChildren(nodeId);
        for (const child of children) {
          if (!validateNode(child.id)) {
            return false;
          }
        }

        recursiveStack.delete(nodeId);
        return true;
      };

      return validateNode(tree.rootNodeId);
    } catch (error) {
      this.logger.error('Tree validation failed', { treeId: tree.id, error });
      return false;
    }
  }

  async isDescendant(treeId: string, ancestorId: string, nodeId: string): Promise<boolean> {
    try {
      const tree = await this.getTree(treeId);
      if (!tree) {
        throw new Error(`Tree with ID ${treeId} not found`);
      }

      return this.isNodeDescendant(tree, ancestorId, nodeId);
    } catch (error) {
      this.logger.error('Failed to check descendant relationship', { treeId, ancestorId, nodeId, error });
      throw new Error(`Failed to check descendant relationship: ${error.message}`);
    }
  }

  // Private helper methods
  private getNodeAndDescendants(tree: ResearchTree, nodeId: string): TreeNode[] {
    const result: TreeNode[] = [];
    const node = tree.getNode(nodeId);
    
    if (node) {
      result.push(node);
      const children = tree.getChildren(nodeId);
      for (const child of children) {
        result.push(...this.getNodeAndDescendants(tree, child.id));
      }
    }
    
    return result;
  }

  private getPathFromRoot(tree: ResearchTree, nodeId: string): TreeNode[] {
    const path: TreeNode[] = [];
    let currentNode = tree.getNode(nodeId);

    while (currentNode) {
      path.unshift(currentNode);
      if (currentNode.parentId === null) {
        break;
      }
      currentNode = tree.getNode(currentNode.parentId);
    }

    return path;
  }

  private isNodeDescendant(tree: ResearchTree, ancestorId: string, nodeId: string): boolean {
    const descendants = this.getNodeAndDescendants(tree, ancestorId);
    return descendants.some(node => node.id === nodeId);
  }

  private calculateTreeStats(tree: ResearchTree): { totalNodes: number; maxDepth: number; totalVisits: number; averageWinRate: number; } {
    const treeData = tree.toJSON();
    const nodes = Object.values(treeData.nodes);
    
    const totalNodes = nodes.length;
    const totalVisits = nodes.reduce((sum, node) => sum + node.visits, 0);
    const totalWins = nodes.reduce((sum, node) => sum + node.wins, 0);
    const averageWinRate = totalVisits > 0 ? totalWins / totalVisits : 0;

    // Calculate max depth
    let maxDepth = 0;
    for (const node of nodes) {
      const path = this.getPathFromRoot(tree, node.id);
      maxDepth = Math.max(maxDepth, path.length);
    }

    return {
      totalNodes,
      maxDepth,
      totalVisits,
      averageWinRate
    };
  }
}