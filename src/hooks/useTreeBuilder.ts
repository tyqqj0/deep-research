/**
 * 🌳 useTreeBuilder Hook - SG-MCTS树构建核心Hook
 * 
 * 设计理念：
 * - 复用现有Hook架构模式（参考useLiteratureResearch.ts）
 * - 集成TreeBuilderStore状态管理
 * - 协调SGMCTSController算法执行
 * - 提供React组件友好的API接口
 * 
 * 核心职责：
 * - 管理树构建的完整生命周期
 * - 提供可观察的MCTS迭代执行
 * - 处理用户交互（暂停/恢复/停止）
 * - 实时状态更新和错误处理
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { MCTSNode, LibraryItem, LiteratureTree } from '@/libs/db';
import { treeService } from '@/libs/tree/TreeService';
import { libraryService } from '@/libs/db/LibraryService';
import { useTreeBuilderStore } from '@/store/treeBuilderStore';
import { useLibraryStore } from '@/store/libraryStore';
import { SGMCTSController } from '@/libs/mcts/SGMCTSController';
import { 
  createDefaultAlgorithmSuite, 
  algorithmFactory 
} from '@/libs/mcts/algorithms/AlgorithmFactory';
import { 
  MCTSIterationResult, 
  EvaluationContext,
  AlgorithmError,
  AlgorithmConfiguration 
} from '@/libs/mcts/algorithms/interfaces';

// ==================== Hook返回类型定义 ====================

export interface TreeBuilderData {
  // 当前状态
  isBuilding: boolean;
  buildingStatus: string;
  currentSession: any;
  currentIteration: number;
  maxIterations: number;
  
  // 树和节点数据
  currentTree: LiteratureTree | null;
  selectedNode: MCTSNode | null;
  iterationHistory: MCTSIterationResult[];
  
  // 实时统计
  statistics: any;
  realtimeMetrics: any;
  
  // 错误状态
  error: Error | null;
  canResume: boolean;
}

export interface TreeBuilderActions {
  // 构建会话管理
  startTreeBuilding: (rootItem: LibraryItem, researchTopic: string) => Promise<void>;
  pauseBuilding: () => void;
  resumeBuilding: () => void;
  stopBuilding: () => void;
  
  // 迭代执行
  runSingleIteration: () => Promise<MCTSIterationResult | null>;
  runContinuousBuilding: () => Promise<void>;
  
  // 配置管理
  updateAlgorithmConfig: (config: Partial<AlgorithmConfiguration>) => void;
  switchAlgorithmPreset: (presetName: string) => void;
  
  // UI交互
  selectNode: (nodeId: string | null) => void;
  setStepMode: (enabled: boolean) => void;
  setMaxIterations: (max: number) => void;
  
  // 工具方法
  refreshCurrentTree: () => Promise<void>;
  exportSession: () => any;
  clearError: () => void;
}

// ==================== Hook实现 ====================

export function useTreeBuilder(): TreeBuilderData & TreeBuilderActions {
  // ==================== 状态管理 ====================
  
  const treeBuilderStore = useTreeBuilderStore();
  const libraryStore = useLibraryStore();
  
  // 本地状态
  const [currentTree, setCurrentTree] = useState<LiteratureTree | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  // 控制器实例引用
  const controllerRef = useRef<SGMCTSController | null>(null);
  const isExecutingRef = useRef<boolean>(false);
  
  // ==================== 树构建核心方法 ====================
  
  /**
   * 开始树构建会话
   * 创建新树并初始化MCTS控制器
   */
  const startTreeBuilding = useCallback(async (
    rootItem: LibraryItem, 
    researchTopic: string
  ) => {
    try {
      setError(null);
      treeBuilderStore.updateBuildingStatus('正在初始化树构建会话...');
      
      // 1. 创建新的文献树
      const treeName = `${researchTopic} - ${new Date().toLocaleString()}`;
      const newTree = await treeService.createTree(treeName, rootItem.id);
      setCurrentTree(newTree);
      
      // 2. 启动构建会话
      const sessionId = await treeBuilderStore.startBuildingSession(
        rootItem, 
        researchTopic, 
        newTree.id
      );
      
      // 3. 初始化MCTS控制器
      await initializeMCTSController(newTree, rootItem, researchTopic);
      
      // 4. 更新状态
      treeBuilderStore.updateBuildingStatus(`会话 ${sessionId.substring(0, 8)} 已创建，等待执行指令`);
      
      toast.success(`树构建会话已创建: ${treeName}`);
      
    } catch (error) {
      console.error('启动树构建失败:', error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      setError(new Error(`启动失败: ${errorMsg}`));
      treeBuilderStore.handleError(new Error(errorMsg));
      toast.error(`启动失败: ${errorMsg}`);
    }
  }, [treeBuilderStore]);

  /**
   * 执行单次MCTS迭代
   */
  const runSingleIteration = useCallback(async (): Promise<MCTSIterationResult | null> => {
    if (!controllerRef.current || !currentTree || !treeBuilderStore.currentSession) {
      toast.warning('请先启动树构建会话');
      return null;
    }
    
    if (isExecutingRef.current) {
      toast.warning('正在执行中，请等待完成');
      return null;
    }
    
    try {
      isExecutingRef.current = true;
      setError(null);
      
      // 准备评估上下文
      const context = await prepareEvaluationContext();
      
      // 更新状态
      await treeBuilderStore.runSingleIteration();
      
      // 执行MCTS迭代
      const result = await controllerRef.current.runSingleIteration(currentTree, context);
      
      // 更新状态和统计
      treeBuilderStore.addIterationResult(result);
      treeBuilderStore.updateStatistics({
        totalIterations: treeBuilderStore.statistics.totalIterations + 1,
        successfulExpansions: treeBuilderStore.statistics.successfulExpansions + (result.expandedNode ? 1 : 0)
      });
      
      // 刷新树数据
      await refreshCurrentTree();
      
      // 更新状态
      treeBuilderStore.updateBuildingStatus(
        `第 ${treeBuilderStore.currentIteration} 次迭代完成 ` +
        `(奖励: ${result.reward.toFixed(3)}, ` +
        `${result.expandedNode ? '新节点已创建' : '未扩展'})`
      );
      
      return result;
      
    } catch (error) {
      console.error('MCTS迭代执行失败:', error);
      const errorMsg = error instanceof Error ? error.message : '迭代执行失败';
      setError(new Error(errorMsg));
      treeBuilderStore.handleError(new Error(errorMsg));
      return null;
    } finally {
      isExecutingRef.current = false;
    }
  }, [currentTree, treeBuilderStore]);

  /**
   * 连续执行多次迭代
   */
  const runContinuousBuilding = useCallback(async () => {
    if (!controllerRef.current || !currentTree || !treeBuilderStore.currentSession) {
      toast.warning('请先启动树构建会话');
      return;
    }
    
    if (isExecutingRef.current) {
      toast.warning('正在执行中，请等待完成');
      return;
    }
    
    try {
      isExecutingRef.current = true;
      setError(null);
      
      // 开始连续构建
      await treeBuilderStore.runContinuousBuilding();
      
      // 准备评估上下文
      const context = await prepareEvaluationContext();
      
      // 计算剩余迭代次数
      const remainingIterations = treeBuilderStore.maxIterations - treeBuilderStore.currentIteration;
      
      // 执行连续迭代
      const results = await controllerRef.current.runContinuousIterations(
        currentTree,
        context,
        remainingIterations,
        (iteration, result) => {
          // 进度回调
          treeBuilderStore.addIterationResult(result);
          treeBuilderStore.updateBuildingStatus(
            `连续构建中: ${iteration}/${remainingIterations} ` +
            `(最新奖励: ${result.reward.toFixed(3)})`
          );
        }
      );
      
      // 更新最终状态
      treeBuilderStore.updateStatistics({
        totalIterations: treeBuilderStore.statistics.totalIterations + results.length,
        successfulExpansions: treeBuilderStore.statistics.successfulExpansions + 
          results.filter(r => r.expandedNode).length
      });
      
      // 刷新树数据
      await refreshCurrentTree();
      
      // 完成构建
      treeBuilderStore.completeBuildingSession();
      toast.success(`连续构建完成，共执行 ${results.length} 次迭代`);
      
    } catch (error) {
      console.error('连续构建失败:', error);
      const errorMsg = error instanceof Error ? error.message : '连续构建失败';
      setError(new Error(errorMsg));
      treeBuilderStore.handleError(new Error(errorMsg));
    } finally {
      isExecutingRef.current = false;
    }
  }, [currentTree, treeBuilderStore]);

  // ==================== 控制方法 ====================
  
  const pauseBuilding = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.pause();
    }
    treeBuilderStore.pauseBuildingSession();
    toast.info('构建已暂停');
  }, [treeBuilderStore]);

  const resumeBuilding = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.resume();
    }
    treeBuilderStore.resumeBuildingSession();
    toast.info('构建已恢复');
  }, [treeBuilderStore]);

  const stopBuilding = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.stop();
    }
    treeBuilderStore.stopBuildingSession();
    isExecutingRef.current = false;
    toast.info('构建已停止');
  }, [treeBuilderStore]);

  // ==================== 配置管理 ====================
  
  const updateAlgorithmConfig = useCallback((config: Partial<AlgorithmConfiguration>) => {
    treeBuilderStore.updateAlgorithmConfig(config);
    
    // 如果有活跃的控制器，需要重新初始化
    if (controllerRef.current && currentTree && treeBuilderStore.currentSession) {
      toast.info('算法配置已更新，将在下次迭代生效');
    }
  }, [treeBuilderStore, currentTree]);

  const switchAlgorithmPreset = useCallback((presetName: string) => {
    treeBuilderStore.switchAlgorithmPreset(presetName);
    toast.success(`已切换到算法预设: ${presetName}`);
  }, [treeBuilderStore]);

  // ==================== UI交互方法 ====================
  
  const selectNode = useCallback((nodeId: string | null) => {
    treeBuilderStore.selectNode(nodeId);
  }, [treeBuilderStore]);

  const setStepMode = useCallback((enabled: boolean) => {
    treeBuilderStore.setStepMode(enabled);
    toast.info(`${enabled ? '启用' : '禁用'}单步执行模式`);
  }, [treeBuilderStore]);

  const setMaxIterations = useCallback((max: number) => {
    treeBuilderStore.setMaxIterations(max);
  }, [treeBuilderStore]);

  // ==================== 工具方法 ====================
  
  const refreshCurrentTree = useCallback(async () => {
    if (!treeBuilderStore.currentSession) return;
    
    try {
      const updatedTree = await treeService.getTreeById(treeBuilderStore.currentSession.treeId);
      if (updatedTree) {
        setCurrentTree(updatedTree);
      }
    } catch (error) {
      console.error('刷新树数据失败:', error);
    }
  }, [treeBuilderStore.currentSession]);

  const exportSession = useCallback(() => {
    if (!treeBuilderStore.currentSession) {
      toast.warning('没有活跃的构建会话');
      return null;
    }
    
    return treeBuilderStore.exportSession(treeBuilderStore.currentSession.id);
  }, [treeBuilderStore]);

  const clearError = useCallback(() => {
    setError(null);
    treeBuilderStore.clearError();
  }, [treeBuilderStore]);

  // ==================== 私有辅助方法 ====================
  
  /**
   * 初始化MCTS控制器
   */
  const initializeMCTSController = useCallback(async (
    tree: LiteratureTree,
    rootItem: LibraryItem,
    researchTopic: string
  ) => {
    try {
      // 创建算法套件
      const algorithmSuite = algorithmFactory.createAlgorithmSuite(
        treeBuilderStore.algorithmConfig
      );
      
      // 创建控制器实例
      controllerRef.current = new SGMCTSController(
        {
          evaluator: algorithmSuite.evaluator,
          expander: algorithmSuite.expander,
          selector: algorithmSuite.selector
        },
        algorithmSuite.config
      );
      
      treeBuilderStore.updateBuildingStatus('MCTS控制器已初始化');
      
    } catch (error) {
      throw new Error(`初始化MCTS控制器失败: ${error.message}`);
    }
  }, [treeBuilderStore]);

  /**
   * 准备评估上下文
   */
  const prepareEvaluationContext = useCallback(async (): Promise<EvaluationContext> => {
    if (!currentTree || !treeBuilderStore.currentSession) {
      throw new Error('缺少必要的上下文信息');
    }
    
    // 获取当前路径
    const selectedNodeId = treeBuilderStore.uiState.selectedNodeId || currentTree.rootNodeId;
    const currentPath = selectedNodeId ? 
      treeService.getPathToNode(currentTree, selectedNodeId) : 
      [currentTree.nodes[currentTree.rootNodeId]];
    
    // 获取可用文献
    const availableLiterature = libraryStore.items;
    
    return {
      currentPath,
      availableLiterature,
      researchTopic: treeBuilderStore.currentSession.researchTopic,
      iterationCount: treeBuilderStore.currentIteration,
      treeDepth: treeService.getTreeStats(currentTree).maxDepth
    };
  }, [currentTree, treeBuilderStore, libraryStore.items]);

  // ==================== 生命周期效果 ====================
  
  // 监听当前会话变化，刷新树数据
  useEffect(() => {
    if (treeBuilderStore.currentSession) {
      refreshCurrentTree();
    } else {
      setCurrentTree(null);
      controllerRef.current = null;
    }
  }, [treeBuilderStore.currentSession, refreshCurrentTree]);

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.stop();
      }
      isExecutingRef.current = false;
    };
  }, []);

  // ==================== 返回Hook接口 ====================
  
  return {
    // 数据
    isBuilding: treeBuilderStore.isBuilding,
    buildingStatus: treeBuilderStore.buildingStatus,
    currentSession: treeBuilderStore.currentSession,
    currentIteration: treeBuilderStore.currentIteration,
    maxIterations: treeBuilderStore.maxIterations,
    currentTree,
    selectedNode: currentTree && treeBuilderStore.uiState.selectedNodeId ? 
      currentTree.nodes[treeBuilderStore.uiState.selectedNodeId] : null,
    iterationHistory: treeBuilderStore.iterationHistory,
    statistics: treeBuilderStore.statistics,
    realtimeMetrics: treeBuilderStore.realtimeMetrics,
    error: error || treeBuilderStore.realtimeMetrics.lastError,
    canResume: treeBuilderStore.canResume,
    
    // 行为
    startTreeBuilding,
    pauseBuilding,
    resumeBuilding,
    stopBuilding,
    runSingleIteration,
    runContinuousBuilding,
    updateAlgorithmConfig,
    switchAlgorithmPreset,
    selectNode,
    setStepMode,
    setMaxIterations,
    refreshCurrentTree,
    exportSession,
    clearError
  };
}