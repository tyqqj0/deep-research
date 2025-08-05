/**
 * 🧠 Thinker - 思考推理模块
 *
 * 职责：实现TVC流程的第一步(Think) - 分析当前路径，生成可能的研究方向
 * 核心是LLM驱动的推理过程
 *
 * TODO: 🎯 需要改进的地方
 * 1. 集成LLM进行智能路径总结
 * 2. 使用LLM预测研究方向而不是简化版本
 * 3. 深度分析研究脉络和发展趋势
 * 4. 识别研究空白和潜在机会
 */

import { MCTSNode, LibraryItem } from '@/libs/db';
import { EvaluationContext } from '../interfaces';
import { SessionLiteratureConnector } from '../../../research/SessionLiteratureConnector';

export interface ResearchDirection {
  id: string;
  title: string;
  description: string;
  reasoning: string;
  confidence: number;
  keyWords: string[];
  expectedCitations: number;
}

export interface ThinkingResult {
  directions: ResearchDirection[];
  pathSummary: string;
  reasoning: string;
  confidence: number;
  executionTime: number;
}

export interface IThinker {
  /**
   * 基于当前节点路径生成可能的研究扩展方向
   */
  generateDirections(
    currentNode: MCTSNode,
    context: EvaluationContext
  ): Promise<ThinkingResult>;

  /**
   * 分析从根节点到当前节点的路径意义
   */
  analyzePath(
    path: MCTSNode[],
    context: EvaluationContext
  ): Promise<{
    pathTheme: string;
    evolutionPattern: string;
    gaps: string[];
    suggestedDirections: string[];
  }>;
}

export class DefaultThinker implements IThinker {
  constructor(private sessionConnector?: SessionLiteratureConnector) {}

  async generateDirections(
    currentNode: MCTSNode,
    context: EvaluationContext
  ): Promise<ThinkingResult> {
    const startTime = Date.now();

    try {
      console.log(`🧠 [DefaultThinker] 开始思考推理，路径长度: ${context.currentPath.length}`);

      // 🎯 优先使用真实数据
      if (this.sessionConnector) {
        return await this.generateDirectionsWithRealData(currentNode, context, startTime);
      }

      // 🔄 降级到基础算法（保持向后兼容）
      console.warn(`⚠️ [DefaultThinker] SessionConnector未提供，使用基础算法`);
      return await this.generateDirectionsBasic(currentNode, context, startTime);

    } catch (error) {
      console.error(`❌ [DefaultThinker] 思考推理失败:`, error);
      throw new Error(`Thinking process failed: ${error.message}`);
    }
  }

  async analyzePath(
    path: MCTSNode[],
    context: EvaluationContext
  ) {
    // 简化的路径分析实现
    const pathTheme = `研究主题: ${context.researchTopic}`;
    const evolutionPattern = `路径深度: ${path.length}, 探索模式: 广度优先`;
    
    // 模拟发现的研究空白
    const gaps = [
      '缺乏最新的实验验证',
      '理论与实践结合不足', 
      '跨学科研究机会'
    ];

    const suggestedDirections = [
      '深入理论分析',
      '实验验证研究',
      '应用场景扩展',
      '方法论改进'
    ];

    return {
      pathTheme,
      evolutionPattern,
      gaps,
      suggestedDirections
    };
  }

