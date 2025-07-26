/**
 * 🎯 SG-MCTS控制器 - 自引导蒙特卡洛树搜索主控制器
 * 
 * 核心职责：
 * - 实现稳定的MCTS四步流程：选择→扩展→评估→反向传播
 * - 协调可插拔的算法组件（Evaluator, Expander, Selector）
 * - 管理树构建的整个生命周期
 * - 提供可中断、可恢复的迭代执行
 * 
 * 设计特点：
 * - 算法与流程分离：算法实现可插拔替换
 * - 状态可观察：每步执行都有详细状态输出
 * - 错误可恢复：异常处理不会中断整个流程
 * - 性能可监控：详细的执行时间和性能统计
 */

import { 
  NodeEvaluator, 
  NodeExpander, 
  SelectionStrategy,
  EvaluationContext,
  MCTSIterationResult,
  MCTSConfig,
  AlgorithmError
} from './algorithms/interfaces';
import { MCTSNode, LibraryItem, LiteratureTree } from '@/libs/db';
import { treeService } from '@/libs/tree/TreeService';
import { libraryService } from '@/libs/db/LibraryService';

// ==================== 执行状态类型 ====================

export interface SGMCTSExecutionState {
  phase: 'selection' | 'expansion' | 'evaluation' | 'backpropagation' | 'idle' | 'error';
  currentNode: MCTSNode | null;
  selectedPath: MCTSNode[];
  lastIterationResult: MCTSIterationResult | null;
  error: Error | null;
  canInterrupt: boolean;
}

export interface SGMCTSStatistics {
  totalIterations: number;
  successfulIterations: number;
  failedIterations: number;
  averageIterationTime: number;
  phaseStatistics: {
    selection: { totalTime: number; count: number; };
    expansion: { totalTime: number; count: number; };
    evaluation: { totalTime: number; count: number; };
    backpropagation: { totalTime: number; count: number; };
  };
  nodeStatistics: {
    nodesCreated: number;
    maxDepthReached: number;
    averageExpansionsPerNode: number;
  };
}

// ==================== 主控制器类 ====================

export class SGMCTSController {
  private evaluator: NodeEvaluator;
  private expander: NodeExpander;
  private selector: SelectionStrategy;
  private config: MCTSConfig;
  
  // 执行状态
  private executionState: SGMCTSExecutionState;
  private statistics: SGMCTSStatistics;
  private shouldStop: boolean = false;
  private shouldPause: boolean = false;

  constructor(
    algorithms: {
      evaluator: NodeEvaluator;
      expander: NodeExpander;
      selector: SelectionStrategy;
    },
    config: MCTSConfig
  ) {
    this.evaluator = algorithms.evaluator;
    this.expander = algorithms.expander;
    this.selector = algorithms.selector;
    this.config = config;
    
    // 初始化状态
    this.executionState = {
      phase: 'idle',
      currentNode: null,
      selectedPath: [],
      lastIterationResult: null,
      error: null,
      canInterrupt: true
    };
    
    this.statistics = this.initializeStatistics();
  }

  // ==================== 主要执行方法 ====================

  /**
   * 执行单次MCTS迭代
   * @param tree 当前树结构
   * @param context 评估上下文
   * @returns 迭代结果
   */
  async runSingleIteration(
    tree: LiteratureTree, 
    context: EvaluationContext
  ): Promise<MCTSIterationResult> {
    const startTime = Date.now();
    this.executionState.error = null;
    
    try {
      // 检查中断信号
      if (this.shouldStop) {
        throw new AlgorithmError('执行被用户停止', 'controller');
      }
      
      if (this.shouldPause) {
        this.executionState.phase = 'idle';
        throw new AlgorithmError('执行被用户暂停', 'controller');
      }

      // Phase 1: 选择节点
      this.executionState.phase = 'selection';
      const selectedNode = await this.selectionPhase(tree, context);
      
      // Phase 2: 扩展节点
      this.executionState.phase = 'expansion';
      const expandedNode = await this.expansionPhase(selectedNode, tree, context);
      
      // Phase 3: 评估节点
      this.executionState.phase = 'evaluation';
      const evaluationResult = await this.evaluationPhase(expandedNode || selectedNode, context);
      
      // Phase 4: 反向传播
      this.executionState.phase = 'backpropagation';
      await this.backpropagationPhase(expandedNode || selectedNode, evaluationResult.reward, tree);
      
      const executionTime = Date.now() - startTime;
      
      // 创建迭代结果
      const iterationResult: MCTSIterationResult = {
        selectedNode,
        expandedNode,
        reward: evaluationResult.reward,
        evaluationDetails: evaluationResult.evaluationDetails,
        expansionCandidates: evaluationResult.expansionCandidates,
        executionTime
      };
      
      // 更新统计信息
      this.updateStatistics(iterationResult, true);
      this.executionState.lastIterationResult = iterationResult;
      this.executionState.phase = 'idle';
      
      return iterationResult;
      
    } catch (error) {
      this.executionState.error = error as Error;
      this.executionState.phase = 'error';
      this.updateStatistics(null, false);
      
      // 重新抛出错误，让上层处理
      throw error;
    }
  }

