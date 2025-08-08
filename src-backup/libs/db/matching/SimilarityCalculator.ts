/**
 * 📊 SimilarityCalculator - 文献相似度计算器
 * 
 * 🎯 核心职责:
 * - 计算字符串相似度（优化的学术标题算法）
 * - 计算作者列表相似度
 * - 计算综合匹配分数
 * - 支持可配置的权重和阈值
 */

import { LibraryItem } from '../schema';

export interface ScoreWeights {
  title: number;
  authors: number;
  year: number;
}

export interface ExtractedReferenceData {
  title?: string;
  authors?: string[];
  year?: number;
  doi?: string;
}

export class SimilarityCalculator {
  private defaultWeights: ScoreWeights = {
    title: 0.7,
    authors: 0.2,
    year: 0.1
  };

  /**
   * 📝 计算两个字符串的相似度（优化版，针对学术标题）
   */
  calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    // 移除标点符号和多余空格，进行标准化
    const normalize = (s: string) => s.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const s1 = normalize(str1);
    const s2 = normalize(str2);

    if (s1 === s2) return 1;

    // 🎯 多种相似度算法组合
    // 1. 词汇重叠率（对学术标题很有效）
    const words1 = s1.toLowerCase().split(' ').filter(w => w.length > 2); // 忽略短词
    const words2 = s2.toLowerCase().split(' ').filter(w => w.length > 2);
    const commonWords = words1.filter(w => words2.includes(w));
    const wordOverlap = commonWords.length / Math.max(words1.length, words2.length);

    // 2. 最长公共子序列
    const lcs = this.longestCommonSubsequence(s1, s2);
    const lcsRatio = lcs / Math.max(s1.length, s2.length);

    // 3. 组合评分（词汇重叠权重更高）
    return wordOverlap * 0.7 + lcsRatio * 0.3;
  }

  /**
   * 👥 计算作者列表的相似度
   */
  calculateAuthorSimilarity(authors1: string[], authors2: string[]): number {
    if (authors1.length === 0 && authors2.length === 0) return 1;
    if (authors1.length === 0 || authors2.length === 0) return 0;

    let matchCount = 0;
    for (const author1 of authors1) {
      for (const author2 of authors2) {
        if (this.calculateStringSimilarity(author1, author2) > 0.8) {
          matchCount++;
          break;
        }
      }
    }

    return matchCount / Math.max(authors1.length, authors2.length);
  }

  /**
   * 📊 计算引文与文献条目的匹配分数
   * 综合考虑标题、作者和年份的相似度
   */
  calculateMatchScore(
    reference: ExtractedReferenceData, 
    item: LibraryItem, 
    weights: ScoreWeights = this.defaultWeights
  ): number {
    let score = 0;
    let factors = 0;

    // 标题相似度（权重：0.7）- 核心中的核心
    if (reference.title && item.title) {
      const titleSimilarity = this.calculateStringSimilarity(
        reference.title.toLowerCase().trim(),
        item.title.toLowerCase().trim()
      );
      score += titleSimilarity * weights.title;
      factors += weights.title;
    }

    // 作者相似度（权重：0.2）- 重要的辅助判断
    if (reference.authors && item.authors && reference.authors.length > 0) {
      const authorSimilarity = this.calculateAuthorSimilarity(reference.authors, item.authors);
      score += authorSimilarity * weights.authors;
      factors += weights.authors;
    }

    // 年份匹配（权重：0.1）- 仅作为微调和加分项
    if (reference.year && item.year) {
      const yearMatch = Math.abs(reference.year - item.year) <= 1 ? 1 : 0;
      score += yearMatch * weights.year;
      factors += weights.year;
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * 🔤 计算最长公共子序列长度（用于字符串相似度计算）
   */
  private longestCommonSubsequence(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    return dp[m][n];
  }

  /**
   * 🔧 设置权重配置
   */
  setWeights(weights: Partial<ScoreWeights>): void {
    this.defaultWeights = { ...this.defaultWeights, ...weights };
  }
}

// Export singleton instance
export const similarityCalculator = new SimilarityCalculator();