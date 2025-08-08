/**
 * ✅ Validator - 扩展验证模块
 * 
 * 职责：验证TVC流程生成的扩展是否有效、有价值且符合研究标准
 * 包括重复性检测、质量评估、一致性验证
 */

import { MCTSNode, LibraryItem } from '@/libs/db';
import { EvaluationContext } from '../interfaces';
import { ResearchDirection } from './Thinker';
import { DirectionFormulation } from './Formulator';
import { Citation } from './Citer';

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  validationScore: number;
  issues: ValidationIssue[];
  recommendations: string[];
  qualityMetrics: {
    noveltyScore: number;
    relevanceScore: number;
    feasibilityScore: number;
    impactScore: number;
  };
  executionTime: number;
}

export interface ValidationIssue {
  type: 'duplicate' | 'low_quality' | 'inconsistent' | 'irrelevant' | 'infeasible';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestion: string;
}

export interface ExpansionCandidate {
  direction: ResearchDirection;
  formulation: DirectionFormulation;
  citations: Citation[];
  parentNode: MCTSNode;
}

export interface IValidator {
  /**
   * 验证完整的扩展候选
   */
  validateExpansion(
    candidate: ExpansionCandidate,
    context: EvaluationContext
  ): Promise<ValidationResult>;

  /**
   * 检测与现有节点的重复性
   */
  checkDuplication(
    candidate: ExpansionCandidate,
    existingNodes: MCTSNode[],
    context: EvaluationContext
  ): Promise<{
    isDuplicate: boolean;
    similarityScore: number;
    mostSimilarNode: MCTSNode | null;
    reasoning: string;
  }>;

  /**
   * 评估扩展的研究质量
   */
  assessQuality(
    candidate: ExpansionCandidate,
    context: EvaluationContext
  ): Promise<{
    noveltyScore: number;
    relevanceScore: number;
    feasibilityScore: number;
    impactScore: number;
    reasoning: string;
  }>;

  /**
   * 验证TVC流程的一致性
   */
  validateTVCConsistency(
    direction: ResearchDirection,
    formulation: DirectionFormulation,
    citations: Citation[]
  ): Promise<{
    isConsistent: boolean;
    consistencyScore: number;
    inconsistencies: string[];
  }>;
}

export class DefaultValidator implements IValidator {
  async validateExpansion(
    candidate: ExpansionCandidate,
    context: EvaluationContext
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];

