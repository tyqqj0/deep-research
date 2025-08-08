/**
 * 🔍 ReferenceExtractor - 引文数据提取器
 * 
 * 🎯 核心职责:
 * - 从多种格式的引文数据中提取标准化信息
 * - 支持嵌套结构和扁平结构
 * - 处理不同数据源的格式差异
 */

import { ExtractedReferenceData } from './SimilarityCalculator';

export class ReferenceExtractor {
  /**
   * 🔍 提取引文数据 - 处理不同的数据结构
   * 支持多种引文数据格式：
   * 1. 扁平结构：{ title, authors, year, doi }
   * 2. 嵌套结构：{ parsed: { title, authors, year, doi }, raw_text, source }
   */
  extractReferenceData(reference: any): ExtractedReferenceData {
    if (!reference) return {};

    // 如果有 parsed 字段，优先使用 parsed 中的数据
    if (reference.parsed && typeof reference.parsed === 'object') {
      const extracted = {
        title: reference.parsed.title || reference.raw_text,
        authors: reference.parsed.authors?.map((author: any) =>
          typeof author === 'string' ? author : author.name || author.author
        ) || [],
        year: reference.parsed.year ||
          (reference.parsed.publicationDate ? new Date(reference.parsed.publicationDate).getFullYear() : undefined) ||
          (reference.parsed.publication_date ? new Date(reference.parsed.publication_date).getFullYear() : undefined),
        doi: reference.parsed.doi || reference.parsed.externalIds?.DOI
      };

      return extracted;
    }

    // 否则使用扁平结构
    return {
      title: reference.title,
      authors: reference.authors,
      year: reference.year,
      doi: reference.doi
    };
  }

  /**
   * 🔧 验证提取的数据是否有效
   */
  validateExtractedData(data: ExtractedReferenceData): boolean {
    return !!(data.title || data.doi);
  }

  /**
   * 📋 批量提取引文数据
   */
  extractBatchReferenceData(references: any[]): ExtractedReferenceData[] {
    return references
      .map(ref => this.extractReferenceData(ref))
      .filter(data => this.validateExtractedData(data));
  }
}

// Export singleton instance
export const referenceExtractor = new ReferenceExtractor();