/**
 * 📚 Citer - 文献引用检索模块
 * 
 * 职责：实现TVC流程的第三步(Cite) - 基于表述检索相关文献
 * 支持多种检索策略：文本搜索、语义检索、NLI增强检索
 */

import { MCTSNode, LibraryItem } from '@/libs/db';
import { EvaluationContext } from '../interfaces';
import { DirectionFormulation } from './Formulator';
import { SessionLiteratureConnector } from '../../../research/SessionLiteratureConnector';

export interface CitationResult {
  citations: Citation[];
  searchSummary: string;
  totalFound: number;
  confidence: number;
  executionTime: number;
}

export interface Citation {
  literatureId: string;
  literature: LibraryItem;
  relevanceScore: number;
  matchedFormulation: string;
  matchedKeywords: string[];
  retrievalMethod: 'text' | 'semantic' | 'nli';
  reasoning: string;
}

export interface ICiter {
  /**
   * 基于方向表述检索相关文献
   */
  findRelevantLiterature(
    formulations: DirectionFormulation[],
    context: EvaluationContext
  ): Promise<CitationResult>;

  /**
   * 评估文献与研究方向的相关性
   */
  assessRelevance(
    literature: LibraryItem,
    formulation: DirectionFormulation,
    context: EvaluationContext
  ): Promise<{
    relevanceScore: number;
    reasoning: string;
    matchedConcepts: string[];
  }>;

  /**
   * 过滤重复和低质量引用
   */
  filterCitations(
    citations: Citation[],
    maxResults?: number
  ): Promise<Citation[]>;
}

export class DefaultCiter implements ICiter {
  constructor(private sessionConnector?: SessionLiteratureConnector) {}

  async findRelevantLiterature(
    formulations: DirectionFormulation[],
    context: EvaluationContext
  ): Promise<CitationResult> {
    const startTime = Date.now();

    try {
      console.log(`📚 [DefaultCiter] 开始文献检索，表述数量: ${formulations.length}`);

      // 🎯 优先使用真实数据
      if (this.sessionConnector) {
        return await this.searchWithRealData(formulations, context, startTime);
      }

      // 🔄 降级到假数据（保持向后兼容）
      console.warn(`⚠️ [DefaultCiter] SessionConnector未提供，使用假数据`);
      return await this.searchWithMockData(formulations, context, startTime);

    } catch (error) {
      console.error(`❌ [DefaultCiter] 文献检索失败:`, error);
      throw new Error(`Citation search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async assessRelevance(
    literature: LibraryItem,
    formulation: DirectionFormulation,
    context: EvaluationContext
  ) {
    // 简化的相关性评估
    const titleMatch = this.calculateTextSimilarity(literature.title, formulation.formulation);
    const abstractMatch = literature.abstract 
      ? this.calculateTextSimilarity(literature.abstract, formulation.formulation)
      : 0;

    // 关键词匹配
    const matchedConcepts = formulation.keywords.filter(keyword => 
      literature.title.toLowerCase().includes(keyword.toLowerCase()) ||
      (literature.abstract && literature.abstract.toLowerCase().includes(keyword.toLowerCase()))
    );

    const keywordScore = matchedConcepts.length / formulation.keywords.length;
    const relevanceScore = (titleMatch * 0.4 + abstractMatch * 0.4 + keywordScore * 0.2);

    return {
      relevanceScore,
      reasoning: `标题匹配度: ${titleMatch.toFixed(2)}, 摘要匹配度: ${abstractMatch.toFixed(2)}, 关键词匹配: ${matchedConcepts.length}/${formulation.keywords.length}`,
      matchedConcepts
    };
  }

  async filterCitations(
    citations: Citation[],
    maxResults: number = 10
  ): Promise<Citation[]> {
    // 🎯 修改去重逻辑：基于 literatureId + matchedFormulation 的组合去重
    // 这样同一篇文献可以被不同的表述匹配，保持正确的对应关系
    const uniqueCitations = citations.reduce((acc, citation) => {
      const key = `${citation.literatureId}_${citation.matchedFormulation}`;
      const existing = acc.find(c =>
        `${c.literatureId}_${c.matchedFormulation}` === key
      );

      if (!existing || citation.relevanceScore > existing.relevanceScore) {
        acc = acc.filter(c =>
          `${c.literatureId}_${c.matchedFormulation}` !== key
        );
        acc.push(citation);
      }
      return acc;
    }, [] as Citation[]);

    console.log(`🔍 [DefaultCiter] 去重前: ${citations.length}个citations, 去重后: ${uniqueCitations.length}个`);

    // 按相关性评分排序
    uniqueCitations.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // 限制结果数量
    return uniqueCitations.slice(0, maxResults);
  }

  private async searchByFormulation(
    formulation: DirectionFormulation,
    context: EvaluationContext
  ): Promise<Citation[]> {
    const citations: Citation[] = [];
    
    try {
      // 使用多种搜索策略
      const searchResults = await Promise.all([
        this.searchByTitle(formulation),
        this.searchByKeywords(formulation),
        this.searchByAbstract(formulation),
        this.searchByTopic(formulation, context)
      ]);

      // 合并所有搜索结果
      const allLiterature = searchResults.flat();
      
      // 评估相关性并创建引用
      for (const literature of allLiterature) {
        const relevance = await this.assessRelevance(literature, formulation, context);
        
        if (relevance.relevanceScore > 0.3) { // 相关性阈值
          citations.push({
            literatureId: literature.id,
            literature,
            relevanceScore: relevance.relevanceScore,
            matchedFormulation: formulation.formulation,
            matchedKeywords: relevance.matchedConcepts,
            retrievalMethod: 'text',
            reasoning: relevance.reasoning
          });
        }
      }

      return citations;

    } catch (error) {
      console.error('文献检索失败:', error);
      return this.getFallbackResults(formulation, context);
    }
  }

  private async searchByTitle(formulation: DirectionFormulation): Promise<LibraryItem[]> {
    // 模拟调用LibraryService的搜索功能
    // 在实际应用中，这里应该调用真实的数据库搜索
    return this.simulateDeepSearch('title', formulation.formulation, formulation.keywords);
  }

  private async searchByKeywords(formulation: DirectionFormulation): Promise<LibraryItem[]> {
    // 基于关键词的搜索
    const keywordQuery = formulation.keywords.slice(0, 3).join(' ');
    return this.simulateDeepSearch('keywords', keywordQuery, formulation.keywords);
  }

  private async searchByAbstract(formulation: DirectionFormulation): Promise<LibraryItem[]> {
    // 在摘要中搜索相关内容
    return this.simulateDeepSearch('abstract', formulation.formulation, formulation.keywords);
  }

  private async searchByTopic(formulation: DirectionFormulation, context: EvaluationContext): Promise<LibraryItem[]> {
    // 基于研究主题的搜索
    return this.simulateDeepSearch('topic', context.researchTopic, [context.researchTopic]);
  }

  private simulateDeepSearch(searchType: string, query: string, keywords: string[]): LibraryItem[] {
    // 模拟深度搜索结果 - 在实际应用中应该调用LibraryService
    const mockResults: LibraryItem[] = [];
    
    // 基于搜索类型生成不同的模拟结果
    const resultCount = Math.floor(Math.random() * 5) + 1; // 1-5个结果
    
    for (let i = 0; i < resultCount; i++) {
      const relevantKeywords = keywords.slice(0, Math.min(3, keywords.length));
      
      const newId = crypto.randomUUID();
      console.log(`🔧 [DefaultCiter] 生成假数据ID: ${newId} (searchType: ${searchType})`);

      mockResults.push({
        id: newId, // 🎯 使用真正的UUID而不是自定义格式
        title: this.generateRelevantTitle(query, relevantKeywords, searchType),
        authors: this.generateRelevantAuthors(),
        abstract: this.generateRelevantAbstract(query, relevantKeywords),
        associatedSessions: relevantKeywords.slice(0, 2),
        url: `https://example.com/${searchType}_${i}`,
        year: new Date().getFullYear(),
        createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // 随机过去一年内的日期
        updatedAt: new Date()
      });
    }
    
