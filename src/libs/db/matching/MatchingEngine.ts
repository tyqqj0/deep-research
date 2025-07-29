/**
 * 🔍 MatchingEngine - 智能文献匹配引擎
 * 
 * 🎯 核心职责:
 * - 在文献库中查找与给定引文匹配的条目
 * - 支持DOI精确匹配和多字段模糊匹配
 * - 使用守门员机制和分层阈值优化性能
 */

import { LibraryItem } from '../schema';
import { SimilarityCalculator, ExtractedReferenceData } from './SimilarityCalculator';
import { ReferenceExtractor } from './ReferenceExtractor';
import { db } from '../index';

export interface MatchingThresholds {
  gatekeeperThreshold: number;  // 守门员阈值
  finalThreshold: number;       // 最终匹配阈值
}

export class MatchingEngine {
  private thresholds: MatchingThresholds = {
    gatekeeperThreshold: 0.4,
    finalThreshold: 0.6
  };

  constructor(
    private similarityCalculator: SimilarityCalculator,
    private referenceExtractor: ReferenceExtractor
  ) {}

  /**
   * 🔍 核心匹配引擎：统一的文献匹配逻辑
   * @param matchData 匹配数据（可以是引文、URL、DOI等）
   * @param options 匹配选项
   */
  private async findMatches(matchData: {
    title?: string;
    authors?: string[];
    year?: number;
    doi?: string;
    url?: string;
  }, options: {
    enableTitleMatching?: boolean;
    sourceItemId?: string;
    strictMode?: boolean; // 严格模式：只有精确匹配（DOI/URL）
  } = {}): Promise<LibraryItem | null> {
    try {
      // 策略1: DOI 精确匹配（最高优先级）
      if (matchData.doi) {
        const doiMatch = await db.library
          .where('doi')
          .equals(matchData.doi.trim())
          .first();

        if (doiMatch) {
          // 检查自我引用
          if (options.sourceItemId && doiMatch.id === options.sourceItemId) {
            console.log(`🚫 [MatchingEngine] Self-reference detected, ignoring DOI match`);
          } else {
            console.log(`✅ [MatchingEngine] DOI精确匹配: ${doiMatch.title}`);
            return doiMatch;
          }
        }
      }

      // 策略2: URL 精确匹配
      if (matchData.url) {
        const urlMatch = await db.library
          .where('url')
          .equals(matchData.url.trim())
          .first();
        
        if (urlMatch) {
          console.log(`✅ [MatchingEngine] URL精确匹配: ${urlMatch.title}`);
          return urlMatch;
        }
      }

      // 策略3: 标题+作者综合匹配（如果启用且有标题）
      if (options.enableTitleMatching && matchData.title && !options.strictMode) {
        // 🚫 跳过临时处理标题的匹配，避免误判
        if (matchData.title.startsWith('Processing: ')) {
          console.log(`🚫 [MatchingEngine] Skipping title matching for temporary processing title: "${matchData.title}"`);
          return null;
        }
        
        // console.log(`🔍 [MatchingEngine] 开始标题相似性匹配: "${matchData.title}"`);
        
        const allItems = await db.library.toArray();
        const candidates = [];

        for (const item of allItems) {
          // 跳过自我引用
          if (options.sourceItemId && item.id === options.sourceItemId) {
            continue;
          }

          // 🚫 跳过库中已有的临时处理标题，避免误判
          if (item.title.startsWith('Processing: ')) {
            continue;
          }

          // 🚪 守门员：最低标题相似度检查
          const titleSimilarity = this.similarityCalculator.calculateStringSimilarity(
            matchData.title.toLowerCase().trim(),
            item.title.toLowerCase().trim()
          );

          // console.log(`📊 [MatchingEngine] 标题相似性: "${item.title}" = ${(titleSimilarity * 100).toFixed(1)}%`);

          if (titleSimilarity < this.thresholds.gatekeeperThreshold) {
            continue; // 标题相似度太低，直接跳过
          }

          // 通过守门员检查，计算综合得分
          const extractedRef = {
            title: matchData.title,
            authors: matchData.authors || [],
            year: matchData.year
          };
          
          const totalScore = this.similarityCalculator.calculateMatchScore(extractedRef, item);
          candidates.push({
            item,
            titleSimilarity,
            totalScore
          });
        }

        // 按总分排序，筛选高质量匹配
        const qualifiedMatches = candidates
          .filter(candidate => candidate.totalScore > this.thresholds.finalThreshold)
          .sort((a, b) => b.totalScore - a.totalScore);

        if (qualifiedMatches.length > 0) {
          const bestMatch = qualifiedMatches[0];
          console.log(`✅ [MatchingEngine] 智能匹配成功: "${bestMatch.item.title}" (相似度: ${(bestMatch.totalScore * 100).toFixed(1)}%)`);
          return bestMatch.item;
        } else {
          // console.log(`❌ [MatchingEngine] 未找到符合阈值的匹配项 (最高阈值: ${this.thresholds.finalThreshold})`);
        }
      }

      return null;
    } catch (error) {
      console.error('Error in core matching engine:', error);
      return null;
    }
  }

