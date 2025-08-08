import { create } from "zustand";
import { persist } from "zustand/middleware";
import { pick } from "radash";
import { nanoid } from "nanoid";
// 🎯 导入算法相关类型
import {
  MCTSIterationResult,
  AlgorithmConfiguration,
  EvaluationContext,
  MCTSConfig
} from '@/libs/mcts/algorithms/interfaces';
import { MCTSNode, LibraryItem } from '@/libs/db';

// 🎯 算法构建会话接口
export interface BuildingSession {
  id: string;
  treeId: string;
  rootItemId: string;
  researchTopic: string;
  startTime: Date;
  lastActiveTime: Date;
  totalIterations: number;
  status: 'active' | 'paused' | 'completed' | 'failed';
}

// 🎯 算法状态接口
export interface AlgorithmState {
  // 会话管理
  currentSession: BuildingSession | null;
  sessionHistory: BuildingSession[];

  // 执行状态控制
  isBuilding: boolean;
  buildingStatus: string;
  shouldPause: boolean;
  shouldStop: boolean;
  canResume: boolean;

  // MCTS迭代状态
  currentIteration: number;
  maxIterations: number;
  iterationHistory: MCTSIterationResult[];
  currentEvaluationContext: EvaluationContext | null;

  // 算法配置管理
  activeTemplateId: string;
  algorithmConfig: AlgorithmConfiguration;
  availableConfigurations: Array<{
    name: string;
    description: string;
    config: AlgorithmConfiguration;
  }>;

  // UI状态（不持久化）
  uiState: {
    selectedNodeId: string | null;
    highlightPath: string[];
    showIterationDetails: boolean;
    showAlgorithmConfig: boolean;
    stepMode: boolean;
    autoScroll: boolean;
  };
}

export interface TaskStore {
  id: string;
  question: string;
  resources: Resource[];
  query: string;
  questions: string;
  feedback: string;
  reportPlan: string;
  suggestion: string;
  tasks: SearchTask[];
  requirement: string;
  title: string;
  finalReport: string;
  sources: Source[];
  images: ImageSource[];
  knowledgeGraph: string;
  maxDepth: number;
  thinkingProcess: string;
  // 🌳 话题关联的树ID
  treeId?: string;
  // 🎯 算法状态（新增）
  algorithmState?: AlgorithmState;
}

interface TaskFunction {
  update: (tasks: SearchTask[]) => void;
  setId: (id: string) => void;
  setTitle: (title: string) => void;
  setSuggestion: (suggestion: string) => void;
  setRequirement: (requirement: string) => void;
  setQuery: (query: string) => void;
  addTask: (
    task: Omit<SearchTask, "id" | "state" | "learning" | "sources" | "images">
  ) => SearchTask;
  updateTask: (id: string, task: Partial<SearchTask>) => void;
  removeTask: (id: string) => boolean;
  setQuestion: (question: string) => void;
  addResource: (resource: Resource) => void;
  updateResource: (id: string, resource: Partial<Resource>) => void;
  removeResource: (id: string) => boolean;
  updateQuestions: (questions: string) => void;
  updateReportPlan: (plan: string) => void;
  updateFinalReport: (report: string) => void;
  setSources: (sources: Source[]) => void;
  setImages: (images: Source[]) => void;
  setFeedback: (feedback: string) => void;
  updateKnowledgeGraph: (knowledgeGraph: string) => void;
  setMaxDepth: (depth: number) => void;
  updateThinkingProcess: (text: string) => void;
  // 🌳 树状态管理
  setTreeId: (treeId?: string) => void;

  // 🎯 算法状态管理方法
  initializeAlgorithmState: (topic: string) => void;
  updateAlgorithmState: (updates: Partial<AlgorithmState>) => void;
  startBuildingSession: (rootItem: LibraryItem, researchTopic: string, treeId: string) => Promise<string>;
  updateBuildingStatus: (status: string) => void;
  runSingleIteration: () => void;
  runContinuousBuilding: () => void;
  pauseBuilding: () => void;
  resumeBuilding: () => void;
  stopBuilding: () => void;
  setMaxIterations: (max: number) => void;
  updateAlgorithmConfig: (config: AlgorithmConfiguration) => void;
  setActiveTemplateId: (templateId: string) => void;
  addIterationResult: (result: MCTSIterationResult) => void;
  clearAlgorithmState: () => void;

  clear: () => void;
  reset: () => void;
  backup: () => TaskStore;
  restore: (taskStore: TaskStore) => void;
}