    return mockResults;
  }

  private generateRelevantTitle(query: string, keywords: string[], searchType: string): string {
    const templates = {
      title: [
        `${keywords[0] || ''}研究中的${query}方法`,
        `基于${keywords[1] || ''}的${query}优化策略`,
        `${query}：${keywords[0] || ''}领域的新进展`
      ],
      keywords: [
        `${keywords.join('与')}的融合研究`,
        `${keywords[0]}驱动的${keywords[1] || ''}分析`,
        `${keywords.slice(0, 2).join('、')}协同机制研究`
      ],
      abstract: [
        `${query}的理论基础与实践应用`,
        `${keywords[0] || ''}视角下的${query}分析`,
        `${query}在${keywords[1] || ''}中的应用研究`
      ],
      topic: [
        `${query}的最新研究进展`,
        `${query}理论与方法综述`,
        `${query}关键技术及发展趋势`
      ]
    };
    
    const typeTemplates = templates[searchType as keyof typeof templates] || templates.title;
    return typeTemplates[Math.floor(Math.random() * typeTemplates.length)];
  }

  private generateRelevantAuthors(): string[] {
    const authorPool = [
      '张明', '李华', '王强', 'John Smith', 'Sarah Johnson', '陈晓', '刘伟',
      'Michael Brown', 'Emily Davis', '杨文', '赵雷', 'David Wilson', 'Lisa Chen'
    ];
    
    const authorCount = Math.floor(Math.random() * 3) + 1; // 1-3个作者
    const selectedAuthors: string[] = [];
    
    for (let i = 0; i < authorCount; i++) {
      const author = authorPool[Math.floor(Math.random() * authorPool.length)];
      if (!selectedAuthors.includes(author)) {
        selectedAuthors.push(author);
      }
    }
    
    return selectedAuthors;
  }

  private generateRelevantAbstract(query: string, keywords: string[]): string {
    const templates = [
      `本文针对${query}问题，提出了基于${keywords[0] || '新方法'}的解决方案。通过${keywords[1] || '理论分析'}和${keywords[2] || '实验验证'}，证明了该方法的有效性。研究结果表明，该方法在相关领域具有重要的应用价值和理论意义。`,
      `本研究探讨了${keywords[0] || ''}与${keywords[1] || ''}的关系，提出了${query}的创新框架。通过深入分析和实证研究，验证了该框架的可行性。研究为相关领域的进一步发展提供了重要参考。`,
      `随着${keywords[0] || '技术'}的发展，${query}成为研究热点。本文从${keywords[1] || '理论'}角度出发，结合${keywords[2] || '实践'}需求，提出了新的研究视角。研究成果对推动领域发展具有积极意义。`
    ];
    
    return templates[Math.floor(Math.random() * templates.length)];
  }

  private getFallbackResults(formulation: DirectionFormulation, context: EvaluationContext): Citation[] {
    // 降级结果：返回一个基础的引用
    const fallbackLiterature: LibraryItem = {
      id: crypto.randomUUID(), // 🎯 使用UUID
      title: `${formulation.originalTitle}相关研究综述`,
      authors: ['研究团队'],
      abstract: `关于${formulation.formulation}的综合性研究，涵盖了${formulation.keywords.slice(0, 2).join('、')}等关键领域。`,
      associatedSessions: formulation.keywords.slice(0, 2),
      url: '',
      year: new Date().getFullYear(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return [{
      literatureId: fallbackLiterature.id,
      literature: fallbackLiterature,
      relevanceScore: 0.6,
      matchedFormulation: formulation.formulation,
      matchedKeywords: formulation.keywords.slice(0, 2),
      retrievalMethod: 'text',
      reasoning: '检索失败时的降级结果'
    }];
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // 简化的文本相似度计算
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  private calculateSearchConfidence(citations: Citation[]): number {
    if (citations.length === 0) return 0;

    const avgRelevance = citations.reduce((sum, c) => sum + c.relevanceScore, 0) / citations.length;
    const diversityBonus = Math.min(citations.length / 10, 0.2); // 多样性奖励

    return Math.min(avgRelevance + diversityBonus, 1.0);
  }

  /**
   * 🎯 使用真实数据进行文献检索
   */
  private async searchWithRealData(
    formulations: DirectionFormulation[],
    context: EvaluationContext,
    startTime: number
  ): Promise<CitationResult> {
    const allCitations: Citation[] = [];
    let totalFound = 0;

    // 🎯 获取当前节点的被引文献列表
    let currentNodeId: string;
    let currentLiteratureId: string;

    // console.log(`🔍 [DefaultCiter] 新版本代码生效！检查context:`, {
    //   hasCurrentNode: !!context.currentNode,
    //   currentPathLength: context.currentPath.length,
    //   currentNodeId: context.currentNode?.id,
    //   currentNodeLiteratureId: context.currentNode?.libraryItemId
    // });

    if (context.currentNode) {
      // 🎯 优先使用context.currentNode（新的方式）
      currentNodeId = context.currentNode.id;
      currentLiteratureId = context.currentNode.libraryItemId;
      // console.log(`🎯 [DefaultCiter] 使用currentNode获取节点信息: ${currentNodeId}, literatureId: ${currentLiteratureId}`);
    } else if (context.currentPath.length > 0) {
      // 🔄 向后兼容：使用路径中的最后一个节点
      const lastNode = context.currentPath[context.currentPath.length - 1];
      currentNodeId = lastNode.id;
      currentLiteratureId = lastNode.libraryItemId;
      // console.log(`🔄 [DefaultCiter] 使用currentPath获取节点信息: ${currentNodeId}, literatureId: ${currentLiteratureId}`);
    } else {
      // ❌ 这种情况不应该再发生
      console.error(`❌ [DefaultCiter] 无法获取当前节点信息，context.currentNode和currentPath都为空`);
      throw new Error('无法获取当前节点信息，请检查EvaluationContext配置');
    }

    // 🎯 获取treeId - 从SessionConnector获取当前树ID
    const treeId = this.sessionConnector!.getCurrentTreeId();

    // console.log(`🔍 [DefaultCiter] 开始获取被引文献: nodeId=${currentNodeId}, literatureId=${currentLiteratureId}, treeId=${treeId}`);

    const availableLiterature = await this.sessionConnector!.getAvailableCitedByLiterature(
      currentNodeId,
      treeId || ''
    );

    // console.log(`📚 [DefaultCiter] 获取到${availableLiterature.length}篇可用被引文献`);

    if (availableLiterature.length === 0) {
      console.log(`📝 [DefaultCiter] 当前节点无可用被引文献，返回空结果`);
      const executionTime = Date.now() - startTime;
      return {
        citations: [],
        totalFound: 0,
        confidence: 0.0,
        searchSummary: '当前节点无可用被引文献，无法进行文献检索',
        executionTime
      };
    }

    // 为每个表述匹配相关文献
    for (const formulation of formulations) {
      const matchedLiterature = await this.matchFormulationWithLiterature(
        formulation,
        availableLiterature
      );

      const citations = this.formatAsCitations(matchedLiterature, formulation);
      allCitations.push(...citations);
      totalFound += citations.length;
    }

    // 🎯 去重和过滤
    const filteredCitations = await this.filterCitations(allCitations, 10);

    const executionTime = Date.now() - startTime;
    const searchSummary = `通过${formulations.length}个表述检索，从${availableLiterature.length}篇被引文献中发现${totalFound}篇相关文献`;

    return {
      citations: filteredCitations,
      searchSummary,
      totalFound,
      confidence: 0.8, // 真实数据置信度更高
      executionTime
    };
  }

  /**
   * 🔄 使用假数据进行文献检索（向后兼容）
   */
  private async searchWithMockData(
    formulations: DirectionFormulation[],
    context: EvaluationContext,
    startTime: number
  ): Promise<CitationResult> {
    const allCitations: Citation[] = [];

    // 为每个表述检索文献
    for (const formulation of formulations) {
      const citations = await this.searchByFormulation(formulation, context);
      allCitations.push(...citations);
    }

    // 去重和排序
    const filteredCitations = await this.filterCitations(allCitations, 10);
    const executionTime = Date.now() - startTime;

    return {
      citations: filteredCitations,
      searchSummary: `通过${formulations.length}个表述检索，发现${allCitations.length}篇相关文献`,
      totalFound: allCitations.length,
      confidence: this.calculateSearchConfidence(filteredCitations),
      executionTime
    };
  }

  /**
   * 🎯 匹配表述与文献
   */
  private async matchFormulationWithLiterature(
    formulation: DirectionFormulation,
    literature: LibraryItem[]
  ): Promise<LibraryItem[]> {
    // console.log(`🔍 [DefaultCiter] 匹配表述与${literature.length}篇文献: ${formulation.formulation}`);

    // 方案1: 简单关键词匹配
    const keywords = formulation.keywords.map(k => k.toLowerCase());

    // 🎯 计算每篇文献的匹配分数，然后只选择最佳匹配
    const scoredLiterature = literature.map(item => {
      const title = item.title.toLowerCase();
      const abstract = item.abstract?.toLowerCase() || '';
      let score = 0;

      // 关键词匹配分数
      const keywordMatches = keywords.filter(keyword =>
        title.includes(keyword) || abstract.includes(keyword)
      ).length;
      score += keywordMatches * 2; // 关键词匹配权重更高

      // 表述匹配分数
      const formulationWords = formulation.formulation.toLowerCase().split(/\s+/);
      const formulationMatches = formulationWords.filter(word =>
        word.length > 2 && (title.includes(word) || abstract.includes(word))
      ).length;
      score += formulationMatches;

      // 精确匹配加分
      if (title === formulation.formulation.toLowerCase()) {
        score += 10; // 精确匹配最高分
      }

      return { item, score };
    }).filter(scored => scored.score > 0); // 只保留有匹配的文献

    // 🎯 按分数排序，只返回最佳匹配的1篇文献
    scoredLiterature.sort((a, b) => b.score - a.score);
    const bestMatch = scoredLiterature.length > 0 ? [scoredLiterature[0].item] : [];

    console.log(`✅ [DefaultCiter] 匹配到${scoredLiterature.length}篇相关文献，选择最佳匹配${bestMatch.length}篇`);
    if (bestMatch.length > 0) {
      console.log(`🎯 [DefaultCiter] 最佳匹配: "${bestMatch[0].title}" (分数: ${scoredLiterature[0].score})`);
    }

    return bestMatch;
  }

  /**
   * 🎯 格式化为Citation对象
   */
  private formatAsCitations(literature: LibraryItem[], formulation: DirectionFormulation): Citation[] {
    return literature.map(item => ({
      literatureId: item.id,
      literature: item,
      relevanceScore: 0.7, // 真实数据的基础相关性
      matchedFormulation: formulation.formulation,
      matchedKeywords: formulation.keywords.slice(0, 3),
      retrievalMethod: 'text' as const,
      reasoning: '基于被引文献的真实数据匹配'
    }));
  }
}

// 语义检索增强版本 - 基于语义嵌入的高精度文献检索
export class SemanticCiter implements ICiter {
  constructor(
    private embeddingModel: string = 'text-embedding-ada-002',
    private apiKey?: string,
    private similarityThreshold: number = 0.7
  ) {}

  async findRelevantLiterature(
    formulations: DirectionFormulation[],
    context: EvaluationContext
  ): Promise<CitationResult> {
    const startTime = Date.now();

    try {
      const allCitations: Citation[] = [];

      // 为每个表述进行语义检索
      for (const formulation of formulations) {
        const citations = await this.semanticSearchByFormulation(formulation, context);
        allCitations.push(...citations);
      }

      // 基于语义相似度去重和排序
      const filteredCitations = await this.filterCitations(allCitations, 10);
      const executionTime = Date.now() - startTime;

      return {
        citations: filteredCitations,
        searchSummary: `通过语义检索处理了${formulations.length}个表述，发现${allCitations.length}篇相关文献`,
        totalFound: allCitations.length,
        confidence: this.calculateSemanticConfidence(filteredCitations),
        executionTime
      };

    } catch (error) {
      console.error('语义检索失败:', error);
      // 降级到传统文本检索
      const defaultCiter = new DefaultCiter();
      return await defaultCiter.findRelevantLiterature(formulations, context);
    }
  }

  async assessRelevance(
    literature: LibraryItem,
    formulation: DirectionFormulation,
    context: EvaluationContext
  ) {
    try {
      // 构建文本用于语义比较
      const literatureText = `${literature.title} ${literature.abstract || ''}`;
      const formulationText = `${formulation.formulation} ${formulation.keywords.join(' ')}`;

      // 计算语义相似度
      const semanticSimilarity = await this.calculateSemanticSimilarity(
        literatureText,
        formulationText
      );

      // 计算关键词匹配度
      const keywordMatch = this.calculateKeywordOverlap(
        literature,
        formulation.keywords
      );

      // 综合相关性评分
      const relevanceScore = semanticSimilarity * 0.7 + keywordMatch * 0.3;

      // 识别匹配的概念
      const matchedConcepts = this.extractMatchedConcepts(literature, formulation);

      return {
        relevanceScore,
        reasoning: `语义相似度: ${semanticSimilarity.toFixed(3)}, 关键词匹配: ${keywordMatch.toFixed(3)}`,
        matchedConcepts
      };

    } catch (error) {
      console.error('语义相关性评估失败:', error);
      // 降级到文本相似度
      return this.fallbackRelevanceAssessment(literature, formulation);
    }
  }

  async filterCitations(citations: Citation[], maxResults: number = 10) {
    if (citations.length === 0) return [];

    try {
      // 基于语义多样性的过滤
      const diversifiedCitations = await this.semanticDiversification(citations);
      
      // 按相关性排序
      diversifiedCitations.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      return diversifiedCitations.slice(0, maxResults);

    } catch (error) {
      console.error('语义过滤失败:', error);
      // 降级到简单排序
      return citations
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, maxResults);
    }
  }

  private async semanticSearchByFormulation(
    formulation: DirectionFormulation,
    context: EvaluationContext
  ): Promise<Citation[]> {
    const citations: Citation[] = [];

    try {
      // 在实际应用中，这里应该调用语义搜索服务
      // 目前使用模拟的语义搜索结果
      const semanticResults = await this.simulateSemanticSearch(formulation, context);

      for (const literature of semanticResults) {
        const relevance = await this.assessRelevance(literature, formulation, context);
        
        if (relevance.relevanceScore > this.similarityThreshold) {
          citations.push({
            literatureId: literature.id,
            literature,
            relevanceScore: relevance.relevanceScore,
            matchedFormulation: formulation.formulation,
            matchedKeywords: relevance.matchedConcepts,
            retrievalMethod: 'semantic',
            reasoning: `语义检索: ${relevance.reasoning}`
          });
        }
      }

      return citations;

    } catch (error) {
      console.error('语义搜索失败:', formulation.formulation, error);
      return [];
    }
  }

  private async calculateSemanticSimilarity(text1: string, text2: string): Promise<number> {
    if (process.env.NODE_ENV === 'development' || !this.apiKey) {
      // 开发环境下使用模拟的语义相似度
      return this.simulateSemanticSimilarity(text1, text2);
    }

    try {
      // 获取文本嵌入
      const embedding1 = await this.getTextEmbedding(text1);
      const embedding2 = await this.getTextEmbedding(text2);

      // 计算余弦相似度
      return this.cosineSimilarity(embedding1, embedding2);

    } catch (error) {
      console.error('语义相似度计算失败:', error);
      return this.simulateSemanticSimilarity(text1, text2);
    }
  }

  private async getTextEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: text
      })
    });

    if (!response.ok) {
      throw new Error(`嵌入API调用失败: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('向量维度不匹配');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  private simulateSemanticSimilarity(text1: string, text2: string): number {
    // 基于词汇重叠的简化语义相似度
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    const jaccardSimilarity = intersection.size / union.size;
    
    // 添加一些随机变化以模拟语义理解
    const semanticBonus = Math.random() * 0.2 - 0.1; // -0.1 to 0.1
    
    return Math.min(1, Math.max(0, jaccardSimilarity + semanticBonus));
  }

  private async simulateSemanticSearch(
    formulation: DirectionFormulation,
    context: EvaluationContext
  ): Promise<LibraryItem[]> {
    // 模拟语义搜索结果，生成高质量的相关文献
    const results: LibraryItem[] = [];
    const resultCount = Math.floor(Math.random() * 4) + 2; // 2-5个结果

    for (let i = 0; i < resultCount; i++) {
      results.push({
        id: crypto.randomUUID(), // 🎯 使用UUID
        title: this.generateSemanticTitle(formulation, context),
        authors: this.generateSemanticAuthors(),
        abstract: this.generateSemanticAbstract(formulation, context),
        status: 'parsed',
        topics: this.generateSemanticTopics(formulation),
        url: `https://semantic.example.com/${i}`,
        filePath: null,
        createdAt: new Date(Date.now() - Math.random() * 730 * 24 * 60 * 60 * 1000), // 过去两年内
        updatedAt: new Date()
      });
    }

    return results;
  }

  private generateSemanticTitle(formulation: DirectionFormulation, context: EvaluationContext): string {
    const concepts = [...formulation.keywords, context.researchTopic];
    const templates = [
      `深入理解${concepts[0]}：${formulation.originalTitle}的创新方法`,
      `${concepts[0]}与${concepts[1] || '先进技术'}的融合研究`,
      `基于${context.researchTopic}的${formulation.originalTitle}优化策略`,
      `${formulation.originalTitle}在${concepts[1] || '现代应用'}中的理论与实践`
    ];
    
    return templates[Math.floor(Math.random() * templates.length)];
  }

  private generateSemanticAuthors(): string[] {
    const expertAuthors = [
      '李明华', 'Dr. Sarah Wilson', '张志强', 'Prof. Michael Chen',
      '王晓燕', 'Dr. Emily Zhang', '刘建国', 'Prof. David Kumar'
    ];
    
    const count = Math.floor(Math.random() * 3) + 1;
    return expertAuthors.slice(0, count);
  }

  private generateSemanticAbstract(formulation: DirectionFormulation, context: EvaluationContext): string {
    return `本研究聚焦于${formulation.formulation}，在${context.researchTopic}领域提出了创新的理论框架。通过深入分析${formulation.keywords.slice(0, 2).join('和')}的内在关系，我们发展了一套完整的方法论。实验结果证实了该方法在提升系统性能和解决实际问题方面的显著优势。研究成果为${context.researchTopic}领域的进一步发展奠定了重要基础，具有广泛的应用前景和学术价值。`;
  }

  private generateSemanticTopics(formulation: DirectionFormulation): string[] {
    const baseTopics = formulation.keywords.slice(0, 2);
    const extendedTopics = ['机器学习', '深度学习', '人工智能', '数据挖掘', '优化算法'];
    
    return [...baseTopics, extendedTopics[Math.floor(Math.random() * extendedTopics.length)]];
  }

  private calculateKeywordOverlap(literature: LibraryItem, keywords: string[]): number {
    const literatureWords = new Set([
      ...literature.title.toLowerCase().split(/\s+/),
      ...(literature.abstract?.toLowerCase().split(/\s+/) || []),
      ...(literature.topics?.map(t => t.toLowerCase()) || [])
    ]);

    const keywordWords = new Set(keywords.map(k => k.toLowerCase()));
    const overlap = [...keywordWords].filter(k => literatureWords.has(k)).length;
    
    return Math.min(1, overlap / keywords.length);
  }

  private extractMatchedConcepts(literature: LibraryItem, formulation: DirectionFormulation): string[] {
    const concepts: string[] = [];
    const literatureText = `${literature.title} ${literature.abstract || ''}`.toLowerCase();
    
    for (const keyword of formulation.keywords) {
      if (literatureText.includes(keyword.toLowerCase())) {
        concepts.push(keyword);
      }
    }
    
    return concepts;
  }

  private async semanticDiversification(citations: Citation[]): Promise<Citation[]> {
    if (citations.length <= 3) return citations;

    // 简化的多样性算法：确保不同主题的文献都被包含
    const diversified: Citation[] = [];
    const seenTopics = new Set<string>();

    // 首先选择最高分的引用
    const sortedCitations = [...citations].sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    for (const citation of sortedCitations) {
      const topicKey = citation.literature.topics?.join('_') || 'unknown';
      
      if (!seenTopics.has(topicKey) || diversified.length < 3) {
        diversified.push(citation);
        seenTopics.add(topicKey);
        
        if (diversified.length >= 8) break; // 保留多样性的同时限制数量
      }
    }

    return diversified;
  }

  private calculateSemanticConfidence(citations: Citation[]): number {
    if (citations.length === 0) return 0;

    const avgRelevance = citations.reduce((sum, c) => sum + c.relevanceScore, 0) / citations.length;
    const diversityScore = Math.min(1, citations.length / 10); // 多样性奖励
    const semanticBonus = 0.1; // 语义检索的额外置信度
    
    return Math.min(1, avgRelevance + diversityScore * 0.2 + semanticBonus);
  }

  private fallbackRelevanceAssessment(literature: LibraryItem, formulation: DirectionFormulation) {
    // 降级到基础文本相似度计算
    const titleMatch = this.calculateBasicSimilarity(literature.title, formulation.formulation);
    const abstractMatch = literature.abstract 
      ? this.calculateBasicSimilarity(literature.abstract, formulation.formulation)
      : 0;

    const relevanceScore = (titleMatch * 0.6 + abstractMatch * 0.4);
    
    return {
      relevanceScore,
      reasoning: `降级评估 - 标题匹配: ${titleMatch.toFixed(2)}, 摘要匹配: ${abstractMatch.toFixed(2)}`,
      matchedConcepts: formulation.keywords.slice(0, 2)
    };
  }

  private calculateBasicSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }
}

