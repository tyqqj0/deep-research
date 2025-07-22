/**
 * 📚 LibraryService - 文献数据库服务 (数据访问层)
 * 
 * 🎯 核心职责 (Data Access Layer):
 * - 提供一个纯粹的、无业务逻辑的接口，用于操作 IndexedDB 中的 `library` 和 `literatureTrees` 表。
 * - 执行原子性的 CRUD (Create, Read, Update, Delete) 操作。
 * - 作为与数据库交互的唯一真实来源 (Single Source of Truth)。
 *
 * ❌ 不负责:
 * - 任何多步骤的业务逻辑或工作流 (这些逻辑已迁移到后端服务)。
 * - 调用外部服务，如 Mineru 或 PDF 抓取器。
 * - 理解数据状态背后的业务含义 (例如，它只知道更新 `parsingStatus` 字段，但不知道 "parsing" 是什么意思)。
 *
 * ➡️ 这是一个低阶服务，专注于 "如何读写数据库"。
 */

import { db, LibraryItem, LiteratureTree } from './index';
import { LibraryItemSchema, ParsingStatusEnum } from './schema';
import { generateLibraryItemId } from '../utils/uuid';

type ParsingStatus = typeof ParsingStatusEnum[number];

export class LibraryService {
  private db = db;

  /**
   * Get all library items
   */
  async getAllLibraryItems(): Promise<LibraryItem[]> {
    try {
      const items = await this.db.library.orderBy('createdAt').reverse().toArray();
      return items;
    } catch (error) {
      console.error('Error getting all library items:', error);
      throw new Error('Failed to fetch library items');
    }
  }

  /**
   * Get library item by ID
   */
  async getLibraryItemById(id: string): Promise<LibraryItem | null> {
    try {
      const item = await this.db.library.get(id);
      return item || null;
    } catch (error) {
      console.error('Error getting library item by ID:', error);
      throw new Error('Failed to fetch library item');
    }
  }

  /**
   * Check for duplicate literature by title
   */
  async checkDuplicateByTitle(title: string): Promise<LibraryItem[]> {
    try {
      const duplicates = await this.db.library
        .where('title')
        .equalsIgnoreCase(title.trim())
        .toArray();
      return duplicates;
    } catch (error) {
      console.error('Error checking duplicates:', error);
      throw new Error('Failed to check duplicates');
    }
  }

  /**
   * Add new library item with duplicate check
   */
  async addLibraryItem(item: LibraryItem): Promise<{ success: boolean; duplicate?: LibraryItem[] }> {
    try {
      // Validate the item
      const validatedItem = LibraryItemSchema.parse(item);

      // Check for duplicates
      const duplicates = await this.checkDuplicateByTitle(validatedItem.title);

      if (duplicates.length > 0) {
        return {
          success: false,
          duplicate: duplicates
        };
      }

      // Add to database
      await this.db.library.add(validatedItem as LibraryItem);
      return { success: true };
    } catch (error) {
      console.error('Error adding library item:', error);
      throw new Error('Failed to add library item');
    }
  }

  /**
   * Update library item
   */
  async updateLibraryItem(id: string, updates: Partial<LibraryItem>): Promise<void> {
    try {
      const existingItem = await this.getLibraryItemById(id);
      if (!existingItem) {
        throw new Error(`Library item with ID ${id} not found`);
      }

      const updatedItem: LibraryItem = {
        ...existingItem,
        ...updates,
        updatedAt: new Date()
      };

      // Validate the updated item
      const validatedItem = LibraryItemSchema.parse(updatedItem);

      // Update in database
      await this.db.library.update(id, validatedItem);
    } catch (error) {
      console.error('Error updating library item:', error);
      throw new Error('Failed to update library item');
    }
  }

