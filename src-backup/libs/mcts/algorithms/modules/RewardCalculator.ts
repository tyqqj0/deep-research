/**
 * 🏆 RewardCalculator - 奖励计算模块
 * 
 * 职责：计算MCTS节点的奖励值，综合考虑多个维度的价值评估
 * 包括文献重要性、引用链质量、生成内容价值、研究潜力等
 */

import { MCTSNode, LibraryItem } from '@/libs/db';
import { EvaluationContext } from '../interfaces';
import { ResearchDirection } from './Thinker';
import { DirectionFormulation } from './Formulator';
import { Citation } from './Citer';
import { ValidationResult } from './Validator';

export interface RewardResult {
  totalReward: number;
  confidence: number;
  breakdown: {
    importanceReward: number;
    citationReward: number;
    noveltyReward: number;
    validationReward: number;
    pathReward: number;
  };
  reasoning: string;
  executionTime: number;
}

export interface RewardComponents {
  direction?: ResearchDirection;
  formulation?: DirectionFormulation;
  citations?: Citation[];
  validation?: ValidationResult;
  pathContext?: MCTSNode[];
}

export interface IRewardCalculator {
  /**
   * 计算节点的综合奖励值
   */
  calculateReward(
    node: MCTSNode,
    components: RewardComponents,
    context: EvaluationContext
  ): Promise<RewardResult>;

  /**
   * 计算文献重要性奖励
   */
  calculateImportanceReward(
    literature: LibraryItem,
    context: EvaluationContext
  ): Promise<{
    score: number;
    reasoning: string;
    factors: {
      topicRelevance: number;
      citationPotential: number;
      contentQuality: number;
    };
  }>;

  /**
   * 计算引用链奖励
   */
  calculateCitationReward(
    citations: Citation[],
    context: EvaluationContext
  ): Promise<{
    score: number;
    reasoning: string;
    factors: {
      relevanceScore: number;
      diversityScore: number;
      qualityScore: number;
    };
  }>;

  /**
   * 计算路径奖励（考虑整个搜索路径的价值）
   */
  calculatePathReward(
    currentPath: MCTSNode[],
    context: EvaluationContext
  ): Promise<{
    score: number;
    reasoning: string;
    factors: {
      depthReward: number;
      diversityReward: number;
      progressReward: number;
    };
  }>;
}

export class DefaultRewardCalculator implements IRewardCalculator {
  async calculateReward(
    node: MCTSNode,
    components: RewardComponents,
    context: EvaluationContext
  ): Promise<RewardResult> {
    const startTime = Date.now();

    try {
      let importanceReward = 0;
      let citationReward = 0;
      let noveltyReward = 0;
      let validationReward = 0;
      let pathReward = 0;

      // 1. 文献重要性奖励
      if (node.literatureId) {
        const literature = await this.getLiteratureById(node.literatureId);
        if (literature) {
          const importanceResult = await this.calculateImportanceReward(literature, context);
          importanceReward = importanceResult.score;
        }
      }

      // 2. 引用链奖励
      if (components.citations && components.citations.length > 0) {
        const citationResult = await this.calculateCitationReward(components.citations, context);
        citationReward = citationResult.score;
      }

      // 3. 新颖性奖励
      if (components.direction) {
        noveltyReward = this.calculateNoveltyReward(components.direction, context);
      }

      // 4. 验证奖励
      if (components.validation) {
        validationReward = this.calculateValidationReward(components.validation);
      }

      // 5. 路径奖励
      if (components.pathContext) {
        const pathResult = await this.calculatePathReward(components.pathContext, context);
        pathReward = pathResult.score;
      }

      // 权重配置
      const weights = {
        importance: 0.3,
        citation: 0.25,
        novelty: 0.2,
        validation: 0.15,
        path: 0.1
      };

      // 计算加权总奖励
      const totalReward = (
        importanceReward * weights.importance +
        citationReward * weights.citation +
        noveltyReward * weights.novelty +
        validationReward * weights.validation +
        pathReward * weights.path
      );

      const breakdown = {
        importanceReward,
        citationReward,
        noveltyReward,
        validationReward,
        pathReward
      };

      const confidence = this.calculateConfidence(breakdown, components);
      const reasoning = this.generateRewardReasoning(breakdown, weights);

      const executionTime = Date.now() - startTime;

      return {
        totalReward,
        confidence,
        breakdown,
        reasoning,
        executionTime
      };

    } catch (error) {
      throw new Error(`Reward calculation failed: ${error.message}`);
    }
  }

  async calculateImportanceReward(
    literature: LibraryItem,
    context: EvaluationContext
  ) {
    // 1. 主题相关性评分
    const topicRelevance = this.calculateTopicRelevance(literature, context.researchTopic);

    // 2. 引用潜力评分（基于作者、期刊等）
    const citationPotential = this.calculateCitationPotential(literature);

    // 3. 内容质量评分
    const contentQuality = this.calculateContentQuality(literature);

    const score = (topicRelevance * 0.5 + citationPotential * 0.3 + contentQuality * 0.2);

    return {
      score,
      reasoning: `主题相关性: ${topicRelevance.toFixed(2)}, 引用潜力: ${citationPotential.toFixed(2)}, 内容质量: ${contentQuality.toFixed(2)}`,
      factors: {
        topicRelevance,
        citationPotential,
        contentQuality
      }
    };
  }

