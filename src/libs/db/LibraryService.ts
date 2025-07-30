/**
 * 📚 LibraryService - 文献数据库服务 (数据访问层) - 重构版本
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
 * 🔄 重构变化:
 * - 智能匹配功能已提取到独立的 matching 模块
 * - 引文链接功能通过 CitationLinker 提供
 * - 保持向后兼容性，提供相同的API接口
 *
 * ➡️ 这是一个低阶服务，专注于 "如何读写数据库"。
 */

import { db, LibraryItem, LiteratureTree } from './index';
import { LibraryItemSchema } from './schema';
import { generateLibraryItemId } from '../utils/uuid';
import { z } from 'zod';

// Import smart matching functionality
import {
  matchingEngine,
  citationLinker,
  referenceExtractor,
  smartMatching
} from './matching';
import type { CitationLinkResult, BidirectionalLinkResult } from './matching';

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
   * 🔒 私有方法：智能添加或更新文献（仅供API层调用）
   * 
   * 🎯 核心功能：
   * - 自动智能查重（复用现有MatchingEngine）
   * - 检测到重复时自动智能合并
   * - 确保数据一致性和完整性
   * 
   * @param literatureData 文献数据
   * @returns 最终文献ID
   */
  private async addOrUpdateLiteratureWithDuplicateCheck(
    literatureData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      console.log('🔍 [LibraryService] Starting intelligent duplicate check and merge process');

      // 🔍 Step 1: 复用现有成熟MatchingEngine进行智能查重
      const existingItem = await matchingEngine.findItemByUrlOrDoi(
        literatureData.url || undefined,
        literatureData.doi || undefined,
        literatureData.title,
        literatureData.authors,
        literatureData.year
      );

      if (existingItem) {
        console.log(`🤝 [LibraryService] Found duplicate item, performing intelligent merge: ${existingItem.title}`);

        // 🤝 Step 2: 智能合并（合并新数据到现有项）
        const mergedData = await this.intelligentMerge(existingItem, literatureData);

        // 📝 Step 3: 更新现有项
        await this.updateLibraryItem(existingItem.id, mergedData);

        console.log(`✅ [LibraryService] Successfully merged with existing item: ${existingItem.id}`);
        return existingItem.id;
      } else {
        // 📚 Step 4: 创建新文献项
        console.log('📚 [LibraryService] No duplicate found, creating new literature item');

        // 🔒 最终防御性检查：确保 authors 不为空
        const safeData = { ...literatureData };
        if (!safeData.authors || safeData.authors.length === 0) {
          console.warn('⚠️ [LibraryService] Authors array is empty in addOrUpdateLiteratureWithDuplicateCheck, applying fallback');
          safeData.authors = ['Unknown Author'];
        }

        console.log('🔍 [LibraryService] Final data check before creation:', {
          title: safeData.title,
          authors: safeData.authors,
          authorsCount: safeData.authors?.length,
          year: safeData.year
        });

        const newItem: LibraryItem = {
          id: generateLibraryItemId(),
          ...safeData,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await this.addLibraryItem(newItem);

        console.log(`✅ [LibraryService] Successfully created new item: ${newItem.id}`);
        return newItem.id;
      }
    } catch (error) {
      console.error('❌ [LibraryService] Error in addOrUpdateLiteratureWithDuplicateCheck:', error);
      throw error;
    }
  }

  /**
   * 🤝 私有方法：智能合并文献数据
   * 
   * 合并策略：
   * - 优先保留更完整的数据（非空字段）
   * - DOI和URL：新数据优先（假设更准确）
   * - 元数据：合并作者列表，选择更完整的标题
   * - 内容：保留已有解析内容，补充缺失信息
   */
  private async intelligentMerge(
    existingItem: LibraryItem,
    newData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Partial<LibraryItem>> {
    const mergedData: Partial<LibraryItem> = {
      updatedAt: new Date()
    };

    // 🔗 DOI和URL：新数据优先（假设更准确）
    if (newData.doi && newData.doi !== existingItem.doi) {
      mergedData.doi = newData.doi;
      console.log(`🔗 [Merge] Updated DOI: ${existingItem.doi} → ${newData.doi}`);
    }

    if (newData.url && newData.url !== existingItem.url) {
      mergedData.url = newData.url;
      console.log(`🔗 [Merge] Updated URL: ${existingItem.url} → ${newData.url}`);
    }

    // 📝 标题：选择更完整的（长度更长且不是临时标题）
    if (newData.title &&
      newData.title.length > existingItem.title.length &&
      !newData.title.startsWith('Processing: ') &&
      !existingItem.title.startsWith('Processing: ')) {
      mergedData.title = newData.title;
      console.log(`📝 [Merge] Updated title: ${existingItem.title} → ${newData.title}`);
    }

    // 👥 作者：合并作者列表，去重
    if (newData.authors && newData.authors.length > 0) {
      const existingAuthors = existingItem.authors || [];
      const newAuthors = newData.authors.filter(author =>
        author !== 'Unknown Author' &&
        !existingAuthors.includes(author)
      );

      if (newAuthors.length > 0) {
        mergedData.authors = [...existingAuthors, ...newAuthors];
        console.log(`👥 [Merge] Merged authors: ${existingAuthors.length} + ${newAuthors.length} = ${mergedData.authors.length}`);
      }
    }

    // 📅 年份：选择更准确的（非空且合理范围）
    if (newData.year && newData.year !== existingItem.year && newData.year > 1900 && newData.year <= new Date().getFullYear() + 5) {
      mergedData.year = newData.year;
      console.log(`📅 [Merge] Updated year: ${existingItem.year} → ${newData.year}`);
    }

    // 📚 期刊/出版物：选择更完整的
    if (newData.publication && (!existingItem.publication || newData.publication.length > existingItem.publication.length)) {
      mergedData.publication = newData.publication;
      console.log(`📚 [Merge] Updated publication: ${existingItem.publication} → ${newData.publication}`);
    }

    // 📄 摘要：选择更完整的
    if (newData.abstract && (!existingItem.abstract || newData.abstract.length > existingItem.abstract.length)) {
      mergedData.abstract = newData.abstract;
      console.log(`📄 [Merge] Updated abstract: ${existingItem.abstract?.substring(0, 50)}... → ${newData.abstract.substring(0, 50)}...`);
    }

    // 🔍 解析内容：合并引用文献，保留解析文本
    if (newData.parsedContent) {
      const existingParsed = existingItem.parsedContent || {};
      const newParsed = newData.parsedContent;

      mergedData.parsedContent = {
        // 保留现有解析文本，除非新的更完整
        extractedText: newParsed.extractedText && newParsed.extractedText.length > (existingParsed.extractedText?.length || 0)
          ? newParsed.extractedText
          : existingParsed.extractedText,

        // 合并引用文献列表
        extractedReferences: [
          ...(existingParsed.extractedReferences || []),
          ...(newParsed.extractedReferences || [])
        ].filter((ref, index, arr) =>
          // 简单去重：基于引用文本
          arr.findIndex(r => JSON.stringify(r) === JSON.stringify(ref)) === index
        )
      };

      console.log(`🔍 [Merge] Merged parsed content: ${(existingParsed.extractedReferences?.length || 0)} + ${(newParsed.extractedReferences?.length || 0)} references`);
    }

    // 🏷️ 主题标签：合并去重
    if (newData.topics && newData.topics.length > 0) {
      const existingTopics = existingItem.topics || [];
      const newTopics = newData.topics.filter(topic => !existingTopics.includes(topic));

      if (newTopics.length > 0) {
        mergedData.topics = [...existingTopics, ...newTopics];
        console.log(`🏷️ [Merge] Merged topics: ${existingTopics.length} + ${newTopics.length} = ${mergedData.topics.length}`);
      }
    }

    // 🔄 后端任务：保留最新的任务信息
    if (newData.backendTask) {
      mergedData.backendTask = newData.backendTask;
      console.log(`🔄 [Merge] Updated backend task: ${newData.backendTask.task_id}`);
    }

    // 🔒 最终验证：确保authors不为空
    if (!mergedData.authors || mergedData.authors.length === 0) {
      console.warn('⚠️ [LibraryService] Merged data has empty authors, applying fallback');
      mergedData.authors = ['Unknown Author'];
    }

    console.log(`🤝 [LibraryService] Intelligent merge completed with ${Object.keys(mergedData).length} field updates`);
    console.log(`🔍 [LibraryService] Final merged authors: ${mergedData.authors}`);
    return mergedData;
  }

  /**
   * 🎯 判断是否需要触发查重检查
   * 
   * 仅在DOI、URL、Title发生变化时触发，减少不必要的查重开销
   */
  private shouldCheckDuplicate(
    oldData: LibraryItem,
    newData: Partial<LibraryItem>
  ): boolean {
    return !!(
      (newData.doi && newData.doi !== oldData.doi) ||
      (newData.url && newData.url !== oldData.url) ||
      (newData.title && newData.title !== oldData.title && !newData.title.startsWith('Processing: '))
    );
  }

  /**
   * 🌟 公开方法：从API层智能添加或更新文献
   * 
   * 这是API层的入口点，内部会调用私有的智能查重和合并方法
   * 
   * @param literatureData 文献数据  
   * @returns 最终文献ID
   */
  async addOrUpdateFromAPI(
    literatureData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    return await this.addOrUpdateLiteratureWithDuplicateCheck(literatureData);
  }

  /**
   * 🔄 公开方法：更新现有文献（带智能查重）
   * 
   * 当更新现有文献时，如果关键字段（DOI、URL、Title）发生变化，
   * 会触发查重检查，避免产生重复项
   * 
   * @param id 文献ID
   * @param updateData 更新数据
   */
  async updateWithDuplicateCheck(id: string, updateData: Partial<LibraryItem>): Promise<void> {
    try {
      // 获取现有数据
      const existingItem = await this.getLibraryItemById(id);
      if (!existingItem) {
        throw new Error(`Library item not found: ${id}`);
      }

      // 检查是否需要查重
      if (this.shouldCheckDuplicate(existingItem, updateData)) {
        console.log('🔍 [LibraryService] Key fields changed, performing duplicate check');

        // 构造完整的数据进行查重
        const fullData = { ...existingItem, ...updateData };
        const potentialDuplicate = await matchingEngine.findItemByUrlOrDoi(
          fullData.url || undefined,
          fullData.doi || undefined,
          fullData.title,
          fullData.authors,
          fullData.year
        );

        // 如果找到重复项且不是自己
        if (potentialDuplicate && potentialDuplicate.id !== id) {
          console.log(`🤝 [LibraryService] Found duplicate during update, merging items: ${potentialDuplicate.id}`);

          // 将更新数据合并到找到的重复项
          const mergedData = await this.intelligentMerge(potentialDuplicate, { ...existingItem, ...updateData });
          await this.updateLibraryItem(potentialDuplicate.id, mergedData);

          // 删除原始项（已合并到重复项）
          await this.deleteLibraryItem(id);

          // console.log(`✅ [LibraryService] Successfully merged items: ${id} → ${potentialDuplicate.id}`);
          return;
        }
      }

      // 没有重复，正常更新
      await this.updateLibraryItem(id, { ...updateData, updatedAt: new Date() });
      // console.log(`✅ [LibraryService] Successfully updated item: ${id}`);

    } catch (error) {
      console.error(`❌ [LibraryService] Error in updateWithDuplicateCheck:`, error);
      throw error;
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
   * Find library item by URL or DOI
   * 📝 重构说明：使用独立的MatchingEngine模块
   */
  async findItemByUrlOrDoi(url?: string, doi?: string): Promise<LibraryItem | null> {
    return await matchingEngine.findItemByUrlOrDoi(url, doi);
  }

  /**
   * Add new library item with duplicate check
   * 此为底层方法，若要添加文献，请使用masterAddLiterature()，带有自动的duplicate check，解析，更新等功能
   */
  async addLibraryItem(item: LibraryItem): Promise<string> {
    try {
      // ✅ 添加调试信息和详细的Zod验证错误处理
      console.log('📝 [LibraryService] Validating item before adding:', {
        id: item.id,
        title: item.title,
        authors: item.authors,
        authorsLength: item.authors?.length,
        year: item.year,
        url: item.url,
        createdAt: item.createdAt,
        hasRequiredFields: Boolean(item.id && item.title && item.authors && item.year && item.createdAt)
      });

      const validatedItem = LibraryItemSchema.parse(item);
      const id = await this.db.library.add(validatedItem as LibraryItem);
      console.log('[LibraryService] Added literature item:', validatedItem.title);
      return String(id);
    } catch (error) {
      // 🐞 详细的Zod错误处理
      if (error instanceof z.ZodError) {
        console.error('❌ [LibraryService] Zod validation error:', {
          issues: error.issues,
          formattedErrors: error.format(),
          path: error.issues.map(issue => issue.path),
          messages: error.issues.map(issue => issue.message)
        });
        throw new Error(`Data validation failed: ${error.issues.map(issue => `${issue.path.join('.')} - ${issue.message}`).join('; ')}`);
      }

      console.error('[LibraryService] Failed to add library item:', error);
      throw error;
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
   * Delete library item and all related citations
   */
  async deleteLibraryItem(id: string): Promise<void> {
    try {
      // 🗑️ 首先删除所有相关的引用关系
      console.log(`🗑️ Deleting all citations related to item: ${id}`);

      // 删除该文献作为源头的引用 (sourceItemId)
      const sourceCount = await this.db.citations.where('sourceItemId').equals(id).delete();
      console.log(`🗑️ Deleted ${sourceCount} citations where this item was the source`);

      // 删除该文献作为目标的引用 (targetItemId)
      const targetCount = await this.db.citations.where('targetItemId').equals(id).delete();
      console.log(`🗑️ Deleted ${targetCount} citations where this item was the target`);

      // 🗑️ 最后删除文献本身
      const count = await this.db.library.where('id').equals(id).delete();
      if (count === 0) {
        throw new Error(`Library item with ID ${id} not found`);
      }

      console.log(`✅ Successfully deleted literature item and ${sourceCount + targetCount} related citations`);
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
   * 🏷️ Topics 管理功能
   */

  /**
   * 为文献添加topic标签
   */
  async addTopicToItem(itemId: string, topic: string): Promise<void> {
    try {
      const item = await this.getLibraryItemById(itemId);
      if (!item) {
        throw new Error(`Library item with ID ${itemId} not found`);
      }

      const currentTopics = item.topics || [];
      if (!currentTopics.includes(topic)) {
        const updatedTopics = [...currentTopics, topic];
        await this.updateLibraryItem(itemId, { topics: updatedTopics });
        console.log(`[LibraryService] Added topic "${topic}" to item ${itemId}`);
      } else {
        console.log(`[LibraryService] Topic "${topic}" already exists for item ${itemId}`);
      }
    } catch (error) {
      console.error('Error adding topic to item:', error);
      throw new Error('Failed to add topic to item');
    }
  }

  /**
   * 合并topics数组，去重处理
   */
  mergeTopics(existingTopics: string[] = [], newTopic: string): string[] {
    const topicsSet = new Set([...existingTopics, newTopic]);
    return Array.from(topicsSet);
  }

  /**
   * 根据topic查找文献
   */
  async getItemsByTopic(topic: string): Promise<LibraryItem[]> {
    try {
      const items = await this.db.library
        .filter(item => !!(item.topics && item.topics.includes(topic)))
        .toArray();
      return items;
    } catch (error) {
      console.error('Error getting items by topic:', error);
      throw new Error('Failed to fetch items by topic');
    }
  }

  // ==============================================
  // 📚 Literature Trees Management
  // ==============================================

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

  // ==============================================
  // 📤 Import/Export functionality
  // ==============================================

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

  // ==============================================
  // 🔗 Citation Management (Delegated to CitationLinker)
  // ==============================================

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
   * 📝 重构说明：使用独立的CitationLinker模块
   */
  async linkCitationsForItem(itemId: string): Promise<CitationLinkResult> {
    return await citationLinker.linkCitationsForItem(itemId);
  }

  /**
   * 🔄 核心双向链接逻辑: 当新文献添加时，自动与整个库进行双向关联
   * 📝 重构说明：使用独立的CitationLinker模块
   */
  async linkNewItemBidirectionally(newItemId: string): Promise<BidirectionalLinkResult> {
    return await citationLinker.linkNewItemBidirectionally(newItemId);
  }

  /**
   * 🔗 手动创建引文链接
   * 📝 重构说明：使用独立的CitationLinker模块
   */
  async createCitationLink(sourceItemId: string, targetItemId: string): Promise<boolean> {
    return await citationLinker.createCitationLink(sourceItemId, targetItemId);
  }

  /**
   * 🗑️ 删除引文链接
   * 📝 重构说明：使用独立的CitationLinker模块
   */
  async deleteCitationLink(sourceItemId: string, targetItemId: string): Promise<void> {
    return await citationLinker.deleteCitationLink(sourceItemId, targetItemId);
  }

  /**
   * 🔗 手动创建引文链接 - 支持图谱交互
   * 📝 重构说明：使用独立的CitationLinker模块
   */
  async createManualCitationLink(sourceItemId: string, targetItemId: string): Promise<boolean> {
    return await citationLinker.createManualCitationLink(sourceItemId, targetItemId);
  }

  /**
   * 🌐 获取所有引文链接 - 用于全局图谱
   * 📝 重构说明：使用独立的CitationLinker模块
   */
  async getAllCitations(): Promise<Array<{ source: string; target: string }>> {
    return await citationLinker.getAllCitations();
  }

  // ==============================================
  // 🔍 Smart Matching (Delegated to MatchingEngine)
  // ==============================================

  /**
   * 🔍 智能匹配：在文献库中查找与给定引文匹配的条目
   * 📝 重构说明：使用独立的MatchingEngine模块
   */
  async findMatchingLiterature(reference: any, sourceItemId?: string): Promise<LibraryItem | null> {
    return await matchingEngine.findMatchingLiterature(reference, sourceItemId);
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

      // 🔍 处理嵌套结构的引文数据，返回格式化的未链接引文
      return item.parsedContent.extractedReferences
        .map(ref => {
          const extractedData = referenceExtractor.extractReferenceData(ref);
          return {
            ...ref, // 保留原始数据
            // 添加提取的扁平化数据，便于UI显示
            title: extractedData.title,
            authors: extractedData.authors,
            year: extractedData.year,
            doi: extractedData.doi
          };
        })
        .filter(ref => {
          if (!ref.title) return true;
          return !linkedTitles.has(ref.title.toLowerCase().trim());
        });
    } catch (error) {
      console.error('Error getting unlinked references:', error);
      throw new Error('Failed to get unlinked references');
    }
  }

  // ==============================================
  // 📊 Statistics and Analytics
  // ==============================================

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

  // ==============================================
  // 🔧 Reference Management
  // ==============================================

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

  // ==============================================
  // 🔄 Backend Synchronization
  // ==============================================

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