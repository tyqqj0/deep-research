/**
 * 🎯 Locator - 节点定位模块
 * 
 * 职责：实现MCTS的选择阶段，计算SG-UCT值并选择最佳节点
 * 对应原SelectionStrategy接口的核心功能
 */

import { MCTSNode, LibraryItem } from '@/libs/db';
import { EvaluationContext, MCTSConfig } from '../interfaces';

export interface LocatorResult {
  selectedNode: MCTSNode;
  selectionReason: string;
  uctValue: number;
  allScores: Array<{
    node: MCTSNode;
    score: number;
    breakdown: {
      exploitationTerm: number;
      explorationTerm: number;
      semanticTerm: number;
      llmPriority: number;
    };
  }>;
}

export interface ILocator {
  /**
   * 从候选节点中选择最佳节点进行扩展
   */
  selectBestNode(
    candidates: MCTSNode[],
    parent: MCTSNode | null,
    config: MCTSConfig,
    context: EvaluationContext
  ): Promise<LocatorResult>;

  /**
   * 计算单个节点的SG-UCT值
   */
  calculateSGUCTValue(
    node: MCTSNode,
    parent: MCTSNode | null,
    config: MCTSConfig,
    context: EvaluationContext
  ): Promise<{
    uctValue: number;
    exploitationTerm: number;
    explorationTerm: number;
    semanticTerm: number;
    llmPriority: number;
  }>;
}

export class DefaultLocator implements ILocator {
  async selectBestNode(
    candidates: MCTSNode[],
    parent: MCTSNode | null,
    config: MCTSConfig,
    context: EvaluationContext
  ): Promise<LocatorResult> {
    if (candidates.length === 0) {
      throw new Error('No candidate nodes provided');
    }

    // 计算所有候选节点的UCT值
    const allScores = await Promise.all(
      candidates.map(async node => {
        const breakdown = await this.calculateSGUCTValue(node, parent, config, context);
        return {
          node,
          score: breakdown.uctValue,
          breakdown
        };
      })
    );

    // 根据配置应用不同的选择策略
    const selectedResult = await this.applySelectionStrategy(allScores, config, context);

    return {
      selectedNode: selectedResult.node,
      selectionReason: this.generateSelectionReason(selectedResult, allScores.length),
      uctValue: selectedResult.score,
      allScores
    };
  }

  async calculateSGUCTValue(
    node: MCTSNode,
    parent: MCTSNode | null,
    config: MCTSConfig,
    context: EvaluationContext
  ) {
    // 改进的利用项计算
    const exploitationTerm = await this.calculateExploitationTerm(node, context);
    
    // 改进的探索项计算
    const explorationTerm = await this.calculateExplorationTerm(node, parent, config, context);
    
    // 增强的语义项计算
    const semanticTerm = await this.calculateSemanticTerm(node, config, context);
    
    // 改进的LLM优先级计算
    const llmPriority = await this.calculateLLMPriority(node, context);

    const uctValue = exploitationTerm + explorationTerm + semanticTerm + llmPriority;

    return {
      uctValue: Math.max(0, uctValue), // 确保非负
      exploitationTerm,
      explorationTerm,
      semanticTerm,
      llmPriority
    };
  }

  private async calculateExploitationTerm(node: MCTSNode, context: EvaluationContext): Promise<number> {
    if (node.visits === 0) return 0;
    
    // 基础胜率
    const winRate = node.wins / node.visits;
    
    // 考虑节点深度的调整
    const depthAdjustment = this.calculateDepthAdjustment(node, context);
    
    // 考虑最近表现的调整
    const recentPerformanceAdjustment = this.calculateRecentPerformance(node);
    
    return winRate * depthAdjustment * recentPerformanceAdjustment;
  }

  private async calculateExplorationTerm(
    node: MCTSNode,
    parent: MCTSNode | null,
    config: MCTSConfig,
    context: EvaluationContext
  ): Promise<number> {
    if (!parent || node.visits === 0) return config.explorationConstant;
    
    // 基础UCB1公式
    const baseExploration = config.explorationConstant * Math.sqrt(Math.log(parent.visits) / node.visits);
    
    // 自适应探索常数
    const adaptiveExploration = this.calculateAdaptiveExploration(node, parent, context);
    
    // 多样性奖励
    const diversityBonus = this.calculateDiversityBonus(node, context);
    
    return baseExploration * adaptiveExploration + diversityBonus;
  }

