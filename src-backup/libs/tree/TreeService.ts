/**
 * 🌳 TreeService - 树形数据服务 (数据访问层)
 * 
 * 🎯 核心职责 (对标LibraryService的引文管理模式):
 * - 提供纯粹的、无业务逻辑的树形数据CRUD操作接口
 * - 执行原子性的树节点和树结构操作
 * - 作为树形数据与数据库交互的唯一真实来源
 * 
 * ❌ 不负责:
 * - 复杂的MCTS算法逻辑 (请参见 TreeController.ts)
 * - 多步骤的业务工作流 (请参见 TreeWorkflowService.ts)
 * - UI状态管理 (请参见 useTree.ts Hook)
 * 
 * ➡️ 这是一个低阶服务，专注于 "如何读写树形数据"
 */

import { db, LiteratureTree, MCTSNode, LibraryItem } from '../db';
import { LiteratureTreeSchema, MCTSNodeSchema } from '../db/schema';
import { generateNodeId, generateTreeId } from '../utils/uuid';

export class TreeService {
  private db = db;

  // ==================== 树结构 CRUD 操作 ====================

  /**
   * 获取所有文献树
   */
  async getAllTrees(): Promise<LiteratureTree[]> {
    try {
      const trees = await this.db.literatureTrees.orderBy('createdAt').reverse().toArray();
      return trees;
    } catch (error) {
      console.error('Error getting all trees:', error);
      throw new Error('Failed to fetch trees');
    }
  }

  /**
   * 根据ID获取文献树
   */
  async getTreeById(id: string): Promise<LiteratureTree | null> {
    try {
      const tree = await this.db.literatureTrees.get(id);
      return tree || null;
    } catch (error) {
      console.error('Error getting tree by ID:', error);
      throw new Error('Failed to fetch tree');
    }
  }

  /**
   * 创建新的文献树
   */
  async createTree(name: string, rootItemId: string): Promise<LiteratureTree> {
    try {
      const treeId = generateTreeId();
      const rootNodeId = generateNodeId();

      // 创建根节点
      const rootNode: MCTSNode = {
        id: rootNodeId,
        parentId: null,
        libraryItemId: rootItemId,
        visits: 0,
        wins: 0
      };

      // 创建树结构
      const tree: LiteratureTree = {
        id: treeId,
        name,
        rootNodeId,
        nodes: {
          [rootNodeId]: rootNode
        },
        createdAt: new Date()
      };

      // 验证数据
      const validatedTree = LiteratureTreeSchema.parse(tree);

      // 保存到数据库
      await this.db.literatureTrees.add(validatedTree as LiteratureTree);
      return validatedTree as LiteratureTree;
    } catch (error) {
      console.error('Error creating tree:', error);
      throw new Error('Failed to create tree');
    }
  }

  /**
   * 更新文献树
   */
  async updateTree(tree: LiteratureTree): Promise<void> {
    try {
      // 验证数据
      const validatedTree = LiteratureTreeSchema.parse(tree);
      await this.db.literatureTrees.put(validatedTree as LiteratureTree);
    } catch (error) {
      console.error('Error updating tree:', error);
      throw new Error('Failed to update tree');
    }
  }

  /**
   * 删除文献树
   */
  async deleteTree(id: string): Promise<void> {
    try {
      const count = await this.db.literatureTrees.where('id').equals(id).delete();
      if (count === 0) {
        throw new Error(`Tree with ID ${id} not found`);
      }
    } catch (error) {
      console.error('Error deleting tree:', error);
      throw new Error('Failed to delete tree');
    }
  }

  // ==================== 节点操作 ====================

  /**
   * 向树中添加新节点
   */
  async addNodeToTree(treeId: string, parentNodeId: string, libraryItemId: string): Promise<MCTSNode> {
    try {
      const tree = await this.getTreeById(treeId);
      if (!tree) {
        throw new Error(`Tree with ID ${treeId} not found`);
      }

      // 验证父节点存在
      if (!tree.nodes[parentNodeId]) {
        throw new Error(`Parent node ${parentNodeId} not found in tree`);
      }

      // 🎯 临时修复：如果libraryItemId不是有效UUID，生成一个新的
      // let validLibraryItemId = libraryItemId;
      // const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      // if (!uuidRegex.test(libraryItemId)) {
      //   validLibraryItemId = crypto.randomUUID();
      //   console.warn(`⚠️ [TreeService] 非UUID格式的libraryItemId: ${libraryItemId}, 已转换为: ${validLibraryItemId}`);
      // }

      // 创建新节点
      const newNode: MCTSNode = {
        id: generateNodeId(),
        parentId: parentNodeId,
        libraryItemId,
        visits: 0,
        wins: 0
      };

      // 验证节点数据
      const validatedNode = MCTSNodeSchema.parse(newNode);

      // 添加到树中
      tree.nodes[newNode.id] = validatedNode as MCTSNode;

      // 更新树
      await this.updateTree(tree);
      return validatedNode as MCTSNode;
    } catch (error) {
      console.error('Error adding node to tree:', error);
      throw new Error('Failed to add node to tree');
    }
  }