// 🎯 默认算法配置
export const defaultAlgorithmConfig: AlgorithmConfiguration = {
  evaluator: {
    type: 'llm-enhanced',
    config: {
      graphWeight: 0.7,
      llmModel: 'gpt-3.5-turbo',
      temperatureWeight: 0.3,
      usePageRank: true,
      useCitationCount: true
    }
  },
  expander: {
    type: 'tvc-process',
    config: {
      maxCandidates: 5,
      useNLI: false,
      temporalValidation: true,
      retrievalMethod: 'hybrid'
    }
  },
  selector: {
    type: 'sg-uct',
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
};

// 🎯 默认算法状态
const defaultAlgorithmState: AlgorithmState = {
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
  activeTemplateId: 'default-balanced',
  availableConfigurations: [
    {
      name: 'default',
      description: '默认平衡配置',
      config: defaultAlgorithmConfig
    }
  ],
  uiState: {
    selectedNodeId: null,
    highlightPath: [],
    showIterationDetails: false,
    showAlgorithmConfig: false,
    stepMode: false,
    autoScroll: true
  }
};

const defaultValues: TaskStore = {
  id: "",
  question: "",
  resources: [],
  query: "",
  questions: "",
  feedback: "",
  reportPlan: "",
  suggestion: "",
  tasks: [],
  requirement: "",
  title: "",
  finalReport: "",
  sources: [],
  images: [],
  knowledgeGraph: "",
  maxDepth: 3,
  thinkingProcess: "",
  // 🌳 默认无关联树
  treeId: undefined,
  // 🎯 默认无算法状态
  algorithmState: undefined,
};

export const useTaskStore = create(
  persist<TaskStore & TaskFunction>(
    (set, get) => ({
      ...defaultValues,
      update: (tasks) => set(() => ({ tasks: [...tasks] })),
      setId: (id) => set(() => ({ id })),
      setTitle: (title) => set(() => ({ title })),
      setSuggestion: (suggestion) => set(() => ({ suggestion })),
      setRequirement: (requirement) => set(() => ({ requirement })),
      setQuery: (query) => set(() => ({ query })),
      addTask: (task) => {
        const newTask: SearchTask = {
          ...task,
          id: nanoid(),
          state: "unprocessed",
          learning: "",
          sources: [],
          images: [],
        };
        set((state) => ({ tasks: [...state.tasks, newTask] }));
        return newTask;
      },
      updateTask: (id, task) => {
        const newTasks = get().tasks.map((item) => {
          if (item.id === id) {
            return { ...item, ...task };
          }
          return item;
        });
        set(() => ({ tasks: [...newTasks] }));
      },
      removeTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        }));
        return true;
      },
      setQuestion: (question) => set(() => ({ question })),
      addResource: (resource) =>
        set((state) => ({ resources: [resource, ...state.resources] })),
      updateResource: (id, resource) => {
        const newResources = get().resources.map((item) => {
          return item.id === id ? { ...item, ...resource } : item;
        });
        set(() => ({ resources: [...newResources] }));
      },
      removeResource: (id) => {
        set((state) => ({
          resources: state.resources.filter((resource) => resource.id !== id),
        }));
        return true;
      },
      updateQuestions: (questions) => set(() => ({ questions })),
      updateReportPlan: (plan) => set(() => ({ reportPlan: plan })),
      updateFinalReport: (report) => set(() => ({ finalReport: report })),
      setSources: (sources) => set(() => ({ sources })),
      setImages: (images) => set(() => ({ images })),
      setFeedback: (feedback) => set(() => ({ feedback })),
      updateKnowledgeGraph: (knowledgeGraph) => set(() => ({ knowledgeGraph })),
      setMaxDepth: (depth) => set(() => ({ maxDepth: depth })),
      updateThinkingProcess: (text) => set(() => ({ thinkingProcess: text })),
      // 🌳 树状态管理
      setTreeId: (treeId) => set(() => ({ treeId })),

      // 🎯 算法状态管理方法实现
      initializeAlgorithmState: (topic: string) => {
        const newAlgorithmState: AlgorithmState = {
          ...defaultAlgorithmState,
          // 可以根据topic定制初始配置
        };
        set(state => {
          // 🎯 只有当title为空时才设置，避免覆盖现有的title
          const shouldSetTitle = !state.title && !state.question;
          return {
            algorithmState: newAlgorithmState,
            ...(shouldSetTitle && { title: topic })
          };
        });
        console.log('🎯 [TaskStore] Algorithm state initialized for topic:', topic);
      },

      updateAlgorithmState: (updates: Partial<AlgorithmState>) => {
        set(state => ({
          algorithmState: state.algorithmState ? {
            ...state.algorithmState,
            ...updates
          } : { ...defaultAlgorithmState, ...updates }
        }));
      },

      startBuildingSession: async (rootItem: LibraryItem, researchTopic: string, treeId: string) => {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const session: BuildingSession = {
          id: sessionId,
          treeId: treeId,
          rootItemId: rootItem.id,
          researchTopic,
          startTime: new Date(),
          lastActiveTime: new Date(),
          totalIterations: 0,
          status: 'active'
        };

        set(state => {
          const currentAlgorithmState = state.algorithmState || defaultAlgorithmState;
          return {
            algorithmState: {
              ...currentAlgorithmState,
              currentSession: session,
              sessionHistory: [...currentAlgorithmState.sessionHistory, session],
              isBuilding: false, // 等待用户选择执行模式
              buildingStatus: '会话已创建，等待开始构建',
              shouldPause: false,
              shouldStop: false,
              canResume: false,
              currentIteration: 0,
              iterationHistory: []
            },
            treeId: treeId // 同时更新全局树ID
          };
        });

        console.log('🎯 [TaskStore] Building session started:', sessionId);
        return sessionId;
      },

      updateBuildingStatus: (status: string) => {
        set(state => ({
          algorithmState: state.algorithmState ? {
            ...state.algorithmState,
            buildingStatus: status
          } : undefined
        }));
      },

      runSingleIteration: () => {
        set(state => ({
          algorithmState: state.algorithmState ? {
            ...state.algorithmState,
            isBuilding: true,
            buildingStatus: '执行单步迭代中...'
          } : undefined
        }));
      },

      runContinuousBuilding: () => {
        set(state => ({
          algorithmState: state.algorithmState ? {
            ...state.algorithmState,
            isBuilding: true,
            buildingStatus: '连续构建中...',
            shouldPause: false,
            shouldStop: false
          } : undefined
        }));
      },

      pauseBuilding: () => {
        set(state => ({
          algorithmState: state.algorithmState ? {
            ...state.algorithmState,
            shouldPause: true,
            canResume: true,
            buildingStatus: '已暂停'
          } : undefined
        }));
      },

      resumeBuilding: () => {
        set(state => ({
          algorithmState: state.algorithmState ? {
            ...state.algorithmState,
            shouldPause: false,
            canResume: false,
            isBuilding: true,
            buildingStatus: '恢复构建中...'
          } : undefined
        }));
      },

      stopBuilding: () => {
        set(state => ({
          algorithmState: state.algorithmState ? {
            ...state.algorithmState,
            shouldStop: true,
            isBuilding: false,
            canResume: false,
            buildingStatus: '已停止'
          } : undefined
        }));
      },

      setMaxIterations: (max: number) => {
        set(state => ({
          algorithmState: state.algorithmState ? {
            ...state.algorithmState,
            maxIterations: max
          } : undefined
        }));
      },

      setActiveTemplateId: (templateId: string) => {
        set(state => ({
          algorithmState: state.algorithmState ? {
            ...state.algorithmState,
            activeTemplateId: templateId
          } : undefined
        }));
      },

      addIterationResult: (result: MCTSIterationResult) => {
        set(state => ({
          algorithmState: state.algorithmState ? {
            ...state.algorithmState,
            // 🎯 限制历史记录数量，避免LocalStorage配额超限
            iterationHistory: [...state.algorithmState.iterationHistory, result].slice(-50), // 只保留最近50次迭代
            currentIteration: state.algorithmState.currentIteration + 1
          } : undefined
        }));
      },

      clearAlgorithmState: () => {
        set(state => ({
          algorithmState: undefined
        }));
      },

      clear: () => set(() => ({ tasks: [] })),
      reset: () => set(() => ({ ...defaultValues })),
      backup: () => {
        const state = get();
        return {
          ...pick(state, Object.keys(defaultValues) as (keyof TaskStore)[]),
          // 🎯 确保算法状态也被备份（但排除UI状态）
          algorithmState: state.algorithmState ? {
            ...state.algorithmState,
            uiState: defaultAlgorithmState.uiState // 重置UI状态
          } : undefined
        } as TaskStore;
      },
      restore: (taskStore) => set(() => ({ ...taskStore })),
    }),
    { name: "research" }
  )
);