  private async calculateSemanticTerm(
    node: MCTSNode,
    config: MCTSConfig,
    context: EvaluationContext
  ): Promise<number> {
    if (!config.semanticWeight || config.semanticWeight === 0) return 0;
    
    try {
      // 获取节点对应的文献信息
      const literature = await this.getNodeLiterature(node);
      if (!literature) return 0;
      
      // 计算与研究主题的语义相似度
      const topicSimilarity = this.calculateTopicSimilarity(literature, context.researchTopic);
      
      // 计算与当前路径的语义一致性
      const pathConsistency = this.calculatePathConsistency(literature, context.currentPath || []);
      
      // 计算创新潜力
      const innovationPotential = this.calculateInnovationPotential(literature, context);
      
      return config.semanticWeight * (topicSimilarity * 0.4 + pathConsistency * 0.3 + innovationPotential * 0.3);
      
    } catch (error) {
      console.warn('语义项计算失败:', error);
      return config.semanticWeight * 0.1; // 默认值
    }
  }

  private async calculateLLMPriority(node: MCTSNode, context: EvaluationContext): Promise<number> {
    try {
      // 基于节点历史表现的LLM评估
      const performanceScore = this.calculateNodePerformanceScore(node);
      
      // 基于研究潜力的评估
      const researchPotential = await this.assessResearchPotential(node, context);
      
      // 基于路径位置的重要性评估
      const positionImportance = this.calculatePositionImportance(node, context);
      
      return (performanceScore * 0.4 + researchPotential * 0.4 + positionImportance * 0.2) * 0.1;
      
    } catch (error) {
      console.warn('LLM优先级计算失败:', error);
      return 0.01; // 默认小值
    }
  }

  private async applySelectionStrategy(
    scoredNodes: Array<{ node: MCTSNode; score: number; breakdown: any }>,
    config: MCTSConfig,
    context: EvaluationContext
  ): Promise<{ node: MCTSNode; score: number; breakdown: any }> {
    // 按分数排序
    const sortedNodes = scoredNodes.sort((a, b) => b.score - a.score);
    
    // 默认选择最高分节点，但引入一些随机性以避免局部最优
    const selectionStrategy = config.selectionStrategy || 'greedy';
    
    switch (selectionStrategy) {
      case 'greedy':
        return sortedNodes[0];
        
      case 'epsilon_greedy':
        const epsilon = 0.1; // 10%的概率随机选择
        if (Math.random() < epsilon && sortedNodes.length > 1) {
          const randomIndex = Math.floor(Math.random() * Math.min(3, sortedNodes.length));
          return sortedNodes[randomIndex];
        }
        return sortedNodes[0];
        
      case 'softmax':
        return this.softmaxSelection(sortedNodes);
        
      case 'thompson_sampling':
        return this.thompsonSamplingSelection(sortedNodes);
        
      default:
        return sortedNodes[0];
    }
  }

  private softmaxSelection(
    scoredNodes: Array<{ node: MCTSNode; score: number; breakdown: any }>
  ): { node: MCTSNode; score: number; breakdown: any } {
    const temperature = 1.0; // 控制选择的随机性
    const expScores = scoredNodes.map(item => Math.exp(item.score / temperature));
    const sumExpScores = expScores.reduce((sum, score) => sum + score, 0);
    
    const probabilities = expScores.map(score => score / sumExpScores);
    
    // 根据概率分布随机选择
    const random = Math.random();
    let cumulativeProb = 0;
    
    for (let i = 0; i < scoredNodes.length; i++) {
      cumulativeProb += probabilities[i];
      if (random <= cumulativeProb) {
        return scoredNodes[i];
      }
    }
    
    return scoredNodes[0]; // 后备选择
  }

