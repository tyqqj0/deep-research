/**
 * 📝 Formulator - 表述生成模块
 * 
 * 职责：实现TVC流程的第二步(Verbalize) - 将思考的研究方向总结为清晰的一句话描述
 * 为后续的文献检索提供精准的查询语句
 */

import { MCTSNode, LibraryItem } from '@/libs/db';
import { EvaluationContext } from '../interfaces';
import { ResearchDirection } from './Thinker';

export interface FormulationResult {
  formulations: DirectionFormulation[];
  summary: string;
  confidence: number;
  executionTime: number;
}

export interface DirectionFormulation {
  directionId: string;
  originalTitle: string;
  formulation: string;
  keywords: string[];
  searchQueries: string[];
  confidence: number;
  reasoning: string;
}

export interface IFormulator {
  /**
   * 将研究方向转换为具体的检索表述
   */
  formulateDirections(
    directions: ResearchDirection[],
    context: EvaluationContext
  ): Promise<FormulationResult>;

  /**
   * 为单个研究方向生成多个表述变体
   */
  generateFormulationVariants(
    direction: ResearchDirection,
    context: EvaluationContext
  ): Promise<{
    variants: string[];
    bestVariant: string;
    reasoning: string;
  }>;
}

export class DefaultFormulator implements IFormulator {
  async formulateDirections(
    directions: ResearchDirection[],
    context: EvaluationContext
  ): Promise<FormulationResult> {
    const startTime = Date.now();

    try {
      const formulations = await Promise.all(
        directions.map(direction => this.formulateDirection(direction, context))
      );

      const executionTime = Date.now() - startTime;
      const avgConfidence = formulations.reduce((sum, f) => sum + f.confidence, 0) / formulations.length;

      return {
        formulations,
        summary: `Generated ${formulations.length} formulations for research directions`,
        confidence: avgConfidence,
        executionTime
      };

    } catch (error) {
      throw new Error(`Formulation process failed: ${error.message}`);
    }
  }

  async generateFormulationVariants(
    direction: ResearchDirection,
    context: EvaluationContext
  ) {
    // 生成不同表述风格的变体
    const variants = [
      `${direction.title}在${context.researchTopic}领域的应用研究`,
      `基于${context.researchTopic}的${direction.title}方法`,
      `${direction.title}：${context.researchTopic}的新视角`,
      `${context.researchTopic}中${direction.title}的理论与实践`
    ];

    // 简单选择最短的作为最佳变体
    const bestVariant = variants.reduce((best, current) => 
      current.length < best.length ? current : best
    );

    return {
      variants,
      bestVariant,
      reasoning: `选择最简洁的表述以提高检索精度`
    };
  }

  private async formulateDirection(
    direction: ResearchDirection,
    context: EvaluationContext
  ): Promise<DirectionFormulation> {
    // 生成核心表述
    const variants = await this.generateFormulationVariants(direction, context);
    const formulation = variants.bestVariant;

    // 提取关键词
    const keywords = [
      ...direction.keyWords,
      ...this.extractKeywordsFromTopic(context.researchTopic),
      ...this.extractKeywordsFromDescription(direction.description)
    ].filter((keyword, index, array) => array.indexOf(keyword) === index); // 去重

    // 生成搜索查询
    const searchQueries = this.generateSearchQueries(formulation, keywords, context);

    return {
      directionId: direction.id,
      originalTitle: direction.title,
      formulation,
      keywords,
      searchQueries,
      confidence: direction.confidence * 0.9, // 略微降低置信度
      reasoning: `将"${direction.title}"表述为"${formulation}"以便文献检索`
    };
  }

  private extractKeywordsFromTopic(topic: string): string[] {
    // 简化的关键词提取
    return topic.split(/\s+|,|，/).filter(word => word.length > 2);
  }

  private extractKeywordsFromDescription(description: string): string[] {
    // 提取描述中的关键词
    const words = description.split(/\s+|,|，|。|\./).filter(word => word.length > 2);
    return words.slice(0, 3); // 只取前3个
  }

  private generateSearchQueries(
    formulation: string,
    keywords: string[],
    context: EvaluationContext
  ): string[] {
    const queries = [
      formulation, // 完整表述
      keywords.slice(0, 3).join(' '), // 前3个关键词组合
      `${context.researchTopic} ${keywords[0] || ''}`, // 主题+主要关键词
      keywords.slice(0, 2).join(' AND ') // 布尔查询格式
    ];

    return queries.filter(query => query.trim().length > 0);
  }
}

