/**
 * 🔗 会话文献数据库连接件 - SessionLiteratureConnector
 * 
 * 为特定研究话题提供会话级别的文献数据库操作接口
 * 自动处理话题相关的文献筛选、标签管理、批量操作等功能
 */

import { LibraryItem } from '@/libs/db';
import { useLibraryStore } from '@/store/libraryStore';
import { libraryService } from '@/libs/db/LibraryService';
import { generateLibraryItemId } from '@/libs/utils/uuid';
import { toast } from 'sonner';

export interface SessionLiteratureOptions {
  topic: string;
  autoTag?: boolean; // 自动为添加的文献打上话题标签
  filterByTopic?: boolean; // 是否只显示话题相关文献
}

export interface BatchAddResult {
  success: number;
  duplicates: number;
  errors: number;
  totalProcessed: number;
  addedItems: LibraryItem[];
  errorDetails: Array<{ url: string; error: string }>;
}

export class SessionLiteratureConnector {
  private topic: string;
  private autoTag: boolean;
  private filterByTopic: boolean;
  private libraryStore: ReturnType<typeof useLibraryStore>;

  constructor(options: SessionLiteratureOptions) {
    this.topic = options.topic;
    this.autoTag = options.autoTag ?? true;
    this.filterByTopic = options.filterByTopic ?? true;
    this.libraryStore = useLibraryStore.getState();
  }

  /**
   * 获取当前话题相关的文献列表
   */
  getTopicLiterature(): LibraryItem[] {
    // 🚀 每次都获取最新的状态，确保响应式更新
    const currentItems = useLibraryStore.getState().items;

    if (!this.filterByTopic) {
      return currentItems;
    }

    return currentItems.filter(item =>
      this.isTopicRelated(item)
    );
  }

  /**
   * 判断文献是否与当前话题相关
   */
  private isTopicRelated(item: LibraryItem): boolean {
    const topicLower = this.topic.toLowerCase();

    // 检查topics标签
    if (item.topics?.some(topic => topic.toLowerCase().includes(topicLower))) {
      return true;
    }

    // 检查标题
    if (item.title.toLowerCase().includes(topicLower)) {
      return true;
    }

    // 检查摘要
    if (item.abstract?.toLowerCase().includes(topicLower)) {
      return true;
    }

    // // 检查关键词
    // if (item.keywords?.some((keyword: string) => keyword.toLowerCase().includes(topicLower))) {
    //   return true;
    // }

    return false;
  }