  private thompsonSamplingSelection(
    scoredNodes: Array<{ node: MCTSNode; score: number; breakdown: any }>
  ): { node: MCTSNode; score: number; breakdown: any } {
    // 简化的汤普森采样实现
    const sampledScores = scoredNodes.map(item => {
      const node = item.node;
      const alpha = node.wins + 1;
      const beta = node.visits - node.wins + 1;
      
      // 简化的Beta分布采样（使用近似）
      const sampledValue = this.sampleBeta(alpha, beta);
      
      return { ...item, sampledScore: sampledValue };
    });
    
    // 选择采样值最高的节点
    return sampledScores.reduce((best, current) => 
      current.sampledScore > best.sampledScore ? current : best
    );
  }

  private sampleBeta(alpha: number, beta: number): number {
    // Beta分布的简化采样（使用均值加噪声的近似）
    const mean = alpha / (alpha + beta);
    const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
    const noise = (Math.random() - 0.5) * 2 * Math.sqrt(variance);
    
    return Math.max(0, Math.min(1, mean + noise));
  }

  // 辅助方法实现

  private calculateDepthAdjustment(node: MCTSNode, context: EvaluationContext): number {
    // 根据树的深度调整利用项，鼓励适度的深度探索
    const currentDepth = context.currentPath?.length || 0;
    const optimalDepth = 4; // 理想深度
    
    if (currentDepth < optimalDepth) {
      return 1.1; // 略微鼓励深入
    } else if (currentDepth > optimalDepth * 2) {
      return 0.9; // 略微惩罚过深
    }
    
    return 1.0;
  }

  private calculateRecentPerformance(node: MCTSNode): number {
    // 简化实现：基于访问次数的新近性评估
    // 在实际应用中，这里应该维护节点的历史表现记录
    const recentVisits = Math.min(node.visits, 10); // 最近10次访问
    if (recentVisits === 0) return 1.0;
    
    // 简化的最近表现评估
    const recentSuccessRate = node.wins / node.visits; // 简化假设
    return 0.8 + 0.4 * recentSuccessRate; // 0.8 到 1.2 的范围
  }

  private calculateAdaptiveExploration(node: MCTSNode, parent: MCTSNode, context: EvaluationContext): number {
    // 基于当前搜索阶段自适应调整探索常数
    const searchPhase = this.determineSearchPhase(context);
    
    switch (searchPhase) {
      case 'early': return 1.2; // 早期更多探索
      case 'middle': return 1.0; // 中期平衡
      case 'late': return 0.8; // 后期更多利用
      default: return 1.0;
    }
  }

  private calculateDiversityBonus(node: MCTSNode, context: EvaluationContext): number {
    // 计算多样性奖励，鼓励探索不同类型的节点
    const siblings = context.currentPath?.slice(-1)[0] ? [] : []; // 简化实现
    
    // 如果当前路径缺乏多样性，给予奖励
    const diversityScore = 0.02; // 基础多样性奖励
    
    return diversityScore;
  }

  private calculateTopicSimilarity(literature: any, researchTopic: string): number {
    if (!literature || !literature.title) return 0;
    
    // 简化的主题相似度计算
    const titleWords = new Set(literature.title.toLowerCase().split(/\s+/));
    const topicWords = new Set(researchTopic.toLowerCase().split(/\s+/));
    
    const intersection = [...titleWords].filter(word => topicWords.has(word));
    const union = [...new Set([...titleWords, ...topicWords])];
    
    return intersection.length / union.length;
  }

  private calculatePathConsistency(literature: any, currentPath: MCTSNode[]): number {
    // 简化的路径一致性计算
    if (currentPath.length === 0) return 1.0;
    
    // 在实际应用中，这里应该分析当前路径的主题一致性
    return 0.8; // 简化返回
  }

  private calculateInnovationPotential(literature: any, context: EvaluationContext): number {
    // 评估文献的创新潜力
    if (!literature) return 0;
    
    // 基于文献的新近性、引用潜力等因素
    const recency = this.calculateRecency(literature);
    const uniqueness = this.calculateUniqueness(literature, context);
    
    return (recency * 0.6 + uniqueness * 0.4);
  }