// LLM增强版本 - 真正的AI驱动表述生成
export class LLMFormulator implements IFormulator {
  constructor(
    private llmApiKey: string,
    private model: string = 'gpt-3.5-turbo',
    private temperature: number = 0.3,
    private maxTokens: number = 1200
  ) {}

  async formulateDirections(
    directions: ResearchDirection[],
    context: EvaluationContext
  ): Promise<FormulationResult> {
    const startTime = Date.now();

    try {
      // 并行处理所有研究方向
      const formulationPromises = directions.map(direction => 
        this.formulateDirection(direction, context)
      );

      const formulations = await Promise.all(formulationPromises);
      const executionTime = Date.now() - startTime;
      
      const avgConfidence = formulations.reduce((sum, f) => sum + f.confidence, 0) / formulations.length;

      return {
        formulations,
        summary: `通过LLM处理了${directions.length}个研究方向，生成${formulations.length}个高质量表述`,
        confidence: avgConfidence,
        executionTime
      };

    } catch (error) {
      console.error('LLM表述生成失败:', error);
      // 降级到默认实现
      const defaultFormulator = new DefaultFormulator();
      return await defaultFormulator.formulateDirections(directions, context);
    }
  }

  async generateFormulationVariants(
    direction: ResearchDirection,
    context: EvaluationContext
  ) {
    try {
      const prompt = this.buildVariantsPrompt(direction, context);
      const response = await this.callLLM(prompt);
      
      return this.parseVariantsFromResponse(response, direction);

    } catch (error) {
      console.error('LLM变体生成失败:', error);
      // 降级到简化实现
      const baseFormulation = `${direction.title}在${context.researchTopic}领域的研究`;
      return {
        variants: [
          baseFormulation,
          `${context.researchTopic}中的${direction.title}方法`,
          `${direction.title}：${context.researchTopic}研究新视角`
        ],
        bestVariant: baseFormulation,
        reasoning: '使用简化的变体生成策略'
      };
    }
  }

  private async formulateDirection(
    direction: ResearchDirection,
    context: EvaluationContext
  ): Promise<DirectionFormulation> {
    try {
      // 1. 生成表述变体
      const variants = await this.generateFormulationVariants(direction, context);
      
      // 2. 通过LLM生成增强的关键词
      const enhancedKeywords = await this.generateEnhancedKeywords(direction, context);
      
      // 3. 生成多样化的搜索查询
      const searchQueries = await this.generateSearchQueries(variants.bestVariant, enhancedKeywords, context);

      return {
        directionId: direction.id,
        originalTitle: direction.title,
        formulation: variants.bestVariant,
        keywords: enhancedKeywords,
        searchQueries,
        confidence: direction.confidence * 0.95, // LLM处理后保持高置信度
        reasoning: `LLM优化表述：${variants.reasoning}`
      };

    } catch (error) {
      console.error(`单个方向表述生成失败: ${direction.title}`, error);
      // 降级处理
      return {
        directionId: direction.id,
        originalTitle: direction.title,
        formulation: `${direction.title}的深入研究与应用`,
        keywords: direction.keyWords,
        searchQueries: [direction.title, ...direction.keyWords.slice(0, 2)],
        confidence: direction.confidence * 0.8,
        reasoning: '降级到基础表述生成'
      };
    }
  }

  private buildVariantsPrompt(direction: ResearchDirection, context: EvaluationContext): string {
    return `
# 研究方向表述优化任务

## 研究背景
- **整体研究主题**: ${context.researchTopic}
- **当前研究方向**: ${direction.title}
- **方向描述**: ${direction.description}
- **核心关键词**: ${direction.keyWords.join(', ')}
- **置信度**: ${direction.confidence}

## 优化目标
将研究方向转化为适合文献检索的精确表述，要求：
1. **精确性**: 准确反映研究内容和范围
2. **可检索性**: 包含易于匹配的关键术语
3. **学术性**: 使用规范的学术表达
4. **创新性**: 体现方向的独特价值

## 任务要求
请生成3-5个不同风格的表述变体，每个变体应该：
- 长度适中（15-40字）
- 包含核心概念
- 便于文献检索
- 体现研究创新点

## 输出格式
请严格按照以下JSON格式输出：

\`\`\`json
{
  "variants": [
    "表述变体1",
    "表述变体2", 
    "表述变体3",
    "表述变体4"
  ],
  "analysis": {
    "bestVariant": "最优表述",
    "reasoning": "选择理由",
    "strengths": ["优势1", "优势2"],
    "targetAudience": "目标读者群体"
  },
  "optimization": {
    "keyTerms": ["核心术语1", "核心术语2"],
    "searchability": 0.85,
    "clarity": 0.90
  }
}
\`\`\`
`;
  }