  /**
   * Delete library item
   */
  async deleteLibraryItem(id: string): Promise<void> {
    try {
      const count = await this.db.library.where('id').equals(id).delete();
      if (count === 0) {
        throw new Error(`Library item with ID ${id} not found`);
      }
    } catch (error) {
      console.error('Error deleting library item:', error);
      throw new Error('Failed to delete library item');
    }
  }

  /**
   * Bulk delete library items
   */
  async bulkDeleteLibraryItems(ids: string[]): Promise<void> {
    try {
      await this.db.library.where('id').anyOf(ids).delete();
    } catch (error) {
      console.error('Error bulk deleting library items:', error);
      throw new Error('Failed to delete library items');
    }
  }

  /**
   * Search library items
   */
  async searchLibraryItems(query: string): Promise<LibraryItem[]> {
    try {
      const lowerQuery = query.toLowerCase();

      const items = await this.db.library
        .filter(item => {
          const titleMatch = item.title.toLowerCase().includes(lowerQuery);
          const authorMatch = item.authors.some(author => author.toLowerCase().includes(lowerQuery));
          const publicationMatch = Boolean(item.publication && item.publication.toLowerCase().includes(lowerQuery));
          const abstractMatch = Boolean(item.abstract && item.abstract.toLowerCase().includes(lowerQuery));

          return titleMatch || authorMatch || publicationMatch || abstractMatch;
        })
        .toArray();

      return items;
    } catch (error) {
      console.error('Error searching library items:', error);
      throw new Error('Failed to search library items');
    }
  }

  /**
   * Get items by source
   */
  async getItemsBySource(source: string): Promise<LibraryItem[]> {
    try {
      const items = await this.db.library.where('source').equals(source).toArray();
      return items;
    } catch (error) {
      console.error('Error getting items by source:', error);
      throw new Error('Failed to fetch items by source');
    }
  }

  /**
   * Get items by year range
   */
  async getItemsByYearRange(startYear: number, endYear: number): Promise<LibraryItem[]> {
    try {
      const items = await this.db.library
        .where('year')
        .between(startYear, endYear, true, true)
        .toArray();
      return items;
    } catch (error) {
      console.error('Error getting items by year range:', error);
      throw new Error('Failed to fetch items by year range');
    }
  }

  /**
   * Get all literature trees
   */
  async getAllTrees(): Promise<LiteratureTree[]> {
    try {
      const trees = await this.db.literatureTrees.orderBy('createdAt').reverse().toArray();
      return trees;
    } catch (error) {
      console.error('Error getting all literature trees:', error);
      throw new Error('Failed to fetch literature trees');
    }
  }

  /**
   * Get literature tree by ID
   */
  async getTreeById(id: string): Promise<LiteratureTree | null> {
    try {
      const tree = await this.db.literatureTrees.get(id);
      return tree || null;
    } catch (error) {
      console.error('Error getting literature tree by ID:', error);
      throw new Error('Failed to fetch literature tree');
    }
  }

  /**
   * Save literature tree
   */
  async saveTree(tree: LiteratureTree): Promise<void> {
    try {
      await this.db.literatureTrees.put(tree);
    } catch (error) {
      console.error('Error saving literature tree:', error);
      throw new Error('Failed to save literature tree');
    }
  }

  /**
   * Delete literature tree
   */
  async deleteTree(id: string): Promise<void> {
    try {
      const count = await this.db.literatureTrees.where('id').equals(id).delete();
      if (count === 0) {
        throw new Error(`Literature tree with ID ${id} not found`);
      }
    } catch (error) {
      console.error('Error deleting literature tree:', error);
      throw new Error('Failed to delete literature tree');
    }
  }

  /**
   * Export library items as JSON
   */
  async exportLibraryAsJSON(): Promise<string> {
    try {
      const items = await this.getAllLibraryItems();
      return JSON.stringify(items, null, 2);
    } catch (error) {
      console.error('Error exporting library as JSON:', error);
      throw new Error('Failed to export library');
    }
  }

