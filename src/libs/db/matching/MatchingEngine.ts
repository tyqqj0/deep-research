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
   * 🔍 智能匹配：在文献库中查找与给定引文匹配的条目
   * 匹配策略：
   * 1. DOI 精确匹配（优先级最高）
   * 2. 标题 + 作者 + 年份模糊匹配
   */
  async findMatchingLiterature(reference: any, sourceItemId?: string): Promise<LibraryItem | null> {
    try {
      // 🔍 提取引文数据 - 处理嵌套结构
      const extractedRef = this.referenceExtractor.extractReferenceData(reference);

      // 策略一：DOI 精确匹配
      if (extractedRef.doi) {
        const doiMatch = await db.library
          .where('doi')
          .equals(extractedRef.doi.trim())
          .first();

        if (doiMatch) {
          // 检查自我引用
          if (sourceItemId && doiMatch.id === sourceItemId) {
            console.log(`🚫 [DOI] Self-reference detected, ignoring`);
          } else {
            console.log(`✅ [DOI] Match found: ${doiMatch.title}`);
            return doiMatch;
          }
        }
      }

      // 策略二：带守门员的综合匹配
      if (extractedRef.title) {
        const allItems = await db.library.toArray();
        const candidates = [];

        for (const item of allItems) {
          // 🚪 守门员：最低标题相似度检查
          const titleSimilarity = this.similarityCalculator.calculateStringSimilarity(
            extractedRef.title.toLowerCase().trim(),
            item.title.toLowerCase().trim()
          );

          if (titleSimilarity < this.thresholds.gatekeeperThreshold) {
            continue; // 标题相似度太低，直接跳过
          }

          // 通过守门员检查，计算综合得分
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

        console.log(`🔍 [MATCH] Found ${qualifiedMatches.length} qualified matches (threshold: ${this.thresholds.finalThreshold})`);

        if (qualifiedMatches.length > 0) {
          const bestMatch = qualifiedMatches[0];
          console.log(`✅ [MATCH] Best match: "${bestMatch.item.title}" (score: ${bestMatch.totalScore.toFixed(3)})`);
          return bestMatch.item;
        } else {
          console.log(`❌ [MATCH] No qualified matches found (highest score below ${this.thresholds.finalThreshold} threshold)`);
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding matching literature:', error);
      return null;
    }
  }

  /**
   * 🔍 根据URL或DOI查找文献
   */
  async findItemByUrlOrDoi(url?: string, doi?: string): Promise<LibraryItem | null> {
    try {
      // Priority 1: DOI match (most reliable)
      if (doi) {
        const doiMatch = await db.library
          .where('doi')
          .equals(doi.trim())
          .first();
        if (doiMatch) {
          return doiMatch;
        }
      }

      // Priority 2: URL match
      if (url) {
        const urlMatch = await db.library
          .where('url')
          .equals(url.trim())
          .first();
        if (urlMatch) {
          return urlMatch;
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding item by URL or DOI:', error);
      throw new Error('Failed to find item by URL or DOI');
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