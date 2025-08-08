/**
 * 🔗 CitationLinker - 引文链接管理器
 * 
 * 🎯 核心职责:
 * - 自动化引文链接：为指定文献条目自动链接其参考文献
 * - 双向链接机制：正向和反向引文关系的建立
 * - 链接验证和去重
 */

import { LibraryItem } from '../schema';
import { MatchingEngine } from './MatchingEngine';
import { ReferenceExtractor } from './ReferenceExtractor';
import { db } from '../index';

export interface CitationLinkResult {
  totalReferences: number;
  linkedCount: number;
  unlinkedCount: number;
  linkedItems: Array<{ reference: any; linkedItem: LibraryItem }>;
}

export interface BidirectionalLinkResult {
  forwardLinks: number;
  backwardLinks: number;
}

export class CitationLinker {
  constructor(
    private matchingEngine: MatchingEngine,
    private referenceExtractor: ReferenceExtractor
  ) {}

  /**
   * 🔗 自动化引文链接：为指定文献条目自动链接其参考文献
   * 触发时机：在文献解析流程成功之后调用
   */
  async linkCitationsForItem(itemId: string): Promise<CitationLinkResult> {
    try {
      const item = await db.library.get(itemId);

      if (!item || !item.parsedContent?.extractedReferences) {
        console.log(`⚠️ [DEBUG] No item or no extracted references found for itemId: ${itemId}`);
        return { totalReferences: 0, linkedCount: 0, unlinkedCount: 0, linkedItems: [] };
      }

      const references = item.parsedContent.extractedReferences;
      const linkedItems: Array<{ reference: any; linkedItem: LibraryItem }> = [];
      let linkedCount = 0;

      for (let i = 0; i < references.length; i++) {
        const reference = references[i];
        const matchedItem = await this.matchingEngine.findMatchingLiterature(reference, item.id);

        if (matchedItem) {
          // 检查是否已存在链接，避免重复
          const existingLink = await db.citations
            .where(['sourceItemId', 'targetItemId'])
            .equals([itemId, matchedItem.id])
            .first();

          if (!existingLink) {
            await db.citations.add({
              sourceItemId: itemId,
              targetItemId: matchedItem.id,
              createdAt: new Date()
            });
            linkedItems.push({ reference, linkedItem: matchedItem });
            linkedCount++;
          }
        }
      }

      return {
        totalReferences: references.length,
        linkedCount,
        unlinkedCount: references.length - linkedCount,
        linkedItems
      };
    } catch (error) {
      console.error('Error linking citations for item:', error);
      throw new Error('Failed to link citations');
    }
  }

  /**
   * 🔄 核心双向链接逻辑: 当新文献添加时，自动与整个库进行双向关联
   * @param newItemId - 新添加的文献ID
   */
  async linkNewItemBidirectionally(newItemId: string): Promise<BidirectionalLinkResult> {
    console.log(`[Linker] Starting bidirectional linking for new item: ${newItemId}`);
    const newItem = await db.library.get(newItemId);
    if (!newItem) {
      console.error(`[Linker] New item ${newItemId} not found.`);
      return { forwardLinks: 0, backwardLinks: 0 };
    }

    let forwardLinks = 0;
    let backwardLinks = 0;

    // 1. 正向链接 (新文献 -> 引用 -> 旧文献)
    if (newItem.parsedContent?.extractedReferences) {
      for (const reference of newItem.parsedContent.extractedReferences) {
        const matchedItem = await this.matchingEngine.findMatchingLiterature(reference, newItem.id);
        if (matchedItem) {
          const created = await this.createCitationLink(newItem.id, matchedItem.id);
          if (created) forwardLinks++;
        }
      }
    }
    console.log(`[Linker] Forward links created: ${forwardLinks}`);

    // 2. 反向链接 (旧文献 -> 引用 -> 新文献)
    const allOtherItems = await db.library.where('id').notEqual(newItemId).toArray();
    for (const existingItem of allOtherItems) {
      if (existingItem.parsedContent?.extractedReferences) {
        for (const reference of existingItem.parsedContent.extractedReferences) {
          // 使用我们强大的匹配算法，检查旧文献的引文是否与新文献匹配
          const extractedRef = this.referenceExtractor.extractReferenceData(reference);

          // 🚪 守门员：最低标题相似度检查
          if (extractedRef.title && newItem.title) {
            const titleSimilarity = this.matchingEngine['similarityCalculator'].calculateStringSimilarity(
              extractedRef.title.toLowerCase().trim(),
              newItem.title.toLowerCase().trim()
            );

            if (titleSimilarity < 0.4) { // 🎯 提高守门员阈值到40%
              continue; // 标题相似度太低，直接跳过
            }
          }

          const score = this.matchingEngine['similarityCalculator'].calculateMatchScore(extractedRef, newItem);
          if (score > 0.6) { // 🎯 使用和 findMatchingLiterature 相同的更严格阈值
            // console.log(`🔗 [BACKWARD] Creating backward link: ${existingItem.title} → ${newItem.title} (score: ${score.toFixed(3)})`);
            const created = await this.createCitationLink(existingItem.id, newItem.id);
            if (created) backwardLinks++;
          } else {
            // console.log(`⏭️ [BACKWARD] Skipping low-score match: ${existingItem.title} → ${newItem.title} (score: ${score.toFixed(3)}, threshold: 0.6)`);
          }
        }
      }
    }
    console.log(`[Linker] Backward links created: ${backwardLinks}`);

    return { forwardLinks, backwardLinks };
  }