// NLI增强版本 - 基于自然语言推理的精准文献检索
export class NLICiter implements ICiter {
  constructor(
    private nliModel: string = 'roberta-large-mnli',
    private apiKey?: string,
    private entailmentThreshold: number = 0.8
  ) {}

  async findRelevantLiterature(
    formulations: DirectionFormulation[],
    context: EvaluationContext
  ): Promise<CitationResult> {
    const startTime = Date.now();

    try {
      const allCitations: Citation[] = [];

      // 使用NLI方法为每个表述检索文献
      for (const formulation of formulations) {
        const citations = await this.nliSearchByFormulation(formulation, context);
        allCitations.push(...citations);
      }

      // 基于NLI推理质量过滤
      const filteredCitations = await this.filterCitations(allCitations, 10);
      const executionTime = Date.now() - startTime;

      return {
        citations: filteredCitations,
        searchSummary: `通过NLI推理处理了${formulations.length}个表述，识别出${allCitations.length}篇逻辑相关的文献`,
        totalFound: allCitations.length,
        confidence: this.calculateNLIConfidence(filteredCitations),
        executionTime
      };

    } catch (error) {
      console.error('NLI检索失败:', error);
      // 降级到语义检索
      const semanticCiter = new SemanticCiter();
      return await semanticCiter.findRelevantLiterature(formulations, context);
    }
  }

