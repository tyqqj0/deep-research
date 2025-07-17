/**
 * 🌳 useTree Hook - 树形数据管理 (对标useCitations设计模式)
 * 
 * 🎯 核心职责:
 * - 封装树形数据的获取、操作和状态管理
 * - 提供完整的树操作接口（增删改查、MCTS算法）
 * - 与全局状态管理（useLibraryStore）协调工作
 * - 实时响应数据变化，自动更新UI
 * 
 * 📋 功能对标:
 * - 数据获取 ← useCitations.fetchCitationData
 * - 操作方法 ← useCitations.linkCitation/unlinkCitation
 * - 状态管理 ← useCitations的loading/error状态
 * - 实时更新 ← useCitations的refresh机制
 */

import { useState, useEffect, useCallback } from 'react';
import { LiteratureTree, MCTSNode, LibraryItem } from '@/libs/db';
import { treeService } from '@/libs/tree/TreeService';
import { TreeController } from '@/libs/tree/TreeController';
import { useLibraryStore } from '@/store/libraryStore';
import { useLiveQuery } from 'dexie-react-hooks';

// 树形数据接口
export interface TreeData {
  tree: LiteratureTree | null;
  nodes: MCTSNode[];
  rootNode: MCTSNode | null;
  selectedNode: MCTSNode | null;
  treeStats: {
    totalNodes: number;
    maxDepth: number;
    totalVisits: number;
    averageWinRate: number;
  } | null;
  isLoading: boolean;
  error: string | null;
}

// 树操作接口
export interface TreeActions {
  // 基础操作
  refresh: () => Promise<void>;
  selectNode: (nodeId: string | null) => void;
  
  // 节点操作
  addNode: (parentNodeId: string, libraryItemId: string) => Promise<MCTSNode>;
  deleteNode: (nodeId: string) => Promise<void>;
  moveNode: (nodeId: string, newParentId: string) => Promise<void>;
  updateNodeStats: (nodeId: string, visits: number, wins: number) => Promise<void>;
  
  // MCTS算法操作
  runMCTSSimulation: () => Promise<void>;
  expandNode: (nodeId: string) => Promise<MCTSNode[]>;
  
  // 树结构操作
  getNodePath: (nodeId: string) => MCTSNode[];
  getChildNodes: (nodeId: string) => MCTSNode[];
  
  // 文献关联操作
  getNodeLiteratureItem: (nodeId: string) => Promise<LibraryItem | null>;
  findNodesByLiteratureItem: (itemId: string) => MCTSNode[];
}

/**
 * 🌳 useTree Hook - 树形数据管理
 * 
 * @param treeId - 树的ID，如果为null则不加载任何树
 * @returns TreeData & TreeActions - 树数据和操作方法
 */