  private buildKeywordsPrompt(direction: ResearchDirection, context: EvaluationContext): string {
    return `
# 关键词增强任务

## 研究信息
- **研究主题**: ${context.researchTopic}
- **研究方向**: ${direction.title}  
- **详细描述**: ${direction.description}
- **现有关键词**: ${direction.keyWords.join(', ')}

## 任务目标
基于研究内容，生成更完整、更精确的关键词列表，包括：
1. **核心概念词**: 研究的主要概念和理论
2. **方法术语**: 使用的研究方法和技术
3. **应用领域**: 相关的应用场景和行业
4. **技术关键词**: 涉及的具体技术和工具

## 输出格式
请严格按照以下JSON格式输出：

\`\`\`json
{
  "keywords": {
    "core": ["核心概念1", "核心概念2"],
    "methods": ["方法1", "方法2"],
    "applications": ["应用1", "应用2"],
    "technical": ["技术术语1", "技术术语2"]
  },
  "combined": ["所有关键词的合并列表"],
  "confidence": 0.88
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
              content: '你是一个专业的学术写作助手，擅长将研究想法转化为精确的学术表述和检索关键词。'
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
    if (prompt.includes('研究方向表述优化任务')) {
      return `
\`\`\`json
{
  "variants": [
    "深度学习多模态融合架构的优化策略研究",
    "多模态深度学习中的特征对齐与信息融合",
    "面向多媒体理解的多模态深度学习框架",
    "多模态数据驱动的深度学习架构设计"
  ],
  "analysis": {
    "bestVariant": "深度学习多模态融合架构的优化策略研究",
    "reasoning": "该表述既突出了技术特点（多模态融合），又明确了研究重点（优化策略），适合学术检索",
    "strengths": ["概念明确", "技术导向", "可检索性强"],
    "targetAudience": "深度学习和多媒体处理研究者"
  },
  "optimization": {
    "keyTerms": ["多模态融合", "深度学习", "架构优化"],
    "searchability": 0.88,
    "clarity": 0.92
  }
}
\`\`\`
`;
    } else if (prompt.includes('关键词增强任务')) {
      return `
\`\`\`json
{
  "keywords": {
    "core": ["多模态学习", "深度学习", "特征融合", "信息对齐"],
    "methods": ["卷积神经网络", "注意力机制", "迁移学习", "表示学习"],
    "applications": ["计算机视觉", "自然语言处理", "多媒体理解", "人机交互"],
    "technical": ["神经网络架构", "损失函数设计", "优化算法", "模型压缩"]
  },
  "combined": ["多模态学习", "深度学习", "特征融合", "信息对齐", "卷积神经网络", "注意力机制", "计算机视觉", "神经网络架构"],
  "confidence": 0.85
}
\`\`\`
`;
    }
    
    return `{"error": "未识别的提示词类型"}`;
  }

  private parseVariantsFromResponse(response: string, direction: ResearchDirection) {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('响应中未找到有效的JSON格式');
      }

      const data = JSON.parse(jsonMatch[1]);
      
      return {
        variants: Array.isArray(data.variants) ? data.variants : [direction.title],
        bestVariant: data.analysis?.bestVariant || data.variants?.[0] || direction.title,
        reasoning: data.analysis?.reasoning || 'LLM生成的优化表述'
      };

    } catch (error) {
      console.error('解析变体响应失败:', error);
      return {
        variants: [direction.title],
        bestVariant: direction.title,
        reasoning: '解析失败，使用原始标题'
      };
    }
  }

  private async generateEnhancedKeywords(
    direction: ResearchDirection,
    context: EvaluationContext
  ): Promise<string[]> {
    try {
      const prompt = this.buildKeywordsPrompt(direction, context);
      const response = await this.callLLM(prompt);
      
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[1]);
        return data.combined || direction.keyWords;
      }
      
      return direction.keyWords;

    } catch (error) {
      console.error('关键词增强失败:', error);
      return direction.keyWords;
    }
  }

  private async generateSearchQueries(
    formulation: string,
    keywords: string[],
    context: EvaluationContext
  ): Promise<string[]> {
    // 生成多样化的搜索查询
    const queries = [
      formulation, // 完整表述
      keywords.slice(0, 3).join(' '), // 前3个关键词
      `${context.researchTopic} ${keywords[0] || ''}`, // 主题+主要关键词
      keywords.slice(0, 2).join(' AND '), // 布尔查询
      `"${formulation}"`, // 精确匹配查询
      keywords.filter(k => k.length > 3).slice(0, 2).join(' OR ') // OR查询
    ];

    return queries.filter(query => query.trim().length > 0);
  }
}