    try {
      // 1. 重复性检测
      const duplicationCheck = await this.checkDuplication(
        candidate,
        context.existingNodes || [],
        context
      );

      if (duplicationCheck.isDuplicate) {
        issues.push({
          type: 'duplicate',
          severity: duplicationCheck.similarityScore > 0.8 ? 'critical' : 'high',
          description: `与现有节点高度相似 (${duplicationCheck.similarityScore.toFixed(2)})`,
          suggestion: '考虑修改研究方向或选择其他扩展路径'
        });
      }

      // 2. 质量评估
      const qualityMetrics = await this.assessQuality(candidate, context);

      // 3. TVC一致性验证
      const consistencyCheck = await this.validateTVCConsistency(
        candidate.direction,
        candidate.formulation,
        candidate.citations
      );

      if (!consistencyCheck.isConsistent) {
        issues.push({
          type: 'inconsistent',
          severity: 'medium',
          description: '思考-表述-引用流程存在不一致',
          suggestion: '重新审查TVC流程的逻辑连贯性'
        });
      }

      // 4. 引用质量检查
      if (candidate.citations.length === 0) {
        issues.push({
          type: 'low_quality',
          severity: 'high',
          description: '缺少支撑文献',
          suggestion: '增加相关文献引用以支持研究方向'
        });
      }

      const lowQualityCitations = candidate.citations.filter(c => c.relevanceScore < 0.5);
      if (lowQualityCitations.length > candidate.citations.length * 0.5) {
        issues.push({
          type: 'low_quality',
          severity: 'medium',
          description: '引用文献相关性较低',
          suggestion: '提高文献检索的精确度和相关性'
        });
      }

      // 5. 可行性评估
      if (qualityMetrics.feasibilityScore < 0.3) {
        issues.push({
          type: 'infeasible',
          severity: 'high',
          description: '研究方向可行性较低',
          suggestion: '重新评估研究的技术可行性和资源需求'
        });
      }

      // 6. 相关性评估
      if (qualityMetrics.relevanceScore < 0.4) {
        issues.push({
          type: 'irrelevant',
          severity: 'medium',
          description: '与研究主题相关性不足',
          suggestion: '调整研究方向以更好地契合主题'
        });
      }

      // 计算总体验证分数
      const validationScore = this.calculateValidationScore(qualityMetrics, issues);
      const isValid = validationScore > 0.6 && !issues.some(i => i.severity === 'critical');

      const executionTime = Date.now() - startTime;

      return {
        isValid,
        confidence: this.calculateConfidence(qualityMetrics, issues),
        validationScore,
        issues,
        recommendations: this.generateRecommendations(candidate, qualityMetrics, issues),
        qualityMetrics,
        executionTime
      };

    } catch (error) {
      throw new Error(`Validation failed: ${error.message}`);
    }
  }

  async checkDuplication(
    candidate: ExpansionCandidate,
    existingNodes: MCTSNode[],
    context: EvaluationContext
  ) {
    let mostSimilarNode: MCTSNode | null = null;
    let maxSimilarity = 0;

    for (const node of existingNodes) {
      // 简化的相似度计算（基于标题和描述）
      const titleSimilarity = this.calculateTextSimilarity(
        candidate.direction.title,
        node.id // 简化：使用node.id作为比较，实际应该使用node的研究内容
      );

      const descriptionSimilarity = this.calculateTextSimilarity(
        candidate.direction.description,
        node.id // 简化实现
      );

      const similarity = (titleSimilarity + descriptionSimilarity) / 2;

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        mostSimilarNode = node;
      }
    }

    const isDuplicate = maxSimilarity > 0.7; // 相似度阈值

    return {
      isDuplicate,
      similarityScore: maxSimilarity,
      mostSimilarNode,
      reasoning: `最高相似度: ${maxSimilarity.toFixed(3)}, 阈值: 0.7`
    };
  }

  async assessQuality(
    candidate: ExpansionCandidate,
    context: EvaluationContext
  ) {
    // 1. 新颖性评分 - 基于与现有研究的差异
    const noveltyScore = Math.max(0, 1 - (candidate.citations.length > 0 
      ? candidate.citations.reduce((sum, c) => sum + c.relevanceScore, 0) / candidate.citations.length * 0.5
      : 0));

    // 2. 相关性评分 - 基于与研究主题的匹配度
    const topicMatch = this.calculateTextSimilarity(
      candidate.direction.title + ' ' + candidate.direction.description,
      context.researchTopic
    );
    const relevanceScore = topicMatch;

    // 3. 可行性评分 - 基于关键词和描述的复杂度
    const complexity = candidate.direction.keyWords.length / 10; // 简化的复杂度计算
    const feasibilityScore = Math.max(0.2, 1 - complexity);

    // 4. 影响力评分 - 基于期望引用数和置信度
    const impactScore = Math.min(1, 
      (candidate.direction.expectedCitations / 10) * candidate.direction.confidence
    );

    return {
      noveltyScore,
      relevanceScore,
      feasibilityScore,
      impactScore,
      reasoning: `新颖性: ${noveltyScore.toFixed(2)}, 相关性: ${relevanceScore.toFixed(2)}, 可行性: ${feasibilityScore.toFixed(2)}, 影响力: ${impactScore.toFixed(2)}`
    };
  }

  async validateTVCConsistency(
    direction: ResearchDirection,
    formulation: DirectionFormulation,
    citations: Citation[]
  ) {
    const inconsistencies: string[] = [];

    // 检查思考-表述一致性
    const thinkFormulateConsistency = this.calculateTextSimilarity(
      direction.title + ' ' + direction.description,
      formulation.formulation
    );

    if (thinkFormulateConsistency < 0.5) {
      inconsistencies.push('思考内容与表述不够一致');
    }

    // 检查表述-引用一致性
    let formulateCiteConsistency = 0;
    if (citations.length > 0) {
      formulateCiteConsistency = citations.reduce((sum, citation) => {
        return sum + this.calculateTextSimilarity(
          formulation.formulation,
          citation.literature.title + ' ' + (citation.literature.abstract || '')
        );
      }, 0) / citations.length;

      if (formulateCiteConsistency < 0.4) {
        inconsistencies.push('表述与引用文献相关性不足');
      }
    }

    // 检查关键词一致性
    const directionKeywords = new Set(direction.keyWords.map(k => k.toLowerCase()));
    const formulationKeywords = new Set(formulation.keywords.map(k => k.toLowerCase()));
    const keywordOverlap = [...directionKeywords].filter(k => formulationKeywords.has(k)).length;
    const keywordConsistency = keywordOverlap / Math.max(directionKeywords.size, formulationKeywords.size);

    if (keywordConsistency < 0.3) {
      inconsistencies.push('思考和表述的关键词不够一致');
    }

    const consistencyScore = (thinkFormulateConsistency + formulateCiteConsistency + keywordConsistency) / 3;

    return {
      isConsistent: inconsistencies.length === 0,
      consistencyScore,
      inconsistencies
    };
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  private calculateValidationScore(
    qualityMetrics: any,
    issues: ValidationIssue[]
  ): number {
    // 基础质量分数
    const baseScore = (
      qualityMetrics.noveltyScore * 0.25 +
      qualityMetrics.relevanceScore * 0.3 +
      qualityMetrics.feasibilityScore * 0.25 +
      qualityMetrics.impactScore * 0.2
    );

    // 问题惩罚
    let penalty = 0;
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          penalty += 0.3;
          break;
        case 'high':
          penalty += 0.2;
          break;
        case 'medium':
          penalty += 0.1;
          break;
        case 'low':
          penalty += 0.05;
          break;
      }
    }

    return Math.max(0, baseScore - penalty);
  }

  private calculateConfidence(
    qualityMetrics: any,
    issues: ValidationIssue[]
  ): number {
    const avgQuality = (
      qualityMetrics.noveltyScore +
      qualityMetrics.relevanceScore + 
      qualityMetrics.feasibilityScore +
      qualityMetrics.impactScore
    ) / 4;

    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;

    if (criticalIssues > 0) return Math.min(0.3, avgQuality);
    if (highIssues > 1) return Math.min(0.5, avgQuality);

    return avgQuality;
  }

  private generateRecommendations(
    candidate: ExpansionCandidate,
    qualityMetrics: any,
    issues: ValidationIssue[]
  ): string[] {
    const recommendations: string[] = [];

    // 基于质量指标的建议
    if (qualityMetrics.noveltyScore < 0.5) {
      recommendations.push('增强研究方向的创新性，探索更独特的视角');
    }

    if (qualityMetrics.relevanceScore < 0.5) {
      recommendations.push('提高与研究主题的相关性，调整研究焦点');
    }

    if (qualityMetrics.feasibilityScore < 0.5) {
      recommendations.push('简化研究方案，提高实施的可行性');
    }

    if (qualityMetrics.impactScore < 0.5) {
      recommendations.push('强化研究的潜在影响力和学术价值');
    }

    // 基于具体问题的建议
    if (candidate.citations.length < 3) {
      recommendations.push('增加更多高质量的文献引用');
    }

    if (candidate.direction.confidence < 0.7) {
      recommendations.push('提高研究方向的确定性和可靠性');
    }

    // 去重
    return [...new Set(recommendations)];
  }
}