export function useTree(treeId: string | null): TreeData & TreeActions {
  // 本地状态
  const [data, setData] = useState<TreeData>({
    tree: null,
    nodes: [],
    rootNode: null,
    selectedNode: null,
    treeStats: null,
    isLoading: false,
    error: null
  });

  // 全局状态
  const { 
    activeTreeController, 
    treeVersion,
    selectTree: selectTreeInStore,
    runMCTS: runMCTSInStore 
  } = useLibraryStore();

  // 使用Dexie的实时查询监听树数据变化
  const liveTree = useLiveQuery(
    () => treeId ? treeService.getTreeById(treeId) : null,
    [treeId]
  );

  // 获取树数据
  const fetchTreeData = useCallback(async () => {
    if (!treeId) {
      setData(prev => ({ 
        ...prev, 
        tree: null, 
        nodes: [], 
        rootNode: null, 
        treeStats: null 
      }));
      return;
    }

    setData(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const tree = await treeService.getTreeById(treeId);
      
      if (!tree) {
        setData(prev => ({
          ...prev,
          tree: null,
          nodes: [],
          rootNode: null,
          treeStats: null,
          isLoading: false,
          error: `Tree with ID ${treeId} not found`
        }));
        return;
      }

      const nodes = Object.values(tree.nodes);
      const rootNode = tree.nodes[tree.rootNodeId] || null;
      const treeStats = treeService.getTreeStats(tree);

      setData(prev => ({
        ...prev,
        tree,
        nodes,
        rootNode,
        treeStats,
        isLoading: false,
        error: null
      }));
    } catch (error) {
      console.error('Error fetching tree data:', error);
      setData(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false
      }));
    }
  }, [treeId]);

  // 刷新数据
  const refresh = useCallback(async () => {
    await fetchTreeData();
  }, [fetchTreeData]);

  // 选择节点
  const selectNode = useCallback((nodeId: string | null) => {
    if (!data.tree) return;
    
    const selectedNode = nodeId ? data.tree.nodes[nodeId] || null : null;
    setData(prev => ({ ...prev, selectedNode }));
  }, [data.tree]);

  // 添加节点
  const addNode = useCallback(async (parentNodeId: string, libraryItemId: string): Promise<MCTSNode> => {
    if (!treeId) {
      throw new Error('No tree selected');
    }

    try {
      const newNode = await treeService.addNodeToTree(treeId, parentNodeId, libraryItemId);
      await refresh(); // 刷新数据
      return newNode;
    } catch (error) {
      console.error('Error adding node:', error);
      throw error;
    }
  }, [treeId, refresh]);

  // 删除节点
  const deleteNode = useCallback(async (nodeId: string): Promise<void> => {
    if (!treeId) {
      throw new Error('No tree selected');
    }

    try {
      await treeService.deleteNodeFromTree(treeId, nodeId);
      
      // 如果删除的是当前选中的节点，清除选择
      if (data.selectedNode?.id === nodeId) {
        setData(prev => ({ ...prev, selectedNode: null }));
      }
      
      await refresh(); // 刷新数据
    } catch (error) {
      console.error('Error deleting node:', error);
      throw error;
    }
  }, [treeId, data.selectedNode, refresh]);

  // 移动节点
  const moveNode = useCallback(async (nodeId: string, newParentId: string): Promise<void> => {
    if (!treeId) {
      throw new Error('No tree selected');
    }

    try {
      await treeService.moveNodeInTree(treeId, nodeId, newParentId);
      await refresh(); // 刷新数据
    } catch (error) {
      console.error('Error moving node:', error);
      throw error;
    }
  }, [treeId, refresh]);

  // 更新节点统计信息
  const updateNodeStats = useCallback(async (nodeId: string, visits: number, wins: number): Promise<void> => {
    if (!treeId) {
      throw new Error('No tree selected');
    }

    try {
      await treeService.updateNodeStats(treeId, nodeId, visits, wins);
      await refresh(); // 刷新数据
    } catch (error) {
      console.error('Error updating node stats:', error);
      throw error;
    }
  }, [treeId, refresh]);

  // 运行MCTS模拟
  const runMCTSSimulation = useCallback(async (): Promise<void> => {
    if (!treeId) {
      throw new Error('No tree selected');
    }

    try {
      // 确保全局状态中有正确的TreeController
      if (!activeTreeController || activeTreeController.tree?.id !== treeId) {
        await selectTreeInStore(treeId);
      }

      // 运行MCTS模拟
      await runMCTSInStore();
      
      // 刷新本地数据
      await refresh();
    } catch (error) {
      console.error('Error running MCTS simulation:', error);
      throw error;
    }
  }, [treeId, activeTreeController, selectTreeInStore, runMCTSInStore, refresh]);

  // 扩展节点（添加子节点的智能版本）
  const expandNode = useCallback(async (nodeId: string): Promise<MCTSNode[]> => {
    if (!data.tree) {
      throw new Error('No tree loaded');
    }

    // 这里可以实现智能扩展逻辑，比如基于引文关系自动添加相关文献
    // 目前返回现有子节点
    const childNodes = treeService.getChildNodes(data.tree, nodeId);
    return childNodes;
  }, [data.tree]);

  // 获取节点路径
  const getNodePath = useCallback((nodeId: string): MCTSNode[] => {
    if (!data.tree) return [];
    return treeService.getPathToNode(data.tree, nodeId);
  }, [data.tree]);

  // 获取子节点
  const getChildNodes = useCallback((nodeId: string): MCTSNode[] => {
    if (!data.tree) return [];
    return treeService.getChildNodes(data.tree, nodeId);
  }, [data.tree]);

  // 获取节点关联的文献项
  const getNodeLiteratureItem = useCallback(async (nodeId: string): Promise<LibraryItem | null> => {
    if (!data.tree) return null;
    
    const node = data.tree.nodes[nodeId];
    if (!node) return null;

    try {
      // 这里需要调用LibraryService获取文献项
      const { libraryService } = await import('@/libs/db/LibraryService');
      return await libraryService.getLibraryItemById(node.libraryItemId);
    } catch (error) {
      console.error('Error getting literature item:', error);
      return null;
    }
  }, [data.tree]);

  // 根据文献项ID查找节点
  const findNodesByLiteratureItem = useCallback((itemId: string): MCTSNode[] => {
    if (!data.tree) return [];
    
    return Object.values(data.tree.nodes).filter(node => node.libraryItemId === itemId);
  }, [data.tree]);

  // 监听treeId变化
  useEffect(() => {
    fetchTreeData();
  }, [fetchTreeData]);

  // 监听实时数据变化
  useEffect(() => {
    if (liveTree) {
      const nodes = Object.values(liveTree.nodes);
      const rootNode = liveTree.nodes[liveTree.rootNodeId] || null;
      const treeStats = treeService.getTreeStats(liveTree);

      setData(prev => ({
        ...prev,
        tree: liveTree,
        nodes,
        rootNode,
        treeStats
      }));
    }
  }, [liveTree]);

  // 监听全局treeVersion变化（MCTS操作后的更新）
  useEffect(() => {
    if (treeVersion > 0) {
      refresh();
    }
  }, [treeVersion, refresh]);

  return {
    // 数据
    ...data,
    
    // 操作方法
    refresh,
    selectNode,
    addNode,
    deleteNode,
    moveNode,
    updateNodeStats,
    runMCTSSimulation,
    expandNode,
    getNodePath,
    getChildNodes,
    getNodeLiteratureItem,
    findNodesByLiteratureItem
  };
}
