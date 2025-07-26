/**
 * 🔧 默认算法实现 - 基础版本
 * 
 * 提供基本的算法实现作为系统的默认选择
 * 后续可以通过更高级的LLM增强算法替换
 * 
 * 实现策略：
 * - 先提供简单可工作的版本
 * - 为后续LLM增强预留接口
 * - 确保数学模型的基础框架正确
 */

import { 
  NodeEvaluator, 
  NodeExpander, 
  SelectionStrategy,
  EvaluationContext,
  MCTSConfig,
  MCTSIterationResult,
  EvaluationError,
  ExpansionError,
  SelectionError
} from './interfaces';
import { MCTSNode, LibraryItem } from '@/libs/db';
import { libraryService } from '@/libs/db/LibraryService';

// ==================== 默认节点评估器 ====================

export class DefaultNodeEvaluator implements NodeEvaluator {
  
  async evaluateImportance(node: MCTSNode, context: EvaluationContext) {
    try {
      // 获取文献信息
      const item = await libraryService.getLibraryItemById(node.libraryItemId);
      if (!item) {
        throw new EvaluationError(`文献项 ${node.libraryItemId} 未找到`);
      }

      // 基础图结构得分计算
      const graphScore = await this.calculateGraphScore(node, item, context);
      
      // 简化的语义得分（暂时基于年份和引用）
      const llmScore = await this.calculateBasicSemanticScore(node, item, context);
      
      // 权重组合 (γ = 0.7, 更偏重图结构)
      const gamma = 0.7;
      const totalScore = gamma * graphScore + (1 - gamma) * llmScore;

      return {
        totalScore,
        graphScore,
        llmScore,  
        breakdown: {
          pageRank: graphScore * 0.4,  // 简化的PageRank近似
          citationCount: Math.log(1 + (item.year ? (2024 - item.year) : 0)) * 0.1,
          degreeScore: graphScore * 0.3,
          semanticRelevance: llmScore
        }
      };
    } catch (error) {
      throw new EvaluationError(`评估节点重要性失败: ${error.message}`, { node, context });
    }
  }

  async evaluateCitationChain(parentNode: MCTSNode, childNode: MCTSNode, context: EvaluationContext) {
    try {
      const parentItem = await libraryService.getLibraryItemById(parentNode.libraryItemId);
      const childItem = await libraryService.getLibraryItemById(childNode.libraryItemId);
      
      if (!parentItem || !childItem) {
        throw new EvaluationError('引用链文献项未找到');
      }

      // 时序一致性检查
      const temporalScore = this.calculateTemporalCoherence(parentItem, childItem);
      
      // 简化的NLI得分（基于主题相似性）
      const nliScore = this.calculateTopicSimilarity(parentItem, childItem);
      
      // 综合得分
      const score = 0.6 * temporalScore + 0.4 * nliScore;

      return {
        score,
        nliScore,
        temporalScore,
        confidence: Math.min(temporalScore, nliScore), // 保守的置信度
        reasoning: `时序得分: ${temporalScore.toFixed(3)}, 主题相似性: ${nliScore.toFixed(3)}`
      };
    } catch (error) {
      throw new EvaluationError(`评估引用链失败: ${error.message}`, { parentNode, childNode });
    }
  }

  async evaluateGenerationReward(node: MCTSNode, generatedText: string, context: EvaluationContext) {
    try {
      // 简化的生成奖励计算
      const textQuality = this.calculateTextQuality(generatedText);
      const coherenceScore = this.calculateBasicCoherence(node, context);
      
      // 简化的DPO得分
      const dpoScore = textQuality * 0.8 + Math.random() * 0.2; // 添加随机性模拟不确定性
      
      const reward = dpoScore * coherenceScore;

      return {
        reward,
        dpoScore,
        coherenceScore
      };
    } catch (error) {
      throw new EvaluationError(`评估生成奖励失败: ${error.message}`, { node, generatedText });
    }
  }

  // ==================== 辅助计算方法 ====================

  private async calculateGraphScore(node: MCTSNode, item: LibraryItem, context: EvaluationContext): Promise<number> {
    // 基于节点在树中的位置和访问次数的简化图得分
    const depthPenalty = 1 / (1 + context.treeDepth * 0.1);
    const visitBonus = Math.log(1 + node.visits) * 0.1;
    const yearBonus = item.year ? Math.max(0, (item.year - 1990) / 34) : 0.5; // 归一化年份
    
    return (depthPenalty + visitBonus + yearBonus) / 3;
  }