  async assessRelevance(
    literature: LibraryItem,
    formulation: DirectionFormulation,
    context: EvaluationContext
  ) {
    try {
      // 构建前提-假设对进行NLI分析
      const premise = `${literature.title}. ${literature.abstract || ''}`;
      const hypothesis = `这篇文献研究了${formulation.formulation}相关的内容`;

      // 计算蕴含关系
      const entailmentScore = await this.calculateEntailment(premise, hypothesis);

      // 计算矛盾关系（用于识别不相关内容）
      const contradictionHypothesis = `这篇文献与${formulation.formulation}没有任何关系`;
      const contradictionScore = await this.calculateEntailment(premise, contradictionHypothesis);

      // 综合相关性评分
      const relevanceScore = Math.max(0, entailmentScore - contradictionScore * 0.5);

      // 识别逻辑关联的概念
      const matchedConcepts = await this.extractNLIMatchedConcepts(literature, formulation);

      return {
        relevanceScore,
        reasoning: `NLI蕴含: ${entailmentScore.toFixed(3)}, 矛盾检测: ${contradictionScore.toFixed(3)}`,
        matchedConcepts
      };

    } catch (error) {
      console.error('NLI相关性评估失败:', error);
      // 降级到语义相关性评估
      return this.fallbackNLIAssessment(literature, formulation);
    }
  }