  /**
   * Import library items from JSON
   */
  async importLibraryFromJSON(jsonData: string): Promise<{ added: number; errors: string[] }> {
    const result = { added: 0, errors: [] as string[] };

    try {
      const items = JSON.parse(jsonData) as LibraryItem[];

      if (!Array.isArray(items)) {
        throw new Error('Invalid JSON format: expected array of items');
      }

      for (const item of items) {
        try {
          // Generate new ID to avoid conflicts
          const itemWithNewId: LibraryItem = {
            ...item,
            id: generateLibraryItemId(),
            createdAt: new Date(item.createdAt),
            updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
          };

          await this.addLibraryItem(itemWithNewId);
          result.added++;
        } catch (error) {
          result.errors.push(`Failed to import item "${item.title}": ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Import failed: ${error}`);
    }

    return result;
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    totalItems: number;
    totalTrees: number;
    itemsBySource: Record<string, number>;
    itemsByYear: Record<number, number>;
  }> {
    try {
      const [items, trees] = await Promise.all([
        this.getAllLibraryItems(),
        this.getAllTrees()
      ]);

      const itemsBySource: Record<string, number> = {};
      const itemsByYear: Record<number, number> = {};

      items.forEach(item => {
        const source = item.source || 'unknown';
        itemsBySource[source] = (itemsBySource[source] || 0) + 1;

        itemsByYear[item.year] = (itemsByYear[item.year] || 0) + 1;
      });

      return {
        totalItems: items.length,
        totalTrees: trees.length,
        itemsBySource,
        itemsByYear
      };
    } catch (error) {
      console.error('Error getting statistics:', error);
      throw new Error('Failed to get statistics');
    }
  }

  /**
   * Clear all data (use with caution)
   */
  async clearAllData(): Promise<void> {
    try {
      await Promise.all([
        this.db.library.clear(),
        this.db.literatureTrees.clear()
      ]);
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw new Error('Failed to clear data');
    }
  }

  /**
   * Get citation relationships for an item
   */
  async getCitationRelationships(itemId: string): Promise<{
    references: LibraryItem[];
    citedBy: LibraryItem[];
  }> {
    try {
      // Get references (items this item cites)
      const referenceCitations = await this.db.citations
        .where('sourceItemId')
        .equals(itemId)
        .toArray();

      const references = await Promise.all(
        referenceCitations.map(citation => this.db.library.get(citation.targetItemId))
      );

      // Get cited by (items that cite this item)
      const citedByCitations = await this.db.citations
        .where('targetItemId')
        .equals(itemId)
        .toArray();

      const citedBy = await Promise.all(
        citedByCitations.map(citation => this.db.library.get(citation.sourceItemId))
      );

      return {
        references: references.filter(Boolean) as LibraryItem[],
        citedBy: citedBy.filter(Boolean) as LibraryItem[]
      };
    } catch (error) {
      console.error('Error getting citation relationships:', error);
      throw new Error('Failed to get citation relationships');
    }
  }

  /**
   * 🔗 自动化引文链接：为指定文献条目自动链接其参考文献
   * 触发时机：在文献解析流程成功之后调用
   */
  async linkCitationsForItem(itemId: string): Promise<{
    totalReferences: number;
    linkedCount: number;
    unlinkedCount: number;
    linkedItems: Array<{ reference: any; linkedItem: LibraryItem }>;
  }> {
    try {
      const item = await this.getLibraryItemById(itemId);
      if (!item || !item.parsedContent?.extractedReferences) {
        return { totalReferences: 0, linkedCount: 0, unlinkedCount: 0, linkedItems: [] };
      }

      const references = item.parsedContent.extractedReferences;
      const linkedItems: Array<{ reference: any; linkedItem: LibraryItem }> = [];
      let linkedCount = 0;

      for (const reference of references) {
        const matchedItem = await this.findMatchingLiterature(reference);
        if (matchedItem) {
          // 检查是否已存在链接，避免重复
          const existingLink = await this.db.citations
            .where(['sourceItemId', 'targetItemId'])
            .equals([itemId, matchedItem.id])
            .first();

          if (!existingLink) {
            await this.db.citations.add({
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
   * 🔍 智能匹配：在文献库中查找与给定引文匹配的条目
   * 匹配策略：
   * 1. DOI 精确匹配（优先级最高）
   * 2. 标题 + 作者 + 年份模糊匹配
   */
  async findMatchingLiterature(reference: any): Promise<LibraryItem | null> {
    try {
      // 策略一：DOI 精确匹配
      if (reference.doi) {
        const doiMatch = await this.db.library
          .where('doi')
          .equals(reference.doi.trim())
          .first();
        if (doiMatch) {
          return doiMatch;
        }
      }

      // 策略二：模糊匹配
      if (reference.title) {
        const allItems = await this.db.library.toArray();
        const scoredMatches = allItems
          .map(item => ({
            item,
            score: this.calculateMatchScore(reference, item)
          }))
          .filter(match => match.score > 0.7) // 只考虑相似度超过70%的匹配
          .sort((a, b) => b.score - a.score);

        if (scoredMatches.length > 0) {
          return scoredMatches[0].item;
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding matching literature:', error);
      return null;
    }
  }

  /**
   * 📊 计算引文与文献条目的匹配分数
   * 综合考虑标题、作者和年份的相似度
   */
  private calculateMatchScore(reference: any, item: LibraryItem): number {
    let score = 0;
    let factors = 0;

    // 标题相似度（权重：0.5）
    if (reference.title && item.title) {
      const titleSimilarity = this.calculateStringSimilarity(
        reference.title.toLowerCase().trim(),
        item.title.toLowerCase().trim()
      );
      score += titleSimilarity * 0.5;
      factors += 0.5;
    }

    // 作者相似度（权重：0.3）
    if (reference.authors && item.authors && reference.authors.length > 0) {
      const authorSimilarity = this.calculateAuthorSimilarity(reference.authors, item.authors);
      score += authorSimilarity * 0.3;
      factors += 0.3;
    }

    // 年份匹配（权重：0.2）
    if (reference.year && item.year) {
      const yearMatch = Math.abs(reference.year - item.year) <= 1 ? 1 : 0;
      score += yearMatch * 0.2;
      factors += 0.2;
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * 📝 计算两个字符串的相似度（简化版 Jaro-Winkler）
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    // 移除标点符号和多余空格，进行标准化
    const normalize = (s: string) => s.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const s1 = normalize(str1);
    const s2 = normalize(str2);

    if (s1 === s2) return 1;

    // 计算最长公共子序列的长度比例
    const lcs = this.longestCommonSubsequence(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    return lcs / maxLength;
  }

  /**
   * 👥 计算作者列表的相似度
   */
  private calculateAuthorSimilarity(authors1: string[], authors2: string[]): number {
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
   * 📋 获取指定文献的未链接引文列表
   */
  async getUnlinkedReferences(itemId: string): Promise<any[]> {
    try {
      const item = await this.getLibraryItemById(itemId);
      if (!item || !item.parsedContent?.extractedReferences) {
        return [];
      }

      const { references: linkedReferences } = await this.getCitationRelationships(itemId);
      const linkedTitles = new Set(linkedReferences.map(ref => ref.title.toLowerCase().trim()));

      // 返回尚未链接的引文
      return item.parsedContent.extractedReferences.filter(ref => {
        if (!ref.title) return true;
        return !linkedTitles.has(ref.title.toLowerCase().trim());
      });
    } catch (error) {
      console.error('Error getting unlinked references:', error);
      throw new Error('Failed to get unlinked references');
    }
  }

  /**
   * 🔗 手动创建引文链接
   */
  async createCitationLink(sourceItemId: string, targetItemId: string): Promise<boolean> {
    try {
      // 检查是否已存在链接
      const existingLink = await this.db.citations
        .where(['sourceItemId', 'targetItemId'])
        .equals([sourceItemId, targetItemId])
        .first();

      if (existingLink) {
        return false; // 已存在，不重复创建
      }

      await this.db.citations.add({
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
      const count = await this.db.citations
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
   * 🔄 核心双向链接逻辑: 当新文献添加时，自动与整个库进行双向关联
   * @param newItemId - 新添加的文献ID
   */
  async linkNewItemBidirectionally(newItemId: string): Promise<{ forwardLinks: number; backwardLinks: number }> {
    console.log(`[Linker] Starting bidirectional linking for new item: ${newItemId}`);
    const newItem = await this.getLibraryItemById(newItemId);
    if (!newItem) {
      console.error(`[Linker] New item ${newItemId} not found.`);
      return { forwardLinks: 0, backwardLinks: 0 };
    }

    let forwardLinks = 0;
    let backwardLinks = 0;

    // 1. 正向链接 (新文献 -> 引用 -> 旧文献)
    if (newItem.parsedContent?.extractedReferences) {
      for (const reference of newItem.parsedContent.extractedReferences) {
        const matchedItem = await this.findMatchingLiterature(reference);
        if (matchedItem) {
          const created = await this.createCitationLink(newItem.id, matchedItem.id);
          if (created) forwardLinks++;
        }
      }
    }
    console.log(`[Linker] Forward links created: ${forwardLinks}`);

    // 2. 反向链接 (旧文献 -> 引用 -> 新文献)
    const allOtherItems = await this.db.library.where('id').notEqual(newItemId).toArray();
    for (const existingItem of allOtherItems) {
      if (existingItem.parsedContent?.extractedReferences) {
        for (const reference of existingItem.parsedContent.extractedReferences) {
          // 使用我们强大的匹配算法，检查旧文献的引文是否与新文献匹配
          const score = this.calculateMatchScore(reference, newItem);
          if (score > 0.7) { // 使用和 findMatchingLiterature 相同的阈值
            const created = await this.createCitationLink(existingItem.id, newItem.id);
            if (created) backwardLinks++;
          }
        }
      }
    }
    console.log(`[Linker] Backward links created: ${backwardLinks}`);

    return { forwardLinks, backwardLinks };
  }

  /**
   * 🌐 获取所有引文链接 - 用于全局图谱
   */
  async getAllCitations(): Promise<Array<{ source: string; target: string }>> {
    try {
      const allLinks = await this.db.citations.toArray();
      return allLinks.map(link => ({
        source: link.sourceItemId,
        target: link.targetItemId
      }));
    } catch (error) {
      console.error('Error getting all citations:', error);
      throw new Error('Failed to get all citations');
    }
  }

  /**
   * ➕ 为指定文献添加新的引文信息
   * @param itemId - 文献ID
   * @param newReference - 新的引文数据
   * @returns Promise<boolean> - 是否添加成功
   */
  async addExtractedReference(itemId: string, newReference: any): Promise<boolean> {
    try {
      const item = await this.getLibraryItemById(itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      // 确保 parsedContent 和 extractedReferences 存在
      const currentParsedContent = item.parsedContent || {};
      const currentReferences = currentParsedContent.extractedReferences || [];

      // 添加新引文到数组末尾
      const updatedReferences = [
        ...currentReferences,
        {
          ...newReference,
          addedAt: new Date()
        }
      ];

      // 更新文献项
      const updatedParsedContent = {
        ...currentParsedContent,
        extractedReferences: updatedReferences
      };

      await this.updateLibraryItem(itemId, {
        parsedContent: updatedParsedContent
      });

      console.log(`[LibraryService] Added new reference to item ${itemId}`);
      return true;
    } catch (error) {
      console.error('Error adding extracted reference:', error);
      throw new Error('Failed to add extracted reference');
    }
  }

  /**
   * ✏️ 更新指定文献的某一条引文信息
   * @param itemId - 文献ID
   * @param referenceIndex - 引文在数组中的索引
   * @param updatedReference - 更新后的引文数据
   * @returns Promise<boolean> - 是否更新成功
   */
  async updateExtractedReference(itemId: string, referenceIndex: number, updatedReference: any): Promise<boolean> {
    try {
      const item = await this.getLibraryItemById(itemId);
      if (!item || !item.parsedContent?.extractedReferences) {
        throw new Error('Item not found or has no extracted references');
      }

      const references = item.parsedContent.extractedReferences;
      if (referenceIndex < 0 || referenceIndex >= references.length) {
        throw new Error('Reference index out of bounds');
      }

      // 创建新的引文数组，替换指定索引的引文
      const updatedReferences = [...references];
      updatedReferences[referenceIndex] = {
        ...references[referenceIndex],
        ...updatedReference,
        // 添加编辑时间戳
        lastEditedAt: new Date()
      };

      // 更新文献项 - 确保正确更新 parsedContent
      const updatedParsedContent = {
        ...item.parsedContent,
        extractedReferences: updatedReferences
      };

      await this.updateLibraryItem(itemId, {
        parsedContent: updatedParsedContent
      });

      console.log(`[LibraryService] Updated reference ${referenceIndex} for item ${itemId}`);
      return true;
    } catch (error) {
      console.error('Error updating extracted reference:', error);
      throw new Error('Failed to update extracted reference');
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
        this.getLibraryItemById(sourceItemId),
        this.getLibraryItemById(targetItemId)
      ]);

      if (!sourceItem || !targetItem) {
        throw new Error('One or both items not found');
      }

      // 防止自引用
      if (sourceItemId === targetItemId) {
        throw new Error('Cannot create citation link from item to itself');
      }

      // 检查是否已存在链接
      const existingLink = await this.db.citations
        .where(['sourceItemId', 'targetItemId'])
        .equals([sourceItemId, targetItemId])
        .first();

      if (existingLink) {
        console.log(`[LibraryService] Citation link already exists: ${sourceItemId} -> ${targetItemId}`);
        return false; // 已存在，不重复创建
      }

      // 创建新的引文链接
      await this.db.citations.add({
        sourceItemId,
        targetItemId,
        createdAt: new Date()
      });

      console.log(`[LibraryService] Created manual citation link: ${sourceItem.title} -> ${targetItem.title}`);
      return true; // 成功创建
    } catch (error) {
      console.error('Error creating manual citation link:', error);
      throw new Error('Failed to create manual citation link');
    }
  }

  /**
   * 🔄 同步后端数据到本地缓存
   * 用于在获取后端数据后，更新本地数据库缓存
   * @param backendItems - 从后端获取的文献数据数组
   */
  async syncItemsFromBackend(backendItems: LibraryItem[]): Promise<void> {
    try {
      console.log(`📦 [LibraryService] Syncing ${backendItems.length} items from backend to local cache...`);

      // 清空本地库，然后添加后端数据（完全同步策略）
      // 注意：这是一个简化的同步策略，生产环境可能需要更复杂的增量同步
      await this.db.library.clear();

      // 批量添加后端数据
      for (const item of backendItems) {
        try {
          // 验证数据格式
          const validatedItem = LibraryItemSchema.parse(item);
          await this.db.library.add(validatedItem as LibraryItem);
        } catch (validationError) {
          console.warn(`⚠️ Skipping invalid item during sync: ${item.title}`, validationError);
        }
      }

      console.log(`✅ [LibraryService] Successfully synced ${backendItems.length} items to local cache`);
    } catch (error) {
      console.error('❌ [LibraryService] Error syncing items from backend:', error);
      throw new Error('Failed to sync items from backend to local cache');
    }
  }
}

// Export singleton instance
export const libraryService = new LibraryService();