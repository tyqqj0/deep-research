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
import { MainPageTreeSession } from '@/libs/tree/MainPageTreeSession';
import { libraryService } from '@/libs/db/LibraryService';
import { useLibraryStore } from '@/store/libraryStore';
import { useTaskStore } from '@/store/task';
// 🎯 导入默认算法配置
import { defaultAlgorithmConfig } from '@/store/task';
import { SGMCTSController } from '@/libs/mcts/SGMCTSController';
import {
  createDefaultModularAlgorithmSuite,
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
  // 🎯 算法状态（从TaskStore.algorithmState读取）
  isBuilding: boolean;
  buildingStatus: string;
  currentSession: any | null;
  currentIteration: number;
  maxIterations: number;
  algorithmConfig: any;
  iterationHistory: MCTSIterationResult[];

  // 树和节点数据 - 使用TaskStore统一管理
  currentTreeId: string | undefined; // 🎯 从TaskStore读取的树ID
  selectedNode: MCTSNode | null;

  // 实时统计
  statistics: any;
  realtimeMetrics: any;

  // 错误状态
  error: Error | null;
  canResume: boolean;
}

export interface TreeBuilderActions {
  // 构建会话管理
  startTreeBuilding: (rootItem: LibraryItem, researchTopic: string) => Promise<string>;
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
  
  const libraryStore = useLibraryStore();
  const taskStore = useTaskStore(); // 🎯 主要状态管理器

  // 本地状态 - 移除currentTree，改用全局TaskStore.treeId
  const [error, setError] = useState<Error | null>(null);
  
  // 控制器实例引用
  const controllerRef = useRef<SGMCTSController | null>(null);
  const isExecutingRef = useRef<boolean>(false);
  
  // ==================== 工具方法 ====================

  /**
   * 🎯 获取当前树对象（使用MainPageTreeSession的fallback机制）
   */
  const getCurrentTree = useCallback(async (): Promise<LiteratureTree | null> => {
    try {
      // 🎯 使用MainPageTreeSession的getCurrentTree方法，它包含自动fallback逻辑
      const treeSession = MainPageTreeSession.getInstance();
      return await treeSession.getCurrentTree();
    } catch (error) {
      console.error('获取当前树失败:', error);
      return null;
    }
  }, [taskStore.treeId]);

  // ==================== 树构建核心方法 ====================

