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
import { TreeController } from '@/libs/tree/TreeController';

// 导入新的模块化组件
import { IThinker } from './algorithms/modules/Thinker';
import { IFormulator } from './algorithms/modules/Formulator';
import { ICiter } from './algorithms/modules/Citer';
import { IValidator } from './algorithms/modules/Validator';
import { ILocator } from './algorithms/modules/Locator';
import { IRewardCalculator } from './algorithms/modules/RewardCalculator';
import { IExpander, ExpansionRequest } from './algorithms/modules/Expander';

// ==================== 执行状态类型 ====================

export type ExecutionMode = 'traditional' | 'modular';

export interface SGMCTSExecutionState {
  phase: 'selection' | 'expansion' | 'evaluation' | 'backpropagation' | 'idle' | 'error';
  currentNode: MCTSNode | null;
  selectedPath: MCTSNode[];
  lastIterationResult: MCTSIterationResult | null;
  error: Error | null;
  canInterrupt: boolean;
  mode: ExecutionMode;
}

// 传统算法组件
export interface TraditionalAlgorithms {
  evaluator: NodeEvaluator;
  expander: NodeExpander;
  selector: SelectionStrategy;
}

// 模块化算法组件
export interface ModularAlgorithms {
  thinker: IThinker;
  formulator: IFormulator;
  citer: ICiter;
  validator: IValidator;
  locator: ILocator;
  rewardCalculator: IRewardCalculator;
  expander: IExpander;
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
  // 🎯 算法组件 - 统一使用模块化模式
  private thinker: IThinker;
  private formulator: IFormulator;
  private citer: ICiter;
  private validator: IValidator;
  private locator: ILocator;
  private rewardCalculator: IRewardCalculator;
  private modularExpander: IExpander;

  private config: MCTSConfig;

  // 🎯 真实树控制器 - 替代内存树管理
  private treeController: TreeController;
  private currentTree: LiteratureTree;

  // 执行状态
  private executionState: SGMCTSExecutionState;
  private statistics: SGMCTSStatistics;
  private shouldStop: boolean = false;
  private shouldPause: boolean = false;

