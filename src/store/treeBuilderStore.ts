/**
 * 🌳 TreeBuilderStore - SG-MCTS树构建专用状态管理
 * 
 * 设计原则：
 * - 复用现有Zustand架构模式
 * - 专门管理MCTS迭代状态和流程控制
 * - 与libraryStore协作但保持独立
 * - 支持可中断、可恢复的构建过程
 * 
 * 状态职责：
 * - 管理当前构建会话状态
 * - 跟踪MCTS迭代历史和统计
 * - 控制算法执行流程（暂停/恢复/停止）
 * - 提供实时状态更新给UI组件
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MCTSNode, LibraryItem, LiteratureTree } from '@/libs/db';
import { 
  MCTSIterationResult, 
  AlgorithmConfiguration,
  EvaluationContext,
  MCTSConfig 
} from '@/libs/mcts/algorithms/interfaces';

// ==================== 状态类型定义 ====================

export interface BuildingSession {
  id: string;                          // 会话ID
  treeId: string;                      // 关联的树ID
  rootItemId: string;                  // 根节点文献ID
  researchTopic: string;               // 研究主题
  startTime: Date;                     // 开始时间
  lastActiveTime: Date;                // 最后活跃时间
  totalIterations: number;             // 总迭代次数
  status: 'active' | 'paused' | 'completed' | 'error'; // 会话状态
}

export interface IterationStatistics {
  totalIterations: number;             // 总迭代次数
  successfulExpansions: number;        // 成功扩展次数
  averageIterationTime: number;        // 平均迭代时间
  totalBuildingTime: number;           // 总构建时间
  nodesGenerated: number;              // 生成的节点数
  maxTreeDepth: number;                // 最大树深度
  algorithmPerformance: {              // 算法性能统计
    evaluationTime: number;
    expansionTime: number;
    selectionTime: number;
  };
}

export interface TreeBuilderState {
  // ==================== 构建会话管理 ====================
  currentSession: BuildingSession | null;    // 当前构建会话
  sessionHistory: BuildingSession[];         // 历史会话
  
  // ==================== 执行状态控制 ====================
  isBuilding: boolean;                       // 是否正在构建
  buildingStatus: string;                    // 当前状态描述
  shouldPause: boolean;                      // 暂停信号
  shouldStop: boolean;                       // 停止信号
  canResume: boolean;                        // 是否可以恢复
  
  // ==================== MCTS迭代状态 ====================
  currentIteration: number;                 // 当前迭代次数
  maxIterations: number;                     // 最大迭代次数
  iterationHistory: MCTSIterationResult[];  // 迭代历史记录
  currentEvaluationContext: EvaluationContext | null; // 当前评估上下文
  
  // ==================== 算法配置管理 ====================
  algorithmConfig: AlgorithmConfiguration;  // 当前算法配置
  availableConfigurations: Array<{           // 可用配置预设
    name: string;
    description: string;
    config: AlgorithmConfiguration;
  }>;
  
  // ==================== 实时统计信息 ====================
  statistics: IterationStatistics;          // 统计信息
  realtimeMetrics: {                         // 实时指标
    currentUCTScores: Array<{
      nodeId: string;
      score: number;
      breakdown: any;
    }>;
    expansionCandidates: LibraryItem[];      // 当前候选扩展
    selectedNodePath: MCTSNode[];           // 当前选择路径
    lastError: Error | null;                // 最后的错误
  };
  
  // ==================== UI状态管理 ====================
  uiState: {
    selectedNodeId: string | null;          // 当前选中的节点
    highlightPath: string[];                // 高亮路径
    showIterationDetails: boolean;          // 显示迭代详情
    showAlgorithmConfig: boolean;           // 显示算法配置
    stepMode: boolean;                      // 单步执行模式
    autoScroll: boolean;                    // 自动滚动到新节点
  };
}

// ==================== 行为接口定义 ====================

export interface TreeBuilderActions {
  // ==================== 会话管理 ====================
  startBuildingSession: (
    rootItem: LibraryItem, 
    researchTopic: string,
    treeId?: string
  ) => Promise<string>; // 返回会话ID
  
  pauseBuildingSession: () => void;
  resumeBuildingSession: () => void;
  stopBuildingSession: () => void;
  completeBuildingSession: () => void;
  
  // ==================== 迭代执行控制 ====================
  runSingleIteration: () => Promise<MCTSIterationResult | null>;
  runContinuousBuilding: () => Promise<void>;
  setMaxIterations: (max: number) => void;
  resetIterationHistory: () => void;
  
  // ==================== 算法配置管理 ====================
  updateAlgorithmConfig: (config: Partial<AlgorithmConfiguration>) => void;
  switchAlgorithmPreset: (presetName: string) => void;
  saveConfigurationPreset: (name: string, description: string) => void;
  
  // ==================== 状态更新方法 ====================
  updateBuildingStatus: (status: string) => void;
  updateStatistics: (stats: Partial<IterationStatistics>) => void;
  addIterationResult: (result: MCTSIterationResult) => void;
  updateRealtimeMetrics: (metrics: Partial<TreeBuilderState['realtimeMetrics']>) => void;
  
  // ==================== UI状态管理 ====================
  selectNode: (nodeId: string | null) => void;
  setHighlightPath: (path: string[]) => void;
  toggleIterationDetails: () => void;
  toggleAlgorithmConfig: () => void;
  setStepMode: (enabled: boolean) => void;
  setAutoScroll: (enabled: boolean) => void;
  
  // ==================== 工具方法 ====================
  getCurrentTree: () => Promise<LiteratureTree | null>;
  getSessionById: (id: string) => BuildingSession | null;
  exportSession: (sessionId: string) => any;
  importSession: (sessionData: any) => Promise<string>;
  clearHistory: () => void;
  
  // ==================== 错误处理 ====================
  handleError: (error: Error, context?: any) => void;
  clearError: () => void;
}

// ==================== Store实现 ====================

const initialStatistics: IterationStatistics = {
  totalIterations: 0,
  successfulExpansions: 0,
  averageIterationTime: 0,
  totalBuildingTime: 0,
  nodesGenerated: 0,
  maxTreeDepth: 0,
  algorithmPerformance: {
    evaluationTime: 0,
    expansionTime: 0,
    selectionTime: 0
  }
};

export const useTreeBuilderStore = create<TreeBuilderState & TreeBuilderActions>()(
  persist(
    (set, get) => ({
      // ==================== 初始状态 ====================
      currentSession: null,
      sessionHistory: [],
      isBuilding: false,
      buildingStatus: '等待开始构建',
      shouldPause: false,
      shouldStop: false,
      canResume: false,
      currentIteration: 0,
      maxIterations: 50,
      iterationHistory: [],
      currentEvaluationContext: null,
      
      // 默认算法配置
      algorithmConfig: {
        evaluator: {
          type: 'default',
          config: {
            graphWeight: 0.7,
            llmModel: 'gpt-3.5-turbo',
            temperatureWeight: 0.8,
            usePageRank: true,
            useCitationCount: true
          }
        },
        expander: {
          type: 'default',
          config: {
            maxCandidates: 5,
            useNLI: false,
            temporalValidation: true,
            retrievalMethod: 'keyword'
          }
        },
        selector: {
          type: 'default',
          config: {
            explorationConstant: 1.41,
            semanticWeight: 0.3,
            adaptiveExploration: false,
            llmGuidanceStrength: 0.5
          }
        },
        global: {
          explorationConstant: 1.41,
          semanticWeight: 0.3,
          maxIterations: 50,
          maxDepth: 8,
          temperatureDecay: 0.95,
          batchSize: 1
        }
      },
      
      availableConfigurations: [
        {
          name: 'default',
          description: '默认平衡配置',
          config: {
            evaluator: { type: 'default', config: {} },
            expander: { type: 'default', config: {} },
            selector: { type: 'default', config: {} },
            global: {
              explorationConstant: 1.41,
              semanticWeight: 0.3,
              maxIterations: 50,
              maxDepth: 8,
              temperatureDecay: 0.95,
              batchSize: 1
            }
          }
        }
      ],
      
      statistics: initialStatistics,
      
      realtimeMetrics: {
        currentUCTScores: [],
        expansionCandidates: [],
        selectedNodePath: [],
        lastError: null
      },
      
      uiState: {
        selectedNodeId: null,
        highlightPath: [],
        showIterationDetails: false,
        showAlgorithmConfig: false,
        stepMode: true, // 默认单步模式
        autoScroll: true
      },

      // ==================== 行为实现 ====================

      startBuildingSession: async (rootItem, researchTopic, treeId) => {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const session: BuildingSession = {
          id: sessionId,
          treeId: treeId || `tree_${Date.now()}`,
          rootItemId: rootItem.id,
          researchTopic,
          startTime: new Date(),
          lastActiveTime: new Date(),
          totalIterations: 0,
          status: 'active'
        };

        set(state => ({
          currentSession: session,
          sessionHistory: [...state.sessionHistory, session],
          isBuilding: false, // 等待用户选择执行模式
          buildingStatus: '会话已创建，等待开始构建',
          shouldPause: false,
          shouldStop: false,
          canResume: false,
          currentIteration: 0,
          iterationHistory: [],
          statistics: initialStatistics,
          realtimeMetrics: {
            ...state.realtimeMetrics,
            lastError: null
          }
        }));

        return sessionId;
      },

      pauseBuildingSession: () => {
        set(state => ({
          shouldPause: true,
          canResume: state.isBuilding,
          buildingStatus: state.isBuilding ? '正在暂停...' : '已暂停'
        }));
      },

      resumeBuildingSession: () => {
        set({
          shouldPause: false,
          canResume: false,
          buildingStatus: '恢复构建中...'
        });
      },

      stopBuildingSession: () => {
        set(state => ({
          shouldStop: true,
          shouldPause: false,
          canResume: false,
          buildingStatus: '正在停止...',
          currentSession: state.currentSession ? {
            ...state.currentSession,
            status: 'completed',
            lastActiveTime: new Date()
          } : null
        }));
      },

      completeBuildingSession: () => {
        set(state => ({
          isBuilding: false,
          buildingStatus: '构建已完成',
          shouldPause: false,
          shouldStop: false,
          canResume: false,
          currentSession: state.currentSession ? {
            ...state.currentSession,
            status: 'completed',
            lastActiveTime: new Date(),
            totalIterations: state.currentIteration
          } : null
        }));
      },

      runSingleIteration: async () => {
        // 这个方法的具体实现将在useTreeBuilder Hook中完成
        // 这里只更新相关状态
        const state = get();
        if (!state.currentSession) return null;

        set(prevState => ({
          isBuilding: true,
          buildingStatus: `执行第 ${prevState.currentIteration + 1} 次迭代...`,
          currentIteration: prevState.currentIteration + 1
        }));

        return null; // 实际结果由Hook返回
      },

      runContinuousBuilding: async () => {
        const state = get();
        if (!state.currentSession) return;

        set({
          isBuilding: true,
          buildingStatus: '连续构建中...',
          shouldPause: false,
          shouldStop: false
        });
      },

      setMaxIterations: (max) => {
        set(state => ({
          maxIterations: max,
          algorithmConfig: {
            ...state.algorithmConfig,
            global: {
              ...state.algorithmConfig.global,
              maxIterations: max
            }
          }
        }));
      },

      resetIterationHistory: () => {
        set({
          iterationHistory: [],
          currentIteration: 0,
          statistics: initialStatistics
        });
      },

      updateAlgorithmConfig: (config) => {
        set(state => ({
          algorithmConfig: {
            ...state.algorithmConfig,
            ...config
          }
        }));
      },

      switchAlgorithmPreset: (presetName) => {
        const state = get();
        const preset = state.availableConfigurations.find(c => c.name === presetName);
        if (preset) {
          set({ algorithmConfig: preset.config });
        }
      },

      saveConfigurationPreset: (name, description) => {
        const state = get();
        const newPreset = {
          name,
          description,
          config: { ...state.algorithmConfig }
        };
        
        set(prevState => ({
          availableConfigurations: [
            ...prevState.availableConfigurations.filter(c => c.name !== name),
            newPreset
          ]
        }));
      },

      updateBuildingStatus: (status) => {
        set({ buildingStatus: status });
      },

      updateStatistics: (stats) => {
        set(state => ({
          statistics: { ...state.statistics, ...stats }
        }));
      },

      addIterationResult: (result) => {
        set(state => ({
          iterationHistory: [...state.iterationHistory, result],
          statistics: {
            ...state.statistics,
            totalIterations: state.statistics.totalIterations + 1,
            successfulExpansions: state.statistics.successfulExpansions + (result.expandedNode ? 1 : 0),
            averageIterationTime: (state.statistics.averageIterationTime * state.statistics.totalIterations + result.executionTime) / (state.statistics.totalIterations + 1)
          }
        }));
      },

      updateRealtimeMetrics: (metrics) => {
        set(state => ({
          realtimeMetrics: { ...state.realtimeMetrics, ...metrics }
        }));
      },

      selectNode: (nodeId) => {
        set(state => ({
          uiState: { ...state.uiState, selectedNodeId: nodeId }
        }));
      },

      setHighlightPath: (path) => {
        set(state => ({
          uiState: { ...state.uiState, highlightPath: path }
        }));
      },

      toggleIterationDetails: () => {
        set(state => ({
          uiState: { 
            ...state.uiState, 
            showIterationDetails: !state.uiState.showIterationDetails 
          }
        }));
      },

      toggleAlgorithmConfig: () => {
        set(state => ({
          uiState: { 
            ...state.uiState, 
            showAlgorithmConfig: !state.uiState.showAlgorithmConfig 
          }
        }));
      },

      setStepMode: (enabled) => {
        set(state => ({
          uiState: { ...state.uiState, stepMode: enabled }
        }));
      },

      setAutoScroll: (enabled) => {
        set(state => ({
          uiState: { ...state.uiState, autoScroll: enabled }
        }));
      },

      getCurrentTree: async () => {
        const state = get();
        if (!state.currentSession) return null;
        
        try {
          const { treeService } = await import('@/libs/tree/TreeService');
          return await treeService.getTreeById(state.currentSession.treeId);
        } catch (error) {
          console.error('获取当前树失败:', error);
          return null;
        }
      },

      getSessionById: (id) => {
        const state = get();
        return state.sessionHistory.find(s => s.id === id) || null;
      },

      exportSession: (sessionId) => {
        const state = get();
        const session = state.sessionHistory.find(s => s.id === sessionId);
        if (!session) return null;

        return {
          session,
          iterationHistory: state.iterationHistory,
          statistics: state.statistics,
          algorithmConfig: state.algorithmConfig,
          exportTime: new Date().toISOString()
        };
      },

      importSession: async (sessionData) => {
        const sessionId = `imported_${Date.now()}`;
        const importedSession: BuildingSession = {
          ...sessionData.session,
          id: sessionId,
          status: 'completed'
        };

        set(state => ({
          sessionHistory: [...state.sessionHistory, importedSession],
          // 可选择性恢复其他数据
        }));

        return sessionId;
      },

      clearHistory: () => {
        set({
          sessionHistory: [],
          iterationHistory: [],
          statistics: initialStatistics
        });
      },

      handleError: (error, context) => {
        console.error('TreeBuilder错误:', error, context);
        set(state => ({
          isBuilding: false,
          buildingStatus: `错误: ${error.message}`,
          realtimeMetrics: {
            ...state.realtimeMetrics,
            lastError: error
          },
          currentSession: state.currentSession ? {
            ...state.currentSession,
            status: 'error',
            lastActiveTime: new Date()
          } : null
        }));
      },

      clearError: () => {
        set(state => ({
          realtimeMetrics: {
            ...state.realtimeMetrics,
            lastError: null
          }
        }));
      }
    }),
    {
      name: 'tree-builder-store',
      // 只持久化配置和历史，不持久化运行时状态
      partialize: (state) => ({
        sessionHistory: state.sessionHistory,
        algorithmConfig: state.algorithmConfig,
        availableConfigurations: state.availableConfigurations,
        maxIterations: state.maxIterations,
        uiState: {
          stepMode: state.uiState.stepMode,
          autoScroll: state.uiState.autoScroll,
          showIterationDetails: state.uiState.showIterationDetails,
          showAlgorithmConfig: state.uiState.showAlgorithmConfig
        }
      })
    }
  )
);