  private async calculateBasicSemanticScore(node: MCTSNode, item: LibraryItem, context: EvaluationContext): Promise<number> {
    // 基于标题和摘要关键词匹配的简化语义得分
    const title = item.title.toLowerCase();
    const abstract = (item.abstract || '').toLowerCase();
    const topic = context.researchTopic.toLowerCase();
    
    // 简单的关键词匹配
    const titleMatch = title.includes(topic) ? 0.5 : 0;
    const abstractMatch = abstract.includes(topic) ? 0.3 : 0;
    const topicRelevance = item.topics?.some(t => topic.includes(t.toLowerCase())) ? 0.2 : 0;
    
    return titleMatch + abstractMatch + topicRelevance;
  }

  private calculateTemporalCoherence(parentItem: LibraryItem, childItem: LibraryItem): number {
    if (!parentItem.year || !childItem.year) return 0.5; // 未知年份给中等分
    
    // 子节点应该晚于或等于父节点（技术发展时间线）
    if (childItem.year >= parentItem.year) {
      const yearDiff = childItem.year - parentItem.year;
      return Math.exp(-yearDiff / 10); // 时间差越大，得分越低
    } else {
      return 0.1; // 时序不一致给低分
    }
  }

  private calculateTopicSimilarity(item1: LibraryItem, item2: LibraryItem): number {
    // 基于标题词汇重叠的简化相似性
    const words1 = new Set(item1.title.toLowerCase().split(/\s+/));
    const words2 = new Set(item2.title.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateTextQuality(text: string): number {
    // 简化的文本质量评估
    const lengthScore = Math.min(text.length / 200, 1); // 长度归一化
    const structureScore = text.includes('.') ? 0.5 : 0; // 基本结构检查
    return (lengthScore + structureScore) / 2;
  }

  private calculateBasicCoherence(node: MCTSNode, context: EvaluationContext): number {
    // 基于路径深度和节点访问的一致性评估
    const pathLength = context.currentPath.length;
    const coherence = 1 / (1 + pathLength * 0.1); // 路径越长，一致性要求越高
    return Math.max(0.1, coherence);
  }
}

// ==================== 默认节点扩展器 ====================

export class DefaultNodeExpander implements NodeExpander {

  async generateCandidates(node: MCTSNode, context: EvaluationContext) {
    try {
      const currentItem = await libraryService.getLibraryItemById(node.libraryItemId);
      if (!currentItem) {
        throw new ExpansionError(`当前节点文献 ${node.libraryItemId} 不存在`);  
      }

      // 简化的TVC过程
      const tvcSteps = await this.simulateTVCProcess(currentItem, context);
      
      // 从可用文献中筛选候选项
      const candidates = await this.filterCandidates(currentItem, context);

      return {
        candidates: candidates.slice(0, 5), // 限制候选数量
        tvcSteps,
        confidence: 0.7, // 默认置信度
        reasoning: `基于 ${currentItem.title} 生成了 ${candidates.length} 个候选文献`
      };
    } catch (error) {
      throw new ExpansionError(`生成候选节点失败: ${error.message}`, { node, context });
    }
  }

  async validateExpansion(parentNode: MCTSNode, candidate: LibraryItem, context: EvaluationContext) {
    try {
      const parentItem = await libraryService.getLibraryItemById(parentNode.libraryItemId);
      if (!parentItem) {
        throw new ExpansionError(`父节点文献 ${parentNode.libraryItemId} 不存在`);
      }

      // 基础验证检查
      const issues: string[] = [];
      const suggestions: string[] = [];
      
      // 时序检查
      if (parentItem.year && candidate.year && candidate.year < parentItem.year) {
        issues.push('候选文献发表时间早于父节点，可能存在时序问题');
        suggestions.push('检查技术发展时间线的合理性');
      }
      
      // 主题相关性检查
      const topicRelevance = this.calculateTopicRelevance(parentItem, candidate, context);
      if (topicRelevance < 0.2) {
        issues.push('候选文献与当前研究主题相关性较低');
        suggestions.push('考虑选择更相关的文献或明确连接逻辑');
      }

      const validationScore = Math.max(0, 1 - issues.length * 0.3);
      const isValid = issues.length <= 1 && validationScore > 0.4;

      return {
        isValid,
        validationScore,
        issues,
        suggestions
      };
    } catch (error) {
      throw new ExpansionError(`验证扩展失败: ${error.message}`, { parentNode, candidate });
    }
  }

  async retrieveRelevantLiterature(query: string, context: EvaluationContext, maxResults = 10) {
    try {
      // 从现有文献库中检索相关文献
      const allItems = context.availableLiterature;
      const queryLower = query.toLowerCase();
      
      const scoredItems = allItems
        .map(item => ({
          item,
          score: this.calculateRelevanceScore(item, queryLower)
        }))
        .filter(({ score }) => score > 0.1) // 过滤掉不相关的
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);

      return {
        items: scoredItems.map(({ item }) => item),
        relevanceScores: scoredItems.map(({ score }) => score),
        retrievalMethod: 'keyword-matching'
      };
    } catch (error) {
      throw new ExpansionError(`检索相关文献失败: ${error.message}`, { query, maxResults });
    }
  }

  // ==================== 辅助方法 ====================

  private async simulateTVCProcess(currentItem: LibraryItem, context: EvaluationContext) {
    // 简化的TVC过程模拟
    const think = `基于 "${currentItem.title}" 的研究，下一步技术发展可能涉及...`;
    const verbalize = `该研究领域的关键技术突破方向包括方法改进、应用扩展和理论深化`;
    const citations = [`${currentItem.title} 等相关工作`];
    
    return [{
      think,
      verbalize,
      citations,
      validation: true
    }];
  }

  private async filterCandidates(currentItem: LibraryItem, context: EvaluationContext): Promise<LibraryItem[]> {
    // 过滤候选文献
    const availableItems = context.availableLiterature;
    const usedItemIds = new Set(context.currentPath.map(n => n.libraryItemId));
    
    return availableItems
      .filter(item => 
        !usedItemIds.has(item.id) && // 避免重复
        item.id !== currentItem.id && // 不选择自身
        this.isRelevantCandidate(currentItem, item, context)
      )
      .sort((a, b) => (b.year || 0) - (a.year || 0)) // 按年份排序
      .slice(0, 10);
  }

  private isRelevantCandidate(current: LibraryItem, candidate: LibraryItem, context: EvaluationContext): boolean {
    // 检查候选文献是否相关
    const topicRelevance = this.calculateTopicRelevance(current, candidate, context);
    const temporalValidity = !current.year || !candidate.year || candidate.year >= current.year;
    
    return topicRelevance > 0.15 && temporalValidity;
  }

  private calculateTopicRelevance(item1: LibraryItem, item2: LibraryItem, context: EvaluationContext): number {
    // 计算主题相关性
    const title1 = item1.title.toLowerCase();
    const title2 = item2.title.toLowerCase();
    const topic = context.researchTopic.toLowerCase();
    
    // 与研究主题的相关性
    const topicRelevance1 = title1.includes(topic) ? 0.5 : 0;
    const topicRelevance2 = title2.includes(topic) ? 0.5 : 0;
    
    // 文献间的相似性
    const similarity = this.calculateJaccardSimilarity(title1, title2);
    
    return (topicRelevance1 + topicRelevance2) * 0.6 + similarity * 0.4;
  }

  private calculateRelevanceScore(item: LibraryItem, query: string): number {
    const title = item.title.toLowerCase();
    const abstract = (item.abstract || '').toLowerCase();
    
    let score = 0;
    if (title.includes(query)) score += 0.6;
    if (abstract.includes(query)) score += 0.4;
    
    // 词汇匹配
    const queryWords = query.split(/\s+/);
    const titleWords = title.split(/\s+/);
    const matchingWords = queryWords.filter(w => titleWords.some(tw => tw.includes(w)));
    score += (matchingWords.length / queryWords.length) * 0.3;
    
    return Math.min(score, 1);
  }

  private calculateJaccardSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
}

// ==================== 默认选择策略 ====================

export class DefaultSelectionStrategy implements SelectionStrategy {