  private calculateRecency(literature: any): number {
    if (!literature.createdAt) return 0.5;
    
    const ageInDays = (Date.now() - new Date(literature.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const maxAge = 365 * 2; // 2年
    
    return Math.max(0, 1 - ageInDays / maxAge);
  }

  private calculateUniqueness(literature: any, context: EvaluationContext): number {
    // 简化的独特性评估
    if (!literature.topics) return 0.5;
    
    // 基于主题的独特性
    const commonTopics = ['机器学习', '深度学习', '人工智能'];
    const uniqueTopics = literature.topics.filter(topic => !commonTopics.includes(topic));
    
    return Math.min(1, uniqueTopics.length / literature.topics.length + 0.3);
  }

  private calculateNodePerformanceScore(node: MCTSNode): number {
    if (node.visits === 0) return 0.5;
    
    const winRate = node.wins / node.visits;
    const visitBonus = Math.min(0.2, node.visits / 50); // 访问次数奖励
    
    return winRate + visitBonus;
  }

  private async assessResearchPotential(node: MCTSNode, context: EvaluationContext): Promise<number> {
    // 简化的研究潜力评估
    const literature = await this.getNodeLiterature(node);
    if (!literature) return 0.5;
    
    // 基于文献质量指标
    const titleQuality = literature.title.length > 20 && literature.title.length < 100 ? 0.8 : 0.5;
    const abstractQuality = literature.abstract ? 0.8 : 0.3;
    const topicRelevance = this.calculateTopicSimilarity(literature, context.researchTopic);
    
    return (titleQuality * 0.3 + abstractQuality * 0.3 + topicRelevance * 0.4);
  }

  private calculatePositionImportance(node: MCTSNode, context: EvaluationContext): number {
    // 基于节点在搜索树中的位置评估重要性
    const pathLength = context.currentPath?.length || 0;
    
    // 中等深度的节点通常更重要
    if (pathLength >= 2 && pathLength <= 4) {
      return 0.8;
    } else if (pathLength === 1 || pathLength === 5) {
      return 0.6;
    } else {
      return 0.4;
    }
  }

  private determineSearchPhase(context: EvaluationContext): 'early' | 'middle' | 'late' {
    const iterationCount = context.iterationCount || 0;
    
    if (iterationCount < 10) return 'early';
    if (iterationCount < 50) return 'middle';
    return 'late';
  }

  private async getNodeLiterature(node: MCTSNode): Promise<any> {
    // 在实际应用中，这里应该从数据库获取节点对应的文献
    // 目前返回模拟数据
    if (!node.literatureId) return null;
    
    return {
      id: node.literatureId,
      title: `文献标题_${node.id}`,
      abstract: `文献摘要_${node.id}`,
      topics: ['研究主题', '方法论'],
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
    };
  }

  private generateSelectionReason(
    selectedResult: { node: MCTSNode; score: number; breakdown: any },
    totalCandidates: number
  ): string {
    const breakdown = selectedResult.breakdown;
    const dominantFactor = this.identifyDominantFactor(breakdown);
    
    return `从${totalCandidates}个候选中选择得分最高节点 (${selectedResult.score.toFixed(4)})，主要因素: ${dominantFactor}`;
  }

  private identifyDominantFactor(breakdown: any): string {
    const factors = {
      '利用价值': breakdown.exploitationTerm,
      '探索价值': breakdown.explorationTerm,
      '语义相关性': breakdown.semanticTerm,
      'LLM优先级': breakdown.llmPriority
    };
    
    const maxFactor = Object.entries(factors).reduce((max, [name, value]) => 
      value > max.value ? { name, value } : max
    , { name: '利用价值', value: factors['利用价值'] });
    
    return maxFactor.name;
  }
}

// LLM增强版本 - AI驱动的智能节点定位
export class LLMLocator implements ILocator {
  constructor(
    private llmApiKey: string,
    private model: string = 'gpt-3.5-turbo',
    private temperature: number = 0.3,
    private maxTokens: number = 1000
  ) {}

  async selectBestNode(
    candidates: MCTSNode[],
    parent: MCTSNode | null,
    config: MCTSConfig,
    context: EvaluationContext
  ): Promise<LocatorResult> {
    if (candidates.length === 0) {
      throw new Error('No candidate nodes provided');
    }

    try {
      // 使用LLM进行智能节点评估
      const llmAnalysis = await this.performLLMAnalysis(candidates, parent, context);
      
      // 结合传统UCT计算
      const traditionalScores = await Promise.all(
        candidates.map(async node => {
          const breakdown = await this.calculateSGUCTValue(node, parent, config, context);
          return {
            node,
            score: breakdown.uctValue,
            breakdown
          };
        })
      );

      // 融合LLM分析和传统评分
      const hybridScores = this.combineScores(traditionalScores, llmAnalysis);
      
      // 选择最佳节点
      const bestResult = hybridScores.reduce((best, current) => 
        current.score > best.score ? current : best
      );

      return {
        selectedNode: bestResult.node,
        selectionReason: `LLM增强选择: ${llmAnalysis.reasoning} (综合得分: ${bestResult.score.toFixed(4)})`,
        uctValue: bestResult.score,
        allScores: hybridScores
      };

    } catch (error) {
      console.error('LLM节点定位失败:', error);
      // 降级到默认实现
      const defaultLocator = new DefaultLocator();
      return await defaultLocator.selectBestNode(candidates, parent, config, context);
    }
  }

  async calculateSGUCTValue(
    node: MCTSNode,
    parent: MCTSNode | null,
    config: MCTSConfig,
    context: EvaluationContext
  ) {
    // 使用增强的计算方法
    const defaultLocator = new DefaultLocator();
    return await defaultLocator.calculateSGUCTValue(node, parent, config, context);
  }

  private async performLLMAnalysis(
    candidates: MCTSNode[],
    parent: MCTSNode | null,
    context: EvaluationContext
  ): Promise<{
    nodeScores: Map<string, number>;
    reasoning: string;
    bestNodeId: string;
  }> {
    const prompt = this.buildLLMAnalysisPrompt(candidates, parent, context);
    const response = await this.callLLM(prompt);
    
    return this.parseLLMAnalysisResult(response, candidates);
  }

  private buildLLMAnalysisPrompt(
    candidates: MCTSNode[],
    parent: MCTSNode | null,
    context: EvaluationContext
  ): string {
    const candidateInfo = candidates.slice(0, 5).map((node, index) => 
      `候选${index + 1}: ${node.id} (访问${node.visits}次, 胜率${node.visits > 0 ? (node.wins/node.visits*100).toFixed(1) : '0'}%)`
    ).join('\n');

    return `
# 智能节点选择分析任务

## 研究背景
- **研究主题**: ${context.researchTopic}
- **当前路径深度**: ${context.currentPath?.length || 0}
- **总迭代次数**: ${context.iterationCount || 0}

## 父节点信息
${parent ? `父节点: ${parent.id} (访问${parent.visits}次)` : '根节点选择'}

## 候选节点信息
${candidateInfo}

## 分析任务
请从研究策略的角度分析每个候选节点的选择价值，考虑：

1. **研究潜力**: 节点可能带来的学术价值和创新性
2. **探索平衡**: 在利用已知优势和探索未知区域之间的平衡
3. **路径一致性**: 与当前研究路径的逻辑一致性
4. **风险评估**: 选择该节点的潜在风险和收益

## 输出格式
请严格按照以下JSON格式输出：

\`\`\`json
{
  "analysis": {
    "bestChoice": "node_id",
    "reasoning": "详细的选择理由和分析过程",
    "riskAssessment": "风险评估说明"
  },
  "nodeScores": {
    "node_id_1": 0.85,
    "node_id_2": 0.72,
    "node_id_3": 0.91
  },
  "strategicInsights": [
    "策略洞察1",
    "策略洞察2"
  ]
}
\`\`\`
`;
  }

  private async callLLM(prompt: string): Promise<string> {
    try {
      if (process.env.NODE_ENV === 'development') {
        return this.getMockLLMResponse(prompt);
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.llmApiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的研究策略分析专家，擅长评估学术研究中的节点选择策略。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: this.temperature,
          max_tokens: this.maxTokens
        })
      });

      if (!response.ok) {
        throw new Error(`LLM API调用失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '';

    } catch (error) {
      console.error('LLM API调用错误:', error);
      throw error;
    }
  }

  private getMockLLMResponse(prompt: string): string {
    return `
\`\`\`json
{
  "analysis": {
    "bestChoice": "node_1",
    "reasoning": "基于当前研究阶段和路径分析，node_1在研究潜力和风险平衡方面表现最佳。该节点既保持了与现有研究路径的一致性，又具备了足够的创新空间，预期能够产生高质量的研究成果。",
    "riskAssessment": "风险相对较低，成功概率较高，即使失败也能提供有价值的学习经验"
  },
  "nodeScores": {
    "node_1": 0.88,
    "node_2": 0.75,
    "node_3": 0.82,
    "node_4": 0.69
  },
  "strategicInsights": [
    "当前研究阶段适合深化现有方向而非大幅转向",
    "建议在接下来的2-3步中保持路径一致性",
    "可以考虑在后续探索中引入更多创新元素"
  ]
}
\`\`\`
`;
  }

  private parseLLMAnalysisResult(response: string, candidates: MCTSNode[]): {
    nodeScores: Map<string, number>;
    reasoning: string;
    bestNodeId: string;
  } {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('响应中未找到有效的JSON格式');
      }

      const data = JSON.parse(jsonMatch[1]);
      const nodeScores = new Map<string, number>();
      
      // 转换节点分数
      if (data.nodeScores) {
        Object.entries(data.nodeScores).forEach(([nodeId, score]) => {
          nodeScores.set(nodeId, Math.min(1, Math.max(0, score as number)));
        });
      }

      // 如果没有分数，给所有候选节点分配默认分数
      if (nodeScores.size === 0) {
        candidates.forEach((node, index) => {
          nodeScores.set(node.id, 0.5 + Math.random() * 0.3); // 0.5-0.8 的随机分数
        });
      }

      return {
        nodeScores,
        reasoning: data.analysis?.reasoning || 'LLM分析结果',
        bestNodeId: data.analysis?.bestChoice || candidates[0]?.id || ''
      };

    } catch (error) {
      console.error('解析LLM分析结果失败:', error);
      
      // 返回降级结果
      const nodeScores = new Map<string, number>();
      candidates.forEach(node => {
        nodeScores.set(node.id, 0.6);
      });

      return {
        nodeScores,
        reasoning: 'LLM分析失败，使用默认评分',
        bestNodeId: candidates[0]?.id || ''
      };
    }
  }