  /**
   * 添加单个文献到数据库
   */
  async addLiterature(itemData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<{
    success: boolean;
    itemId?: string;
    duplicate?: LibraryItem[];
    error?: string;
  }> {
    try {
      // 自动添加话题标签
      if (this.autoTag) {
        const topics = itemData.topics || [];
        if (!topics.includes(this.topic)) {
          topics.push(this.topic);
        }
        itemData = { ...itemData, topics };
      }

      // 使用libraryStore的masterAddLiterature方法
      const result = await this.libraryStore.masterAddLiterature(itemData, {
        preCheckDuplicate: true,
        onComplete: (itemId: string, result: string) => {
          if (result === 'created') {
            console.log(`[SessionConnector] Successfully added literature: ${itemId}`);
          } else {
            console.log(`[SessionConnector] Duplicate literature detected: ${itemId}`);
          }
        },
        onError: (error: any) => {
          console.error(`[SessionConnector] Failed to add literature:`, error);
        }
      });

      return result;
    } catch (error) {
      console.error('[SessionConnector] Error adding literature:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 批量添加文献（通过URL列表）- 🚀 并行化版本
   */
  async batchAddFromUrls(urls: string[]): Promise<BatchAddResult> {
    console.log(`🚀 [SessionConnector] Starting parallel batch add for ${urls.length} URLs`);

    const result: BatchAddResult = {
      success: 0,
      duplicates: 0,
      errors: 0,
      totalProcessed: urls.length,
      addedItems: [],
      errorDetails: []
    };

    toast.loading(`正在并行添加 ${urls.length} 个文献...`, { id: 'batch-add' });

    try {
      // 🏗️ 为所有URL创建基础文献数据
      const itemsData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>[] = urls.map(url => ({
        title: `Processing: ${url}`, // 临时标题，后端会更新
        authors: ['Unknown Author'], // 提供默认作者，避免空数组
        year: new Date().getFullYear(), // 提供默认年份
        url: url.trim(),
        source: 'import', // 使用有效的source值
        topics: this.autoTag ? [this.topic] : []
      }));

      // 🚀 一次性并行处理所有文献（利用底层的并行化处理）
      const batchResult = await this.libraryStore.masterAddLiteratures(itemsData);

      // 📊 转换结果格式以匹配 BatchAddResult 接口
      result.success = batchResult.totalAdded;
      result.errors = batchResult.totalErrors;

      // 🔍 处理详细结果
      batchResult.results.forEach((itemResult: any, index: number) => {
        const url = urls[index];

        if (itemResult.success) {
          // 成功添加，查找添加的项目
          const addedItem = this.libraryStore.items.find((item: any) =>
            item.url === url || item.title.includes(url)
          );
          if (addedItem) {
            result.addedItems.push(addedItem);
          }
        } else {
          // 添加到错误详情
          result.errorDetails.push({
            url,
            error: itemResult.error || 'Unknown error'
          });
        }
      });

      console.log(`✅ [SessionConnector] Completed: ${result.success} success, ${result.errors} errors`);

    } catch (error) {
      console.error('❌ [SessionConnector] Batch add failed completely:', error);

      // 全部失败的情况
      result.errors = urls.length;
      result.success = 0;

      urls.forEach(url => {
        result.errorDetails.push({
          url,
          error: error instanceof Error ? error.message : 'Batch operation failed'
        });
      });
    }

    // 更新toast提示
    const successMsg = `批量添加完成：成功 ${result.success}，重复 ${result.duplicates}，失败 ${result.errors}`;
    if (result.errors > 0) {
      toast.warning(successMsg, { id: 'batch-add' });
    } else {
      toast.success(successMsg, { id: 'batch-add' });
    }

    console.log('[SessionConnector] Batch add completed:', result);
    return result;
  }

  /**
   * 更新文献的话题标签
   */
  async updateLiteratureTopics(itemId: string, topics: string[]): Promise<void> {
    try {
      await this.libraryStore.updateLibraryItem(itemId, { topics });
      console.log(`[SessionConnector] Updated topics for ${itemId}:`, topics);
    } catch (error) {
      console.error('[SessionConnector] Error updating topics:', error);
      throw error;
    }
  }

  /**
   * 为当前话题的所有文献添加标签
   */
  async tagAllTopicLiterature(): Promise<number> {
    const literature = this.getTopicLiterature();
    let updated = 0;

    for (const item of literature) {
      const currentTopics = item.topics || [];
      if (!currentTopics.includes(this.topic)) {
        const newTopics = [...currentTopics, this.topic];
        await this.updateLiteratureTopics(item.id, newTopics);
        updated++;
      }
    }

    console.log(`[SessionConnector] Tagged ${updated} literature items with topic: ${this.topic}`);
    return updated;
  }

  /**
   * 获取话题相关的统计信息
   */
  getTopicStats(): {
    totalLiterature: number;
    bySource: Record<string, number>;
    recentlyAdded: number; // 最近24小时添加的数量
  } {
    const literature = this.getTopicLiterature();
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const stats = {
      totalLiterature: literature.length,
      bySource: {} as Record<string, number>,
      recentlyAdded: 0
    };

    literature.forEach(item => {
      // 统计来源
      stats.bySource[item.source || ''] = (stats.bySource[item.source || ''] || 0) + 1;

      // 统计最近添加的
      if (new Date(item.createdAt).getTime() > oneDayAgo) {
        stats.recentlyAdded++;
      }
    });

    return stats;
  }

  /**
   * 清理话题相关文献（仅移除话题标签，不删除文献）
   */
  async cleanupTopicTags(): Promise<number> {
    const literature = this.getTopicLiterature();
    let cleaned = 0;

    for (const item of literature) {
      if (item.topics?.includes(this.topic)) {
        const newTopics = item.topics.filter(topic => topic !== this.topic);
        await this.updateLiteratureTopics(item.id, newTopics);
        cleaned++;
      }
    }

    console.log(`[SessionConnector] Cleaned topic tags from ${cleaned} literature items`);
    return cleaned;
  }

  /**
   * 获取连接件配置信息
   */
  getConfig(): SessionLiteratureOptions {
    return {
      topic: this.topic,
      autoTag: this.autoTag,
      filterByTopic: this.filterByTopic
    };
  }

  /**
   * 更新连接件配置
   */
  updateConfig(options: Partial<SessionLiteratureOptions>): void {
    if (options.topic !== undefined) this.topic = options.topic;
    if (options.autoTag !== undefined) this.autoTag = options.autoTag;
    if (options.filterByTopic !== undefined) this.filterByTopic = options.filterByTopic;

    console.log('[SessionConnector] Config updated:', this.getConfig());
  }
}

/**
 * 创建会话文献连接件的工厂函数
 */
export function createSessionLiteratureConnector(options: SessionLiteratureOptions): SessionLiteratureConnector {
  return new SessionLiteratureConnector(options);
}

// 需要导入React以支持useMemo
import { useMemo } from 'react';

/**
 * React Hook for SessionLiteratureConnector
 */
export function useSessionLiteratureConnector(options: SessionLiteratureOptions) {
  const connector = useMemo(() => {
    return createSessionLiteratureConnector(options);
  }, [options.topic, options.autoTag, options.filterByTopic]);

  return connector;
}