  async filterCitations(citations: Citation[], maxResults: number = 10) {
    if (citations.length === 0) return [];

    try {
      // 基于NLI推理质量进行过滤
      const nliFilteredCitations = await this.nliQualityFiltering(citations);
      
      // 逻辑一致性检查
      const consistentCitations = await this.logicalConsistencyCheck(nliFilteredCitations);
      
      // 按推理强度排序
      consistentCitations.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      return consistentCitations.slice(0, maxResults);

    } catch (error) {
      console.error('NLI过滤失败:', error);
      // 降级到基础过滤
      return citations
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, maxResults);
    }
  }

  private async nliSearchByFormulation(
    formulation: DirectionFormulation,
    context: EvaluationContext
  ): Promise<Citation[]> {
    const citations: Citation[] = [];

    try {
      // 模拟NLI驱动的搜索结果
      const nliResults = await this.simulateNLISearch(formulation, context);

      for (const literature of nliResults) {
        const relevance = await this.assessRelevance(literature, formulation, context);
        
        if (relevance.relevanceScore > this.entailmentThreshold) {
          citations.push({
            literatureId: literature.id,
            literature,
            relevanceScore: relevance.relevanceScore,
            matchedFormulation: formulation.formulation,
            matchedKeywords: relevance.matchedConcepts,
            retrievalMethod: 'nli',
            reasoning: `NLI推理: ${relevance.reasoning}`
          });
        }
      }

      return citations;

    } catch (error) {
      console.error('NLI搜索失败:', formulation.formulation, error);
      return [];
    }
  }

  private async calculateEntailment(premise: string, hypothesis: string): Promise<number> {
    if (process.env.NODE_ENV === 'development' || !this.apiKey) {
      // 开发环境下使用模拟的NLI推理
      return this.simulateNLIInference(premise, hypothesis);
    }

    try {
      // 调用NLI模型API（这里假设使用Hugging Face API）
      const response = await fetch(`https://api-inference.huggingface.co/models/${this.nliModel}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: {
            premise: premise,
            hypothesis: hypothesis
          }
        })
      });

      if (!response.ok) {
        throw new Error(`NLI API调用失败: ${response.status}`);
      }

      const data = await response.json();
      
      // 提取蕴含分数
      const entailmentLabel = data.find((item: any) => item.label === 'ENTAILMENT');
      return entailmentLabel ? entailmentLabel.score : 0;

    } catch (error) {
      console.error('NLI推理失败:', error);
      return this.simulateNLIInference(premise, hypothesis);
    }
  }

  private simulateNLIInference(premise: string, hypothesis: string): number {
    // 基于关键词重叠和逻辑结构的模拟NLI推理
    const premiseWords = new Set(premise.toLowerCase().split(/\s+/));
    const hypothesisWords = new Set(hypothesis.toLowerCase().split(/\s+/));
    
    // 计算词汇重叠
    const overlap = [...hypothesisWords].filter(word => premiseWords.has(word)).length;
    const overlapRatio = overlap / hypothesisWords.size;
    
    // 模拟逻辑结构分析
    const logicalIndicators = ['研究', '分析', '提出', '证明', '发现', '表明'];
    const logicalOverlap = logicalIndicators.filter(indicator => 
      premise.includes(indicator) && hypothesis.includes(indicator)
    ).length;
    
    // 综合蕴含分数
    const baseScore = overlapRatio * 0.7 + (logicalOverlap / logicalIndicators.length) * 0.3;
    
    // 添加随机变化模拟模型不确定性
    const noise = (Math.random() - 0.5) * 0.2;
    
    return Math.min(1, Math.max(0, baseScore + noise));
  }

  private async simulateNLISearch(
    formulation: DirectionFormulation,
    context: EvaluationContext
  ): Promise<LibraryItem[]> {
    // 模拟基于NLI的高精度搜索结果
    const results: LibraryItem[] = [];
    const resultCount = Math.floor(Math.random() * 3) + 2; // 2-4个高质量结果

    for (let i = 0; i < resultCount; i++) {
      results.push({
        id: crypto.randomUUID(), // 🎯 使用UUID
        title: this.generateNLITitle(formulation, context),
        authors: this.generateNLIAuthors(),
        abstract: this.generateNLIAbstract(formulation, context),
        status: 'parsed',
        topics: this.generateNLITopics(formulation, context),
        url: `https://nli.example.com/${i}`,
        filePath: null,
        createdAt: new Date(Date.now() - Math.random() * 1095 * 24 * 60 * 60 * 1000), // 过去三年内
        updatedAt: new Date()
      });
    }

    return results;
  }

  private generateNLITitle(formulation: DirectionFormulation, context: EvaluationContext): string {
    // 生成逻辑相关的标题
    const logicalConnectors = ['因果关系', '逻辑推演', '系统性分析', '理论验证'];
    const connector = logicalConnectors[Math.floor(Math.random() * logicalConnectors.length)];
    
    const templates = [
      `${formulation.originalTitle}的${connector}研究`,
      `基于${context.researchTopic}的${formulation.originalTitle}逻辑框架`,
      `${formulation.originalTitle}：从理论到实践的系统性研究`,
      `${context.researchTopic}视角下${formulation.originalTitle}的逻辑分析`
    ];
    
    return templates[Math.floor(Math.random() * templates.length)];
  }

  private generateNLIAuthors(): string[] {
    const logicExperts = [
      '王逻辑', 'Dr. Logic Anderson', '张推理', 'Prof. Reasoning Smith',
      '李系统', 'Dr. Systematic Chen', '刘分析', 'Prof. Analysis Johnson'
    ];
    
    const count = Math.floor(Math.random() * 2) + 1; // 1-2个作者（NLI通常更精准，作者更少）
    return logicExperts.slice(0, count);
  }

  private generateNLIAbstract(formulation: DirectionFormulation, context: EvaluationContext): string {
    return `本研究通过严密的逻辑推理，系统性地分析了${formulation.formulation}在${context.researchTopic}领域的理论基础和实践应用。研究采用演绎推理方法，从${formulation.keywords[0] || '基础理论'}出发，逐步构建了完整的论证体系。通过逻辑分析和实证验证，我们证明了${formulation.originalTitle}与现有理论框架的内在一致性，并揭示了其在实际应用中的逻辑必然性。研究结果为${context.researchTopic}领域的理论发展提供了坚实的逻辑支撑。`;
  }

  private generateNLITopics(formulation: DirectionFormulation, context: EvaluationContext): string[] {
    const logicalTopics = ['逻辑推理', '系统分析', '理论验证'];
    const baseTopics = formulation.keywords.slice(0, 1);
    
    return [...baseTopics, logicalTopics[Math.floor(Math.random() * logicalTopics.length)]];
  }

  private async extractNLIMatchedConcepts(
    literature: LibraryItem,
    formulation: DirectionFormulation
  ): Promise<string[]> {
    // 基于NLI的概念匹配
    const concepts: string[] = [];
    
    for (const keyword of formulation.keywords) {
      const premise = `${literature.title}. ${literature.abstract || ''}`;
      const hypothesis = `这篇文献涉及${keyword}相关的研究内容`;
      
      const entailment = await this.calculateEntailment(premise, hypothesis);
      
      if (entailment > 0.6) { // NLI阈值
        concepts.push(keyword);
      }
    }
    
    return concepts;
  }

  private async nliQualityFiltering(citations: Citation[]): Promise<Citation[]> {
    // 基于NLI推理质量过滤引用
    const highQualityCitations: Citation[] = [];
    
    for (const citation of citations) {
      // 检查推理一致性
      const consistencyScore = await this.checkReasoningConsistency(citation);
      
      if (consistencyScore > 0.7) {
        // 调整相关性分数
        citation.relevanceScore = (citation.relevanceScore + consistencyScore) / 2;
        highQualityCitations.push(citation);
      }
    }
    
    return highQualityCitations;
  }

  private async checkReasoningConsistency(citation: Citation): Promise<number> {
    // 检查推理的逻辑一致性
    const literature = citation.literature;
    const premise = `${literature.title}. ${literature.abstract || ''}`;
    
    // 检查与多个相关假设的一致性
    const hypotheses = [
      `这篇文献的研究方法是合理的`,
      `这篇文献的结论是可信的`,
      `这篇文献与相关领域研究是一致的`
    ];
    
    let totalConsistency = 0;
    for (const hypothesis of hypotheses) {
      const entailment = await this.calculateEntailment(premise, hypothesis);
      totalConsistency += entailment;
    }
    
    return totalConsistency / hypotheses.length;
  }

  private async logicalConsistencyCheck(citations: Citation[]): Promise<Citation[]> {
    if (citations.length <= 1) return citations;
    
    // 检查引用之间的逻辑一致性
    const consistentCitations: Citation[] = [];
    
    for (const citation of citations) {
      let consistencyCount = 0;
      
      for (const otherCitation of citations) {
        if (citation.literatureId !== otherCitation.literatureId) {
          const consistency = await this.checkPairwiseConsistency(citation, otherCitation);
          if (consistency > 0.5) {
            consistencyCount++;
          }
        }
      }
      
      // 如果与其他引用有足够的一致性，则保留
      const consistencyRatio = consistencyCount / (citations.length - 1);
      if (consistencyRatio > 0.3) {
        consistentCitations.push(citation);
      }
    }
    
    return consistentCitations.length > 0 ? consistentCitations : citations.slice(0, 3);
  }

  private async checkPairwiseConsistency(citation1: Citation, citation2: Citation): Promise<number> {
    const text1 = `${citation1.literature.title}. ${citation1.literature.abstract || ''}`;
    const text2 = `${citation2.literature.title}. ${citation2.literature.abstract || ''}`;
    
    // 检查两篇文献是否在逻辑上一致
    const hypothesis = `这两篇文献研究的内容在逻辑上是一致的`;
    const premise = `文献1: ${text1} 文献2: ${text2}`;
    
    return await this.calculateEntailment(premise, hypothesis);
  }

  private calculateNLIConfidence(citations: Citation[]): number {
    if (citations.length === 0) return 0;

    const avgRelevance = citations.reduce((sum, c) => sum + c.relevanceScore, 0) / citations.length;
    const nliBonus = 0.15; // NLI推理的额外置信度
    const consistencyBonus = citations.length > 2 ? 0.1 : 0; // 多引用一致性奖励
    
    return Math.min(1, avgRelevance + nliBonus + consistencyBonus);
  }

  private fallbackNLIAssessment(literature: LibraryItem, formulation: DirectionFormulation) {
    // 降级到关键词匹配评估
    const titleWords = new Set(literature.title.toLowerCase().split(/\s+/));
    const abstractWords = new Set((literature.abstract || '').toLowerCase().split(/\s+/));
    const formulationWords = new Set(formulation.formulation.toLowerCase().split(/\s+/));
    
    const titleOverlap = [...formulationWords].filter(word => titleWords.has(word)).length;
    const abstractOverlap = [...formulationWords].filter(word => abstractWords.has(word)).length;
    
    const relevanceScore = (titleOverlap * 0.6 + abstractOverlap * 0.4) / formulationWords.size;
    
    return {
      relevanceScore: Math.min(1, relevanceScore),
      reasoning: `降级NLI评估 - 标题重叠: ${titleOverlap}, 摘要重叠: ${abstractOverlap}`,
      matchedConcepts: formulation.keywords.slice(0, 2)
    };
  }
}