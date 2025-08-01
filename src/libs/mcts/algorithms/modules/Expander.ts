/**
 * 🚀 Expander - 扩展协调器模块
 * 
 * 职责：协调整个TVC流程，整合所有细粒度模块，执行完整的节点扩展过程
 * Think → Verbalize → Cite → Validate → Reward 的完整流程协调
 */

import { MCTSNode, LibraryItem } from '@/libs/db';
import { EvaluationContext } from '../interfaces';

// 导入各个模块
import { IThinker, ResearchDirection, ThinkingResult } from './Thinker';
import { IFormulator, DirectionFormulation, FormulationResult } from './Formulator';
import { ICiter, Citation, CitationResult } from './Citer';
import { IValidator, ValidationResult, ExpansionCandidate } from './Validator';
import { IRewardCalculator, RewardResult, RewardComponents } from './RewardCalculator';

export interface ExpansionResult {
  success: boolean;
  expandedNodes: ExpandedNode[];
  executionSummary: {
    thinkingResult: ThinkingResult;
    formulationResult: FormulationResult;
    citationResult: CitationResult;
    validationResults: ValidationResult[];
    rewardResults: RewardResult[];
  };
  totalExecutionTime: number;
  errorMessage?: string;
}

export interface ExpandedNode {
  node: MCTSNode;
  direction: ResearchDirection;
  formulation: DirectionFormulation;
  citations: Citation[];
  validation: ValidationResult;
  reward: RewardResult;
  rank: number; // 扩展候选的排名
}

export interface ExpansionConfig {
  maxCandidates: number;
  minValidationScore: number;
  minRewardThreshold: number;
  enableParallelProcessing: boolean;
  skipLowQualityNodes: boolean;
}

export interface IExpander {
  /**
   * 执行完整的TVC扩展流程
   */
  expandNode(
    parentNode: MCTSNode,
    context: EvaluationContext,
    config?: ExpansionConfig
  ): Promise<ExpansionResult>;

  /**
   * 生成扩展候选（原NodeExpander接口兼容）
   */
  generateCandidates(
    node: MCTSNode,
    context: EvaluationContext
  ): Promise<{
    candidates: LibraryItem[];
    reasoning: string;
    confidence: number;
  }>;

  /**
   * 验证扩展有效性（原NodeExpander接口兼容）
   */
  validateExpansion(
    parentNode: MCTSNode,
    candidate: LibraryItem,
    context: EvaluationContext
  ): Promise<{
    isValid: boolean;
    confidence: number;
    reasoning: string;
  }>;

  /**
   * 更新模块配置
   */
  updateModules(modules: {
    thinker?: IThinker;
    formulator?: IFormulator;
    citer?: ICiter;
    validator?: IValidator;
    rewardCalculator?: IRewardCalculator;
  }): void;
}

export class DefaultExpander implements IExpander {
  constructor(
    private thinker: IThinker,
    private formulator: IFormulator,
    private citer: ICiter,
    private validator: IValidator,
    private rewardCalculator: IRewardCalculator
  ) {}