  // 🎯 统一构造函数 - 只支持模块化算法 + TreeController
  constructor(
    algorithms: ModularAlgorithms,
    config: MCTSConfig,
    treeController: TreeController,
    tree: LiteratureTree
  ) {
    this.config = config;

    // 🎯 初始化模块化算法组件
    this.thinker = algorithms.thinker;
    this.formulator = algorithms.formulator;
    this.citer = algorithms.citer;
    this.validator = algorithms.validator;
    this.locator = algorithms.locator;
    this.rewardCalculator = algorithms.rewardCalculator;
    this.modularExpander = algorithms.expander;

    // 🎯 初始化真实树控制器
    this.treeController = treeController;
    this.currentTree = tree;

    console.log(`🌳 [SGMCTSController] 使用真实TreeController，树ID: ${tree.id}, 根节点: ${tree.rootNodeId}`);

    // 初始化状态
    this.executionState = {
      phase: 'idle',
      currentNode: null,
      selectedPath: [],
      lastIterationResult: null,
      error: null,
      canInterrupt: true,
      mode: 'modular'
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

    console.log('🚀 [SGMCTSController] 开始单次MCTS迭代', {
      treeId: tree.id,
      researchTopic: context.researchTopic,
      currentPath: context.currentPath.map(n => n.id)
    });

    try {
      // 检查中断信号
      if (this.shouldStop) {
        throw new AlgorithmError('执行被用户停止', 'controller');
      }

      if (this.shouldPause) {
        this.executionState.phase = 'idle';
        throw new AlgorithmError('执行被用户暂停', 'controller');
      }

      // 🎯 统一使用模块化算法
      const result = await this.runModularIteration(tree, context, startTime);

      console.log('✅ [SGMCTSController] MCTS迭代完成', {
        selectedNodeId: result.selectedNode.id,
        expandedNodeId: result.expandedNode?.id,
        reward: result.reward,
        executionTime: result.executionTime
      });

      return result;
      
    } catch (error) {
      this.executionState.error = error as Error;
      this.executionState.phase = 'error';
      this.updateStatistics(null, false);
      
      // 重新抛出错误，让上层处理
      throw error;
    }
  }

  // 🗑️ 传统算法已移除，统一使用模块化算法

  /**
   * 模块化模式的MCTS迭代 - 使用TVC流程
   */
  private async runModularIteration(
    tree: LiteratureTree,
    context: EvaluationContext,
    startTime: number
  ): Promise<MCTSIterationResult> {
    if (!this.locator || !this.modularExpander || !this.rewardCalculator) {
      throw new AlgorithmError('模块化组件未正确初始化', 'controller');
    }

    // Phase 1: 选择节点 (使用Locator)
    this.executionState.phase = 'selection';
    const selectedNode = await this.modularSelectionPhase(tree, context);
    
    // Phase 2: 模块化扩展 (使用完整TVC流程)
    this.executionState.phase = 'expansion';
    const expansionResult = await this.modularExpansionPhase(selectedNode, tree, context);
    
    // Phase 3: 模块化评估 (使用RewardCalculator)
    this.executionState.phase = 'evaluation';
    const evaluationResult = await this.modularEvaluationPhase(
      expansionResult.expandedNodes.length > 0 ? expansionResult.expandedNodes[0].node : selectedNode,
      context,
      expansionResult
    );
    
    // Phase 4: 反向传播 (与传统模式相同)
    this.executionState.phase = 'backpropagation';
    const nodeToBackpropagate = expansionResult.expandedNodes.length > 0 ? 
      expansionResult.expandedNodes[0].node : selectedNode;
    await this.backpropagationPhase(nodeToBackpropagate, evaluationResult.reward, tree);
    
    const executionTime = Date.now() - startTime;
    
    // 创建迭代结果
    const iterationResult: MCTSIterationResult = {
      selectedNode,
      expandedNode: expansionResult.expandedNodes.length > 0 ? expansionResult.expandedNodes[0].node : null,
      reward: evaluationResult.reward,
      evaluationDetails: {
        ...evaluationResult.evaluationDetails,
        tvcDetails: expansionResult.executionSummary,
        modularMode: true
      },
      expansionCandidates: expansionResult.expandedNodes.map(en => en.citations[0]?.literature).filter(Boolean),
      executionTime
    };
    
    // 更新统计信息
    this.updateStatistics(iterationResult, true);
    this.executionState.lastIterationResult = iterationResult;
    this.executionState.phase = 'idle';
    
    return iterationResult;
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

  // ==================== 模块化阶段实现 ====================

  /**
   * 🎯 模块化选择阶段 - 使用TreeController进行节点选择
   */
  private async modularSelectionPhase(
    tree: LiteratureTree,
    context: EvaluationContext
  ): Promise<MCTSNode> {
    const startTime = Date.now();

    try {
      console.log(`🔍 [SGMCTSController] 开始选择阶段，使用TreeController`);

      // 🎯 使用TreeController的智能选择
      let currentNode = this.treeController.getNode(tree.rootNodeId);
      if (!currentNode) {
        throw new AlgorithmError('根节点不存在', 'locator');
      }

      const path: MCTSNode[] = [currentNode];

      // 🎯 使用TreeController进行智能节点选择
      while (true) {
        const children = this.treeController.getChildren(currentNode.id);

        if (children.length === 0) {
          console.log(`🔍 [SGMCTSController] 到达叶子节点: ${currentNode.id}`);
          break;
        }

        // 🎯 使用TreeController的findBestChild方法
        const bestChild = this.treeController.findBestChild(
          currentNode.id,
          this.config.explorationConstant || 1.41
        );

        if (!bestChild) {
          console.log(`🔍 [SGMCTSController] 无法找到最佳子节点，停在: ${currentNode.id}`);
          break;
        }

        currentNode = bestChild;
        path.push(currentNode);

        console.log(`🔍 [SGMCTSController] 选择节点: ${currentNode.id}, 访问次数: ${currentNode.visits}`);

        if (currentNode.visits === 0 || path.length > this.config.maxDepth) {
          break;
        }
      }
      
      this.executionState.selectedPath = path;
      this.executionState.currentNode = currentNode;
      
      // 更新统计
      const phaseTime = Date.now() - startTime;
      this.statistics.phaseStatistics.selection.totalTime += phaseTime;
      this.statistics.phaseStatistics.selection.count += 1;
      
      return currentNode;
      
    } catch (error) {
      throw new AlgorithmError(
        `模块化选择阶段失败: ${error.message}`,
        'locator',
        { tree, context, error }
      );
    }
  }

  /**
   * 模块化扩展阶段 - 使用完整TVC流程
   */
  private async modularExpansionPhase(
    selectedNode: MCTSNode,
    tree: LiteratureTree,
    context: EvaluationContext
  ) {
    const startTime = Date.now();
    
    try {
      // 检查是否需要扩展
      const existingChildren = Object.values(tree.nodes).filter(
        node => node.parentId === selectedNode.id
      );
      
      const maxChildrenPerNode = this.config.batchSize || 3;
      if (existingChildren.length >= maxChildrenPerNode) {
        return {
          success: true,
          expandedNodes: [],
          executionSummary: {
            thinkingResult: { directions: [], pathSummary: '', reasoning: '', confidence: 0, executionTime: 0 },
            formulationResult: { formulations: [], summary: '', confidence: 0, executionTime: 0 },
            citationResult: { citations: [], searchSummary: '', totalFound: 0, confidence: 0, executionTime: 0 },
            validationResults: [],
            rewardResults: []
          },
          totalExecutionTime: Date.now() - startTime
        };
      }
      
      // 执行TVC扩展流程
      const expansionResult = await this.modularExpander!.expandNode(
        selectedNode,
        context,
        {
          maxCandidates: this.config.batchSize || 3,
          minValidationScore: 0.6,
          minRewardThreshold: 0.5,
          enableParallelProcessing: true,
          skipLowQualityNodes: false
        }
      );
      
      // 🎯 将扩展结果中的节点添加到TreeController中
      for (const expandedNode of expansionResult.expandedNodes) {
        if (expandedNode.node.id.startsWith('temp_')) {
          // 🎯 使用TreeController创建真实的树节点
          const citation = expandedNode.citations[0];
          if (citation) {
            console.log('🌳 [SGMCTSController] 使用TreeController创建节点:', {
              parentId: selectedNode.id,
              literatureId: citation.literatureId,
              literatureTitle: citation.literature?.title,
              isValidUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(citation.literatureId)
            });

            // 🎯 使用TreeController添加子节点
            const newNode = this.treeController.addChild(
              selectedNode.id,
              citation.literatureId
            );

            console.log(`✅ [SGMCTSController] TreeController创建节点成功: ${newNode.id}`);

            // 🎯 保存到数据库
            await this.treeController.save();

            // 更新扩展节点中的ID
            expandedNode.node = newNode;

            // 更新统计信息
            this.statistics.nodeStatistics.nodesCreated += 1;
          }
        }
      }
      
      // 更新阶段统计
      const phaseTime = Date.now() - startTime;
      this.statistics.phaseStatistics.expansion.totalTime += phaseTime;
      this.statistics.phaseStatistics.expansion.count += 1;
      
      return expansionResult;
      
    } catch (error) {
      throw new AlgorithmError(
        `模块化扩展阶段失败: ${error.message}`,
        'expander',
        { selectedNode, tree, context, error }
      );
    }
  }

  /**
   * 模块化评估阶段 - 使用RewardCalculator
   */
  private async modularEvaluationPhase(
    nodeToEvaluate: MCTSNode,
    context: EvaluationContext,
    expansionResult?: any
  ): Promise<{
    reward: number;
    evaluationDetails: any;
    expansionCandidates: LibraryItem[];
  }> {
    const startTime = Date.now();
    
    try {
      // 构建奖励计算组件
      const rewardComponents = {
        direction: expansionResult?.expandedNodes[0]?.direction || {
          id: 'default',
          title: '默认研究方向',
          description: '系统生成的研究方向',
          reasoning: '基于当前节点上下文',
          confidence: 0.7,
          keyWords: [],
          expectedCitations: 3
        },
        formulation: expansionResult?.expandedNodes[0]?.formulation || {
          directionId: 'default',
          originalTitle: '默认表述',
          formulation: '研究表述',
          keywords: [],
          searchQueries: [],
          confidence: 0.7,
          reasoning: '默认表述生成'
        },
        citations: expansionResult?.expandedNodes[0]?.citations || [],
        validation: expansionResult?.expandedNodes[0]?.validation || {
          isValid: true,
          validationScore: 0.7,
          confidence: 0.7,
          issues: [],
          recommendations: [],
          detailedScores: {
            duplicationScore: 0.8,
            qualityScore: 0.7,
            tvcConsistencyScore: 0.8
          },
          executionTime: 0
        },
        pathContext: this.executionState.selectedPath
      };
      
      // 使用RewardCalculator计算奖励
      const rewardResult = await this.rewardCalculator!.calculateReward(
        nodeToEvaluate,
        rewardComponents,
        context
      );
      
      // 更新阶段统计
      const phaseTime = Date.now() - startTime;
      this.statistics.phaseStatistics.evaluation.totalTime += phaseTime;
      this.statistics.phaseStatistics.evaluation.count += 1;
      
      return {
        reward: rewardResult.totalReward,
        evaluationDetails: {
          rewardComponents: rewardResult.components,
          confidence: rewardResult.confidence,
          reasoning: rewardResult.reasoning,
          modularMode: true
        },
        expansionCandidates: expansionResult?.expandedNodes?.map((en: any) => 
          en.citations[0]?.literature
        ).filter(Boolean) || []
      };
      
    } catch (error) {
      throw new AlgorithmError(
        `模块化评估阶段失败: ${error.message}`,
        'rewardCalculator',
        { nodeToEvaluate, context, error }
      );
    }
  }

  // ==================== 传统MCTS方法已移除 ====================
  // 🗑️ 传统的selectionPhase、expansionPhase、evaluationPhase已移除
  // 统一使用模块化的 modularSelectionPhase、modularExpansionPhase、modularEvaluationPhase

  // 🗑️ 传统expansionPhase已移除

  // 🗑️ 传统evaluationPhase已移除

  /**
   * 🎯 反向传播阶段 - 使用TreeController更新节点统计信息
   */
  private async backpropagationPhase(
    node: MCTSNode,
    reward: number,
    tree: LiteratureTree
  ): Promise<void> {
    const startTime = Date.now();

    try {
      console.log('🔄 [SGMCTSController] 开始反向传播，使用TreeController', {
        nodeId: node.id,
        reward: reward
      });

      // 🎯 使用TreeController的内置反向传播方法
      // TreeController已经有_backpropagate方法，但是私有的
      // 我们手动实现，但使用TreeController的节点访问

      let currentNode = this.treeController.getNode(node.id);
      if (!currentNode) {
        throw new Error(`节点不存在: ${node.id}`);
      }

      // 🎯 向上传播，更新所有祖先节点
      while (currentNode) {
        // 更新访问次数和胜利次数
        currentNode.visits += 1;
        currentNode.wins += reward;

        console.log(`🔄 [SGMCTSController] 更新节点统计: ${currentNode.id}, visits: ${currentNode.visits}, wins: ${currentNode.wins.toFixed(3)}`);

        // 移动到父节点
        if (currentNode.parentId === null) {
          break;
        }
        currentNode = this.treeController.getNode(currentNode.parentId);
      }

      // 🎯 保存更新到数据库
      await this.treeController.save();

      const executionTime = Date.now() - startTime;

      // 获取最终的节点统计信息
      const finalNode = this.treeController.getNode(node.id);
      const finalReward = finalNode ? finalNode.wins / finalNode.visits : reward;

      console.log('✅ [SGMCTSController] 反向传播完成', {
        nodeId: node.id,
        finalReward: finalReward,
        visits: finalNode?.visits || 1,
        executionTime
      });

      // 更新统计信息
      this.statistics.phaseStatistics.backpropagation.totalTime += executionTime;
      this.statistics.phaseStatistics.backpropagation.count += 1;

    } catch (error) {
      console.error('❌ [SGMCTSController] 反向传播失败:', error);
      throw new AlgorithmError(`反向传播失败: ${error.message}`, 'backpropagation');
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

  /**
   * 获取当前执行模式
   */
  getExecutionMode(): ExecutionMode {
    return this.mode;
  }

  /**
   * 检查是否支持模块化执行
   */
  supportsModularExecution(): boolean {
    return this.mode === 'modular' && 
           this.thinker !== undefined &&
           this.formulator !== undefined &&
           this.citer !== undefined &&
           this.validator !== undefined &&
           this.locator !== undefined &&
           this.rewardCalculator !== undefined &&
           this.modularExpander !== undefined;
  }

  /**
   * 获取算法组件信息
   */
  getAlgorithmInfo() {
    if (this.mode === 'traditional') {
      return {
        mode: 'traditional',
        components: {
          evaluator: this.evaluator?.constructor.name || 'unknown',
          expander: this.expander?.constructor.name || 'unknown',
          selector: this.selector?.constructor.name || 'unknown'
        }
      };
    } else {
      return {
        mode: 'modular',
        components: {
          thinker: this.thinker?.constructor.name || 'unknown',
          formulator: this.formulator?.constructor.name || 'unknown',
          citer: this.citer?.constructor.name || 'unknown',
          validator: this.validator?.constructor.name || 'unknown',
          locator: this.locator?.constructor.name || 'unknown',
          rewardCalculator: this.rewardCalculator?.constructor.name || 'unknown',
          expander: this.modularExpander?.constructor.name || 'unknown'
        }
      };
    }
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