  /**
   * 连续执行多次迭代
   * @param tree 当前树结构
   * @param context 评估上下文
   * @param maxIterations 最大迭代次数
   * @param onProgress 进度回调
   */
  async runContinuousIterations(
    tree: LiteratureTree,
    context: EvaluationContext,
    maxIterations?: number,
    onProgress?: (iteration: number, result: MCTSIterationResult) => void
  ): Promise<MCTSIterationResult[]> {
    const results: MCTSIterationResult[] = [];
    const iterations = maxIterations || this.config.maxIterations;
    
    this.shouldStop = false;
    this.shouldPause = false;
    
    for (let i = 0; i < iterations; i++) {
      // 检查中断信号
      if (this.shouldStop) {
        console.log(`执行在第 ${i} 次迭代后被停止`);
        break;
      }
      
      if (this.shouldPause) {
        console.log(`执行在第 ${i} 次迭代后被暂停`);
        break;
      }
      
      try {
        // 更新上下文
        const updatedContext = await this.updateEvaluationContext(context, tree);
        
        // 执行单次迭代
        const result = await this.runSingleIteration(tree, updatedContext);
        results.push(result);
        
        // 通知进度
        if (onProgress) {
          onProgress(i + 1, result);
        }
        
        // 更新树结构（如果有新节点）
        if (result.expandedNode) {
          await this.updateTreeStructure(tree, result.expandedNode);
        }
        
        // 检查终止条件
        if (await this.shouldTerminateEarly(tree, results)) {
          console.log(`在第 ${i + 1} 次迭代后达到终止条件`);
          break;
        }
        
        // 短暂延迟，避免阻塞UI
        await new Promise(resolve => setTimeout(resolve, 10));
        
      } catch (error) {
        console.error(`第 ${i + 1} 次迭代执行失败:`, error);
        
        // 根据错误类型决定是否继续
        if (error instanceof AlgorithmError && error.algorithmType === 'controller') {
          break; // 控制器级别的错误，停止执行
        }
        
        // 其他错误继续执行
        continue;
      }
    }
    
    return results;
  }

  // ==================== MCTS四个阶段的实现 ====================

  /**
   * 阶段1：选择节点
   * 使用SG-UCT策略从根节点开始选择到叶节点的路径
   */
  private async selectionPhase(
    tree: LiteratureTree, 
    context: EvaluationContext
  ): Promise<MCTSNode> {
    const startTime = Date.now();
    
    try {
      let currentNode = tree.nodes[tree.rootNodeId];
      if (!currentNode) {
        throw new AlgorithmError('根节点不存在', 'selector');
      }
      
      const path: MCTSNode[] = [currentNode];
      
      // 沿着树向下选择，直到叶节点或可扩展节点
      while (true) {
        const children = Object.values(tree.nodes).filter(
          node => node.parentId === currentNode.id
        );
        
        // 如果没有子节点，这是一个叶节点
        if (children.length === 0) {
          break;
        }
        
        // 使用选择策略选择最佳子节点
        const selectionResult = await this.selector.selectBestChild(
          children,
          currentNode,
          this.config,
          context
        );
        
        currentNode = selectionResult.selectedNode;
        path.push(currentNode);
        
        // 如果选中的节点未被访问过，可以在此扩展
        if (currentNode.visits === 0) {
          break;
        }
        
        // 防止无限循环
        if (path.length > this.config.maxDepth) {
          console.warn(`路径深度超过最大限制 ${this.config.maxDepth}`);
          break;
        }
      }
      
      this.executionState.selectedPath = path;
      this.executionState.currentNode = currentNode;
      
      // 更新阶段统计
      const phaseTime = Date.now() - startTime;
      this.statistics.phaseStatistics.selection.totalTime += phaseTime;
      this.statistics.phaseStatistics.selection.count += 1;
      
      return currentNode;
      
    } catch (error) {
      throw new AlgorithmError(
        `选择阶段失败: ${error.message}`,
        'selector',
        { tree, context, error }
      );
    }
  }