  private async generateDirectionsBasic(
    currentNode: MCTSNode, 
    context: EvaluationContext,
    pathAnalysis: any
  ): Promise<ResearchDirection[]> {
    // 基础版本：生成固定的研究方向模板
    const baseDirections = [
      {
        title: '理论深化',
        description: '对当前理论框架进行深入分析和扩展',
        keyWords: ['理论', '框架', '模型'],
        expectedCitations: 5
      },
      {
        title: '实验验证', 
        description: '通过实验手段验证理论假设',
        keyWords: ['实验', '验证', '测试'],
        expectedCitations: 3
      },
      {
        title: '应用研究',
        description: '探索理论在实际场景中的应用',
        keyWords: ['应用', '实践', '场景'],
        expectedCitations: 4
      },
      {
        title: '方法改进',
        description: '改进现有方法的效率和准确性',
        keyWords: ['方法', '优化', '改进'],
        expectedCitations: 6
      }
    ];

    return baseDirections.map((dir, index) => ({
      id: `direction_${Date.now()}_${index}`,
      title: dir.title,
      description: dir.description,
      reasoning: `基于路径分析，${dir.title}是一个有价值的研究方向`,
      confidence: 0.7 + Math.random() * 0.2, // 0.7-0.9之间
      keyWords: dir.keyWords,
      expectedCitations: dir.expectedCitations
    }));
  }

  /**
   * 🎯 使用真实数据进行思考推理
   */
  private async generateDirectionsWithRealData(
    currentNode: MCTSNode,
    context: EvaluationContext,
    startTime: number
  ): Promise<ThinkingResult> {
    // 🎯 获取路径上所有节点的真实文献数据
    const pathLiterature = await this.sessionConnector!.getPathLiteratureData(context.currentPath);

    console.log(`🧠 [DefaultThinker] 获取到${pathLiterature.length}篇路径文献数据`);

    // 🎯 基于真实数据分析路径
    const pathAnalysis = await this.analyzePathWithRealData(pathLiterature, context);

    // 🎯 基于真实数据生成方向（后续可替换为LLM）
    const originalDirections = await this.generateDirectionsFromRealData(pathLiterature, context, pathAnalysis);

    // 🚀 快速修复：添加随机被引文献方向
    const syntheticDirections = await this.generateSyntheticDirections(currentNode, context);

    // 合并原始方向和合成方向
    const allDirections = [...originalDirections, ...syntheticDirections];

    console.log(`🧠 [DefaultThinker] 生成方向总数: ${allDirections.length} (原始: ${originalDirections.length}, 合成: ${syntheticDirections.length})`);

    const executionTime = Date.now() - startTime;

    return {
      directions: allDirections,
      pathSummary: pathAnalysis.pathTheme,
      reasoning: `基于${pathLiterature.length}篇真实文献的路径分析，识别出${originalDirections.length}个研究方向。额外基于被引文献生成${syntheticDirections.length}个扩展方向`,
      confidence: 0.85, // 真实数据置信度更高
      executionTime
    };
  }

  /**
   * 🔄 基础算法生成方向（向后兼容）
   */
  private async generateDirectionsBasic(
    currentNode: MCTSNode,
    context: EvaluationContext,
    startTime: number
  ): Promise<ThinkingResult> {
    // 分析当前路径
    const pathAnalysis = await this.analyzePath(context.currentPath, context);

    // 生成研究方向（简化版本）
    const directions = await this.generateDirectionsBasicImpl(currentNode, context, pathAnalysis);

    const executionTime = Date.now() - startTime;

    return {
      directions,
      pathSummary: pathAnalysis.pathTheme,
      reasoning: `基于路径分析，识别出${directions.length}个可能的研究方向`,
      confidence: 0.75, // 基础算法置信度
      executionTime
    };
  }

  /**
   * 🎯 基于真实文献数据分析研究路径
   */
  private async analyzePathWithRealData(
    pathLiterature: LibraryItem[],
    context: EvaluationContext
  ) {
    console.log(`🔍 [DefaultThinker] 分析${pathLiterature.length}篇文献的研究路径`);

    // 🎯 提取路径主题
    const themes = pathLiterature.map(lit => ({
      title: lit.title,
      authors: lit.authors,
      year: lit.year,
      abstract: lit.abstract?.substring(0, 200) + '...'
    }));

    // 🎯 分析研究演进
    const evolutionPattern = this.analyzeResearchEvolution(pathLiterature);

    // 🎯 识别研究空白
    const gaps = this.identifyResearchGaps(pathLiterature, context);

    // 🎯 建议研究方向
    const suggestedDirections = this.suggestResearchDirections(pathLiterature, context);

    const pathTheme = `研究路径包含${pathLiterature.length}篇文献，主要关注${context.researchTopic}领域`;

    return {
      pathTheme,
      evolutionPattern,
      gaps,
      suggestedDirections,
      themes
    };
  }