  async expandNode(
    parentNode: MCTSNode,
    context: EvaluationContext,
    config: ExpansionConfig = {
      maxCandidates: 5,
      minValidationScore: 0.6,
      minRewardThreshold: 0.5,
      enableParallelProcessing: true,
      skipLowQualityNodes: false
    }
  ): Promise<ExpansionResult> {
    const startTime = Date.now();

    try {
      console.log(`🚀 开始扩展节点 ${parentNode.id}`);

      // Phase 1: Think - 生成研究方向
      console.log('🧠 Phase 1: 思考推理...');
      const thinkingResult = await this.thinker.generateDirections(parentNode, context);
      
      if (thinkingResult.directions.length === 0) {
        return this.createFailureResult('思考阶段未生成任何研究方向', startTime);
      }

      // 限制候选数量
      const selectedDirections = thinkingResult.directions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, config.maxCandidates);

      console.log(`🧠 生成了 ${selectedDirections.length} 个研究方向`);

      // Phase 2: Verbalize - 生成表述
      console.log('📝 Phase 2: 表述生成...');
      const formulationResult = await this.formulator.formulateDirections(selectedDirections, context);

      if (formulationResult.formulations.length === 0) {
        return this.createFailureResult('表述阶段未生成任何有效表述', startTime);
      }

      console.log(`📝 生成了 ${formulationResult.formulations.length} 个表述`);

      // Phase 3: Cite - 检索文献
      console.log('📚 Phase 3: 文献检索...');
      const citationResult = await this.citer.findRelevantLiterature(formulationResult.formulations, context);

      console.log(`📚 检索到 ${citationResult.citations.length} 个引用`);

      // Phase 4: Validate & Reward - 验证和评分
      console.log('✅ Phase 4: 验证和评分...');
      const expandedNodes: ExpandedNode[] = [];

      if (config.enableParallelProcessing) {
        // 并行处理所有候选
        const processingPromises = formulationResult.formulations.map(async (formulation, index) => {
          return this.processSingleCandidate(
            selectedDirections[index],
            formulation,
            citationResult.citations.filter(c => c.matchedFormulation === formulation.formulation),
            parentNode,
            context,
            config
          );
        });

        const results = await Promise.allSettled(processingPromises);
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            expandedNodes.push(result.value);
          } else {
            console.warn(`候选 ${index} 处理失败:`, result.status === 'rejected' ? result.reason : 'Unknown error');
          }
        });

      } else {
        // 串行处理
        for (let i = 0; i < formulationResult.formulations.length; i++) {
          const formulation = formulationResult.formulations[i];
          const direction = selectedDirections[i];
          const relevantCitations = citationResult.citations.filter(c => 
            c.matchedFormulation === formulation.formulation
          );

          const expandedNode = await this.processSingleCandidate(
            direction,
            formulation,
            relevantCitations,
            parentNode,
            context,
            config
          );

          if (expandedNode) {
            expandedNodes.push(expandedNode);
          }
        }
      }

      // 排序和过滤最终结果
      expandedNodes.sort((a, b) => b.reward.totalReward - a.reward.totalReward);
      expandedNodes.forEach((node, index) => {
        node.rank = index + 1;
      });

      const totalExecutionTime = Date.now() - startTime;

      console.log(`🎉 扩展完成，生成了 ${expandedNodes.length} 个有效节点`);

      return {
        success: true,
        expandedNodes,
        executionSummary: {
          thinkingResult,
          formulationResult,
          citationResult,
          validationResults: expandedNodes.map(n => n.validation),
          rewardResults: expandedNodes.map(n => n.reward)
        },
        totalExecutionTime
      };

    } catch (error) {
      console.error('扩展过程发生错误:', error);
      return this.createFailureResult(`扩展过程失败: ${error.message}`, startTime);
    }
  }

  async generateCandidates(
    node: MCTSNode,
    context: EvaluationContext
  ): Promise<{
    candidates: LibraryItem[];
    reasoning: string;
    confidence: number;
  }> {
    try {
      // 执行简化的TVC流程来生成候选
      const expansionResult = await this.expandNode(node, context, {
        maxCandidates: 3,
        minValidationScore: 0.4,
        minRewardThreshold: 0.3,
        enableParallelProcessing: false,
        skipLowQualityNodes: true
      });

      if (!expansionResult.success) {
        return {
          candidates: [],
          reasoning: expansionResult.errorMessage || '扩展过程失败',
          confidence: 0
        };
      }

      // 转换为LibraryItem格式（兼容原接口）
      const candidates: LibraryItem[] = expansionResult.expandedNodes.map(expandedNode => ({
        id: `generated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: expandedNode.direction.title,
        authors: ['AI Generated'],
        abstract: expandedNode.direction.description,
        status: 'parsed' as const,
        topics: expandedNode.direction.keyWords,
        url: '',
        filePath: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const avgConfidence = expansionResult.expandedNodes.reduce(
        (sum, node) => sum + node.reward.confidence, 0
      ) / expansionResult.expandedNodes.length;

      return {
        candidates,
        reasoning: `通过TVC流程生成了 ${candidates.length} 个候选节点`,
        confidence: avgConfidence
      };

    } catch (error) {
      return {
        candidates: [],
        reasoning: `候选生成失败: ${error.message}`,
        confidence: 0
      };
    }
  }

  async validateExpansion(
    parentNode: MCTSNode,
    candidate: LibraryItem,
    context: EvaluationContext
  ): Promise<{
    isValid: boolean;
    confidence: number;
    reasoning: string;
  }> {
    try {
      // 创建一个简化的ExpansionCandidate
      const expansionCandidate: ExpansionCandidate = {
        direction: {
          id: `dir_${candidate.id}`,
          title: candidate.title,
          description: candidate.abstract || '',
          reasoning: 'Generated from candidate literature',
          confidence: 0.7,
          keyWords: candidate.topics || [],
          expectedCitations: 3
        },
        formulation: {
          directionId: `dir_${candidate.id}`,
          originalTitle: candidate.title,
          formulation: candidate.title,
          keywords: candidate.topics || [],
          searchQueries: [candidate.title],
          confidence: 0.7,
          reasoning: 'Generated from candidate'
        },
        citations: [{
          literatureId: candidate.id,
          literature: candidate,
          relevanceScore: 0.8,
          matchedFormulation: candidate.title,
          matchedKeywords: candidate.topics || [],
          retrievalMethod: 'text' as const,
          reasoning: 'Self-reference'
        }],
        parentNode
      };

      const validationResult = await this.validator.validateExpansion(expansionCandidate, context);

      return {
        isValid: validationResult.isValid,
        confidence: validationResult.confidence,
        reasoning: `验证分数: ${validationResult.validationScore.toFixed(2)}, 问题数: ${validationResult.issues.length}`
      };

    } catch (error) {
      return {
        isValid: false,
        confidence: 0,
        reasoning: `验证过程失败: ${error.message}`
      };
    }
  }

  updateModules(modules: {
    thinker?: IThinker;
    formulator?: IFormulator;
    citer?: ICiter;
    validator?: IValidator;
    rewardCalculator?: IRewardCalculator;
  }): void {
    if (modules.thinker) this.thinker = modules.thinker;
    if (modules.formulator) this.formulator = modules.formulator;
    if (modules.citer) this.citer = modules.citer;
    if (modules.validator) this.validator = modules.validator;
    if (modules.rewardCalculator) this.rewardCalculator = modules.rewardCalculator;
  }

  private async processSingleCandidate(
    direction: ResearchDirection,
    formulation: DirectionFormulation,
    citations: Citation[],
    parentNode: MCTSNode,
    context: EvaluationContext,
    config: ExpansionConfig
  ): Promise<ExpandedNode | null> {
    try {
      // 创建扩展候选
      const candidate: ExpansionCandidate = {
        direction,
        formulation,
        citations,
        parentNode
      };

      // 验证候选
      const validation = await this.validator.validateExpansion(candidate, context);

      // 如果验证不通过且配置要求跳过低质量节点
      if (config.skipLowQualityNodes && validation.validationScore < config.minValidationScore) {
        console.log(`跳过低质量候选: ${direction.title} (验证分数: ${validation.validationScore.toFixed(2)})`);
        return null;
      }

      // 创建临时MCTS节点（实际应用中会通过TreeService创建）
      const tempNode: MCTSNode = {
        id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        literatureId: citations.length > 0 ? citations[0].literatureId : null,
        parentId: parentNode.id,
        visits: 0,
        wins: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 计算奖励
      const rewardComponents: RewardComponents = {
        direction,
        formulation,
        citations,
        validation,
        pathContext: [...(context.currentPath || []), tempNode]
      };

      const reward = await this.rewardCalculator.calculateReward(tempNode, rewardComponents, context);

      // 如果奖励太低且配置要求跳过
      if (config.skipLowQualityNodes && reward.totalReward < config.minRewardThreshold) {
        console.log(`跳过低奖励候选: ${direction.title} (奖励: ${reward.totalReward.toFixed(2)})`);
        return null;
      }

      return {
        node: tempNode,
        direction,
        formulation,
        citations,
        validation,
        reward,
        rank: 0 // 将在后续排序中设置
      };

    } catch (error) {
      console.error(`处理候选失败: ${direction.title}`, error);
      return null;
    }
  }

  private createFailureResult(errorMessage: string, startTime: number): ExpansionResult {
    return {
      success: false,
      expandedNodes: [],
      executionSummary: {
        thinkingResult: {
          directions: [],
          pathSummary: '',
          reasoning: '',
          confidence: 0,
          executionTime: 0
        },
        formulationResult: {
          formulations: [],
          summary: '',
          confidence: 0,
          executionTime: 0
        },
        citationResult: {
          citations: [],
          searchSummary: '',
          totalFound: 0,
          confidence: 0,
          executionTime: 0
        },
        validationResults: [],
        rewardResults: []
      },
      totalExecutionTime: Date.now() - startTime,
      errorMessage
    };
  }
}

// 未来可扩展的高级协调器版本
export class AdvancedExpander implements IExpander {
  constructor(
    private modules: {
      thinker: IThinker;
      formulator: IFormulator;
      citer: ICiter;
      validator: IValidator;
      rewardCalculator: IRewardCalculator;
    },
    private optimizationConfig: {
      enableAdaptiveThresholds: boolean;
      enableCaching: boolean;
      enableMetricsCollection: boolean;
    } = {
      enableAdaptiveThresholds: true,
      enableCaching: true,
      enableMetricsCollection: true
    }
  ) {}

  async expandNode(
    parentNode: MCTSNode,
    context: EvaluationContext,
    config?: ExpansionConfig
  ): Promise<ExpansionResult> {
    // TODO: 实现自适应阈值、缓存优化、指标收集等高级功能
    throw new Error('Advanced Expander not implemented yet');
  }

  async generateCandidates(node: MCTSNode, context: EvaluationContext) {
    // TODO: 实现优化的候选生成
    throw new Error('Advanced candidate generation not implemented yet');
  }

  async validateExpansion(parentNode: MCTSNode, candidate: LibraryItem, context: EvaluationContext) {
    // TODO: 实现优化的扩展验证
    throw new Error('Advanced expansion validation not implemented yet');
  }

  updateModules(modules: any): void {
    // TODO: 实现动态模块更新
    throw new Error('Advanced module update not implemented yet');
  }
}