  /**
   * 阶段2：扩展节点
   * 使用TVC过程为选中的节点生成新的子节点
   */
  private async expansionPhase(
    selectedNode: MCTSNode,
    tree: LiteratureTree,
    context: EvaluationContext
  ): Promise<MCTSNode | null> {
    const startTime = Date.now();
    
    try {
      // 检查是否需要扩展
      const existingChildren = Object.values(tree.nodes).filter(
        node => node.parentId === selectedNode.id
      );
      
      // 如果已经有足够的子节点，不需要扩展
      const maxChildrenPerNode = this.config.batchSize || 3;
      if (existingChildren.length >= maxChildrenPerNode) {
        return null;
      }
      
      // 生成候选扩展
      const expansionResult = await this.expander.generateCandidates(selectedNode, context);
      
      if (expansionResult.candidates.length === 0) {
        console.log(`节点 ${selectedNode.id} 无可用的扩展候选`);
        return null;
      }
      
      // 选择第一个有效的候选作为新节点
      for (const candidate of expansionResult.candidates) {
        // 验证扩展的有效性
        const validation = await this.expander.validateExpansion(
          selectedNode,
          candidate,
          context
        );
        
        if (validation.isValid) {
          // 创建新的MCTS节点
          const newNode = await treeService.addNodeToTree(
            tree.id,
            selectedNode.id,
            candidate.id
          );
          
          // 更新统计信息
          this.statistics.nodeStatistics.nodesCreated += 1;
          this.statistics.nodeStatistics.maxDepthReached = Math.max(
            this.statistics.nodeStatistics.maxDepthReached,
            this.executionState.selectedPath.length
          );
          
          // 更新阶段统计
          const phaseTime = Date.now() - startTime;
          this.statistics.phaseStatistics.expansion.totalTime += phaseTime;
          this.statistics.phaseStatistics.expansion.count += 1;
          
          return newNode;
        }
      }
      
      console.log(`节点 ${selectedNode.id} 的所有候选扩展都未通过验证`);
      return null;
      
    } catch (error) {
      throw new AlgorithmError(
        `扩展阶段失败: ${error.message}`,
        'expander',
        { selectedNode, tree, context, error }
      );
    }
  }

  /**
   * 阶段3：评估节点
   * 计算节点的重要性和奖励值
   */
  private async evaluationPhase(
    nodeToEvaluate: MCTSNode,
    context: EvaluationContext
  ): Promise<{
    reward: number;
    evaluationDetails: any;
    expansionCandidates: LibraryItem[];
  }> {
    const startTime = Date.now();
    
    try {
      // 评估节点重要性
      const importanceResult = await this.evaluator.evaluateImportance(
        nodeToEvaluate,
        context
      );
      
      // 如果是新扩展的节点，还需要评估引用链
      let citationScore = 0;
      if (nodeToEvaluate.parentId) {
        const parentPath = this.executionState.selectedPath;
        const parentNode = parentPath[parentPath.length - 2]; // 倒数第二个是父节点
        
        if (parentNode) {
          const citationResult = await this.evaluator.evaluateCitationChain(
            parentNode,
            nodeToEvaluate,
            context
          );
          citationScore = citationResult.score;
        }
      }
      
      // 计算生成过程奖励
      const generatedText = `节点${nodeToEvaluate.id}的技术贡献描述`; // 简化实现
      const generationResult = await this.evaluator.evaluateGenerationReward(
        nodeToEvaluate,
        generatedText,
        context
      );
      
      // 综合奖励计算
      const reward = (
        importanceResult.totalScore * 0.5 +
        citationScore * 0.3 +
        generationResult.reward * 0.2
      );
      
      const evaluationDetails = {
        importanceScore: importanceResult.totalScore,
        citationScore,
        semanticScore: importanceResult.llmScore,
        uctValue: 0 // 将在选择阶段计算
      };
      
      // 更新阶段统计
      const phaseTime = Date.now() - startTime;
      this.statistics.phaseStatistics.evaluation.totalTime += phaseTime;
      this.statistics.phaseStatistics.evaluation.count += 1;
      
      return {
        reward,
        evaluationDetails,
        expansionCandidates: [] // 简化实现
      };
      
    } catch (error) {
      throw new AlgorithmError(
        `评估阶段失败: ${error.message}`,
        'evaluator',
        { nodeToEvaluate, context, error }
      );
    }
  }