  async calculateCitationReward(
    citations: Citation[],
    context: EvaluationContext
  ) {
    if (citations.length === 0) {
      return {
        score: 0,
        reasoning: '无引用文献',
        factors: {
          relevanceScore: 0,
          diversityScore: 0,
          qualityScore: 0
        }
      };
    }

    // 1. 相关性评分 - 引用文献的平均相关性
    const relevanceScore = citations.reduce((sum, citation) => sum + citation.relevanceScore, 0) / citations.length;

    // 2. 多样性评分 - 引用来源的多样性
    const uniqueAuthors = new Set(citations.flatMap(c => c.literature.authors)).size;
    const diversityScore = Math.min(1, uniqueAuthors / (citations.length * 0.8));

    // 3. 质量评分 - 高质量引用的比例
    const highQualityCitations = citations.filter(c => c.relevanceScore > 0.7).length;
    const qualityScore = highQualityCitations / citations.length;

    const score = (relevanceScore * 0.5 + diversityScore * 0.25 + qualityScore * 0.25);

    return {
      score,
      reasoning: `相关性: ${relevanceScore.toFixed(2)}, 多样性: ${diversityScore.toFixed(2)}, 质量: ${qualityScore.toFixed(2)}`,
      factors: {
        relevanceScore,
        diversityScore,
        qualityScore
      }
    };
  }

  async calculatePathReward(
    currentPath: MCTSNode[],
    context: EvaluationContext
  ) {
    // 1. 深度奖励 - 鼓励深度探索，但避免过度深入
    const optimalDepth = 5;
    const currentDepth = currentPath.length;
    const depthReward = currentDepth <= optimalDepth 
      ? currentDepth / optimalDepth
      : Math.max(0, 1 - (currentDepth - optimalDepth) * 0.1);

    // 2. 多样性奖励 - 路径上节点的多样性
    const uniqueLiteratureIds = new Set(
      currentPath.filter(node => node.literatureId).map(node => node.literatureId)
    );
    const diversityReward = Math.min(1, uniqueLiteratureIds.size / Math.max(1, currentPath.length * 0.8));

    // 3. 进展奖励 - 基于路径上节点的平均奖励值
    const avgNodeValue = currentPath.reduce((sum, node) => {
      return sum + (node.visits > 0 ? node.wins / node.visits : 0);
    }, 0) / currentPath.length;
    const progressReward = Math.min(1, avgNodeValue);

    const score = (depthReward * 0.4 + diversityReward * 0.3 + progressReward * 0.3);

    return {
      score,
      reasoning: `深度: ${depthReward.toFixed(2)}, 多样性: ${diversityReward.toFixed(2)}, 进展: ${progressReward.toFixed(2)}`,
      factors: {
        depthReward,
        diversityReward,
        progressReward
      }
    };
  }

  private calculateTopicRelevance(literature: LibraryItem, researchTopic: string): number {
    // 简化的主题相关性计算
    const titleMatch = this.calculateTextSimilarity(literature.title, researchTopic);
    const abstractMatch = literature.abstract 
      ? this.calculateTextSimilarity(literature.abstract, researchTopic)
      : 0;
    const topicMatch = literature.topics 
      ? literature.topics.some(topic => researchTopic.toLowerCase().includes(topic.toLowerCase())) ? 0.8 : 0
      : 0;

    return (titleMatch * 0.4 + abstractMatch * 0.4 + topicMatch * 0.2);
  }

