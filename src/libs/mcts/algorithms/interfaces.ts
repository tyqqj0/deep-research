/**
 * 🧩 MCTS算法接口定义 - 可插拔算法工具层
 * 
 * 设计原则：
 * - 算法与流程分离：算法实现可随时升级，不影响主控流程
 * - 统一接口规范：所有算法实现必须遵循相同接口
 * - 配置化驱动：通过配置文件选择具体算法实现
 * 
 * 核心思想：
 * 主控流程调用接口方法，具体算法实现注入到接口中
 * 可轻松扩展新的评估、扩展、选择算法而不改变核心逻辑
 */

import { MCTSNode, LibraryItem } from '@/libs/db';

// ==================== 核心数据类型 ====================

export interface EvaluationContext {
  currentPath: MCTSNode[];           // 当前路径上的所有节点
  availableLiterature: LibraryItem[]; // 可用的文献库
  researchTopic: string;             // 研究主题
  iterationCount: number;            // 当前迭代次数
  treeDepth: number;                 // 当前树深度
}

export interface MCTSIterationResult {
  selectedNode: MCTSNode;     // 选择的节点
  expandedNode: MCTSNode | null; // 扩展的新节点（如果有）
  reward: number;             // 获得的奖励值
  evaluationDetails: {        // 评估详情
    importanceScore: number;
    citationScore: number;
    semanticScore: number;
    uctValue: number;
  };
  expansionCandidates: LibraryItem[]; // 候选扩展文献
  executionTime: number;      // 执行时间（毫秒）
}

export interface MCTSConfig {
  explorationConstant: number;    // UCT探索常数 c
  semanticWeight: number;         // 语义权重 λ
  maxIterations: number;          // 最大迭代次数
  maxDepth: number;              // 最大树深度
  temperatureDecay: number;       // 温度衰减系数
  batchSize: number;             // 批处理大小
}

// ==================== 核心算法接口 ====================

/**
 * 🎯 节点评估器接口
 * 负责计算节点的重要性和价值评分
 */
export interface NodeEvaluator {
  /**
   * 计算节点重要性得分
   * 实现论文中的 S(v) = γ·S_graph(v) + (1-γ)·S_LLM(v)
   */
  evaluateImportance(
    node: MCTSNode, 
    context: EvaluationContext
  ): Promise<{
    totalScore: number;
    graphScore: number;      // 图结构得分
    llmScore: number;        // LLM语义得分
    breakdown: {             // 详细分解
      pageRank: number;
      citationCount: number;
      degreeScore: number;
      semanticRelevance: number;
    };
  }>;

  /**
   * 验证引用链的逻辑合理性
   * 实现论文中的 R_attr(v_parent → v)
   */
  evaluateCitationChain(
    parentNode: MCTSNode, 
    childNode: MCTSNode,
    context: EvaluationContext
  ): Promise<{
    score: number;           // 引用合理性得分
    nliScore: number;        // 自然语言推理得分
    temporalScore: number;   // 时序一致性得分
    confidence: number;      // 置信度
    reasoning: string;       // LLM推理过程
  }>;

  /**
   * 计算生成过程奖励
   * 实现论文中的 R_gen(v)
   */
  evaluateGenerationReward(
    node: MCTSNode,
    generatedText: string,
    context: EvaluationContext
  ): Promise<{
    reward: number;
    dpoScore: number;        // DPO得分
    coherenceScore: number;  // 时序一致性得分
  }>;
}

/**
 * 🌱 节点扩展器接口  
 * 负责生成新的候选节点和验证扩展可行性
 */
export interface NodeExpander {
  /**
   * 通过TVC过程生成候选文献
   * 实现论文中的迭代思考-表述-引用(TVC)过程
   */
  generateCandidates(
    node: MCTSNode,
    context: EvaluationContext
  ): Promise<{
    candidates: LibraryItem[];
    tvcSteps: {
      think: string;         // 思考步骤
      verbalize: string;     // 表述步骤  
      citations: string[];   // 引用文献
      validation: boolean;   // 验证结果
    }[];
    confidence: number;
    reasoning: string;
  }>;

  /**
   * 验证扩展的有效性
   * 包括时序检查、逻辑一致性等
   */
  validateExpansion(
    parentNode: MCTSNode,
    candidate: LibraryItem,
    context: EvaluationContext
  ): Promise<{
    isValid: boolean;
    validationScore: number;
    issues: string[];        // 发现的问题
    suggestions: string[];   // 改进建议
  }>;

