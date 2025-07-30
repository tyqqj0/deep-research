/**
 * 📚 LibraryStore - 极简化版本 (基于SSE重构)
 * 
 * 🎯 核心职责 (纯UI状态管理):
 * - 管理文献列表的UI状态
 * - 处理SSE连接和实时更新
 * - 提供搜索和过滤功能
 * - 管理活跃的文献提交状态
 * 
 * ❌ 不再负责:
 * - 复杂的业务逻辑（已移至存储层）
 * - 轮询机制（已替换为SSE）
 * - 任务状态管理（已简化）
 * - 智能查重（已移至存储层）
 * 

 */

import { create } from 'zustand';
import { liveQuery } from 'dexie';
import { LibraryItem, db, BackendTask } from '../libs/db';
import { LITERATURE_SOURCES, LiteratureSource as LiteratureSourceEnum } from '../libs/db/constants';
import { libraryService } from '../libs/db/LibraryService';
import { apiClient } from '../libs/api';
import { toast } from 'sonner';
import { taskStateManager, type TaskDisplayState } from '../libs/task/TaskStateManager';
import { generateLibraryItemId } from '../libs/utils/uuid';

// 📚 文献提交源接口（用于API调用）
interface LiteratureSource {
  title?: string;
  authors?: string[];
  doi?: string;
  url?: string;
  year?: number;
  journal?: string;
  topics?: string[]; // 🏷️ 支持话题标签
}

// 📊 SSE提交状态接口
interface LiteratureSubmissionState {
  id: string;
  title: string;
  status: 'submitting' | 'processing' | 'completed' | 'failed' | 'url_failed';
  progress: number;
  stage: string;
  eventSource?: EventSource;
  startTime: Date;
}

// 📊 简化的状态接口
interface SimplifiedLibraryState {
  // 📚 核心数据
  items: LibraryItem[];
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;

  // 🔍 搜索和过滤
  sourceFilter: LiteratureSourceEnum | 'all';
  searchTerm: string;
  topicFilter: string[];
  availableTopics: string[];

  // 📡 SSE提交状态（仅用于UI显示）
  activeSubmissions: Map<string, LiteratureSubmissionState>;
}

// 🎯 简化的操作接口
interface SimplifiedLibraryActions {
  // 🚀 核心操作
  initialize: () => Promise<void>;
  refreshItems: () => Promise<void>;

  // 📡 SSE文献提交
  submitLiterature: (source: LiteratureSource) => Promise<void>;

  // 📊 提交状态管理
  updateSubmissionStatus: (id: string, updates: Partial<LiteratureSubmissionState>) => void;
  completeSubmission: (id: string) => void;
  failSubmission: (id: string, error: any) => void;
  removeSubmission: (id: string) => void;

  // 📝 基础CRUD（委托给存储层）  
  updateLibraryItem: (id: string, itemData: Partial<LibraryItem>) => Promise<void>;
  deleteLibraryItem: (id: string) => Promise<void>;
  deleteLibraryItems: (ids: string[]) => Promise<void>;

  // 🔍 搜索和过滤
  setSourceFilter: (source: LiteratureSourceEnum | 'all') => void;
  setSearchTerm: (term: string) => void;
  setTopicFilter: (topics: string[]) => void;
  addTopicToFilter: (topic: string) => void;
  removeTopicFromFilter: (topic: string) => void;
  getFilteredItems: () => LibraryItem[];
  loadAvailableTopics: () => Promise<void>;

  // 🎯 UI状态管理
  getItemDisplayState: (itemId: string) => TaskDisplayState | null;
  getItemDisplayStateByItem: (item: LibraryItem) => TaskDisplayState;
  clearError: () => void;

  // 🔗 Zotero 相关（兼容性）
  isZoteroConfigured: boolean;
  zoteroSyncResult: any;