  private combineScores(
    traditionalScores: Array<{ node: MCTSNode; score: number; breakdown: any }>,
    llmAnalysis: { nodeScores: Map<string, number>; reasoning: string; bestNodeId: string }
  ): Array<{ node: MCTSNode; score: number; breakdown: any }> {
    return traditionalScores.map(item => {
      const llmScore = llmAnalysis.nodeScores.get(item.node.id) || 0.5;
      
      // 融合传统UCT分数和LLM分数
      const combinedScore = item.score * 0.7 + llmScore * 0.3;
      
      return {
        ...item,
        score: combinedScore,
        breakdown: {
          ...item.breakdown,
          llmScore,
          combinedScore
        }
      };
    });
  }
}

// 自适应定位器 - 根据搜索历史动态调整策略
export class AdaptiveLocator implements ILocator {
  private searchHistory: Array<{
    node: MCTSNode;
    success: boolean;
    timestamp: number;
    context: EvaluationContext;
  }> = [];

  private strategyPerformance = new Map<string, { success: number; total: number }>();

  async selectBestNode(
    candidates: MCTSNode[],
    parent: MCTSNode | null,
    config: MCTSConfig,
    context: EvaluationContext
  ): Promise<LocatorResult> {
    if (candidates.length === 0) {
      throw new Error('No candidate nodes provided');
    }

    // 分析历史表现，选择最适合的策略
    const bestStrategy = this.selectBestStrategy(context);
    
    // 根据选定策略调整配置
    const adaptedConfig = this.adaptConfig(config, bestStrategy, context);
    
    // 使用适应后的配置进行选择
    const defaultLocator = new DefaultLocator();
    const result = await defaultLocator.selectBestNode(candidates, parent, adaptedConfig, context);
    
    // 记录选择历史
    this.recordSelection(result.selectedNode, context);
    
    return {
      ...result,
      selectionReason: `自适应策略(${bestStrategy}): ${result.selectionReason}`
    };
  }