  /**
   * 从树中删除节点（及其所有子节点）
   */
  async deleteNodeFromTree(treeId: string, nodeId: string): Promise<void> {
    try {
      const tree = await this.getTreeById(treeId);
      if (!tree) {
        throw new Error(`Tree with ID ${treeId} not found`);
      }

      // 检查节点是否存在
      if (!tree.nodes[nodeId]) {
        throw new Error(`Node with ID ${nodeId} not found in tree`);
      }

      // 不能删除根节点
      if (nodeId === tree.rootNodeId) {
        throw new Error('Cannot delete root node');
      }

      // 获取要删除的节点及其所有子节点
      const nodesToDelete = this.getNodeAndDescendants(tree, nodeId);

      if (nodesToDelete.length === 0) {
        throw new Error(`No nodes found to delete for node ID ${nodeId}`);
      }

      console.log(`Deleting ${nodesToDelete.length} nodes:`, nodesToDelete.map(n => n.id));

      // 从树中删除所有节点
      for (const nodeToDelete of nodesToDelete) {
        delete tree.nodes[nodeToDelete.id];
      }

      // 更新树
      await this.updateTree(tree);
      console.log(`Successfully deleted nodes from tree ${treeId}`);
    } catch (error) {
      console.error('Error deleting node from tree:', error);
      throw error; // 重新抛出原始错误而不是包装错误
    }
  }

  /**
   * 移动节点到新的父节点下
   */
  async moveNodeInTree(treeId: string, nodeId: string, newParentId: string): Promise<void> {
    try {
      const tree = await this.getTreeById(treeId);
      if (!tree) {
        throw new Error(`Tree with ID ${treeId} not found`);
      }

      // 验证节点存在
      const node = tree.nodes[nodeId];
      if (!node) {
        throw new Error(`Node ${nodeId} not found in tree`);
      }

      // 验证新父节点存在
      if (!tree.nodes[newParentId]) {
        throw new Error(`New parent node ${newParentId} not found in tree`);
      }

      // 不能移动根节点
      if (nodeId === tree.rootNodeId) {
        throw new Error('Cannot move root node');
      }

      // 防止循环引用（不能将节点移动到自己的子节点下）
      if (this.isDescendant(tree, newParentId, nodeId)) {
        throw new Error('Cannot move node to its own descendant');
      }

      // 更新节点的父节点
      tree.nodes[nodeId].parentId = newParentId;

      // 更新树
      await this.updateTree(tree);
    } catch (error) {
      console.error('Error moving node in tree:', error);
      throw new Error('Failed to move node in tree');
    }
  }

  /**
   * 更新节点的MCTS统计信息
   */
  async updateNodeStats(treeId: string, nodeId: string, visits: number, wins: number): Promise<void> {
    try {
      const tree = await this.getTreeById(treeId);
      if (!tree) {
        throw new Error(`Tree with ID ${treeId} not found`);
      }

      const node = tree.nodes[nodeId];
      if (!node) {
        throw new Error(`Node ${nodeId} not found in tree`);
      }

      // 更新统计信息
      tree.nodes[nodeId].visits = visits;
      tree.nodes[nodeId].wins = wins;

      // 更新树
      await this.updateTree(tree);
    } catch (error) {
      console.error('Error updating node stats:', error);
      throw new Error('Failed to update node stats');
    }
  }

  // ==================== 查询辅助方法 ====================

  /**
   * 获取节点的所有子节点
   */
  getChildNodes(tree: LiteratureTree, parentId: string): MCTSNode[] {
    return Object.values(tree.nodes).filter(node => node.parentId === parentId);
  }

  /**
   * 获取节点及其所有后代节点
   */
  getNodeAndDescendants(tree: LiteratureTree, nodeId: string): MCTSNode[] {
    const result: MCTSNode[] = [];
    const node = tree.nodes[nodeId];
    
    if (node) {
      result.push(node);
      const children = this.getChildNodes(tree, nodeId);
      for (const child of children) {
        result.push(...this.getNodeAndDescendants(tree, child.id));
      }
    }
    
    return result;
  }

  /**
   * 检查一个节点是否是另一个节点的后代
   */
  isDescendant(tree: LiteratureTree, ancestorId: string, nodeId: string): boolean {
    const descendants = this.getNodeAndDescendants(tree, ancestorId);
    return descendants.some(node => node.id === nodeId);
  }

  /**
   * 获取从根节点到指定节点的路径
   */
  getPathToNode(tree: LiteratureTree, nodeId: string): MCTSNode[] {
    const path: MCTSNode[] = [];
    let currentNode = tree.nodes[nodeId];

    while (currentNode) {
      path.unshift(currentNode);
      if (currentNode.parentId === null) {
        break;
      }
      currentNode = tree.nodes[currentNode.parentId];
    }

    return path;
  }

  /**
   * 获取树的统计信息
   */
  getTreeStats(tree: LiteratureTree): {
    totalNodes: number;
    maxDepth: number;
    totalVisits: number;
    averageWinRate: number;
  } {
    const nodes = Object.values(tree.nodes);
    const totalNodes = nodes.length;
    const totalVisits = nodes.reduce((sum, node) => sum + node.visits, 0);
    const totalWins = nodes.reduce((sum, node) => sum + node.wins, 0);
    const averageWinRate = totalVisits > 0 ? totalWins / totalVisits : 0;

    // 计算最大深度
    let maxDepth = 0;
    for (const node of nodes) {
      const path = this.getPathToNode(tree, node.id);
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

// 导出单例实例
export const treeService = new TreeService();