  // 🏗️ 向后兼容（保留重要的现有接口）
  masterAddLiterature: (itemData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>, options?: any) => Promise<any>;
  masterAddLiteratures: (itemsData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<any>;
  startRealTimeUpdates: () => (() => void) | undefined;
}

type LibraryStore = SimplifiedLibraryState & SimplifiedLibraryActions;

/**
 * 🏪 极简化的LibraryStore - 基于SSE重构
 */
export const useLibraryStore = create<LibraryStore>((set, get) => ({
  // ==================== 初始化状态 ====================
  items: [],
  isLoading: false,
  error: null,
  isInitialized: false,

  sourceFilter: 'all',
  searchTerm: '',
  topicFilter: [],
  availableTopics: [],

  activeSubmissions: new Map(),

  // ==================== 核心操作 ====================

  /**
   * 🚀 初始化应用
   */
  initialize: async () => {
    try {
      set({ isLoading: true, error: null });

      // console.log('🚀 [LibraryStore] Initializing simplified store...');

      // 📚 加载文献数据
      await get().refreshItems();

      // 🏷️ 加载话题
      await get().loadAvailableTopics();

      set({ isInitialized: true });
      // console.log('✅ [LibraryStore] Simplified store initialized successfully');

    } catch (error) {
      console.error('❌ [LibraryStore] Initialization failed:', error);
      set({
        error: error instanceof Error ? error.message : 'Initialization failed',
        isLoading: false
      });
    }
  },

  /**
   * 🔄 刷新文献列表
   */
  refreshItems: async () => {
    try {
      // console.log('🔄 [LibraryStore] Refreshing items...');

      const items = await libraryService.getAllLibraryItems();
      set({ items, isLoading: false });

      // console.log(`✅ [LibraryStore] Loaded ${items.length} items`);

    } catch (error) {
      console.error('❌ [LibraryStore] Failed to refresh items:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to refresh items',
        isLoading: false
      });
    }
  },

  /**
   * 📡 提交文献到SSE接口（立即创建占位文献）
   */
  submitLiterature: async (source: LiteratureSource) => {
    const submissionId = `submission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 🎯 Step 1: 立即创建占位文献（在try块外定义以便catch块访问）
    const placeholderItem: LibraryItem = {
        id: generateLibraryItemId(),
        title: source.title || `Processing: ${source.url || source.doi || 'Unknown Literature'}`,
        authors: source.authors && source.authors.length > 0 ? source.authors : ['Unknown Author'],
        year: source.year || new Date().getFullYear(),
        doi: source.doi,
        url: source.url,
        publication: source.journal,
        abstract: null,
        source: 'import',
        topics: source.topics || undefined, // 🏷️ 保留话题标签

        // 🎯 设置等待处理的后端任务状态
        backendTask: {
          task_id: submissionId,
          execution_status: 'pending',
          result_type: null, // 处理中时为null
          literature_id: null, // 后端完成后会设置
          literature_status: null,
          status: 'pending',
          overall_progress: 0,
          current_stage: '等待处理中...',
          resource_url: null,
          error_info: null
        },

        createdAt: new Date(),
        updatedAt: new Date()
      };

    try {
      console.log('📡 [LibraryStore] Starting literature submission with immediate placeholder creation');

      // 🏗️ 立即添加占位文献到数据库和UI
      await libraryService.addLibraryItem(placeholderItem);
      await get().refreshItems(); // 刷新UI显示占位文献

      // console.log(`✅ [LibraryStore] Created placeholder literature: ${placeholderItem.id}`);

      // 📡 通过API层提交SSE请求
      const apiSource = {
        title: source.title || 'Untitled',
        authors: source.authors || [],
        doi: source.doi || undefined,
        url: source.url || undefined,
        year: source.year || new Date().getFullYear(),
        journal: source.journal || undefined
      };
      const result = await apiClient.submitLiteratureSSE(apiSource, {
        // 📊 状态更新回调：更新占位文献的状态
        onStatusUpdate: async (data) => {
          try {
            // 🔄 更新占位文献的backendTask状态
            await get().updateLibraryItem(placeholderItem.id, {
              backendTask: {
                ...placeholderItem.backendTask!,
                overall_progress: data.progress,
                current_stage: data.stage,
                status: data.status
              }
            });

            // console.log(`🔄 [LibraryStore] Updated placeholder status: ${data.stage} (${data.progress}%)`);
          } catch (error) {
            console.error('❌ [LibraryStore] Failed to update placeholder status:', error);
          }
        },

        // 🎉 完成回调：更新占位文献为完整数据
        onCompleted: async (data) => {
          console.log('🎉 [LibraryStore] Literature submission completed, updating placeholder:', data.literature_id);

          try {
            // 🔄 获取完整文献数据
            const literatureData = await apiClient.getLiterature(data.literature_id);

            // 🔄 准备更新数据（安全处理null值）
            const updateData: Partial<LibraryItem> = {
              title: literatureData.metadata?.title || literatureData.title || placeholderItem.title,
              authors: (() => {
                // 🔍 安全处理authors字段
                let authorsList = [];

                if (literatureData.metadata?.authors && Array.isArray(literatureData.metadata.authors)) {
                  authorsList = literatureData.metadata.authors
                    .map((a: any) => a?.name || (typeof a === 'string' ? a : null))
                    .filter(Boolean);
                }

                if (authorsList.length === 0 && literatureData.authors && Array.isArray(literatureData.authors)) {
                  authorsList = literatureData.authors
                    .map((a: any) => typeof a === 'string' ? a : a?.name)
                    .filter(Boolean);
                }

                return authorsList.length > 0 ? authorsList : placeholderItem.authors;
              })(),
              year: literatureData.metadata?.year || literatureData.year || placeholderItem.year,
              doi: literatureData.identifiers?.doi || literatureData.doi || placeholderItem.doi,
              url: literatureData.content?.pdf_url || literatureData.url || placeholderItem.url,
              publication: literatureData.journal || placeholderItem.publication,
              
              // 🔍 安全处理abstract字段 - 优先使用后端数据，保留原有数据作为后备
              abstract: (literatureData.metadata as any)?.abstract || 
                       (literatureData as any)?.abstract || 
                       placeholderItem.abstract || 
                       null,

              // 🏷️ 保留原始话题标签，不被后端数据覆盖
              topics: placeholderItem.topics || undefined,

              parsedContent: {
                extractedText: literatureData.content?.has_grobid_fulltext ? 'Available' : undefined,
                extractedReferences: Array.isArray(literatureData.references) ? literatureData.references : []
              },

              // 🎆 更新为完成状态
              backendTask: {
                task_id: submissionId,
                execution_status: 'completed',
                result_type: 'created',
                literature_id: data.literature_id,
                literature_status: null,
                status: 'completed',
                overall_progress: 100,
                current_stage: '已完成',
                resource_url: data.resource_url,
                error_info: null
              },

              updatedAt: new Date()
            };

            console.log('🔍 [LibraryStore] Updating placeholder with completed data:', {
              placeholderId: placeholderItem.id,
              title: updateData.title,
              authors: updateData.authors,
              topics: updateData.topics, // 🏷️ 显示保留的话题标签
              literatureId: data.literature_id
            });

            // 🔄 更新占位文献
            await get().updateLibraryItem(placeholderItem.id, updateData);

            // 单个文献处理完成不显示 toast，避免过多提示

          } catch (error) {
            console.error('❌ [LibraryStore] Failed to update placeholder literature:', error);

            // 🚑 更新失败，标记为错误状态
            await get().updateLibraryItem(placeholderItem.id, {
              backendTask: {
                ...placeholderItem.backendTask!,
                execution_status: 'failed',
                status: 'failed',
                current_stage: '更新失败',
                error_info: { error: error instanceof Error ? error.message : 'Unknown error' }
              }
            });

            toast.error('文献更新失败', {
              description: error instanceof Error ? error.message : 'Unknown error',
              duration: 8000
            });
          }
        },

        // ❌ 错误回调：根据错误类型更新占位文献状态
        onError: async (error) => {
          console.log('❌ [LibraryStore] Literature submission failed:', error);

          try {
            // 🎯 根据错误类型设置不同的状态字段
            let backendTaskUpdate: Partial<BackendTask>;

            if (error.error_type === 'URLValidationError') {
              // 🔗 URL验证错误：设置URL验证状态字段
              backendTaskUpdate = {
                ...placeholderItem.backendTask!,
                url_validation_status: 'failed',
                url_validation_error: error.error || 'URL验证失败',
                original_url: error.details?.original_url || source.url || null,
                status: 'failed', // 确保status字段存在
                current_stage: 'URL验证失败',
                error_info: {
                  error_type: 'URLValidationError',
                  error: error.error || 'URL验证失败',
                  details: error.details
                }
              };
              console.log(`🔗 [LibraryStore] URL validation failed for: ${placeholderItem.id}`);
            } else {
              // 🚫 其他错误：设置执行状态为失败
              backendTaskUpdate = {
                ...placeholderItem.backendTask!,
                execution_status: 'failed',
                status: 'failed',
                current_stage: '处理失败',
                error_info: {
                  error_type: error.error_type || 'SubmissionError',
                  error: error.error || 'Unknown error',
                  details: error.details
                }
              };
              console.log(`🚫 [LibraryStore] Processing failed for: ${placeholderItem.id}`);
            }

            // 🔄 更新占位文献的状态
            await get().updateLibraryItem(placeholderItem.id, {
              backendTask: backendTaskUpdate
            });

          } catch (updateError) {
            console.log('❌ [LibraryStore] Failed to update placeholder error state:', updateError);
          }

          // 📢 显示错误提示
          get().failSubmission(submissionId, error);
        }
      });

      if (!result.success) {
        // 🚑 API层返回失败，更新占位文献状态
        try {
          await get().updateLibraryItem(placeholderItem.id, {
            backendTask: {
              ...placeholderItem.backendTask!,
              execution_status: 'failed',
              status: 'failed',
              current_stage: '提交失败',
              error_info: {
                error_type: 'SubmissionError',
                error: result.error || 'Submission failed'
              }
            }
          });
        } catch (updateError) {
          console.log('❌ [LibraryStore] Failed to update placeholder on submission failure:', updateError);
        }

        get().failSubmission(submissionId, { error: result.error || 'Submission failed' });
      }

    } catch (error) {
      console.log('❌ [LibraryStore] SSE submission error:', error);

      // 🚑 捕获异常时，更新占位文献状态
      try {
        await get().updateLibraryItem(placeholderItem.id, {
          backendTask: {
            ...placeholderItem.backendTask!,
            execution_status: 'failed',
            status: 'failed',
            current_stage: '连接失败',
            error_info: {
              error_type: 'ConnectionError',
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        });
      } catch (updateError) {
        console.log('❌ [LibraryStore] Failed to update placeholder on exception:', updateError);
      }

      get().failSubmission(submissionId, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  },

  /**
   * 📊 更新提交状态
   */
  updateSubmissionStatus: (id: string, updates: Partial<LiteratureSubmissionState>) => {
    set(state => {
      const newSubmissions = new Map(state.activeSubmissions);
      const existing = newSubmissions.get(id);

      if (existing) {
        // 过滤掉undefined值以避免spread类型错误
        const filteredUpdates = Object.fromEntries(
          Object.entries(updates).filter(([_, value]) => value !== undefined)
        ) as Partial<LiteratureSubmissionState>;

        newSubmissions.set(id, { ...existing, ...filteredUpdates });
      }

      return { activeSubmissions: newSubmissions };
    });
  },

  /**
   * 🎉 完成提交
   */
  completeSubmission: (id: string) => {
    get().updateSubmissionStatus(id, {
      status: 'completed',
      progress: 100,
      stage: '完成'
    });

    // 🕐 3秒后移除
    setTimeout(() => {
      get().removeSubmission(id);
    }, 3000);
  },

  /**
   * ❌ 提交失败
   */
  failSubmission: (id: string, error: any) => {
    const submission = get().activeSubmissions.get(id);
    const errorMsg = error?.error || error?.message || 'Unknown error';

    get().updateSubmissionStatus(id, {
      status: error?.error_type === 'URLValidationError' ? 'url_failed' : 'failed',
      stage: `失败: ${errorMsg}`
    });

    // 🎭 显示错误提示
    if (error?.error_type === 'URLValidationError') {
      toast.error('URL 访问失败', {
        description: errorMsg,
        duration: 10000,
        action: error?.original_url ? {
          label: '检查链接',
          onClick: () => navigator.clipboard.writeText(error.original_url)
        } : undefined
      });
    } else {
      toast.error('文献处理失败', {
        description: errorMsg,
        duration: 8000
      });
    }

    // 🕐 5秒后移除
    setTimeout(() => {
      get().removeSubmission(id);
    }, 5000);
  },

  /**
   * 🗑️ 移除提交状态
   */
  removeSubmission: (id: string) => {
    set(state => {
      const newSubmissions = new Map(state.activeSubmissions);
      newSubmissions.delete(id);
      return { activeSubmissions: newSubmissions };
    });
  },

  // ==================== 基础CRUD（委托给存储层）====================

  /**
   * 📝 更新文献项（委托给存储层）
   */
  updateLibraryItem: async (id: string, itemData: Partial<LibraryItem>) => {
    try {
      await libraryService.updateWithDuplicateCheck(id, itemData);
      await get().refreshItems(); // 刷新UI
      // console.log(`✅ [LibraryStore] Successfully updated item: ${id}`);
    } catch (error) {
      console.log(`❌ [LibraryStore] Failed to update item ${id}:`, error);
      // 显示用户友好的错误提示
      toast.error('文献更新失败', {
        description: error instanceof Error ? error.message : '未知错误',
        duration: 5000
      });
      set({ error: error instanceof Error ? error.message : 'Update failed' });
    }
  },

  /**
   * 🗑️ 删除文献项
   */
  deleteLibraryItem: async (id: string) => {
    try {
      await libraryService.deleteLibraryItem(id);
      await get().refreshItems(); // 刷新UI
      // console.log(`✅ [LibraryStore] Successfully deleted item: ${id}`);
    } catch (error) {
      console.log(`❌ [LibraryStore] Failed to delete item ${id}:`, error);
      toast.error('文献删除失败', {
        description: error instanceof Error ? error.message : '未知错误',
        duration: 5000
      });
      set({ error: error instanceof Error ? error.message : 'Delete failed' });
    }
  },

  /**
   * 🗑️ 批量删除文献项
   */
  deleteLibraryItems: async (ids: string[]) => {
    try {
      // 批量删除
      const deletePromises = ids.map(id => libraryService.deleteLibraryItem(id));
      await Promise.all(deletePromises);

      await get().refreshItems(); // 刷新UI
      // console.log(`✅ [LibraryStore] Successfully deleted ${ids.length} items`);

      toast.success(`已删除 ${ids.length} 项文献`);
    } catch (error) {
      console.log(`❌ [LibraryStore] Failed to delete items:`, error);
      toast.error('批量删除失败', {
        description: error instanceof Error ? error.message : '未知错误',
        duration: 5000
      });
      set({ error: error instanceof Error ? error.message : 'Batch delete failed' });
    }
  },

  // ==================== 搜索和过滤 ====================

  setSourceFilter: (source: LiteratureSourceEnum | 'all') => {
    set({ sourceFilter: source });
  },

  setSearchTerm: (term: string) => {
    set({ searchTerm: term });
  },

  setTopicFilter: (topics: string[]) => {
    set({ topicFilter: topics });
  },

  addTopicToFilter: (topic: string) => {
    const { topicFilter } = get();
    if (!topicFilter.includes(topic)) {
      set({ topicFilter: [...topicFilter, topic] });
    }
  },

  removeTopicFromFilter: (topic: string) => {
    const { topicFilter } = get();
    set({ topicFilter: topicFilter.filter(t => t !== topic) });
  },

  /**
   * 🔍 获取过滤后的文献列表
   */
  getFilteredItems: () => {
    const { items, sourceFilter, searchTerm, topicFilter } = get();

    return items.filter(item => {
      // 🎯 来源过滤
      if (sourceFilter !== 'all' && item.source !== sourceFilter) {
        return false;
      }

      // 🔍 搜索词过滤
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const titleMatch = item.title.toLowerCase().includes(searchLower);
        const authorMatch = item.authors.some(author =>
          author.toLowerCase().includes(searchLower)
        );
        const abstractMatch = item.abstract?.toLowerCase().includes(searchLower);

        if (!titleMatch && !authorMatch && !abstractMatch) {
          return false;
        }
      }

      // 🏷️ 主题过滤
      if (topicFilter.length > 0) {
        const itemTopics = item.topics || [];
        const hasMatchingTopic = topicFilter.some(filterTopic =>
          itemTopics.includes(filterTopic)
        );

        if (!hasMatchingTopic) {
          return false;
        }
      }

      return true;
    });
  },

  /**
   * 🏷️ 加载可用主题
   */
  loadAvailableTopics: async () => {
    try {
      const items = await libraryService.getAllLibraryItems();
      const topicsSet = new Set<string>();

      items.forEach(item => {
        if (item.topics) {
          item.topics.forEach(topic => topicsSet.add(topic));
        }
      });

      const availableTopics = Array.from(topicsSet).sort();
      set({ availableTopics });

      console.log(`🏷️ [LibraryStore] Loaded ${availableTopics.length} available topics`);
    } catch (error) {
      console.error('❌ [LibraryStore] Failed to load topics:', error);
    }
  },

  // ==================== UI状态管理 ====================

  /**
   * 🎯 获取文献项的显示状态
   */
  getItemDisplayState: (itemId: string) => {
    const { items } = get();
    const item = items.find(i => i.id === itemId);
    return item ? get().getItemDisplayStateByItem(item) : null;
  },

  /**
   * 🎯 直接从item获取显示状态
   */
  getItemDisplayStateByItem: (item: LibraryItem) => {
    return taskStateManager.getTaskDisplayState(item);
  },

  clearError: () => {
    set({ error: null });
  },

  // Zotero 相关方法（兼容性保留）
  isZoteroConfigured: false,
  zoteroSyncResult: null,

  // ==================== 向后兼容 ====================

  /**
   * 🔄 向后兼容：masterAddLiterature
   * 现在委托给新的SSE提交方法
   */
  masterAddLiterature: async (
    itemData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>,
    options?: any
  ) => {
    try {
      console.log('🔄 [LibraryStore] masterAddLiterature called, delegating to SSE submission');

      // 🔄 转换为LiteratureSource格式
      const source: LiteratureSource = {
        title: itemData.title,
        authors: itemData.authors,
        doi: itemData.doi || undefined,
        url: itemData.url || undefined,
        year: itemData.year || undefined,
        journal: itemData.publication || undefined,
        topics: itemData.topics || undefined // 🏷️ 保留话题标签
      };

      // 📡 委托给SSE提交
      await get().submitLiterature(source);

      // 🎯 返回成功结果（向后兼容）
      return {
        success: true,
        processingMode: 'sse'
      };

    } catch (error) {
      console.error('❌ [LibraryStore] masterAddLiterature failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  /**
   * 🔄 向后兼容：masterAddLiteratures (批量添加) - 🚀 并行化版本
   * 现在使用并行SSE提交提升性能
   */
  masterAddLiteratures: async (itemsData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    try {
      console.log(`🚀 [LibraryStore] Starting parallel batch processing for ${itemsData.length} items`);

      const results: any[] = [];
      let totalAdded = 0;
      let totalErrors = 0;

      // 🎯 并发控制：最多同时处理5个请求，避免压垮后端
      const CONCURRENT_LIMIT = 5;
      const batches = [];

      // 📦 将数据分批处理
      for (let i = 0; i < itemsData.length; i += CONCURRENT_LIMIT) {
        const batch = itemsData.slice(i, i + CONCURRENT_LIMIT);
        batches.push(batch);
      }

      // 🔄 批次间串行，批次内并行
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];

        // 🚀 批次内并行处理
        const batchPromises = batch.map(async (itemData, itemIndex) => {
          const globalIndex = batchIndex * CONCURRENT_LIMIT + itemIndex;
          try {
            const result = await get().masterAddLiterature(itemData);
            // console.log(`✅ [${globalIndex + 1}/${itemsData.length}] Processed: ${itemData.title}`);
            return {
              ...result,
              title: itemData.title,
              index: globalIndex
            };
          } catch (error) {
            console.log(`❌ [${globalIndex + 1}/${itemsData.length}] Failed: ${itemData.title}`, error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              title: itemData.title,
              index: globalIndex
            };
          }
        });

        // ⏳ 等待当前批次完成
        const batchResults = await Promise.allSettled(batchPromises);

        // 📊 处理批次结果
        batchResults.forEach((settledResult, itemIndex) => {
          if (settledResult.status === 'fulfilled') {
            const result = settledResult.value;
            results.push(result);

            if (result.success) {
              totalAdded++;
            } else {
              totalErrors++;
            }
          } else {
            // Promise 本身失败的情况
            const globalIndex = batchIndex * CONCURRENT_LIMIT + itemIndex;
            const itemData = batch[itemIndex];
            console.log(`💥 [${globalIndex + 1}/${itemsData.length}] Promise failed: ${itemData.title}`, settledResult.reason);
            results.push({
              success: false,
              error: 'Promise execution failed',
              title: itemData.title,
              index: globalIndex
            });
            totalErrors++;
          }
        });

        // console.log(`✅ [LibraryStore] Batch ${batchIndex + 1} completed: ${batch.length} items processed`);
      }

      // 🎯 返回批量结果（向后兼容）
      const finalResult = {
        results: results as any[],
        totalAdded,
        totalErrors
      };

      console.log(`🎊 [LibraryStore] Batch submission completed: ${totalAdded} added, ${totalErrors} errors`);

      // 🎭 显示批量结果提示
      if (totalAdded > 0) {
        toast.success(`批量添加完成`, {
          description: `成功添加 ${totalAdded} 项文献${totalErrors > 0 ? `，${totalErrors} 项失败` : ''}`,
          duration: 8000
        });
      } else if (totalErrors > 0) {
        toast.error(`批量添加失败`, {
          description: `${totalErrors} 项文献添加失败`,
          duration: 8000
        });
      }

      return finalResult;

    } catch (error) {
      console.error('❌ [LibraryStore] masterAddLiteratures failed:', error);
      return {
        results: itemsData.map(item => ({
          success: false,
          error: error instanceof Error ? error.message : 'Batch operation failed',
          title: item.title
        })),
        totalAdded: 0,
        totalErrors: itemsData.length
      };
    }
  },

  /**
   * 🔄 向后兼容：startRealTimeUpdates
   * 现在直接返回空的清理函数，因为我们使用SSE实时更新
   */
  startRealTimeUpdates: () => {
    console.log('🔄 [LibraryStore] Real-time updates requested - using SSE instead of polling');

    // 在SSE架构中，实时更新通过submitLiterature的EventSource连接处理
    // 这里返回一个空的清理函数以保持接口兼容
    return () => {
      console.log('🧹 [LibraryStore] Real-time updates cleanup (no-op in SSE architecture)');
    };
  }
}));

// 🎯 初始化时自动启动
if (typeof window !== 'undefined') {
  useLibraryStore.getState().initialize();
}

console.log('✅ [LibraryStore] Simplified store module loaded successfully');