  /**
   * 从现有文献库中检索相关文献
   * 用于TVC过程的文献引用步骤
   */
  retrieveRelevantLiterature(
    query: string,
    context: EvaluationContext,
    maxResults?: number
  ): Promise<{
    items: LibraryItem[];
    relevanceScores: number[];
    retrievalMethod: string;
  }>;
}

/**
 * 🎲 选择策略接口
 * 负责实现节点选择算法
 */
export interface SelectionStrategy {
  /**
   * 计算SG-UCT值
   * 实现论文中的 SG-UCT(v) = Q(v)/N(v) + c·√(ln N(p)/N(v)) + λ·LLM_priority(v)
   */
  calculateSGUCTValue(
    node: MCTSNode,
    parent: MCTSNode,
    config: MCTSConfig,
    context: EvaluationContext
  ): Promise<{
    uctValue: number;
    exploitationTerm: number;  // 利用项
    explorationTerm: number;   // 探索项
    semanticTerm: number;      // 语义优先项
    llmPriority: number;       // LLM优先级
  }>;

  /**
   * 从候选节点中选择最佳节点
   */
  selectBestChild(
    candidates: MCTSNode[],
    parent: MCTSNode,
    config: MCTSConfig,
    context: EvaluationContext
  ): Promise<{
    selectedNode: MCTSNode;
    selectionReason: string;
    allScores: Array<{
      node: MCTSNode;
      score: number;
      breakdown: any;
    }>;
  }>;

  /**
   * 生成LLM引导的选择优先级
   * 实现论文中的 LLM_priority(v)
   */
  generateLLMPriority(
    node: MCTSNode,
    candidates: MCTSNode[],
    context: EvaluationContext
  ): Promise<{
    priority: number;
    reasoning: string;
    selectedDirection: string;
  }>;
}

// ==================== 算法工厂接口 ====================

/**
 * 🏭 算法工厂接口
 * 负责根据配置创建具体的算法实现
 */
export interface AlgorithmFactory {
  createEvaluator(type: string, config?: any): NodeEvaluator;
  createExpander(type: string, config?: any): NodeExpander;  
  createSelector(type: string, config?: any): SelectionStrategy;
  
  // 获取可用的算法类型
  getAvailableEvaluators(): string[];
  getAvailableExpanders(): string[];
  getAvailableSelectors(): string[];
}

// ==================== 算法配置类型 ====================

export interface AlgorithmConfiguration {
  evaluator: {
    type: 'llm-enhanced' | 'graph-based' | 'hybrid';
    config: {
      graphWeight?: number;     // γ 参数
      llmModel?: string;
      temperatureWeight?: number;
      usePageRank?: boolean;
      useCitationCount?: boolean;
    };
  };
  
  expander: {
    type: 'tvc-process' | 'citation-based' | 'semantic' | 'hybrid';
    config: {
      maxCandidates?: number;
      useNLI?: boolean;
      temporalValidation?: boolean;
      retrievalMethod?: 'semantic' | 'keyword' | 'hybrid';
    };
  };
  
  selector: {
    type: 'sg-uct' | 'traditional-uct' | 'adaptive';
    config: {
      explorationConstant?: number;  // c 参数
      semanticWeight?: number;       // λ 参数
      adaptiveExploration?: boolean;
      llmGuidanceStrength?: number;
    };
  };
  
  global: MCTSConfig;
}

// ==================== 错误处理 ====================

export class AlgorithmError extends Error {
  constructor(
    message: string,
    public algorithmType: string,
    public context?: any
  ) {
    super(message);
    this.name = 'AlgorithmError';
  }
}

export class EvaluationError extends AlgorithmError {
  constructor(message: string, context?: any) {
    super(message, 'evaluator', context);
    this.name = 'EvaluationError';
  }
}

export class ExpansionError extends AlgorithmError {
  constructor(message: string, context?: any) {
    super(message, 'expander', context);
    this.name = 'ExpansionError';
  }
}

export class SelectionError extends AlgorithmError {
  constructor(message: string, context?: any) {
    super(message, 'selector', context);
    this.name = 'SelectionError';
  }
}