  private calculateCitationPotential(literature: LibraryItem): number {
    // 简化的引用潜力计算
    let score = 0.5; // 基础分数

    // 作者数量（多作者通常引用更多）
    if (literature.authors.length > 1) {
      score += Math.min(0.2, literature.authors.length * 0.05);
    }

    // 标题长度（适中的标题通常质量更高）
    const titleLength = literature.title.length;
    if (titleLength >= 30 && titleLength <= 100) {
      score += 0.1;
    }

    // 摘要存在性（有摘要通常质量更高）
    if (literature.abstract) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  private calculateContentQuality(literature: LibraryItem): number {
    let score = 0.5; // 基础分数

    // 标题质量 - 避免过短或过长
    const titleLength = literature.title.length;
    if (titleLength >= 20 && titleLength <= 120) {
      score += 0.2;
    }

    // 摘要质量
    if (literature.abstract) {
      const abstractLength = literature.abstract.length;
      if (abstractLength >= 100 && abstractLength <= 1000) {
        score += 0.2;
      }
    }

    // 主题标签数量
    if (literature.topics && literature.topics.length > 0) {
      score += Math.min(0.1, literature.topics.length * 0.05);
    }

    return Math.min(1, score);
  }

  private calculateNoveltyReward(direction: ResearchDirection, context: EvaluationContext): number {
    // 基于研究方向的新颖性计算奖励
    let noveltyScore = direction.confidence; // 基础新颖性来自方向置信度

    // 关键词独特性
    const uniqueKeywords = direction.keyWords.filter(keyword => 
      !context.researchTopic.toLowerCase().includes(keyword.toLowerCase())
    );
    const keywordNovelty = uniqueKeywords.length / direction.keyWords.length;
    noveltyScore = (noveltyScore + keywordNovelty) / 2;

    // 期望引用数（更高的期望引用通常意味着更有价值的研究）
    const citationBonus = Math.min(0.2, direction.expectedCitations / 20);
    noveltyScore += citationBonus;

    return Math.min(1, noveltyScore);
  }

  private calculateValidationReward(validation: ValidationResult): number {
    // 基于验证结果计算奖励
    return Math.max(0, validation.validationScore * validation.confidence);
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  private calculateConfidence(breakdown: any, components: RewardComponents): number {
    let confidence = 0.5; // 基础置信度

    // 基于组件完整性调整置信度
    if (components.direction) confidence += 0.1;
    if (components.citations && components.citations.length > 0) confidence += 0.1;
    if (components.validation) confidence += 0.1;
    if (components.pathContext) confidence += 0.1;

    // 基于奖励分布调整置信度
    const rewardValues = Object.values(breakdown);
    const avgReward = rewardValues.reduce((sum, val) => sum + val, 0) / rewardValues.length;
    const variance = rewardValues.reduce((sum, val) => sum + Math.pow(val - avgReward, 2), 0) / rewardValues.length;
    
    // 低方差意味着更一致的评估，提高置信度
    if (variance < 0.05) confidence += 0.1;

    return Math.min(1, confidence);
  }

  private generateRewardReasoning(breakdown: any, weights: any): string {
    const sortedComponents = Object.entries(breakdown)
      .map(([key, value]) => ({ key, value: value as number, weight: weights[key.replace('Reward', '')] }))
      .sort((a, b) => (b.value * b.weight) - (a.value * a.weight));

    const topComponent = sortedComponents[0];
    const componentNames = {
      importanceReward: '文献重要性',
      citationReward: '引用质量',
      noveltyReward: '研究新颖性',
      validationReward: '验证通过率',
      pathReward: '路径价值'
    };

    return `主要奖励来源: ${componentNames[topComponent.key]}(${(topComponent.value * topComponent.weight).toFixed(3)})，总体评分反映了多维度价值评估的综合结果`;
  }

  private async getLiteratureById(literatureId: string): Promise<LibraryItem | null> {
    // 简化实现：在实际应用中应该从数据库获取
    // 这里返回一个模拟的文献对象
    return {
      id: literatureId,
      title: '模拟文献标题',
      authors: ['模拟作者'],
      abstract: '模拟摘要内容',
      status: 'parsed',
      topics: ['研究主题'],
      url: '',
      filePath: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}

// ML增强奖励计算版本 - 基于机器学习的智能奖励预测
export class MLRewardCalculator implements IRewardCalculator {
  private modelCache = new Map<string, any>();
  private featureHistory: Array<{
    features: number[];
    reward: number;
    timestamp: number;
  }> = [];

  constructor(
    private mlModel: string = 'reward_prediction_model',
    private apiKey?: string,
    private confidenceThreshold: number = 0.7
  ) {}

  async calculateReward(
    node: MCTSNode,
    components: RewardComponents,
    context: EvaluationContext
  ): Promise<RewardResult> {
    const startTime = Date.now();

    try {
      // 1. 提取特征向量  
      const features = await this.extractFeatures(node, components, context);
      
      // 2. 使用ML模型预测奖励
      const mlPrediction = await this.predictReward(features);
      
      // 3. 计算传统奖励作为基准
      const traditionalReward = await this.calculateTraditionalReward(node, components, context);
      
      // 4. 融合ML预测和传统计算
      const hybridReward = this.combineRewards(mlPrediction, traditionalReward);
      
      // 5. 计算各组件的细分奖励
      const breakdown = await this.calculateRewardBreakdown(features, hybridReward, components);

      const executionTime = Date.now() - startTime;

      // 记录特征和奖励用于模型改进
      this.recordFeatureReward(features, hybridReward.totalReward);

      return {
        totalReward: hybridReward.totalReward,
        confidence: hybridReward.confidence,
        breakdown,
        reasoning: `ML增强奖励计算: ${hybridReward.reasoning}`,
        executionTime
      };

    } catch (error) {
      console.error('ML奖励计算失败:', error);
      // 降级到默认计算
      const defaultCalculator = new DefaultRewardCalculator();
      return await defaultCalculator.calculateReward(node, components, context);
    }
  }

  async calculateImportanceReward(
    literature: LibraryItem,
    context: EvaluationContext
  ) {
    try {
      // 提取文献特征
      const features = this.extractLiteratureFeatures(literature, context);
      
      // 使用ML模型预测重要性
      const prediction = await this.predictImportance(features);
      
      return {
        score: prediction.score,
        reasoning: `ML重要性评估: ${prediction.reasoning}`,
        factors: {
          topicRelevance: features.topicRelevance,
          citationPotential: prediction.citationPotential,
          contentQuality: features.contentQuality
        }
      };

    } catch (error) {
      console.error('ML重要性评估失败:', error);
      // 降级到传统方法
      return this.fallbackImportanceReward(literature, context);
    }
  }

  async calculateCitationReward(
    citations: Citation[],
    context: EvaluationContext
  ) {
    try {
      if (citations.length === 0) {
        return {
          score: 0,
          reasoning: '无引用文献',
          factors: { relevanceScore: 0, diversityScore: 0, qualityScore: 0 }
        };
      }

      // 提取引用特征
      const features = this.extractCitationFeatures(citations, context);
      
      // 使用ML模型评估引用质量
      const prediction = await this.predictCitationQuality(features);
      
      return {
        score: prediction.score,
        reasoning: `ML引用评估: 预测质量分数 ${prediction.score.toFixed(3)}`,
        factors: {
          relevanceScore: features.avgRelevance,
          diversityScore: features.diversity,
          qualityScore: prediction.qualityScore
        }
      };

    } catch (error) {
      console.error('ML引用奖励计算失败:', error);
      // 降级到传统方法
      return this.fallbackCitationReward(citations, context);
    }
  }

  async calculatePathReward(
    currentPath: MCTSNode[],
    context: EvaluationContext
  ) {
    try {
      // 提取路径特征
      const features = this.extractPathFeatures(currentPath, context);
      
      // 使用ML模型评估路径价值
      const prediction = await this.predictPathValue(features);
      
      return {
        score: prediction.score,
        reasoning: `ML路径评估: ${prediction.reasoning}`,
        factors: {
          depthReward: features.normalizedDepth,
          diversityReward: features.diversity,
          progressReward: prediction.progressScore
        }
      };

    } catch (error) {
      console.error('ML路径奖励计算失败:', error);
      // 降级到传统方法
      return this.fallbackPathReward(currentPath, context);
    }
  }

  private async extractFeatures(
    node: MCTSNode,
    components: RewardComponents,
    context: EvaluationContext
  ): Promise<number[]> {
    const features: number[] = [];

    // 节点特征
    features.push(node.visits || 0);
    features.push(node.wins || 0);
    features.push(node.visits > 0 ? node.wins / node.visits : 0);

    // 路径特征
    const pathLength = context.currentPath?.length || 0;
    features.push(pathLength);
    features.push(pathLength > 0 ? pathLength / 10 : 0); // 标准化深度

    // 研究方向特征
    if (components.direction) {
      features.push(components.direction.confidence);
      features.push(components.direction.keyWords.length);
      features.push(components.direction.expectedCitations);
    } else {
      features.push(0.5, 0, 0); // 默认值
    }

    // 引用特征
    if (components.citations) {
      features.push(components.citations.length);
      const avgRelevance = components.citations.length > 0 
        ? components.citations.reduce((sum, c) => sum + c.relevanceScore, 0) / components.citations.length
        : 0;
      features.push(avgRelevance);
    } else {
      features.push(0, 0);
    }

    // 验证特征
    if (components.validation) {
      features.push(components.validation.validationScore);
      features.push(components.validation.confidence);
      features.push(components.validation.issues.length);
    } else {
      features.push(0.5, 0.5, 0);
    }

    // 上下文特征
    features.push(context.iterationCount || 0);
    features.push(context.researchTopic.length);

    return features;
  }

  private async predictReward(features: number[]): Promise<{
    score: number;
    confidence: number;
    reasoning: string;
  }> {
    if (process.env.NODE_ENV === 'development' || !this.apiKey) {
      return this.simulateMLPrediction(features);
    }

    try {
      // 调用ML模型API
      const response = await fetch(`https://api.ml-service.com/predict/reward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.mlModel,
          features,
          return_confidence: true
        })
      });

      if (!response.ok) {
        throw new Error(`ML API调用失败: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        score: Math.min(1, Math.max(0, data.prediction || 0.5)),
        confidence: Math.min(1, Math.max(0, data.confidence || 0.5)),
        reasoning: data.explanation || 'ML模型预测结果'
      };

    } catch (error) {
      console.error('ML奖励预测失败:', error);
      return this.simulateMLPrediction(features);
    }
  }

  private simulateMLPrediction(features: number[]): {
    score: number;
    confidence: number;
    reasoning: string;
  } {
    // 基于特征的简化ML预测模拟
    const winRate = features[2] || 0.5;
    const confidence_dir = features[5] || 0.5;
    const citationCount = features[8] || 0;
    const validationScore = features[11] || 0.5;

    // 加权特征组合
    const rawScore = (
      winRate * 0.3 +
      confidence_dir * 0.25 +
      Math.min(1, citationCount / 5) * 0.25 +
      validationScore * 0.2
    );

    // 添加一些随机性模拟模型不确定性
    const noise = (Math.random() - 0.5) * 0.1;
    const finalScore = Math.min(1, Math.max(0, rawScore + noise));

    const confidence = 0.7 + Math.random() * 0.2; // 0.7-0.9

    return {
      score: finalScore,
      confidence,
      reasoning: `基于${features.length}个特征的ML预测，主要影响因子：胜率(${winRate.toFixed(2)})、方向置信度(${confidence_dir.toFixed(2)})`
    };
  }

  private combineRewards(
    mlPrediction: { score: number; confidence: number; reasoning: string },
    traditionalReward: { totalReward: number; confidence: number }
  ): { totalReward: number; confidence: number; reasoning: string } {
    // 根据ML模型的置信度动态调整权重
    const mlWeight = mlPrediction.confidence > this.confidenceThreshold ? 0.7 : 0.4;
    const traditionalWeight = 1 - mlWeight;

    const combinedReward = (
      mlPrediction.score * mlWeight +
      traditionalReward.totalReward * traditionalWeight
    );

    const combinedConfidence = (
      mlPrediction.confidence * mlWeight +
      traditionalReward.confidence * traditionalWeight
    );

    return {
      totalReward: combinedReward,
      confidence: combinedConfidence,
      reasoning: `ML-传统融合(${(mlWeight*100).toFixed(0)}%-${(traditionalWeight*100).toFixed(0)}%): ${mlPrediction.reasoning}`
    };
  }

  private async calculateTraditionalReward(
    node: MCTSNode,
    components: RewardComponents,
    context: EvaluationContext
  ): Promise<{ totalReward: number; confidence: number }> {
    // 使用默认计算器获取传统奖励
    const defaultCalculator = new DefaultRewardCalculator();
    const result = await defaultCalculator.calculateReward(node, components, context);
    
    return {
      totalReward: result.totalReward,
      confidence: result.confidence
    };
  }

  private async calculateRewardBreakdown(
    features: number[],
    hybridReward: { totalReward: number; confidence: number },
    components: RewardComponents
  ): Promise<any> {
    // 基于ML特征重要性分析分解奖励
    const breakdown = {
      importanceReward: hybridReward.totalReward * 0.3,
      citationReward: hybridReward.totalReward * 0.25,
      noveltyReward: hybridReward.totalReward * 0.2,
      validationReward: hybridReward.totalReward * 0.15,
      pathReward: hybridReward.totalReward * 0.1
    };

    // 基于实际组件调整分解
    if (components.citations && components.citations.length > 0) {
      breakdown.citationReward *= 1.2;
    }

    if (components.validation && components.validation.validationScore > 0.8) {
      breakdown.validationReward *= 1.3;
    }

    return breakdown;
  }

  private extractLiteratureFeatures(literature: LibraryItem, context: EvaluationContext): any {
    return {
      titleLength: literature.title.length,
      hasAbstract: !!literature.abstract,
      topicCount: literature.topics?.length || 0,
      topicRelevance: this.calculateTopicRelevance(literature, context.researchTopic),
      contentQuality: this.assessContentQuality(literature),
      authorCount: literature.authors.length
    };
  }

  private extractCitationFeatures(citations: Citation[], context: EvaluationContext): any {
    const avgRelevance = citations.reduce((sum, c) => sum + c.relevanceScore, 0) / citations.length;
    const uniqueAuthors = new Set(citations.flatMap(c => c.literature.authors)).size;
    const diversity = Math.min(1, uniqueAuthors / (citations.length * 0.8));

    return {
      count: citations.length,
      avgRelevance,
      diversity,
      highQualityCount: citations.filter(c => c.relevanceScore > 0.7).length
    };
  }

  private extractPathFeatures(currentPath: MCTSNode[], context: EvaluationContext): any {
    const depth = currentPath.length;
    const avgVisits = currentPath.length > 0 
      ? currentPath.reduce((sum, node) => sum + node.visits, 0) / currentPath.length
      : 0;
    
    const uniqueLiteratureIds = new Set(
      currentPath.filter(node => node.literatureId).map(node => node.literatureId)
    );

    return {
      depth,
      normalizedDepth: Math.min(1, depth / 8),
      avgVisits,
      diversity: Math.min(1, uniqueLiteratureIds.size / Math.max(1, depth * 0.8)),
      maxVisits: Math.max(...currentPath.map(n => n.visits), 0)
    };
  }

  private async predictImportance(features: any): Promise<{
    score: number;
    reasoning: string;
    citationPotential: number;
  }> {
    // 模拟ML重要性预测
    const score = (
      features.topicRelevance * 0.4 +
      features.contentQuality * 0.3 +
      Math.min(1, features.authorCount / 5) * 0.3
    );

    return {
      score: Math.min(1, score + (Math.random() - 0.5) * 0.1),
      reasoning: `基于主题相关性和内容质量的ML评估`,
      citationPotential: Math.min(1, score * 1.2)
    };
  }

  private async predictCitationQuality(features: any): Promise<{
    score: number;
    qualityScore: number;
  }> {
    const score = (
      features.avgRelevance * 0.5 +
      features.diversity * 0.3 +
      Math.min(1, features.highQualityCount / features.count) * 0.2
    );

    return {
      score: Math.min(1, score + (Math.random() - 0.5) * 0.05),
      qualityScore: Math.min(1, features.highQualityCount / features.count)
    };
  }

  private async predictPathValue(features: any): Promise<{
    score: number;
    reasoning: string;
    progressScore: number;
  }> {
    const score = (
      features.normalizedDepth * 0.4 +
      features.diversity * 0.3 +
      Math.min(1, features.avgVisits / 10) * 0.3
    );

    return {
      score: Math.min(1, score + (Math.random() - 0.5) * 0.08),
      reasoning: `路径深度和多样性的ML综合评估`,
      progressScore: Math.min(1, features.avgVisits / 20)
    };
  }

  private recordFeatureReward(features: number[], reward: number): void {
    this.featureHistory.push({
      features: [...features],
      reward,
      timestamp: Date.now()
    });

    // 限制历史记录大小
    if (this.featureHistory.length > 1000) {
      this.featureHistory.shift();
    }
  }

  private calculateTopicRelevance(literature: LibraryItem, researchTopic: string): number {
    const titleWords = new Set(literature.title.toLowerCase().split(/\s+/));
    const topicWords = new Set(researchTopic.toLowerCase().split(/\s+/));
    
    const intersection = [...titleWords].filter(word => topicWords.has(word));
    const union = [...new Set([...titleWords, ...topicWords])];
    
    return intersection.length / union.length;
  }

  private assessContentQuality(literature: LibraryItem): number {
    let score = 0.5;

    // 标题质量
    const titleLength = literature.title.length;
    if (titleLength >= 20 && titleLength <= 120) score += 0.2;

    // 摘要质量
    if (literature.abstract) {
      const abstractLength = literature.abstract.length;
      if (abstractLength >= 100 && abstractLength <= 1000) score += 0.2;
    }

    // 主题标签
    if (literature.topics && literature.topics.length > 0) {
      score += Math.min(0.1, literature.topics.length * 0.05);
    }

    return Math.min(1, score);
  }

  // 降级方法
  private fallbackImportanceReward(literature: LibraryItem, context: EvaluationContext) {
    const topicRelevance = this.calculateTopicRelevance(literature, context.researchTopic);
    const contentQuality = this.assessContentQuality(literature);
    
    return {
      score: (topicRelevance + contentQuality) / 2,
      reasoning: 'ML失败，使用降级评估',
      factors: {
        topicRelevance,
        citationPotential: 0.5,
        contentQuality
      }
    };
  }

  private fallbackCitationReward(citations: Citation[], context: EvaluationContext) {
    if (citations.length === 0) {
      return {
        score: 0,
        reasoning: '无引用文献',
        factors: { relevanceScore: 0, diversityScore: 0, qualityScore: 0 }
      };
    }

    const avgRelevance = citations.reduce((sum, c) => sum + c.relevanceScore, 0) / citations.length;
    
    return {
      score: avgRelevance,
      reasoning: 'ML失败，使用平均相关性',
      factors: {
        relevanceScore: avgRelevance,
        diversityScore: 0.5,
        qualityScore: 0.5
      }
    };
  }

  private fallbackPathReward(currentPath: MCTSNode[], context: EvaluationContext) {
    const depth = currentPath.length;
    const normalizedDepth = Math.min(1, depth / 8);
    
    return {
      score: normalizedDepth * 0.8,
      reasoning: 'ML失败，使用基于深度的评估',
      factors: {
        depthReward: normalizedDepth,
        diversityReward: 0.5,
        progressReward: 0.5
      }
    };
  }

  // 公共方法用于模型改进
  public getModelInsights(): {
    featureHistorySize: number;
    averageReward: number;
    recentTrends: string[];
    featureImportance: Map<string, number>;
  } {
    const recentHistory = this.featureHistory.slice(-100);
    const avgReward = recentHistory.length > 0 
      ? recentHistory.reduce((sum, item) => sum + item.reward, 0) / recentHistory.length
      : 0;

    const recentTrends = [];
    if (recentHistory.length > 20) {
      const recent20 = recentHistory.slice(-20);
      const prev20 = recentHistory.slice(-40, -20);
      
      const recentAvg = recent20.reduce((sum, item) => sum + item.reward, 0) / recent20.length;
      const prevAvg = prev20.reduce((sum, item) => sum + item.reward, 0) / prev20.length;
      
      if (recentAvg > prevAvg * 1.1) {
        recentTrends.push('奖励预测准确性在提升');
      } else if (recentAvg < prevAvg * 0.9) {
        recentTrends.push('奖励预测准确性在下降，需要模型调优');
      } else {
        recentTrends.push('奖励预测保持稳定');
      }
    }

    // 简化的特征重要性分析
    const featureImportance = new Map([
      ['胜率', 0.25],
      ['方向置信度', 0.20],
      ['引用数量', 0.18],
      ['验证分数', 0.15],
      ['路径深度', 0.12],
      ['其他特征', 0.10]
    ]);

    return {
      featureHistorySize: this.featureHistory.length,
      averageReward: avgReward,
      recentTrends,
      featureImportance
    };
  }
}

// LLM增强奖励计算版本 - AI驱动的智能奖励评估
export class LLMRewardCalculator implements IRewardCalculator {
  constructor(
    private llmApiKey: string,
    private model: string = 'gpt-3.5-turbo',
    private temperature: number = 0.2,
    private maxTokens: number = 1200
  ) {}

  async calculateReward(
    node: MCTSNode,
    components: RewardComponents,
    context: EvaluationContext
  ): Promise<RewardResult> {
    const startTime = Date.now();

    try {
      // 使用LLM进行综合奖励评估
      const llmAnalysis = await this.performLLMRewardAnalysis(node, components, context);
      
      // 计算传统奖励作为参考
      const traditionalReward = await this.calculateTraditionalReward(node, components, context);
      
      // 融合LLM分析和传统计算
      const finalReward = this.combineLLMAndTraditional(llmAnalysis, traditionalReward);

      const executionTime = Date.now() - startTime;

      return {
        totalReward: finalReward.totalReward,
        confidence: finalReward.confidence,
        breakdown: finalReward.breakdown,
        reasoning: `LLM智能评估: ${llmAnalysis.reasoning}`,
        executionTime
      };

    } catch (error) {
      console.error('LLM奖励计算失败:', error);
      // 降级到默认计算
      const defaultCalculator = new DefaultRewardCalculator();
      return await defaultCalculator.calculateReward(node, components, context);
    }
  }

  async calculateImportanceReward(
    literature: LibraryItem,
    context: EvaluationContext
  ) {
    try {
      const prompt = this.buildImportanceAnalysisPrompt(literature, context);
      const response = await this.callLLM(prompt);
      const analysis = this.parseImportanceAnalysis(response);

      return {
        score: analysis.score,
        reasoning: `LLM重要性评估: ${analysis.reasoning}`,
        factors: analysis.factors
      };

    } catch (error) {
      console.error('LLM重要性评估失败:', error);
      return this.fallbackImportanceReward(literature, context);
    }
  }

  async calculateCitationReward(
    citations: Citation[],
    context: EvaluationContext
  ) {
    try {
      if (citations.length === 0) {
        return {
          score: 0,
          reasoning: '无引用文献',
          factors: { relevanceScore: 0, diversityScore: 0, qualityScore: 0 }
        };
      }

      const prompt = this.buildCitationAnalysisPrompt(citations, context);
      const response = await this.callLLM(prompt);
      const analysis = this.parseCitationAnalysis(response);

      return {
        score: analysis.score,
        reasoning: `LLM引用评估: ${analysis.reasoning}`,
        factors: analysis.factors
      };

    } catch (error) {
      console.error('LLM引用评估失败:', error);
      return this.fallbackCitationReward(citations, context);
    }
  }

  async calculatePathReward(
    currentPath: MCTSNode[],
    context: EvaluationContext
  ) {
    try {
      const prompt = this.buildPathAnalysisPrompt(currentPath, context);
      const response = await this.callLLM(prompt);
      const analysis = this.parsePathAnalysis(response);

      return {
        score: analysis.score,
        reasoning: `LLM路径评估: ${analysis.reasoning}`,
        factors: analysis.factors
      };

    } catch (error) {
      console.error('LLM路径评估失败:', error);
      return this.fallbackPathReward(currentPath, context);
    }
  }

  private async performLLMRewardAnalysis(
    node: MCTSNode,
    components: RewardComponents,
    context: EvaluationContext
  ): Promise<{
    totalReward: number;
    confidence: number;
    reasoning: string;
    breakdown: any;
  }> {
    const prompt = this.buildComprehensiveRewardPrompt(node, components, context);
    const response = await this.callLLM(prompt);
    
    return this.parseComprehensiveRewardAnalysis(response);
  }

  private buildComprehensiveRewardPrompt(
    node: MCTSNode,
    components: RewardComponents,
    context: EvaluationContext
  ): string {
    const nodeInfo = `节点${node.id}: 访问${node.visits}次, 胜率${node.visits > 0 ? (node.wins/node.visits*100).toFixed(1) : '0'}%`;
    const directionInfo = components.direction 
      ? `研究方向: ${components.direction.title} (置信度: ${components.direction.confidence})`
      : '无研究方向信息';
    const citationInfo = components.citations 
      ? `引用文献: ${components.citations.length}篇 (平均相关性: ${(components.citations.reduce((s,c) => s + c.relevanceScore, 0) / components.citations.length).toFixed(2)})`
      : '无引用文献';
    const validationInfo = components.validation
      ? `验证结果: ${components.validation.isValid ? '通过' : '未通过'} (分数: ${components.validation.validationScore.toFixed(2)})`
      : '无验证信息';

    return `
# 综合奖励评估任务

## 研究背景
- **研究主题**: ${context.researchTopic}
- **当前路径深度**: ${context.currentPath?.length || 0}
- **总迭代次数**: ${context.iterationCount || 0}

## 节点信息
${nodeInfo}

## 研究组件信息
- ${directionInfo}
- ${citationInfo}
- ${validationInfo}

## 评估任务
请从学术研究价值的角度综合评估该节点的奖励价值，考虑：

1. **学术贡献**: 对研究领域的理论和实践贡献
2. **创新程度**: 研究的新颖性和独创性
3. **实用价值**: 研究成果的应用潜力和影响力
4. **研究质量**: 方法的严谨性和结果的可靠性
5. **未来潜力**: 进一步研究和发展的可能性

## 输出格式
请严格按照以下JSON格式输出：

\`\`\`json
{
  "assessment": {
    "totalReward": 0.82,
    "confidence": 0.88,
    "reasoning": "详细的评估理由和分析过程"
  },
  "breakdown": {
    "academicContribution": 0.85,
    "innovation": 0.78,
    "practicalValue": 0.80,
    "researchQuality": 0.88,
    "futurePotential": 0.84
  },
  "insights": [
    "关键洞察1",
    "关键洞察2",
    "关键洞察3"
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
              content: '你是一个专业的学术研究评估专家，擅长从多个维度评估研究成果的价值和奖励。'
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
    if (prompt.includes('综合奖励评估任务')) {
      return `
\`\`\`json
{
  "assessment": {
    "totalReward": 0.78,
    "confidence": 0.85,
    "reasoning": "该研究节点在学术贡献和创新程度方面表现良好，具有明确的理论价值和实践意义。研究方法较为严谨，但在实用价值方面还有提升空间。整体而言，这是一个有价值的研究方向，值得进一步探索。"
  },
  "breakdown": {
    "academicContribution": 0.82,
    "innovation": 0.75,
    "practicalValue": 0.70,
    "researchQuality": 0.85,
    "futurePotential": 0.80
  },
  "insights": [
    "研究具有明确的理论创新点",
    "方法论相对成熟可靠",
    "应用场景需要进一步拓展",
    "具备良好的后续研究基础"
  ]
}
\`\`\`
`;
    }
    
    return `{"error": "未识别的提示词类型"}`;
  }

  private parseComprehensiveRewardAnalysis(response: string): {
    totalReward: number;
    confidence: number;
    reasoning: string;
    breakdown: any;
  } {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('响应中未找到有效的JSON格式');
      }

      const data = JSON.parse(jsonMatch[1]);
      
      return {
        totalReward: Math.min(1, Math.max(0, data.assessment?.totalReward || 0.5)),
        confidence: Math.min(1, Math.max(0, data.assessment?.confidence || 0.5)),
        reasoning: data.assessment?.reasoning || 'LLM综合评估结果',
        breakdown: data.breakdown || {
          academicContribution: 0.5,
          innovation: 0.5,
          practicalValue: 0.5,
          researchQuality: 0.5,
          futurePotential: 0.5
        }
      };

    } catch (error) {
      console.error('解析LLM奖励分析失败:', error);
      return {
        totalReward: 0.6,
        confidence: 0.5,
        reasoning: 'LLM解析失败，使用默认评估',
        breakdown: {
          academicContribution: 0.6,
          innovation: 0.6,
          practicalValue: 0.6,
          researchQuality: 0.6,
          futurePotential: 0.6
        }
      };
    }
  }

  private async calculateTraditionalReward(
    node: MCTSNode,
    components: RewardComponents,
    context: EvaluationContext
  ): Promise<{ totalReward: number; confidence: number; breakdown: any }> {
    const defaultCalculator = new DefaultRewardCalculator();
    const result = await defaultCalculator.calculateReward(node, components, context);
    
    return {
      totalReward: result.totalReward,
      confidence: result.confidence,
      breakdown: result.breakdown
    };
  }

  private combineLLMAndTraditional(
    llmAnalysis: { totalReward: number; confidence: number; breakdown: any },
    traditionalReward: { totalReward: number; confidence: number; breakdown: any }
  ): { totalReward: number; confidence: number; breakdown: any } {
    // 根据LLM置信度动态调整权重
    const llmWeight = llmAnalysis.confidence > 0.8 ? 0.6 : 0.4;
    const traditionalWeight = 1 - llmWeight;

    const combinedReward = (
      llmAnalysis.totalReward * llmWeight +
      traditionalReward.totalReward * traditionalWeight
    );

    const combinedConfidence = (
      llmAnalysis.confidence * llmWeight +
      traditionalReward.confidence * traditionalWeight
    );

    // 融合breakdown
    const combinedBreakdown = {
      importanceReward: combinedReward * 0.3,
      citationReward: combinedReward * 0.25,
      noveltyReward: combinedReward * 0.2,
      validationReward: combinedReward * 0.15,
      pathReward: combinedReward * 0.1
    };

    return {
      totalReward: combinedReward,
      confidence: combinedConfidence,
      breakdown: combinedBreakdown
    };
  }

  // 其他私有方法的简化实现
  private buildImportanceAnalysisPrompt(literature: LibraryItem, context: EvaluationContext): string {
    return `分析文献"${literature.title}"在${context.researchTopic}领域的重要性`;
  }

  private buildCitationAnalysisPrompt(citations: Citation[], context: EvaluationContext): string {
    return `分析${citations.length}篇引用文献的质量和相关性`;
  }

  private buildPathAnalysisPrompt(currentPath: MCTSNode[], context: EvaluationContext): string {
    return `分析包含${currentPath.length}个节点的研究路径价值`;
  }

  private parseImportanceAnalysis(response: string): any {
    return { score: 0.7, reasoning: 'LLM重要性分析', factors: {} };
  }

  private parseCitationAnalysis(response: string): any {
    return { score: 0.7, reasoning: 'LLM引用分析', factors: {} };
  }

  private parsePathAnalysis(response: string): any {
    return { score: 0.7, reasoning: 'LLM路径分析', factors: {} };
  }

  // 降级方法
  private fallbackImportanceReward(literature: LibraryItem, context: EvaluationContext) {
    return { score: 0.6, reasoning: 'LLM失败降级', factors: {} };
  }

  private fallbackCitationReward(citations: Citation[], context: EvaluationContext) {
    return { score: 0.6, reasoning: 'LLM失败降级', factors: {} };
  }

  private fallbackPathReward(currentPath: MCTSNode[], context: EvaluationContext) {
    return { score: 0.6, reasoning: 'LLM失败降级', factors: {} };
  }
}