  /**
   * 🎯 基于真实数据生成研究方向
   */
  private async generateDirectionsFromRealData(
    pathLiterature: LibraryItem[],
    context: EvaluationContext,
    pathAnalysis: any
  ): Promise<ResearchDirection[]> {
    const directions: ResearchDirection[] = [];

    // 🎯 基于文献演进趋势生成方向
    const evolutionDirections = this.generateEvolutionBasedDirections(pathLiterature, context);
    directions.push(...evolutionDirections);

    // 🎯 基于研究空白生成方向
    const gapDirections = this.generateGapBasedDirections(pathAnalysis.gaps, context);
    directions.push(...gapDirections);

    // 🎯 基于跨领域融合生成方向
    const interdisciplinaryDirections = this.generateInterdisciplinaryDirections(pathLiterature, context);
    directions.push(...interdisciplinaryDirections);

    console.log(`🧠 [DefaultThinker] 基于真实数据生成${directions.length}个研究方向`);

    return directions.slice(0, 4); // 限制数量
  }

  /**
   * 🔍 分析研究演进模式
   */
  private analyzeResearchEvolution(pathLiterature: LibraryItem[]): string {
    if (pathLiterature.length === 0) {
      return '无路径数据';
    }

    // 按年份排序
    const sortedLiterature = [...pathLiterature].sort((a, b) => a.year - b.year);
    const yearSpan = sortedLiterature[sortedLiterature.length - 1].year - sortedLiterature[0].year;

    // 分析作者分布
    const allAuthors = pathLiterature.flatMap(lit => lit.authors);
    const uniqueAuthors = new Set(allAuthors);

    return `时间跨度${yearSpan}年，涉及${uniqueAuthors.size}位不同作者，研究呈现${yearSpan > 5 ? '长期演进' : '集中发展'}趋势`;
  }

  /**
   * 🔍 识别研究空白
   */
  private identifyResearchGaps(pathLiterature: LibraryItem[], context: EvaluationContext): string[] {
    const gaps: string[] = [];

    // 基于时间空白
    const currentYear = new Date().getFullYear();
    const latestYear = Math.max(...pathLiterature.map(lit => lit.year));
    if (currentYear - latestYear > 2) {
      gaps.push(`缺乏${currentYear - latestYear}年内的最新研究`);
    }

    // 基于方法论空白
    const methodKeywords = ['实验', '理论', '仿真', '调研', '分析'];
    const usedMethods = methodKeywords.filter(method =>
      pathLiterature.some(lit =>
        lit.title.includes(method) || lit.abstract?.includes(method)
      )
    );
    const missingMethods = methodKeywords.filter(method => !usedMethods.includes(method));
    if (missingMethods.length > 0) {
      gaps.push(`缺乏${missingMethods.join('、')}方法的研究`);
    }

    // 基于应用领域空白
    gaps.push('需要更多实际应用案例验证');

    return gaps;
  }