// LLM增强验证版本 - AI驱动的智能扩展验证
export class LLMValidator implements IValidator {
  constructor(
    private llmApiKey: string,
    private model: string = 'gpt-3.5-turbo',
    private temperature: number = 0.2,
    private maxTokens: number = 1500
  ) {}

  async validateExpansion(
    candidate: ExpansionCandidate,
    context: EvaluationContext
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      // 1. LLM驱动的重复性检测
      const duplicationCheck = await this.checkDuplication(
        candidate,
        context.existingNodes || [],
        context
      );

      // 2. LLM驱动的质量评估
      const qualityMetrics = await this.assessQuality(candidate, context);

      // 3. LLM驱动的TVC一致性验证
      const consistencyCheck = await this.validateTVCConsistency(
        candidate.direction,
        candidate.formulation,
        candidate.citations
      );

      // 4. 综合分析和问题识别
      const issues = await this.identifyValidationIssues(
        candidate,
        duplicationCheck,
        qualityMetrics,
        consistencyCheck,
        context
      );

      // 5. 生成智能建议
      const recommendations = await this.generateIntelligentRecommendations(
        candidate,
        issues,
        context
      );

      const validationScore = this.calculateLLMValidationScore(
        qualityMetrics,
        consistencyCheck,
        duplicationCheck,
        issues
      );

      const isValid = validationScore > 0.6 && !issues.some(i => i.severity === 'critical');
      const executionTime = Date.now() - startTime;

      return {
        isValid,
        confidence: this.calculateLLMConfidence(validationScore, issues),
        validationScore,
        issues,
        recommendations,
        qualityMetrics,
        executionTime
      };

    } catch (error) {
      console.error('LLM验证失败:', error);
      // 降级到默认验证
      const defaultValidator = new DefaultValidator();
      return await defaultValidator.validateExpansion(candidate, context);
    }
  }

  async checkDuplication(
    candidate: ExpansionCandidate,
    existingNodes: MCTSNode[],
    context: EvaluationContext
  ) {
    try {
      const prompt = this.buildDuplicationCheckPrompt(candidate, existingNodes, context);
      const response = await this.callLLM(prompt);
      
      return this.parseDuplicationResult(response, existingNodes);

    } catch (error) {
      console.error('LLM重复性检测失败:', error);
      // 降级到基础检测
      return this.fallbackDuplicationCheck(candidate, existingNodes);
    }
  }

  async assessQuality(
    candidate: ExpansionCandidate,
    context: EvaluationContext
  ) {
    try {
      const prompt = this.buildQualityAssessmentPrompt(candidate, context);
      const response = await this.callLLM(prompt);
      
      return this.parseQualityResult(response);

    } catch (error) {
      console.error('LLM质量评估失败:', error);
      // 降级到基础评估
      return this.fallbackQualityAssessment(candidate, context);
    }
  }

  async validateTVCConsistency(
    direction: ResearchDirection,
    formulation: DirectionFormulation,
    citations: Citation[]
  ) {
    try {
      const prompt = this.buildTVCConsistencyPrompt(direction, formulation, citations);
      const response = await this.callLLM(prompt);
      
      return this.parseTVCConsistencyResult(response);

    } catch (error) {
      console.error('LLM TVC一致性验证失败:', error);
      // 降级到基础验证
      return this.fallbackTVCConsistency(direction, formulation, citations);
    }
  }

  private buildDuplicationCheckPrompt(
    candidate: ExpansionCandidate,
    existingNodes: MCTSNode[],
    context: EvaluationContext
  ): string {
    const nodeDescriptions = existingNodes.slice(0, 5).map((node, index) => 
      `节点${index + 1}: ${node.id} (访问${node.visits}次)`
    ).join('\n');

    return `
# 研究方向重复性检测任务

## 待检测的新研究方向
- **标题**: ${candidate.direction.title}
- **描述**: ${candidate.direction.description}
- **关键词**: ${candidate.direction.keyWords.join(', ')}
- **表述**: ${candidate.formulation.formulation}

## 现有节点信息
${nodeDescriptions}

## 研究主题背景
${context.researchTopic}

## 检测任务
请分析新研究方向是否与现有节点存在重复或高度相似性。考虑：
1. **概念重叠**: 核心概念和理论基础的相似程度
2. **方法重复**: 研究方法和技术路线的重叠性
3. **创新差异**: 是否有足够的创新点和差异化
4. **价值区分**: 是否能带来独特的研究价值

## 输出格式
请严格按照以下JSON格式输出：

\`\`\`json
{
  "isDuplicate": false,
  "similarityScore": 0.3,
  "mostSimilarNode": "node_id_or_null",
  "reasoning": "详细的重复性分析说明",
  "analysis": {
    "conceptualOverlap": 0.2,
    "methodologicalOverlap": 0.1,
    "innovationDifference": 0.8,
    "valueDistinction": 0.9
  },
  "recommendations": ["建议1", "建议2"]
}
\`\`\`
`;
  }

  private buildQualityAssessmentPrompt(
    candidate: ExpansionCandidate,
    context: EvaluationContext
  ): string {
    return `
# 研究方向质量评估任务

## 研究方向信息
- **标题**: ${candidate.direction.title}
- **描述**: ${candidate.direction.description}
- **推理**: ${candidate.direction.reasoning}
- **置信度**: ${candidate.direction.confidence}
- **关键词**: ${candidate.direction.keyWords.join(', ')}
- **预期引用数**: ${candidate.direction.expectedCitations}

## 表述信息
- **表述**: ${candidate.formulation.formulation}
- **搜索查询**: ${candidate.formulation.searchQueries.slice(0, 3).join(', ')}

## 引用信息
引用数量: ${candidate.citations.length}
主要引用: ${candidate.citations.slice(0, 2).map(c => c.literature.title).join('; ')}

## 研究背景
研究主题: ${context.researchTopic}

## 评估任务
请从以下四个维度评估研究方向的质量：

1. **新颖性** (Novelty): 研究方向的创新程度和独特性
2. **相关性** (Relevance): 与研究主题的相关程度和契合度  
3. **可行性** (Feasibility): 研究的技术可行性和实施难度
4. **影响力** (Impact): 潜在的学术影响力和应用价值

## 输出格式
请严格按照以下JSON格式输出：

\`\`\`json
{
  "noveltyScore": 0.85,
  "relevanceScore": 0.90,
  "feasibilityScore": 0.75,
  "impactScore": 0.80,
  "reasoning": "综合质量评估的详细说明",
  "strengths": ["优势1", "优势2", "优势3"],
  "weaknesses": ["不足1", "不足2"],
  "improvement_suggestions": ["改进建议1", "改进建议2"]
}
\`\`\`
`;
  }

  private buildTVCConsistencyPrompt(
    direction: ResearchDirection,
    formulation: DirectionFormulation,
    citations: Citation[]
  ): string {
    const citationInfo = citations.slice(0, 3).map((c, index) => 
      `引用${index + 1}: ${c.literature.title} (相关性: ${c.relevanceScore.toFixed(2)})`
    ).join('\n');

    return `
# TVC流程一致性验证任务

## Think阶段 - 思考内容
- **研究方向**: ${direction.title}
- **描述**: ${direction.description}
- **推理**: ${direction.reasoning}
- **关键词**: ${direction.keyWords.join(', ')}

## Verbalize阶段 - 表述内容
- **表述**: ${formulation.formulation}
- **原始标题**: ${formulation.originalTitle}
- **表述关键词**: ${formulation.keywords.join(', ')}
- **表述推理**: ${formulation.reasoning}

## Cite阶段 - 引用内容
引用数量: ${citations.length}
${citationInfo}

## 一致性验证任务
请验证Think-Verbalize-Cite三个阶段的逻辑一致性：

1. **Think→Verbalize**: 思考内容是否被准确表述
2. **Verbalize→Cite**: 表述是否得到适当的引用支撑
3. **Think→Cite**: 原始思考是否与引用文献逻辑一致
4. **整体连贯性**: 三个阶段是否形成完整的逻辑链条

## 输出格式
请严格按照以下JSON格式输出：

\`\`\`json
{
  "isConsistent": true,
  "consistencyScore": 0.88,
  "inconsistencies": [],
  "analysis": {
    "thinkVerbalize": 0.92,
    "verbalizeCite": 0.85,
    "thinkCite": 0.87,
    "overallCoherence": 0.90
  },
  "reasoning": "一致性分析的详细说明",
  "suggestions": ["改进建议1", "改进建议2"]
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
              content: '你是一个专业的学术研究验证专家，擅长评估研究方向的质量、创新性和一致性。'
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
    if (prompt.includes('重复性检测任务')) {
      return `
\`\`\`json
{
  "isDuplicate": false,
  "similarityScore": 0.25,
  "mostSimilarNode": null,
  "reasoning": "经过详细分析，新研究方向虽然在某些关键词上有重叠，但在研究方法、创新角度和应用领域上都有显著差异，不构成重复研究。",
  "analysis": {
    "conceptualOverlap": 0.3,
    "methodologicalOverlap": 0.1,
    "innovationDifference": 0.85,
    "valueDistinction": 0.9
  },
  "recommendations": ["强化独特性表述", "明确与现有研究的差异点"]
}
\`\`\`
`;
    } else if (prompt.includes('质量评估任务')) {
      return `
\`\`\`json
{
  "noveltyScore": 0.82,
  "relevanceScore": 0.88,
  "feasibilityScore": 0.75,
  "impactScore": 0.79,
  "reasoning": "该研究方向在新颖性和相关性方面表现突出，具有较强的创新性和明确的研究价值。可行性方面需要考虑技术实现的复杂度，但整体上是可行的。预期能产生良好的学术影响。",
  "strengths": ["创新角度独特", "与主题高度相关", "有清晰的应用前景"],
  "weaknesses": ["技术实现较复杂", "资源需求较高"],
  "improvement_suggestions": ["细化技术实现路径", "考虑分阶段实施策略"]
}
\`\`\`
`;
    } else if (prompt.includes('TVC流程一致性验证')) {
      return `
\`\`\`json
{
  "isConsistent": true,
  "consistencyScore": 0.85,
  "inconsistencies": [],
  "analysis": {
    "thinkVerbalize": 0.90,
    "verbalizeCite": 0.82,
    "thinkCite": 0.83,
    "overallCoherence": 0.85
  },
  "reasoning": "TVC三个阶段总体保持了良好的逻辑一致性。思考阶段的研究方向在表述阶段得到了准确的概括，引用文献与研究主题相关性较强，整体形成了完整的逻辑链条。",
  "suggestions": ["进一步优化关键词的一致性", "增加更多支撑性引用"]
}
\`\`\`
`;
    }
    
    return `{"error": "未识别的验证任务类型"}`;
  }

  private parseDuplicationResult(response: string, existingNodes: MCTSNode[]) {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('响应中未找到有效的JSON格式');
      }

      const data = JSON.parse(jsonMatch[1]);
      
      return {
        isDuplicate: data.isDuplicate || false,
        similarityScore: Math.min(1, Math.max(0, data.similarityScore || 0)),
        mostSimilarNode: data.mostSimilarNode ? existingNodes.find(n => n.id === data.mostSimilarNode) || null : null,
        reasoning: data.reasoning || 'LLM分析结果'
      };

    } catch (error) {
      console.error('解析重复性检测结果失败:', error);
      return this.fallbackDuplicationCheck({ direction: { title: '未知' } } as any, existingNodes);
    }
  }

  private parseQualityResult(response: string) {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('响应中未找到有效的JSON格式');
      }

      const data = JSON.parse(jsonMatch[1]);
      
      return {
        noveltyScore: Math.min(1, Math.max(0, data.noveltyScore || 0.7)),
        relevanceScore: Math.min(1, Math.max(0, data.relevanceScore || 0.7)),
        feasibilityScore: Math.min(1, Math.max(0, data.feasibilityScore || 0.7)),
        impactScore: Math.min(1, Math.max(0, data.impactScore || 0.7)),
        reasoning: data.reasoning || 'LLM质量评估结果'
      };

    } catch (error) {
      console.error('解析质量评估结果失败:', error);
      return {
        noveltyScore: 0.7,
        relevanceScore: 0.7,
        feasibilityScore: 0.7,
        impactScore: 0.7,
        reasoning: '解析失败，使用默认评估'
      };
    }
  }

  private parseTVCConsistencyResult(response: string) {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('响应中未找到有效的JSON格式');
      }

      const data = JSON.parse(jsonMatch[1]);
      
      return {
        isConsistent: data.isConsistent !== false,
        consistencyScore: Math.min(1, Math.max(0, data.consistencyScore || 0.8)),
        inconsistencies: Array.isArray(data.inconsistencies) ? data.inconsistencies : []
      };

    } catch (error) {
      console.error('解析TVC一致性结果失败:', error);
      return {
        isConsistent: true,
        consistencyScore: 0.7,
        inconsistencies: []
      };
    }
  }

  private async identifyValidationIssues(
    candidate: ExpansionCandidate,
    duplicationCheck: any,
    qualityMetrics: any,
    consistencyCheck: any,
    context: EvaluationContext
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // 重复性问题
    if (duplicationCheck.isDuplicate) {
      issues.push({
        type: 'duplicate',
        severity: duplicationCheck.similarityScore > 0.9 ? 'critical' : 'high',
        description: `与现有研究高度相似 (相似度: ${duplicationCheck.similarityScore.toFixed(2)})`,
        suggestion: '重新设计研究角度，强化独特性'
      });
    }

    // 质量问题
    if (qualityMetrics.noveltyScore < 0.5) {
      issues.push({
        type: 'low_quality',
        severity: 'medium',
        description: '研究新颖性不足',
        suggestion: '增强创新点，寻找独特的研究视角'
      });
    }

    if (qualityMetrics.feasibilityScore < 0.4) {
      issues.push({
        type: 'infeasible',
        severity: 'high',
        description: '研究可行性较低',
        suggestion: '简化研究方案，提高实施可行性'
      });
    }

    // 一致性问题
    if (!consistencyCheck.isConsistent) {
      issues.push({
        type: 'inconsistent',
        severity: 'medium',
        description: 'TVC流程存在逻辑不一致',
        suggestion: '重新审查思考-表述-引用的逻辑链条'
      });
    }

    // 引用问题
    if (candidate.citations.length === 0) {
      issues.push({
        type: 'low_quality',
        severity: 'high',
        description: '缺少支撑文献',
        suggestion: '增加相关的高质量文献引用'
      });
    }

    return issues;
  }

  private async generateIntelligentRecommendations(
    candidate: ExpansionCandidate,
    issues: ValidationIssue[],
    context: EvaluationContext
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // 基于问题类型生成智能建议
    const problemTypes = new Set(issues.map(i => i.type));

    if (problemTypes.has('duplicate')) {
      recommendations.push('通过调整研究角度或方法来增强独特性');
      recommendations.push('明确与现有研究的差异化价值');
    }

    if (problemTypes.has('low_quality')) {
      recommendations.push('深化研究内容，提升学术价值');
      recommendations.push('强化理论基础和方法论');
    }

    if (problemTypes.has('inconsistent')) {
      recommendations.push('重新整理TVC流程的逻辑关系');
      recommendations.push('确保思考、表述、引用三者的一致性');
    }

    if (problemTypes.has('infeasible')) {
      recommendations.push('分解复杂任务，采用分阶段实施策略');
      recommendations.push('评估资源需求，确保研究可行性');
    }

    // 基于质量指标的建议
    const qualityMetrics = await this.parseQualityResult('{"noveltyScore": 0.7}'); // 模拟获取
    if (qualityMetrics.noveltyScore < 0.7) {
      recommendations.push('探索更具创新性的研究方法和技术路线');
    }

    // 去重并限制数量
    return [...new Set(recommendations)].slice(0, 5);
  }

  private calculateLLMValidationScore(
    qualityMetrics: any,
    consistencyCheck: any,
    duplicationCheck: any,
    issues: ValidationIssue[]
  ): number {
    // 基础质量分数
    const qualityScore = (
      qualityMetrics.noveltyScore * 0.25 +
      qualityMetrics.relevanceScore * 0.25 +
      qualityMetrics.feasibilityScore * 0.25 +
      qualityMetrics.impactScore * 0.25
    );

    // 一致性奖励
    const consistencyBonus = consistencyCheck.consistencyScore * 0.2;

    // 重复性惩罚
    const duplicationPenalty = duplicationCheck.isDuplicate ? duplicationCheck.similarityScore * 0.3 : 0;

    // 问题惩罚
    let issuePenalty = 0;
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical': issuePenalty += 0.4; break;
        case 'high': issuePenalty += 0.2; break;
        case 'medium': issuePenalty += 0.1; break;
        case 'low': issuePenalty += 0.05; break;
      }
    }

    return Math.max(0, qualityScore + consistencyBonus - duplicationPenalty - issuePenalty);
  }

  private calculateLLMConfidence(validationScore: number, issues: ValidationIssue[]): number {
    let confidence = validationScore * 0.8; // 基础置信度

    // LLM分析的置信度奖励
    confidence += 0.15;

    // 严重问题的置信度惩罚
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;

    if (criticalIssues > 0) confidence = Math.min(confidence, 0.4);
    if (highIssues > 1) confidence = Math.min(confidence, 0.6);

    return Math.min(1, Math.max(0.2, confidence));
  }

  private fallbackDuplicationCheck(candidate: ExpansionCandidate, existingNodes: MCTSNode[]) {
    return {
      isDuplicate: false,
      similarityScore: 0.3,
      mostSimilarNode: null,
      reasoning: 'LLM检测失败，使用降级检测'
    };
  }

  private fallbackQualityAssessment(candidate: ExpansionCandidate, context: EvaluationContext) {
    return {
      noveltyScore: 0.7,
      relevanceScore: 0.7,
      feasibilityScore: 0.7,
      impactScore: 0.7,
      reasoning: 'LLM评估失败，使用默认评估'
    };
  }

  private fallbackTVCConsistency(
    direction: ResearchDirection,
    formulation: DirectionFormulation,
    citations: Citation[]
  ) {
    return {
      isConsistent: true,
      consistencyScore: 0.7,
      inconsistencies: []
    };
  }
}