  async calculateSGUCTValue(node: MCTSNode, parent: MCTSNode, config: MCTSConfig, context: EvaluationContext) {
    try {
      if (node.visits === 0) {
        // 未访问节点拥有无穷大的UCT值
        return {
          uctValue: Infinity,
          exploitationTerm: 0,
          explorationTerm: Infinity,
          semanticTerm: 0,
          llmPriority: 0
        };
      }

      // 标准UCT计算
      const exploitationTerm = node.wins / node.visits;
      const explorationTerm = config.explorationConstant * Math.sqrt(Math.log(parent.visits) / node.visits);
      
      // 简化的LLM优先级（基于年份和主题相关性）
      const llmPriority = await this.calculateSimplifiedLLMPriority(node, context);
      const semanticTerm = config.semanticWeight * llmPriority;
      
      const uctValue = exploitationTerm + explorationTerm + semanticTerm;

      return {
        uctValue,
        exploitationTerm,
        explorationTerm,
        semanticTerm,
        llmPriority
      };
    } catch (error) {
      throw new SelectionError(`计算SG-UCT值失败: ${error.message}`, { node, parent, config });
    }
  }

  async selectBestChild(candidates: MCTSNode[], parent: MCTSNode, config: MCTSConfig, context: EvaluationContext) {
    try {
      if (candidates.length === 0) {
        throw new SelectionError('候选节点列表为空');
      }

      // 计算所有候选节点的UCT值
      const scoredCandidates = await Promise.all(
        candidates.map(async candidate => {
          const uctResult = await this.calculateSGUCTValue(candidate, parent, config, context);
          return {
            node: candidate,
            score: uctResult.uctValue,
            breakdown: uctResult
          };
        })
      );

      // 选择最高分的节点
      const bestCandidate = scoredCandidates.reduce((best, current) => 
        current.score > best.score ? current : best
      );

      return {
        selectedNode: bestCandidate.node,
        selectionReason: `SG-UCT得分: ${bestCandidate.score.toFixed(3)} (利用: ${bestCandidate.breakdown.exploitationTerm.toFixed(3)}, 探索: ${bestCandidate.breakdown.explorationTerm.toFixed(3)}, 语义: ${bestCandidate.breakdown.semanticTerm.toFixed(3)})`,
        allScores: scoredCandidates
      };
    } catch (error) {
      throw new SelectionError(`选择最佳子节点失败: ${error.message}`, { candidates, parent, config });
    }
  }