  /**
   * 开始树构建会话
   * 创建新树并初始化MCTS控制器
   * @returns 创建的树ID
   */
  const startTreeBuilding = useCallback(async (
    rootItem: LibraryItem,
    researchTopic: string
  ): Promise<string> => {
    try {
      setError(null);

      // 🎯 初始化算法状态（如果还没有）
      if (!taskStore.algorithmState) {
        taskStore.initializeAlgorithmState(researchTopic);
      }

      taskStore.updateBuildingStatus('正在初始化树构建会话...');

      // 1. 创建新的文献树
      const treeName = `${researchTopic} - ${new Date().toLocaleString()}`;
      const newTree = await treeService.createTree(treeName, rootItem.id);

      // 2. 启动构建会话（TaskStore统一管理）
      const sessionId = await taskStore.startBuildingSession(
        rootItem,
        researchTopic,
        newTree.id
      );

      // 3. 初始化MCTS控制器
      await initializeMCTSController(newTree, rootItem, researchTopic);

      // 4. 更新状态
      taskStore.updateBuildingStatus(`会话 ${sessionId.substring(0, 8)} 已创建，等待执行指令`);

      toast.success(`树构建会话已创建: ${treeName}`);

      // 🎯 返回创建的树ID
      return newTree.id;

    } catch (error) {
      console.error('启动树构建失败:', error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      setError(new Error(`启动失败: ${errorMsg}`));
      taskStore.updateBuildingStatus(`初始化失败: ${errorMsg}`);
      toast.error(`启动失败: ${errorMsg}`);
      throw error; // 重新抛出错误，让调用者知道失败了
    }
  }, [taskStore]);

  /**
   * 执行单次MCTS迭代
   */
  const runSingleIteration = useCallback(async (): Promise<MCTSIterationResult | null> => {
    if (!controllerRef.current || !taskStore.treeId || !taskStore.algorithmState?.currentSession) {
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

      // 🎯 获取当前树对象
      const currentTree = await getCurrentTree();
      if (!currentTree) {
        throw new Error('无法获取当前树对象');
      }

      // 准备评估上下文
      const context = await prepareEvaluationContext();

      // 更新状态
      taskStore.runSingleIteration();

      // 执行MCTS迭代
      const result = await controllerRef.current.runSingleIteration(currentTree, context);
      
      // 🎯 更新状态和统计（使用TaskStore）
      taskStore.addIterationResult(result);

      // 刷新树数据
      await refreshCurrentTree();

      // 更新状态
      taskStore.updateBuildingStatus(
        `第 ${taskStore.algorithmState?.currentIteration || 0} 次迭代完成 ` +
        `(奖励: ${result.reward.toFixed(3)}, ` +
        `${result.expandedNode ? '新节点已创建' : '未扩展'})`
      );

      return result;

    } catch (error) {
      console.error('MCTS迭代执行失败:', error);
      const errorMsg = error instanceof Error ? error.message : '迭代执行失败';
      setError(new Error(errorMsg));
      taskStore.updateBuildingStatus(`迭代失败: ${errorMsg}`);
      return null;
    } finally {
      isExecutingRef.current = false;
    }
  }, [taskStore, getCurrentTree]);

  /**
   * 连续执行多次迭代
   */
  const runContinuousBuilding = useCallback(async () => {
    if (!controllerRef.current || !taskStore.treeId || !taskStore.algorithmState?.currentSession) {
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

      // 🎯 获取当前树对象
      const currentTree = await getCurrentTree();
      if (!currentTree) {
        throw new Error('无法获取当前树对象');
      }

      // 开始连续构建
      taskStore.runContinuousBuilding();

      // 准备评估上下文
      const context = await prepareEvaluationContext();

      // 计算剩余迭代次数
      const maxIterations = taskStore.algorithmState?.maxIterations || 50;
      const currentIteration = taskStore.algorithmState?.currentIteration || 0;
      const remainingIterations = maxIterations - currentIteration;

      // 执行连续迭代
      const results = await controllerRef.current.runContinuousIterations(
        currentTree,
        context,
        remainingIterations,
        (iteration, result) => {
          // 进度回调
          taskStore.addIterationResult(result);
          taskStore.updateBuildingStatus(
            `连续构建中: ${iteration}/${remainingIterations} ` +
            `(最新奖励: ${result.reward.toFixed(3)})`
          );
        }
      );
      
      // 刷新树数据
      await refreshCurrentTree();

      // 完成构建
      taskStore.updateBuildingStatus('连续构建已完成');
      toast.success(`连续构建完成，共执行 ${results.length} 次迭代`);
      
    } catch (error) {
      console.error('连续构建失败:', error);
      const errorMsg = error instanceof Error ? error.message : '连续构建失败';
      setError(new Error(errorMsg));
      taskStore.updateBuildingStatus(`连续构建失败: ${errorMsg}`);
    } finally {
      isExecutingRef.current = false;
    }
  }, [taskStore, getCurrentTree]);

  // ==================== 控制方法 ====================
  
  const pauseBuilding = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.pause();
    }
    taskStore.pauseBuilding();
    toast.info('构建已暂停');
  }, [taskStore]);

  const resumeBuilding = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.resume();
    }
    taskStore.resumeBuilding();
    toast.info('构建已恢复');
  }, [taskStore]);

  const stopBuilding = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.stop();
    }
    taskStore.stopBuilding();
    isExecutingRef.current = false;
    toast.info('构建已停止');
  }, [taskStore]);

  // ==================== 配置管理 ====================
  
  const updateAlgorithmConfig = useCallback((config: Partial<AlgorithmConfiguration>) => {
    if (taskStore.algorithmState && taskStore.algorithmState.algorithmConfig) {
      const updatedConfig = {
        ...taskStore.algorithmState.algorithmConfig,
        ...config
      };
      taskStore.updateAlgorithmConfig(updatedConfig);

      // 如果有活跃的控制器，需要重新初始化
      if (controllerRef.current && taskStore.treeId && taskStore.algorithmState.currentSession) {
        toast.info('算法配置已更新，将在下次迭代生效');
      }
    }
  }, [taskStore]);

  // ==================== UI交互方法 ====================

  const selectNode = useCallback((nodeId: string | null) => {
    if (taskStore.algorithmState) {
      taskStore.updateAlgorithmState({
        uiState: {
          ...taskStore.algorithmState.uiState,
          selectedNodeId: nodeId
        }
      });
    }
  }, [taskStore]);

  const setStepMode = useCallback((enabled: boolean) => {
    if (taskStore.algorithmState) {
      taskStore.updateAlgorithmState({
        uiState: {
          ...taskStore.algorithmState.uiState,
          stepMode: enabled
        }
      });
    }
    toast.info(`${enabled ? '启用' : '禁用'}单步执行模式`);
  }, [taskStore]);

  const refreshCurrentTree = useCallback(async () => {
    // 🎯 这个方法现在主要用于触发重新渲染，实际数据从TaskStore读取
    // 可以在这里添加一些缓存刷新逻辑
    console.log('🔄 刷新树数据 - TreeId:', taskStore.treeId);
  }, [taskStore.treeId]);

  const exportSession = useCallback(() => {
    if (!taskStore.algorithmState?.currentSession) {
      toast.warning('没有活跃的构建会话');
      return null;
    }

    return {
      session: taskStore.algorithmState.currentSession,
      iterationHistory: taskStore.algorithmState.iterationHistory,
      algorithmConfig: taskStore.algorithmState.algorithmConfig
    };
  }, [taskStore]);

  // const clearError = useCallback(() => {
  //   setError(null);
  //   treeBuilderStore.clearError();
  // }, [treeBuilderStore]);

  // ==================== 私有辅助方法 ====================
  
  /**
   * 初始化MCTS控制器（统一使用模块化算法）
   */
  const initializeMCTSController = useCallback(async (
    tree: LiteratureTree,
    rootItem: LibraryItem,
    researchTopic: string
  ) => {
    try {
      // 🎯 创建模块化算法套件
      const modularAlgorithms = createDefaultModularAlgorithmSuite();

      // 创建默认MCTS配置
      const config = {
        explorationConstant: 1.41,
        semanticWeight: 0.4,
        maxIterations: 50,
        maxDepth: 8,
        temperatureDecay: 0.9,
        batchSize: 3
      };

      // 创建模块化控制器实例
      controllerRef.current = new SGMCTSController(modularAlgorithms, config);

      taskStore.updateBuildingStatus('模块化MCTS控制器已初始化');

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      throw new Error(`初始化MCTS控制器失败: ${errorMsg}`);
    }
  }, [taskStore]);

  /**
   * 准备评估上下文
   */
  const prepareEvaluationContext = useCallback(async (): Promise<EvaluationContext> => {
    if (!taskStore.treeId || !taskStore.algorithmState?.currentSession) {
      throw new Error('缺少必要的上下文信息');
    }

    // 🎯 获取当前树对象
    const currentTree = await getCurrentTree();
    if (!currentTree) {
      throw new Error('无法获取当前树对象');
    }

    // 获取当前路径
    const selectedNodeId = taskStore.algorithmState.uiState.selectedNodeId || currentTree.rootNodeId;
    const currentPath = selectedNodeId ?
      treeService.getPathToNode(currentTree, selectedNodeId) :
      [currentTree.nodes[currentTree.rootNodeId]];

    // 获取可用文献
    const availableLiterature = libraryStore.items;

    return {
      currentPath,
      availableLiterature,
      researchTopic: taskStore.algorithmState.currentSession.researchTopic,
      iterationCount: taskStore.algorithmState.currentIteration,
      treeDepth: treeService.getTreeStats(currentTree).maxDepth
    };
  }, [taskStore, libraryStore.items, getCurrentTree]);

  // ==================== 生命周期效果 ====================
  
  // 监听当前会话变化，刷新树数据
  useEffect(() => {
    if (taskStore.algorithmState?.currentSession) {
      refreshCurrentTree();
    } else {
      // 🎯 会话结束时清理控制器，但不需要清理currentTree（由TaskStore管理）
      controllerRef.current = null;
    }
  }, [taskStore.algorithmState?.currentSession, refreshCurrentTree]);

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
    // 🎯 数据（从TaskStore.algorithmState读取）
    isBuilding: taskStore.algorithmState?.isBuilding || false,
    buildingStatus: taskStore.algorithmState?.buildingStatus || (taskStore.algorithmState ? '等待开始构建' : '未初始化'),
    currentSession: taskStore.algorithmState?.currentSession || null,
    currentIteration: taskStore.algorithmState?.currentIteration || 0,
    maxIterations: taskStore.algorithmState?.maxIterations || 50,
    algorithmConfig: taskStore.algorithmState?.algorithmConfig,
    currentTreeId: taskStore.treeId, // 🎯 从TaskStore读取树ID
    selectedNode: null, // TODO: 需要时可以通过treeId异步获取
    iterationHistory: taskStore.algorithmState?.iterationHistory || [],
    error: error,
    canResume: taskStore.algorithmState?.canResume || false,

    // 统计和指标
    statistics: {
      totalIterations: 0,
      successfulExpansions: 0,
      averageIterationTime: 0,
      nodesGenerated: 0,
      maxTreeDepth: 0,
      totalBuildingTime: 0
    },
    realtimeMetrics: {
      currentPhase: 'idle',
      nodesPerSecond: 0,
      memoryUsage: 0
    },

    // 🎯 行为（使用TaskStore方法和本地方法）
    startTreeBuilding,
    pauseBuilding,
    resumeBuilding,
    stopBuilding,
    runSingleIteration,
    runContinuousBuilding,
    updateAlgorithmConfig,
    switchAlgorithmPreset: () => {}, // 暂时空实现
    selectNode,
    setStepMode,
    setMaxIterations: taskStore.setMaxIterations,
    refreshCurrentTree,
    exportSession,
    clearError: () => setError(null)
  };
}