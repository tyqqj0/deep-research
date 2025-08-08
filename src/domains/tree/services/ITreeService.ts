// @/domains/tree/services/ITreeService.ts

import { ResearchTree, TreeNode } from '../entities/ResearchTree';

/**
 * Tree Service Interface
 * 
 * Defines the contract for tree business logic operations.
 * This service manages the tree lifecycle, node operations, and tree analysis.
 */
export interface ITreeService {
  // Tree lifecycle management
  createTree(name: string, rootNodeData: Omit<TreeNode, 'id'>): Promise<ResearchTree>;
  getTree(id: string): Promise<ResearchTree | null>;
  getAllTrees(): Promise<ResearchTree[]>;
  updateTree(tree: ResearchTree): Promise<void>;
  deleteTree(id: string): Promise<void>;

  // Node operations
  addNode(treeId: string, parentNodeId: string, nodeData: Omit<TreeNode, 'id' | 'parentId'>): Promise<TreeNode>;
  updateNodeStats(treeId: string, nodeId: string, visits: number, wins: number): Promise<void>;
  deleteNode(treeId: string, nodeId: string): Promise<void>;
  moveNode(treeId: string, nodeId: string, newParentId: string): Promise<void>;

  // Tree analysis and querying
  getChildren(treeId: string, parentId: string): Promise<TreeNode[]>;
  getPathToNode(treeId: string, nodeId: string): Promise<TreeNode[]>;
  getTreeStats(treeId: string): Promise<{
    totalNodes: number;
    maxDepth: number;
    totalVisits: number;
    averageWinRate: number;
  }>;

  // Tree validation
  validateTree(tree: ResearchTree): Promise<boolean>;
  isDescendant(treeId: string, ancestorId: string, nodeId: string): Promise<boolean>;
}

// Symbol for dependency injection
export const ITreeService = Symbol('ITreeService');