  /**
   * 🎯 建议研究方向
   */
  private suggestResearchDirections(pathLiterature: LibraryItem[], context: EvaluationContext): string[] {
    const suggestions: string[] = [];

    // 基于高频关键词
    const allText = pathLiterature.map(lit => `${lit.title} ${lit.abstract || ''}`).join(' ');
    const words = allText.toLowerCase().split(/\s+/);
    const wordFreq = words.reduce((acc, word) => {
      if (word.length > 3) {
        acc[word] = (acc[word] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const topWords = Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([word]) => word);

    if (topWords.length > 0) {
      suggestions.push(`深入研究${topWords.join('、')}的关联性`);
    }

    suggestions.push(`${context.researchTopic}的跨学科应用`);
    suggestions.push('构建更完整的理论框架');

    return suggestions;
  }

  /**
   * 🎯 基于演进趋势生成研究方向
   */
  private generateEvolutionBasedDirections(
    pathLiterature: LibraryItem[],
    context: EvaluationContext
  ): ResearchDirection[] {
    const directions: ResearchDirection[] = [];

    if (pathLiterature.length > 0) {
      const latestLit = pathLiterature[pathLiterature.length - 1];

      directions.push({
        id: crypto.randomUUID(),
        title: `${context.researchTopic}的理论深化`,
        description: `基于${latestLit.title}的研究基础，进一步深化理论框架`,
        reasoning: `当前路径显示理论研究需要进一步发展`,
        confidence: 0.8,
        keyWords: ['理论', '深化', context.researchTopic],
        expectedCitations: Math.floor(Math.random() * 10) + 5
      });
    }

    return directions;
  }

  /**
   * 🎯 基于研究空白生成方向
   */
  private generateGapBasedDirections(
    gaps: string[],
    context: EvaluationContext
  ): ResearchDirection[] {
    const directions: ResearchDirection[] = [];

    if (gaps.length > 0) {
      directions.push({
        id: crypto.randomUUID(),
        title: `${context.researchTopic}的应用研究`,
        description: `针对当前研究空白，开展应用导向的研究`,
        reasoning: `识别出${gaps.length}个研究空白，需要应用研究填补`,
        confidence: 0.75,
        keyWords: ['应用', '研究', context.researchTopic],
        expectedCitations: Math.floor(Math.random() * 8) + 3
      });
    }

    return directions;
  }

  /**
   * 🎯 基于跨领域融合生成方向
   */
  private generateInterdisciplinaryDirections(
    pathLiterature: LibraryItem[],
    context: EvaluationContext
  ): ResearchDirection[] {
    const directions: ResearchDirection[] = [];

    // 分析作者背景多样性
    const allAuthors = pathLiterature.flatMap(lit => lit.authors);
    const uniqueAuthors = new Set(allAuthors);

    if (uniqueAuthors.size > 3) {
      directions.push({
        id: crypto.randomUUID(),
        title: `${context.researchTopic}的实验验证`,
        description: `通过实验方法验证现有理论，建立实证基础`,
        reasoning: `多作者背景显示需要实验验证来统一认识`,
        confidence: 0.7,
        keyWords: ['实验', '验证', context.researchTopic],
        expectedCitations: Math.floor(Math.random() * 12) + 8
      });
    }

    return directions;
  }

  /**
   * 🔄 基础方向生成实现（重命名原方法）
   */
  private async generateDirectionsBasicImpl(
    currentNode: MCTSNode,
    context: EvaluationContext,
    pathAnalysis: any
  ): Promise<ResearchDirection[]> {
    // 原有的基础实现逻辑
    const directions: ResearchDirection[] = [];

    // 基于研究主题生成基础方向
    const baseDirections = [
      {
        id: crypto.randomUUID(),
        title: `${context.researchTopic}的方法改进`,
        description: `针对现有方法的局限性，提出改进方案`,
        reasoning: '基于当前研究状态的方法论改进',
        confidence: 0.7,
        keyWords: ['方法', '改进', context.researchTopic],
        expectedCitations: 5
      },
      {
        id: crypto.randomUUID(),
        title: `${context.researchTopic}的应用扩展`,
        description: `将现有研究成果应用到新的领域`,
        reasoning: '扩展应用范围以验证通用性',
        confidence: 0.65,
        keyWords: ['应用', '扩展', context.researchTopic],
        expectedCitations: 7
      },
      {
        id: crypto.randomUUID(),
        title: `${context.researchTopic}的理论完善`,
        description: `完善理论框架，填补理论空白`,
        reasoning: '理论体系需要进一步完善',
        confidence: 0.75,
        keyWords: ['理论', '完善', context.researchTopic],
        expectedCitations: 6
      }
    ];

    directions.push(...baseDirections);

    return directions.slice(0, 4); // 限制数量
  }

  /**
   * 🚀 快速修复：基于被引文献生成合成研究方向
   */
  private async generateSyntheticDirections(
    currentNode: MCTSNode,
    context: EvaluationContext
  ): Promise<ResearchDirection[]> {
    try {
      if (!this.sessionConnector) {
        console.log(`🔄 [DefaultThinker] 无SessionConnector，跳过合成方向生成`);
        return [];
      }

      // 1. 获取当前节点的被引文献
      const citedByLiterature = await this.sessionConnector.getCitedByLiterature(currentNode.id);

      if (citedByLiterature.length === 0) {
        console.log(`📝 [DefaultThinker] 当前节点无被引文献，跳过合成方向生成`);
        return [];
      }

      console.log(`🎯 [DefaultThinker] 获取到${citedByLiterature.length}篇被引文献，开始生成合成方向`);

      // 2. 随机选择4-6篇被引文献（增加数量）
      const shuffled = [...citedByLiterature].sort(() => Math.random() - 0.5);
      const maxSelection = Math.min(6, citedByLiterature.length); // 最多选择6篇
      const minSelection = Math.min(4, citedByLiterature.length); // 最少选择4篇
      const selectionCount = Math.max(minSelection, Math.floor(Math.random() * (maxSelection - minSelection + 1)) + minSelection);
      const selectedLiterature = shuffled.slice(0, selectionCount);

      // 3. 为每篇文献生成简单的研究方向
      const syntheticDirections: ResearchDirection[] = selectedLiterature.map((lit, index) => ({
        id: crypto.randomUUID(),
        title: `基于"${lit.title}"的${context.researchTopic}扩展研究`,
        description: `探索"${lit.title}"在${context.researchTopic}领域的深入应用和扩展可能性`,
        reasoning: `该文献引用了当前研究，表明存在相关性，值得进一步探索`,
        confidence: 0.6, // 较低的置信度，表明是合成方向
        keyWords: this.extractSimpleKeywords(lit.title, context.researchTopic),
        expectedCitations: Math.floor(Math.random() * 5) + 3, // 3-7篇随机
        // 🎯 添加源文献信息，确保能够匹配回去
        sourceLiterature: {
          id: lit.id,
          title: lit.title
        },
        // 🎯 添加原标题字段，用于精确匹配
        originalTitle: lit.title
      }));

      console.log(`✅ [DefaultThinker] 生成${syntheticDirections.length}个合成研究方向`);
      return syntheticDirections;

    } catch (error) {
      console.error(`❌ [DefaultThinker] 合成方向生成失败:`, error);
      return []; // 失败时返回空数组，不影响主流程
    }
  }

  /**
   * 🔧 改进的关键词提取 - 确保能匹配回原文献
   */
  private extractSimpleKeywords(title: string, researchTopic: string): string[] {
    const keywords = [];

    // 🎯 优先添加原文献标题的关键部分
    const titleWords = title.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2) // 降低长度要求
      .filter(word => !['the', 'and', 'or', 'with', 'for', 'to', 'of', 'in', 'on', 'at'].includes(word)) // 过滤停用词
      .slice(0, 4); // 增加关键词数量

    keywords.push(...titleWords);

    // 添加研究主题（但优先级较低）
    keywords.push(researchTopic);

    // 添加一些通用的扩展词
    keywords.push('扩展', '应用');

    console.log(`🔧 [DefaultThinker] 为文献"${title}"提取关键词: [${keywords.join(', ')}]`);

    return keywords.slice(0, 6); // 增加关键词数量限制
  }
}

// LLM增强版本 - 真正的AI驱动思考推理
export class LLMThinker implements IThinker {
  constructor(
    private llmApiKey: string,
    private model: string = 'gpt-3.5-turbo',
    private temperature: number = 0.7,
    private maxTokens: number = 1500
  ) {}

  async generateDirections(
    currentNode: MCTSNode,
    context: EvaluationContext
  ): Promise<ThinkingResult> {
    const startTime = Date.now();

    try {
      // 1. 分析当前路径
      const pathAnalysis = await this.analyzePath(context.currentPath || [], context);

      // 2. 构建LLM提示词
      const prompt = this.buildThinkingPrompt(currentNode, context, pathAnalysis);

      // 3. 调用LLM生成研究方向
      const response = await this.callLLM(prompt);

      // 4. 解析LLM响应
      const directions = this.parseDirectionsFromResponse(response);

      const executionTime = Date.now() - startTime;

      return {
        directions,
        pathSummary: pathAnalysis.pathTheme,
        reasoning: `基于LLM分析，从${pathAnalysis.gaps.length}个研究空白中识别出${directions.length}个有价值的扩展方向`,
        confidence: this.calculateLLMConfidence(response, directions),
        executionTime
      };

    } catch (error) {
      console.error('LLM思考过程失败:', error);
      // 降级到默认实现
      const defaultThinker = new DefaultThinker();
      return await defaultThinker.generateDirections(currentNode, context);
    }
  }

  async analyzePath(
    path: MCTSNode[],
    context: EvaluationContext
  ) {
    try {
      // 构建路径分析提示词
      const pathPrompt = this.buildPathAnalysisPrompt(path, context);

      // 调用LLM进行路径分析
      const response = await this.callLLM(pathPrompt);

      // 解析分析结果
      return this.parsePathAnalysisFromResponse(response, path, context);

    } catch (error) {
      console.error('LLM路径分析失败:', error);
      // 降级到简化分析
      return {
        pathTheme: `研究主题: ${context.researchTopic}`,
        evolutionPattern: `路径深度: ${path.length}, 探索状态: 深度优先`,
        gaps: ['理论深化机会', '实验验证空间', '应用拓展方向'],
        suggestedDirections: ['理论建模', '实证研究', '技术应用', '跨域融合']
      };
    }
  }

  private buildThinkingPrompt(
    currentNode: MCTSNode,
    context: EvaluationContext,
    pathAnalysis: any
  ): string {
    return `
# 研究方向生成任务

## 研究背景
- **研究主题**: ${context.researchTopic}
- **当前路径深度**: ${context.currentPath?.length || 0}
- **路径主题**: ${pathAnalysis.pathTheme}
- **演进模式**: ${pathAnalysis.evolutionPattern}

## 已识别的研究空白
${pathAnalysis.gaps.map((gap, index) => `${index + 1}. ${gap}`).join('\n')}

## 建议的研究方向
${pathAnalysis.suggestedDirections.map((dir, index) => `${index + 1}. ${dir}`).join('\n')}

## 当前节点信息
- **节点ID**: ${currentNode.id}
- **访问次数**: ${currentNode.visits}
- **成功率**: ${currentNode.visits > 0 ? (currentNode.wins / currentNode.visits).toFixed(2) : '0.00'}

## 任务要求
请基于以上信息，生成3-5个具体的研究扩展方向。每个方向应该：
1. **创新性**: 在现有基础上有明确的创新点
2. **可行性**: 有实际的研究和实施路径
3. **价值性**: 对整体研究目标有重要贡献
4. **具体性**: 有明确的研究内容和预期成果

## 输出格式
请严格按照以下JSON格式输出：

\`\`\`json
{
  "directions": [
    {
      "title": "研究方向标题",
      "description": "详细描述研究内容、方法和预期成果",
      "reasoning": "选择这个方向的理由和创新点",
      "confidence": 0.85,
      "keyWords": ["关键词1", "关键词2", "关键词3"],
      "expectedCitations": 6
    }
  ],
  "analysis": {
    "overallStrategy": "整体研究策略说明",
    "innovationPoints": ["创新点1", "创新点2"],
    "challenges": ["挑战1", "挑战2"]
  }
}
\`\`\`
`;
  }

  private buildPathAnalysisPrompt(path: MCTSNode[], context: EvaluationContext): string {
    return `
# 研究路径分析任务

## 研究主题
${context.researchTopic}

## 当前探索路径
路径长度: ${path.length}
${path.map((node, index) => `第${index + 1}层: 节点${node.id} (访问${node.visits}次, 成功率${node.visits > 0 ? (node.wins / node.visits * 100).toFixed(1) : '0'}%)`).join('\n')}

## 分析任务
请分析这条研究路径，提供以下洞察：

1. **路径主题**: 整条路径体现的研究主题和方向
2. **演进模式**: 研究如何从浅层向深层发展
3. **研究空白**: 当前路径中缺失的重要研究维度
4. **建议方向**: 下一步可能的有价值研究方向

## 输出格式
请严格按照以下JSON格式输出：

\`\`\`json
{
  "pathTheme": "路径整体主题总结",
  "evolutionPattern": "研究演进模式描述",
  "gaps": ["研究空白1", "研究空白2", "研究空白3"],
  "suggestedDirections": ["建议方向1", "建议方向2", "建议方向3", "建议方向4"],
  "insights": {
    "strengths": ["路径优势1", "路径优势2"],
    "weaknesses": ["路径不足1", "路径不足2"],
    "opportunities": ["机会1", "机会2"]
  }
}
\`\`\`
`;
  }

  private async callLLM(prompt: string): Promise<string> {
    try {
      // 这里应该调用实际的LLM API
      // 为了演示，我们使用一个模拟的响应
      
      if (process.env.NODE_ENV === 'development') {
        // 开发环境下返回模拟响应
        return this.getMockLLMResponse(prompt);
      }

      // 实际的API调用代码（需要根据具体的LLM服务调整）
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
              content: '你是一个专业的学术研究助手，擅长分析研究方向和生成有价值的学术见解。'
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
    if (prompt.includes('研究方向生成任务')) {
      return `
\`\`\`json
{
  "directions": [
    {
      "title": "多模态深度学习架构优化",
      "description": "结合视觉、文本和音频信息的统一深度学习框架，重点解决模态间信息融合和特征对齐问题，预期在多媒体理解任务上实现显著性能提升",
      "reasoning": "当前多模态学习存在模态差异大、融合效果差的问题，该方向有明确的技术创新点和应用价值",
      "confidence": 0.82,
      "keyWords": ["多模态学习", "深度融合", "特征对齐", "架构优化"],
      "expectedCitations": 8
    },
    {
      "title": "联邦学习隐私保护机制",
      "description": "设计新型差分隐私和同态加密结合的联邦学习框架，在保证模型性能的同时最大化数据隐私保护，适用于医疗、金融等敏感领域",
      "reasoning": "隐私保护是联邦学习的核心挑战，现有方案在隐私-效用平衡上仍有改进空间",
      "confidence": 0.78,
      "keyWords": ["联邦学习", "差分隐私", "同态加密", "隐私保护"],
      "expectedCitations": 6
    },
    {
      "title": "自适应神经网络压缩算法",
      "description": "开发基于任务特征自动调整压缩策略的神经网络压缩方法，实现模型大小和性能的最优平衡，特别适用于边缘计算场景",
      "reasoning": "现有压缩方法多为静态策略，缺乏对具体任务的自适应能力，该方向具有重要的实用价值",
      "confidence": 0.75,
      "keyWords": ["模型压缩", "自适应算法", "边缘计算", "神经网络优化"],
      "expectedCitations": 5
    }
  ],
  "analysis": {
    "overallStrategy": "围绕AI系统的实用化和产业化需求，重点关注多模态、隐私保护和模型优化三个核心方向",
    "innovationPoints": ["模态融合新架构", "隐私-效用平衡机制", "自适应压缩策略"],
    "challenges": ["技术复杂度高", "评估标准不统一", "实际部署难度大"]
  }
}
\`\`\`
`;
    } else {
      return `
\`\`\`json
{
  "pathTheme": "人工智能理论与应用深度融合的研究路径",
  "evolutionPattern": "从基础理论研究逐步向实际应用场景扩展，体现了从抽象到具体的研究演进",
  "gaps": ["缺乏跨学科交叉研究", "实验验证不够充分", "产业应用案例较少", "理论创新有限"],
  "suggestedDirections": ["理论突破与创新", "大规模实验验证", "产业应用拓展", "跨学科融合研究"],
  "insights": {
    "strengths": ["研究深度逐步增加", "技术路线相对清晰"],
    "weaknesses": ["创新突破点不够明显", "应用场景相对单一"],
    "opportunities": ["新兴技术融合机会", "产业需求快速增长"]
  }
}
\`\`\`
`;
    }
  }

  private parseDirectionsFromResponse(response: string): ResearchDirection[] {
    try {
      // 提取JSON部分
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('响应中未找到有效的JSON格式');
      }

      const data = JSON.parse(jsonMatch[1]);
      const directions = data.directions || [];

      return directions.map((dir: any, index: number) => ({
        id: `llm_direction_${Date.now()}_${index}`,
        title: dir.title || '未命名研究方向',
        description: dir.description || '暂无描述',
        reasoning: dir.reasoning || '基于LLM分析生成',
        confidence: Math.min(1, Math.max(0, dir.confidence || 0.7)),
        keyWords: Array.isArray(dir.keyWords) ? dir.keyWords : [],
        expectedCitations: Math.max(1, dir.expectedCitations || 3)
      }));

    } catch (error) {
      console.error('解析LLM响应失败:', error);
      // 返回降级结果
      return [{
        id: `fallback_direction_${Date.now()}`,
        title: '深度理论研究',
        description: '基于当前研究基础进行深入的理论分析和方法改进',
        reasoning: 'LLM解析失败，使用降级方案',
        confidence: 0.6,
        keyWords: ['理论研究', '方法改进'],
        expectedCitations: 3
      }];
    }
  }

  private parsePathAnalysisFromResponse(response: string, path: MCTSNode[], context: EvaluationContext) {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('路径分析响应中未找到有效的JSON格式');
      }

      const data = JSON.parse(jsonMatch[1]);

      return {
        pathTheme: data.pathTheme || `研究主题: ${context.researchTopic}`,
        evolutionPattern: data.evolutionPattern || `路径深度: ${path.length}, 演进模式: 深度探索`,
        gaps: Array.isArray(data.gaps) ? data.gaps : ['理论深化机会', '实验验证需求'],
        suggestedDirections: Array.isArray(data.suggestedDirections) ? data.suggestedDirections : ['理论建模', '实证验证']
      };

    } catch (error) {
      console.error('解析路径分析响应失败:', error);
      // 返回降级结果
      return {
        pathTheme: `研究主题: ${context.researchTopic}`,
        evolutionPattern: `路径深度: ${path.length}, 探索状态: 持续深入`,
        gaps: ['需要更多理论支撑', '缺乏实验验证', '应用场景有限'],
        suggestedDirections: ['理论创新', '实验设计', '应用拓展', '方法优化']
      };
    }
  }

  private calculateLLMConfidence(response: string, directions: ResearchDirection[]): number {
    // 基于响应质量和方向数量计算置信度
    let confidence = 0.7; // 基础置信度

    // 如果成功解析出方向，提高置信度
    if (directions.length > 0) {
      confidence += 0.1;
    }

    // 基于方向的平均置信度调整
    if (directions.length > 0) {
      const avgDirectionConfidence = directions.reduce((sum, dir) => sum + dir.confidence, 0) / directions.length;
      confidence = (confidence + avgDirectionConfidence) / 2;
    }

    // 基于响应长度调整（更详细的响应通常质量更高）
    if (response.length > 500) {
      confidence += 0.05;
    }

    return Math.min(1, Math.max(0.3, confidence));
  }
}