  /**
   * 阶段4：反向传播
   * 将奖励值沿路径向上传播，更新所有节点的统计信息
   */
  private async backpropagationPhase(
    startNode: MCTSNode,
    reward: number,
    tree: LiteratureTree
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      const path = [...this.executionState.selectedPath];
      
      // 如果startNode不在路径中，添加到路径末尾
      if (!path.find(n => n.id === startNode.id)) {
        path.push(startNode);
      }
      
      // 沿路径向上传播奖励
      for (const node of path) {
        const updatedVisits = node.visits + 1;
        const updatedWins = node.wins + reward;
        
        // 更新节点统计信息
        await treeService.updateNodeStats(
          tree.id,
          node.id,
          updatedVisits,
          updatedWins
        );
        
        // 更新本地节点对象
        node.visits = updatedVisits;
        node.wins = updatedWins;
      }
      
      // 更新阶段统计
      const phaseTime = Date.now() - startTime;
      this.statistics.phaseStatistics.backpropagation.totalTime += phaseTime;
      this.statistics.phaseStatistics.backpropagation.count += 1;
      
    } catch (error) {
      throw new AlgorithmError(
        `反向传播阶段失败: ${error.message}`,
        'controller',
        { startNode, reward, tree, error }
      );
    }
  }

  // ==================== 控制方法 ====================

  /**
   * 暂停执行
   */
  pause(): void {
    this.shouldPause = true;
  }

  /**
   * 恢复执行
   */
  resume(): void {
    this.shouldPause = false;
  }

  /**
   * 停止执行
   */
  stop(): void {
    this.shouldStop = true;
  }

  /**
   * 重置控制器状态
   */
  reset(): void {
    this.shouldStop = false;
    this.shouldPause = false;
    this.executionState = {
      phase: 'idle',
      currentNode: null,
      selectedPath: [],
      lastIterationResult: null,
      error: null,
      canInterrupt: true
    };
    this.statistics = this.initializeStatistics();
  }

  // ==================== 状态访问方法 ====================

  getExecutionState(): SGMCTSExecutionState {
    return { ...this.executionState };
  }

  getStatistics(): SGMCTSStatistics {
    return { ...this.statistics };
  }

  isRunning(): boolean {
    return this.executionState.phase !== 'idle' && this.executionState.phase !== 'error';
  }

  // ==================== 私有辅助方法 ====================

  private initializeStatistics(): SGMCTSStatistics {
    return {
      totalIterations: 0,
      successfulIterations: 0,
      failedIterations: 0,
      averageIterationTime: 0,
      phaseStatistics: {
        selection: { totalTime: 0, count: 0 },
        expansion: { totalTime: 0, count: 0 },
        evaluation: { totalTime: 0, count: 0 },
        backpropagation: { totalTime: 0, count: 0 }
      },
      nodeStatistics: {
        nodesCreated: 0,
        maxDepthReached: 0,
        averageExpansionsPerNode: 0
      }
    };
  }

  private updateStatistics(result: MCTSIterationResult | null, success: boolean): void {
    this.statistics.totalIterations += 1;
    
    if (success && result) {
      this.statistics.successfulIterations += 1;
      
      // 更新平均迭代时间
      const totalTime = this.statistics.averageIterationTime * (this.statistics.successfulIterations - 1);
      this.statistics.averageIterationTime = (totalTime + result.executionTime) / this.statistics.successfulIterations;
    } else {
      this.statistics.failedIterations += 1;
    }
  }

  private async updateEvaluationContext(
    context: EvaluationContext,
    tree: LiteratureTree
  ): Promise<EvaluationContext> {
    // 更新当前路径和树深度
    const treeStats = treeService.getTreeStats(tree);
    
    return {
      ...context,
      currentPath: this.executionState.selectedPath,
      iterationCount: this.statistics.totalIterations,
      treeDepth: treeStats.maxDepth
    };
  }

  private async updateTreeStructure(tree: LiteratureTree, newNode: MCTSNode): Promise<void> {
    // 在实际应用中，树结构已经通过treeService更新
    // 这里可以添加额外的后处理逻辑
    tree.nodes[newNode.id] = newNode;
  }

  private async shouldTerminateEarly(
    tree: LiteratureTree,
    results: MCTSIterationResult[]
  ): Promise<boolean> {
    // 检查是否应该提前终止
    
    // 1. 达到最大深度
    const treeStats = treeService.getTreeStats(tree);
    if (treeStats.maxDepth >= this.config.maxDepth) {
      return true;
    }
    
    // 2. 最近几次迭代都没有成功扩展
    const recentResults = results.slice(-5);
    const successfulExpansions = recentResults.filter(r => r.expandedNode !== null).length;
    if (recentResults.length >= 5 && successfulExpansions === 0) {
      return true;
    }
    
    // 3. 奖励值收敛
    if (results.length >= 10) {
      const recentRewards = results.slice(-10).map(r => r.reward);
      const variance = this.calculateVariance(recentRewards);
      if (variance < 0.01) { // 奖励值几乎不变
        return true;
      }
    }
    
    return false;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }
}