  async generateLLMPriority(node: MCTSNode, candidates: MCTSNode[], context: EvaluationContext) {
    try {
      // 简化的LLM优先级生成
      // 在实际实现中，这里会调用真正的LLM
      const item = await libraryService.getLibraryItemById(node.libraryItemId);
      if (!item) {
        throw new SelectionError(`节点文献 ${node.libraryItemId} 不存在`);
      }

      const priority = await this.calculateSimplifiedLLMPriority(node, context);
      
      return {
        priority,
        reasoning: `基于文献 "${item.title}" 的时效性和主题相关性计算优先级`,
        selectedDirection: context.researchTopic.includes('方法') ? '方法改进' : '应用扩展'
      };
    } catch (error) {
      throw new SelectionError(`生成LLM优先级失败: ${error.message}`, { node, candidates });
    }
  }

  // ==================== 辅助方法 ====================

  private async calculateSimplifiedLLMPriority(node: MCTSNode, context: EvaluationContext): Promise<number> {
    try {
      const item = await libraryService.getLibraryItemById(node.libraryItemId);
      if (!item) return 0.5; // 默认中等优先级

      // 基于年份的时效性
      const currentYear = new Date().getFullYear();
      const yearScore = item.year ? Math.max(0, Math.min(1, (item.year - 1990) / (currentYear - 1990))) : 0.5;
      
      // 基于主题相关性的简化评估
      const topicRelevance = this.calculateTopicRelevance(item, context.researchTopic);
      
      // 基于访问次数的热度
      const visitScore = Math.min(1, node.visits / 10);
      
      return (yearScore * 0.4 + topicRelevance * 0.4 + visitScore * 0.2);
    } catch (error) {
      console.warn(`计算简化LLM优先级失败: ${error.message}`);
      return 0.5;
    }
  }

  private calculateTopicRelevance(item: LibraryItem, topic: string): number {
    const title = item.title.toLowerCase();
    const topicLower = topic.toLowerCase();
    
    // 简单的关键词匹配
    if (title.includes(topicLower)) return 0.8;
    
    const topicWords = topicLower.split(/\s+/);
    const titleWords = title.split(/\s+/);
    const matchCount = topicWords.filter(w => titleWords.some(tw => tw.includes(w))).length;
    
    return Math.min(0.7, matchCount / topicWords.length);
  }
}