  /**
   * 🔗 手动创建引文链接
   */
  async createCitationLink(sourceItemId: string, targetItemId: string): Promise<boolean> {
    try {
      // 检查是否已存在链接
      const existingLink = await db.citations
        .where(['sourceItemId', 'targetItemId'])
        .equals([sourceItemId, targetItemId])
        .first();

      if (existingLink) {
        return false; // 已存在，不重复创建
      }

      await db.citations.add({
        sourceItemId,
        targetItemId,
        createdAt: new Date()
      });
      return true; // 成功创建
    } catch (error) {
      console.error('Error creating citation link:', error);
      throw new Error('Failed to create citation link');
    }
  }

  /**
   * 🗑️ 删除引文链接
   */
  async deleteCitationLink(sourceItemId: string, targetItemId: string): Promise<void> {
    try {
      const count = await db.citations
        .where(['sourceItemId', 'targetItemId'])
        .equals([sourceItemId, targetItemId])
        .delete();

      if (count === 0) {
        throw new Error('Citation link not found');
      }
    } catch (error) {
      console.error('Error deleting citation link:', error);
      throw new Error('Failed to delete citation link');
    }
  }

  /**
   * 🔗 手动创建引文链接 - 支持图谱交互
   * @param sourceItemId - 源文献ID
   * @param targetItemId - 目标文献ID
   * @returns Promise<boolean> - 是否创建成功
   */
  async createManualCitationLink(sourceItemId: string, targetItemId: string): Promise<boolean> {
    try {
      // 验证两个文献都存在
      const [sourceItem, targetItem] = await Promise.all([
        db.library.get(sourceItemId),
        db.library.get(targetItemId)
      ]);

      if (!sourceItem || !targetItem) {
        throw new Error('One or both items not found');
      }

      // 防止自引用
      if (sourceItemId === targetItemId) {
        throw new Error('Cannot create citation link from item to itself');
      }

      // 检查是否已存在链接
      const existingLink = await db.citations
        .where(['sourceItemId', 'targetItemId'])
        .equals([sourceItemId, targetItemId])
        .first();

      if (existingLink) {
        console.log(`[CitationLinker] Citation link already exists: ${sourceItemId} -> ${targetItemId}`);
        return false; // 已存在，不重复创建
      }

      // 创建新的引文链接
      await db.citations.add({
        sourceItemId,
        targetItemId,
        createdAt: new Date()
      });

      console.log(`[CitationLinker] Created manual citation link: ${sourceItem.title} -> ${targetItem.title}`);
      return true; // 成功创建
    } catch (error) {
      console.error('Error creating manual citation link:', error);
      throw new Error('Failed to create manual citation link');
    }
  }

  /**
   * 🌐 获取所有引文链接 - 用于全局图谱
   */
  async getAllCitations(): Promise<Array<{ source: string; target: string }>> {
    try {
      const allLinks = await db.citations.toArray();
      return allLinks.map(link => ({
        source: link.sourceItemId,
        target: link.targetItemId
      }));
    } catch (error) {
      console.error('Error getting all citations:', error);
      throw new Error('Failed to get all citations');
    }
  }
}

// Export singleton instance with dependency injection
import { matchingEngine } from './MatchingEngine';
import { referenceExtractor } from './ReferenceExtractor';

export const citationLinker = new CitationLinker(matchingEngine, referenceExtractor);