  /**
   * 🔍 智能匹配：在文献库中查找与给定引文匹配的条目
   * 匹配策略：
   * 1. DOI 精确匹配（优先级最高）
   * 2. 标题 + 作者 + 年份模糊匹配
   */
  async findMatchingLiterature(reference: any, sourceItemId?: string): Promise<LibraryItem | null> {
    try {
      // 🔍 提取引文数据 - 处理嵌套结构
      const extractedRef = this.referenceExtractor.extractReferenceData(reference);

      return await this.findMatches({
        title: extractedRef.title,
        authors: extractedRef.authors,
        year: extractedRef.year,
        doi: extractedRef.doi
      }, {
        enableTitleMatching: true,
        sourceItemId
      });
    } catch (error) {
      console.error('Error finding matching literature:', error);
      return null;
    }
  }

  /**
   * 🔍 增强版查重：通过URL、DOI或标题查找匹配的文献项
   * 支持精确匹配和智能相似性匹配
   * 
   * @param url 文献URL
   * @param doi 文献DOI
   * @param title 文献标题（可选，用于相似性匹配）
   * @param authors 作者列表（可选，用于增强匹配准确性）
   * @param year 发表年份（可选，用于增强匹配准确性）
   */
  async findItemByUrlOrDoi(
    url?: string, 
    doi?: string, 
    title?: string, 
    authors?: string[], 
    year?: number
  ): Promise<LibraryItem | null> {
    try {
      return await this.findMatches({
        title,
        authors,
        year,
        doi,
        url
      }, {
        enableTitleMatching: !!title, // 只有提供标题时才启用标题匹配
        strictMode: false // 允许智能匹配
      });
    } catch (error) {
      console.error('Error finding item by URL, DOI, or title:', error);
      throw new Error('Failed to find item by URL, DOI, or title');
    }
  }

  /**
   * 🔧 设置匹配阈值
   */
  setThresholds(thresholds: Partial<MatchingThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * 🔧 获取当前阈值
   */
  getThresholds(): MatchingThresholds {
    return { ...this.thresholds };
  }

  /**
   * 📊 批量匹配文献
   */
  async batchFindMatches(references: any[], sourceItemId?: string): Promise<Array<{
    reference: any;
    match: LibraryItem | null;
    confidence: number;
  }>> {
    const results = [];

    for (const reference of references) {
      const match = await this.findMatchingLiterature(reference, sourceItemId);
      const extractedRef = this.referenceExtractor.extractReferenceData(reference);
      
      let confidence = 0;
      if (match && extractedRef.title) {
        confidence = this.similarityCalculator.calculateMatchScore(extractedRef, match);
      } else if (match && extractedRef.doi) {
        confidence = 1.0; // DOI match is 100% confident
      }

      results.push({
        reference,
        match,
        confidence
      });
    }

    return results;
  }
}

// Export singleton instance with dependency injection
import { similarityCalculator } from './SimilarityCalculator';
import { referenceExtractor } from './ReferenceExtractor';

export const matchingEngine = new MatchingEngine(similarityCalculator, referenceExtractor);