  async calculateSGUCTValue(
    node: MCTSNode,
    parent: MCTSNode | null,
    config: MCTSConfig,
    context: EvaluationContext
  ) {
    const defaultLocator = new DefaultLocator();
    return await defaultLocator.calculateSGUCTValue(node, parent, config, context);
  }

  private selectBestStrategy(context: EvaluationContext): string {
    const strategies = ['conservative', 'aggressive', 'balanced', 'innovative'];
    
    // 基于历史表现选择策略
    let bestStrategy = 'balanced';
    let bestPerformance = 0;
    
    for (const strategy of strategies) {
      const performance = this.strategyPerformance.get(strategy);
      if (performance && performance.total > 0) {
        const successRate = performance.success / performance.total;
        if (successRate > bestPerformance) {
          bestPerformance = successRate;
          bestStrategy = strategy;
        }
      }
    }
    
    // 如果没有足够的历史数据，根据搜索阶段选择策略
    if (bestPerformance === 0) {
      const iterationCount = context.iterationCount || 0;
      if (iterationCount < 10) return 'aggressive';
      if (iterationCount < 30) return 'balanced';
      return 'conservative';
    }
    
    return bestStrategy;
  }

  private adaptConfig(config: MCTSConfig, strategy: string, context: EvaluationContext): MCTSConfig {
    const adaptedConfig = { ...config };
    
    switch (strategy) {
      case 'conservative':
        adaptedConfig.explorationConstant *= 0.8; // 减少探索
        adaptedConfig.semanticWeight *= 1.2; // 增加语义权重
        break;
        
      case 'aggressive':
        adaptedConfig.explorationConstant *= 1.5; // 增加探索
        adaptedConfig.semanticWeight *= 0.8; // 减少语义权重
        break;
        
      case 'innovative':
        adaptedConfig.explorationConstant *= 1.3;
        adaptedConfig.semanticWeight *= 1.5; // 大幅增加语义权重
        break;
        
      case 'balanced':
      default:
        // 保持默认配置
        break;
    }
    
    return adaptedConfig;
  }

  private recordSelection(selectedNode: MCTSNode, context: EvaluationContext): void {
    // 记录选择历史
    this.searchHistory.push({
      node: selectedNode,
      success: false, // 将在后续更新
      timestamp: Date.now(),
      context: { ...context }
    });
    
    // 限制历史记录大小
    if (this.searchHistory.length > 100) {
      this.searchHistory.shift();
    }
  }

  public updateSelectionResult(nodeId: string, success: boolean, strategy: string): void {
    // 更新历史记录中的成功状态
    const historyItem = this.searchHistory.find(item => item.node.id === nodeId);
    if (historyItem) {
      historyItem.success = success;
    }
    
    // 更新策略表现统计
    const performance = this.strategyPerformance.get(strategy) || { success: 0, total: 0 };
    performance.total += 1;
    if (success) {
      performance.success += 1;
    }
    this.strategyPerformance.set(strategy, performance);
  }

  public getAdaptationInsights(): {
    bestStrategy: string;
    strategyPerformance: Map<string, { success: number; total: number; rate: number }>;
    recentTrends: string[];
  } {
    // 分析当前最佳策略
    let bestStrategy = 'balanced';
    let bestRate = 0;
    
    const performanceWithRates = new Map();
    for (const [strategy, perf] of this.strategyPerformance.entries()) {
      const rate = perf.total > 0 ? perf.success / perf.total : 0;
      performanceWithRates.set(strategy, { ...perf, rate });
      
      if (rate > bestRate) {
        bestRate = rate;
        bestStrategy = strategy;
      }
    }
    
    // 分析最近趋势
    const recentHistory = this.searchHistory.slice(-20);
    const recentTrends = [];
    
    if (recentHistory.length > 10) {
      const recentSuccess = recentHistory.filter(h => h.success).length;
      const successRate = recentSuccess / recentHistory.length;
      
      if (successRate > 0.7) {
        recentTrends.push('近期表现优秀，可考虑更保守的策略');
      } else if (successRate < 0.4) {
        recentTrends.push('近期表现不佳，建议调整策略或增加探索');
      } else {
        recentTrends.push('近期表现平稳，维持当前策略');
      }
    }
    
    return {
      bestStrategy,
      strategyPerformance: performanceWithRates,
      recentTrends
    };
  }
}