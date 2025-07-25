import { create } from 'zustand';
import { liveQuery } from 'dexie';
import { LibraryItem, LiteratureTree, db } from '../libs/db';
import { LITERATURE_SOURCES, DEFAULT_LIBRARY_ITEM_SOURCE, LiteratureSource } from '../libs/db/constants';
import { libraryService } from '../libs/db/LibraryService';
import { apiClient, BackendTaskResponse, Literature } from '../libs/api'; // 🚀 使用新的API Client和类型
import { TreeController } from '../libs/tree/TreeController';
import { zoteroService, ZoteroConfig, ZoteroSyncResult } from '../libs/zotero';
import { generateLibraryItemId } from '../libs/utils/uuid';
import { toast } from 'sonner';

// Define State interface
interface LibraryState {
  items: LibraryItem[];
  trees: LiteratureTree[];
  activeTreeController: TreeController | null;
  isLoading: boolean;
  error: string | null;
  treeVersion: number; // Version number to trigger UI updates
  citationVersion: number; // 🎯 Citation变化版本号，用于触发图谱刷新
  isInitialized: boolean;

  // Filtering and search
  sourceFilter: LiteratureSource | 'all';
  searchTerm: string;
  topicFilter: string[]; // 🏷️ 话题过滤器
  availableTopics: string[]; // 🏷️ 可用话题列表

  // Zotero integration
  zoteroConfig: ZoteroConfig | null;
  isZoteroConfigured: boolean;
  zoteroSyncResult: ZoteroSyncResult | null;

  // PDF upload and processing
  currentDetailItem: LibraryItem | null;
  isUploadingPdf: boolean;
  uploadProgress: Record<string, number>;

  // Auto-metadata extraction settings
  autoExtractMetadata: boolean;

  // 🔄 轮询管理状态
  activeTasks: Map<string, {
    taskId: string;
    literatureId: string; // 本地临时文献ID
    title: string;
    startTime: Date;
  }>; // 正在轮询的任务
  pollingInterval: NodeJS.Timeout | null; // 轮询定时器
  pollingActive: boolean; // 轮询是否激活

  // 🎯 任务回调注册系统
  taskCallbacks: Map<string, {
    onComplete?: (itemId: string, result: 'created' | 'duplicate') => void;
    onError?: (error: Error) => void;
    linkingStrategy?: {
      mode: 'bidirectional' | 'unidirectional' | 'source-to-target';
      sourceItemId?: string;
    };
  }>;
}

// Define Actions interface
interface LibraryActions {
  // Core actions
  initialize: () => Promise<void>;
  _hasSignificantItemsChange: (currentItems: LibraryItem[], newItems: LibraryItem[]) => boolean; // 🎯 智能状态比较（内部方法）
  startRealTimeUpdates: () => () => void; // 返回cleanup函数
  startPolling: () => void; // 🚀 启动全局轮询器
  stopPolling: () => void; // 🚀 停止轮询
  addTaskToPolling: (taskId: string, literatureId: string, title: string) => void; // 🚀 添加任务到轮询列表
  handleTaskStatusUpdate: (taskInfo: any, response: BackendTaskResponse) => Promise<void>; // 🚀 处理任务状态更新（内部方法）
  handleTaskError: (taskInfo: any, error: any) => Promise<void>; // 🚀 处理任务错误（内部方法）
  _updateMetadataFromBackend: (literatureId: string, literatureStatus: any) => Promise<void>; // 🚀 从后端更新元数据（内部方法）
  _syncFinalLiteratureData: (literatureId: string, response: BackendTaskResponse) => Promise<void>; // 🚀 同步最终文献数据（内部方法）
  selectTree: (treeId: string) => Promise<void>;
  runMCTS: () => Promise<void>;
  masterAddLiterature: (
    itemData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>,
    options?: {
      onProgress?: (stage: string, progress: number) => void;
      onTaskCreated?: (taskId: string, itemId: string) => void;
      onComplete?: (itemId: string, result: 'created' | 'duplicate') => void;
      onError?: (error: Error) => void;
      linkingStrategy?: {
        mode: 'bidirectional' | 'unidirectional' | 'source-to-target';
        sourceItemId?: string; // 当mode为'source-to-target'时必需
      };
      preCheckDuplicate?: boolean;
    }
  ) => Promise<{ success: boolean; itemId?: string; taskId?: string; processingMode?: string; duplicate?: LibraryItem[]; error?: string }>;
  addLibraryItem: (itemData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ success: boolean; itemId?: string; duplicate?: LibraryItem[]; error?: string }>;
  addLibraryItems: (itemsData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<any>;
  updateLibraryItem: (id: string, itemData: Partial<LibraryItem>) => Promise<void>;
  deleteLibraryItem: (id: string) => Promise<void>;
  deleteLibraryItems: (ids: string[]) => Promise<void>;
  clearError: () => void;

  // Search and filtering
  setSourceFilter: (source: LiteratureSource | 'all') => void;
  setSearchTerm: (term: string) => void;
  getFilteredItems: () => LibraryItem[];
  
  // 🏷️ Topics filtering
  setTopicFilter: (topics: string[]) => void;
  addTopicToFilter: (topic: string) => void;
  removeTopicFromFilter: (topic: string) => void;
  loadAvailableTopics: () => Promise<void>;

  // Zotero integration
  configureZotero: (config: ZoteroConfig) => Promise<boolean>;
  syncWithZotero: () => Promise<ZoteroSyncResult>;
  clearZoteroConfig: () => void;

  // PDF upload and processing
  setCurrentDetailItem: (item: LibraryItem | null) => void;
  uploadPdfForItem: (itemId: string, file: File) => Promise<void>;
  bulkUploadPdfs: (files: File[]) => Promise<void>;

  // Auto-metadata extraction settings
  setAutoExtractMetadata: (enabled: boolean) => void;

  // ✏️ 引文编辑功能
  updateExtractedReference: (itemId: string, referenceIndex: number, updatedReference: any) => Promise<void>;
  addExtractedReference: (itemId: string, newReference: any) => Promise<void>;

  // 🔗 手动链接功能
  createManualCitationLink: (sourceItemId: string, targetItemId: string) => Promise<boolean>;
  deleteCitationLink: (sourceItemId: string, targetItemId: string) => Promise<void>;
}

// Use the real library service

// Create Zustand store
export const useLibraryStore = create<LibraryState & LibraryActions>((set, get) => ({
  // Initial state
  items: [],
  trees: [],
  activeTreeController: null,
  isLoading: false,
  error: null,
  treeVersion: 0,
  citationVersion: 0, // 🎯 初始化citation版本号
  isInitialized: false,

  // Filtering and search
  sourceFilter: 'all',
  searchTerm: '',
  topicFilter: [], // 🏷️ 初始化为空数组
  availableTopics: [], // 🏷️ 初始化为空数组

  // Zotero integration
  zoteroConfig: null,
  isZoteroConfigured: false,
  zoteroSyncResult: null,

  // PDF upload and processing
  currentDetailItem: null,
  isUploadingPdf: false,
  uploadProgress: {},

  // Auto-metadata extraction settings
  autoExtractMetadata: true, // 默认启用

  // 🔄 轮询管理状态初始值
  activeTasks: new Map(),
  pollingInterval: null,
  pollingActive: false,
  taskCallbacks: new Map(),

  // Clear error action
  clearError: () => {
    set({ error: null });
  },

  // Initialize action
  initialize: async () => {
    try {
      set({ isLoading: true, error: null });

      // TODO: 从全局设置系统加载配置
      // 临时从localStorage加载autoExtractMetadata设置
      try {
        const savedSetting = localStorage.getItem('library.autoExtractMetadata');
        if (savedSetting !== null) {
          set({ autoExtractMetadata: JSON.parse(savedSetting) });
        }
      } catch (error) {
        console.warn('Failed to load autoExtractMetadata setting from localStorage:', error);
      }

      // 🚀 混合策略：优先从后端获取最新数据，本地数据库作为缓存
      let items: LibraryItem[] = [];
      let trees: LiteratureTree[] = [];

      try {
        // 从后端API获取最新数据
        console.log('🔄 Fetching latest data from backend API...');
        const [backendItems, localTrees] = await Promise.all([
          apiClient.getLibraryItems(), // 从后端获取文献数据
          libraryService.getAllTrees()  // 本地获取树数据（暂时保持本地）
        ]);

        items = backendItems;
        trees = localTrees;

        // 🔄 同步到本地缓存
        console.log(`📦 Syncing ${items.length} items to local cache...`);
        await libraryService.syncItemsFromBackend(backendItems);

      } catch (backendError) {
        console.warn('⚠️ Backend API unavailable, falling back to local cache:', backendError);

        // 后端不可用时，从本地缓存加载
        const [localItems, localTrees] = await Promise.all([
          libraryService.getAllLibraryItems(),
          libraryService.getAllTrees()
        ]);

        items = localItems;
        trees = localTrees;
      }

      set({
        items,
        trees,
        isLoading: false,
        isInitialized: true
      });

      // 自动启动实时更新
      get().startRealTimeUpdates();

      // 🚀 启动全局轮询器，监听异步任务状态
      get().startPolling();

      // 🏷️ 加载可用话题列表
      get().loadAvailableTopics().catch(console.error);

    } catch (error) {
      console.error('LibraryStore: Initialization failed:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize library',
        isInitialized: true // also mark as initialized on failure to prevent re-initializing loop
      });
    }
  },

  // 🎯 智能状态比较函数 - 检查是否有实际变化
  _hasSignificantItemsChange: (currentItems: LibraryItem[], newItems: LibraryItem[]): boolean => {
    // 快速检查：数量变化
    if (currentItems.length !== newItems.length) {
      console.log(`📊 Items count changed: ${currentItems.length} → ${newItems.length}`);
      return true;
    }

    // 如果数量相同但为空，无需更新
    if (newItems.length === 0) {
      return false;
    }

    // 创建ID到updatedAt的映射，用于快速比较
    const currentMap = new Map(currentItems.map(item => [item.id, item.updatedAt?.getTime() || 0]));
    const newMap = new Map(newItems.map(item => [item.id, item.updatedAt?.getTime() || 0]));

    // 检查是否有新增或删除的项目
    if (currentMap.size !== newMap.size) {
      console.log(`📊 Items set changed: ${currentMap.size} → ${newMap.size} unique items`);
      return true;
    }

    // 检查每个项目的更新时间
    for (const [id, newTime] of newMap) {
      const currentTime = currentMap.get(id);
      if (currentTime === undefined || currentTime !== newTime) {
        console.log(`📊 Item ${id} updated: ${currentTime} → ${newTime}`);
        return true;
      }
    }

    // 没有发现显著变化
    return false;
  },

  // 启动实时数据更新监听 - 🚀 优化版本
  startRealTimeUpdates: () => {
    console.log('📡 Subscribing to real-time library updates with liveQuery (optimized)...');

    const observable = liveQuery(() => libraryService.getAllLibraryItems());

    // 🎯 防抖机制状态
    let updateTimeout: NodeJS.Timeout | null = null;
    let lastUpdateTime = 0;
    const MIN_UPDATE_INTERVAL = 300; // 最小更新间隔300ms
    const DEBOUNCE_DELAY = 100; // 防抖延迟100ms

    const subscription = observable.subscribe({
      next: (updatedItems) => {
        const now = Date.now();

        // 🚀 智能状态比较
        const { items: currentItems } = get();
        const hasSignificantChange = get()._hasSignificantItemsChange(currentItems, updatedItems);

        if (!hasSignificantChange) {
          console.log('⏭️ No significant changes detected, skipping UI update');
          return;
        }

        // 🎯 防抖机制 - 避免频繁更新
        if (updateTimeout) {
          clearTimeout(updateTimeout);
        }

        // 如果距离上次更新时间太短，延迟更新
        const timeSinceLastUpdate = now - lastUpdateTime;
        const shouldDelay = timeSinceLastUpdate < MIN_UPDATE_INTERVAL;
        const delayTime = shouldDelay ? DEBOUNCE_DELAY : 0;

        updateTimeout = setTimeout(() => {
          console.log(`🔄 Library updated via liveQuery (optimized). Total items: ${updatedItems.length}`);
          lastUpdateTime = Date.now();
          set({ items: updatedItems });
          updateTimeout = null;
        }, delayTime);
      },
      error: (error) => {
        console.error('Error in real-time library subscription:', error);
        set({ error: error instanceof Error ? error.message : 'Live subscription failed' });
      }
    });

    console.log('✅ Real-time updates subscription successful.');

    // The returned function should be called by a component's cleanup logic (e.g., useEffect)
    // to prevent memory leaks.
    return () => {
      subscription.unsubscribe();
      console.log('📡 Real-time updates subscription stopped.');
    };
  },

  // 🚀 启动全局轮询器
  startPolling: () => {
    const { pollingActive, pollingInterval } = get();

    if (pollingActive || pollingInterval) {
      console.log('🔄 Polling already active, skipping...');
      return;
    }

    console.log('🚀 Starting global task polling...');

    const interval = setInterval(async () => {
      const { activeTasks } = get();

      if (activeTasks.size === 0) {
        return; // 没有任务需要轮询
      }

      // 并行查询所有活跃任务的状态
      const taskPromises = Array.from(activeTasks.values()).map(async (taskInfo) => {
        try {
          const status = await apiClient.getTaskStatus(taskInfo.taskId);
          return { taskInfo, status };
        } catch (error) {
          console.error(`❌ Failed to poll task ${taskInfo.taskId}:`, error);
          return { taskInfo, status: null, error };
        }
      });

      const results = await Promise.allSettled(taskPromises);

      // 处理轮询结果
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.status) {
          await get().handleTaskStatusUpdate(result.value.taskInfo, result.value.status);
        } else if (result.status === 'fulfilled' && result.value.error) {
          // 处理轮询错误
          await get().handleTaskError(result.value.taskInfo, result.value.error);
        }
      }
    }, 3000); // 每3秒轮询一次

    set({
      pollingInterval: interval,
      pollingActive: true
    });

    console.log('✅ Global polling started (interval: 3s)');
  },

  // 🚀 停止轮询
  stopPolling: () => {
    const { pollingInterval } = get();

    if (pollingInterval) {
      clearInterval(pollingInterval);
      set({
        pollingInterval: null,
        pollingActive: false
      });
      console.log('🔌 Global polling stopped');
    }
  },

  // 🚀 添加任务到轮询列表
  addTaskToPolling: (taskId: string, literatureId: string, title: string) => {
    const { activeTasks } = get();
    const newTasks = new Map(activeTasks);

    newTasks.set(taskId, {
      taskId,
      literatureId,
      title,
      startTime: new Date()
    });

    set({ activeTasks: newTasks });
    console.log(`📋 Added task to polling: ${taskId} (${title})`);
  },

  // 🚀 处理任务状态更新（内部方法） - 重构为新API结构 + 优化轮询刷新
  handleTaskStatusUpdate: async (taskInfo: any, response: BackendTaskResponse) => {
    const { activeTasks, items } = get();

    // console.log(`🔄 Processing task update: ${taskInfo.taskId} - execution_status: ${response.execution_status}`);

    // 🔄 处理进行中的任务
    if (response.execution_status === 'processing' || response.execution_status === 'pending') {
      // 🎯 优化：只在状态真正改变时才更新UI
      const targetItem = items.find(item => item.id === taskInfo.literatureId);
      if (!targetItem) {
        console.warn(`⚠️ Target item not found: ${taskInfo.literatureId}`);
        return;
      }

      // 🔍 检查是否有实际变化（深度比较关键字段）
      const hasSignificantChange = !targetItem.backendTask ||
        targetItem.backendTask.execution_status !== response.execution_status ||
        targetItem.backendTask.overall_progress !== response.overall_progress ||
        targetItem.backendTask.current_stage !== response.current_stage ||
        JSON.stringify(targetItem.backendTask.literature_status) !== JSON.stringify(response.literature_status);

      if (hasSignificantChange) {
        console.log(`📈 Significant change detected for task ${taskInfo.taskId}, updating UI...`);

        const updatedItems = items.map(item => {
          if (item.id === taskInfo.literatureId) {
            return {
              ...item,
              // 🚀 更新backendTask字段为完整的响应数据
              backendTask: response,
              updatedAt: new Date() // 只在有实际变化时才更新时间戳
            };
          }
          return item;
        });

        set({ items: updatedItems });
      } else {
        // console.log(`⏭️ No significant change for task ${taskInfo.taskId}, skipping UI update`);
      }

      // 🚀 检查元数据是否已完成，如果是则立即更新本地数据
      if (response.literature_status?.component_status?.metadata?.status === 'success') {
        await get()._updateMetadataFromBackend(taskInfo.literatureId, response.literature_status);
      }

    } else if (response.execution_status === 'completed') {
      // ✅ 任务完成
      console.log(`✅ Task completed: ${taskInfo.taskId} (${taskInfo.title}) - result_type: ${response.result_type}`);

      try {
        // 从activeTasks中移除这个任务
        const newTasks = new Map(activeTasks);
        newTasks.delete(taskInfo.taskId);
        set({ activeTasks: newTasks });

        // 最终更新本地数据
        const updatedItems = items.map(item => {
          if (item.id === taskInfo.literatureId) {
            return {
              ...item,
              backendTask: response,
              updatedAt: new Date()
            };
          }
          return item;
        });

        set({ items: updatedItems });

        // 🚀 如果有完整的文献数据，进行最终同步
        if (response.literature_id && response.literature_status) {
          await get()._syncFinalLiteratureData(taskInfo.literatureId, response);
        }

      } catch (error) {
        console.error(`❌ Error processing completed task ${taskInfo.taskId}:`, error);
        await get().handleTaskError(taskInfo, error);
      }

    } else if (response.execution_status === 'failed') {
      // 任务失败
      await get().handleTaskError(taskInfo, new Error(response.current_stage || 'Task failed'));
    }
  },

  // 🚀 处理任务错误（内部方法）
  handleTaskError: async (taskInfo: any, error: any) => {
    const { activeTasks, items } = get();

    console.error(`❌ Task failed: ${taskInfo.taskId} (${taskInfo.title})`, error);

    // 从activeTasks中移除失败的任务
    const newTasks = new Map(activeTasks);
    newTasks.delete(taskInfo.taskId);
    set({ activeTasks: newTasks });

    // 更新文献状态为失败
    const updatedItems = items.map(item => {
      if (item.id === taskInfo.literatureId) {
        return {
          ...item,
          parsingStatus: 'FAILED' as const,
          error: error instanceof Error ? error.message : 'Processing failed',
          updatedAt: new Date()
        };
      }
      return item;
    });

    set({ items: updatedItems });

    // 同步到本地缓存
    try {
      await libraryService.updateLibraryItem(taskInfo.literatureId, {
        backendTask: {
          execution_status: 'failed',
          error_info: { message: error instanceof Error ? error.message : 'Processing failed' }
        }
      });
    } catch (cacheError) {
      console.error('Failed to update failed status in cache:', cacheError);
    }
  },

  // 🚀 从后端更新元数据（内部方法）
  _updateMetadataFromBackend: async (literatureId: string, literatureStatus: any) => {
    const { items } = get();

    console.log(`📝 Updating metadata from backend for item: ${literatureId}`);

    try {
      // 从后端状态中提取元数据
      // 注意：这里需要根据实际的API响应结构来提取数据
      const metadataUpdates: Partial<LibraryItem> = {};

      // 如果有可用的元数据，更新到顶层字段
      if (literatureStatus.component_status?.metadata?.status === 'success') {
        // 这里需要根据实际API返回的结构来提取元数据
        // 暂时保持现有数据不变，只更新backendTask
      }

      // 更新本地数据库
      await libraryService.updateLibraryItem(literatureId, metadataUpdates);

      // 更新Zustand store
      const updatedItems = items.map(item => {
        if (item.id === literatureId) {
          return { ...item, ...metadataUpdates, updatedAt: new Date() };
        }
        return item;
      });

      set({ items: updatedItems });

      console.log('✅ Metadata updated successfully from backend');
    } catch (error) {
      console.error('❌ Failed to update metadata from backend:', error);
    }
  },

  // 🚀 同步最终文献数据（内部方法）
  _syncFinalLiteratureData: async (literatureId: string, response: BackendTaskResponse) => {
    console.log(`🔄 Syncing final literature data for: ${literatureId} - result_type: ${response.result_type}`);

    try {
      if (response.literature_id) {
        // 无论是新创建还是重复的文献，都获取后端的完整数据
        const finalLiterature = await apiClient.getLiterature(response.literature_id);

        console.log('📖 Retrieved literature data from backend:', finalLiterature.title);

        // 🎯 二次智能查重：用解析后的完整元数据再次检查重复
        console.log('🔍 [SECOND_CHECK] Starting post-processing duplicate check with complete metadata...');
        const { matchingEngine } = await import('../libs/db/matching');
        const duplicateAfterParsing = await matchingEngine.findItemByUrlOrDoi(
          finalLiterature.url,
          finalLiterature.doi,
          finalLiterature.title,
          finalLiterature.authors,
          finalLiterature.year
        );

        // 如果找到重复项且不是当前正在处理的条目
        if (duplicateAfterParsing && duplicateAfterParsing.id !== literatureId) {
          console.log(`🎯 [SECOND_CHECK] Found duplicate after parsing! Existing: "${duplicateAfterParsing.title}", Current: "${finalLiterature.title}"`);
          // 显示弹窗提示已自动合并重复文献
          toast.success('已自动合并重复文献');
          
          // 🚀 智能合并策略：将占位条目的信息合并到已存在条目
          console.log('🔄 [MERGE] Merging placeholder data into existing item...');
          
          // 获取占位条目的topics等信息
          const { items } = get();
          const placeholderItem = items.find(item => item.id === literatureId);
          
          if (placeholderItem?.topics && placeholderItem.topics.length > 0) {
            console.log(`🏷️ [MERGE] Merging topics: ${placeholderItem.topics.join(', ')}`);
            // 合并topics到已存在的条目
            for (const topic of placeholderItem.topics) {
              await libraryService.addTopicToItem(duplicateAfterParsing.id, topic);
            }
          }
          
          // 🗑️ 删除占位条目（重复项）
          console.log(`🗑️ [CLEANUP] Removing placeholder duplicate item: ${literatureId}`);
          await libraryService.deleteLibraryItem(literatureId);
          
          // 更新 store 状态，移除占位条目
          const updatedItems = items.filter(item => item.id !== literatureId);
          set({ items: updatedItems });
          
          // 🎯 触发完成回调，但使用已存在条目的ID
          const { taskCallbacks } = get();
          const callbacks = taskCallbacks.get(response.task_id);
          if (callbacks?.onComplete) {
            try {
              callbacks.onComplete(duplicateAfterParsing.id, 'duplicate');
              console.log(`✅ [MERGE] Task completed with merged duplicate: ${duplicateAfterParsing.id}`);
            } catch (callbackError) {
              console.error('❌ Error calling onComplete callback:', callbackError);
            }
          }
          
          return; // 早期返回，不继续处理占位条目
        } else {
          console.log('✅ [SECOND_CHECK] No duplicates found after parsing, proceeding with update...');
        }

        // 🔍 调试后端返回的数据
        console.log('🔍 [DEBUG] Raw backend literature data:', {
          title: finalLiterature.title,
          authors: finalLiterature.authors,
          authorsLength: finalLiterature.authors?.length,
          authorsType: typeof finalLiterature.authors,
          isAuthorsArray: Array.isArray(finalLiterature.authors)
        });

        // 合并后端提取的真实数据到本地条目
        const updates: Partial<LibraryItem> = {
          title: finalLiterature.title || 'Processing...',
          authors: (finalLiterature.authors && finalLiterature.authors.length > 0)
            ? finalLiterature.authors
            : ['Unknown Author'], // 确保作者数组不为空
          year: finalLiterature.year || new Date().getFullYear(),
          doi: finalLiterature.doi || undefined, // 将 null 转换为 undefined
          publication: finalLiterature.journal || undefined, // 同样处理 journal

          // 🔗 同步引文数据到 parsedContent
          parsedContent: (() => {
            console.log(`🔍 [DEBUG] Processing references for parsedContent:`, {
              hasReferences: !!finalLiterature.references,
              referencesLength: finalLiterature.references?.length || 0,
              referencesType: typeof finalLiterature.references,
              isArray: Array.isArray(finalLiterature.references),
              firstReference: finalLiterature.references?.[0],
              firstReferenceKeys: finalLiterature.references?.[0] ? Object.keys(finalLiterature.references[0]) : [],
              sampleReferences: finalLiterature.references?.slice(0, 2)
            });

            return finalLiterature.references && finalLiterature.references.length > 0 ? {
              extractedReferences: finalLiterature.references
            } : undefined;
          })(),

          backendTask: response,
          updatedAt: new Date()
        };

        console.log(`🔗 Syncing ${finalLiterature.references?.length || 0} references for literature: ${finalLiterature.title}`);

        // 更新本地数据库
        await libraryService.updateLibraryItem(literatureId, updates);

        // 更新Zustand store
        const { items } = get();
        const updatedItems = items.map(item => {
          if (item.id === literatureId) {
            return { ...item, ...updates };
          }
          return item;
        });

        set({ items: updatedItems });

        if (response.result_type === 'duplicate') {
          console.log('✅ Duplicate literature data synced with backend information');
        } else {
          console.log('✅ New literature data synced successfully');
        }

        // 🎯 触发任务完成回调
        const { activeTasks, taskCallbacks } = get();
        const taskInfo = activeTasks.get(response.task_id);
        if (taskInfo) {
          const callbacks = taskCallbacks.get(response.task_id);
          if (callbacks?.onComplete) {
            try {
              callbacks.onComplete(literatureId, response.result_type as 'created' | 'duplicate');
            } catch (callbackError) {
              console.error('❌ Error in onComplete callback:', callbackError);
            }
          }

          // 清理回调
          const newCallbacks = new Map(taskCallbacks);
          newCallbacks.delete(response.task_id);
          set({ taskCallbacks: newCallbacks });
        }

        // 🔗 自动触发引文链接流程 - 使用新的链接策略
        if (finalLiterature.references && finalLiterature.references.length > 0) {
          console.log(`🔗 Auto-linking ${finalLiterature.references.length} references...`);

          try {
            // 🎯 获取链接策略
            const { activeTasks, taskCallbacks } = get();
            const taskInfo = activeTasks.get(response.task_id);
            const callbacks = taskCallbacks.get(response.task_id);
            const linkingStrategy = callbacks?.linkingStrategy;

            if (linkingStrategy) {
              console.log(`🎯 Using custom linking strategy: ${linkingStrategy.mode}`);

              switch (linkingStrategy.mode) {
                case 'bidirectional':
                  console.log('🔄 Triggering bidirectional linking...');
                  const biResult = await libraryService.linkNewItemBidirectionally(literatureId);
                  console.log(`✅ Bidirectional linking completed: ${biResult.forwardLinks} forward, ${biResult.backwardLinks} backward`);
                  break;

                case 'unidirectional':
                  console.log('➡️ Triggering unidirectional linking...');
                  const uniResult = await libraryService.linkCitationsForItem(literatureId);
                  console.log(`✅ Unidirectional linking completed: ${uniResult.linkedCount}/${uniResult.totalReferences} linked`);
                  break;

                case 'source-to-target':
                  if (linkingStrategy.sourceItemId) {
                    console.log(`🎯 Triggering source-to-target linking: ${linkingStrategy.sourceItemId} → ${literatureId}`);

                    // 第一步：建立源文献 → 目标文献的链接
                    const sourceToTargetResult = await libraryService.linkCitationsForItem(linkingStrategy.sourceItemId);
                    console.log(`✅ Source-to-target linking completed: ${sourceToTargetResult.linkedCount} links from source`);

                    // 第二步：建立目标文献 → 源文献的反向链接（如果目标文献的引文中包含源文献）
                    const targetToSourceResult = await libraryService.linkCitationsForItem(literatureId);
                    console.log(`✅ Target-to-source linking completed: ${targetToSourceResult.linkedCount} links from target`);
                  } else {
                    console.warn('⚠️ source-to-target mode requires sourceItemId');
                    // 降级为双向链接
                    const fallbackResult = await libraryService.linkNewItemBidirectionally(literatureId);
                    console.log(`✅ Fallback bidirectional linking completed: ${fallbackResult.forwardLinks} forward, ${fallbackResult.backwardLinks} backward`);
                  }
                  break;

                default:
                  console.warn(`⚠️ Unknown linking strategy: ${linkingStrategy.mode}, using bidirectional`);
                  const defaultResult = await libraryService.linkNewItemBidirectionally(literatureId);
                  console.log(`✅ Default bidirectional linking completed: ${defaultResult.forwardLinks} forward, ${defaultResult.backwardLinks} backward`);
              }
            } else {
              // 🔄 默认策略：不再基于 result_type，统一使用双向链接
              console.log('🔄 Using default bidirectional linking strategy...');
              const defaultResult = await libraryService.linkNewItemBidirectionally(literatureId);
              console.log(`✅ Default bidirectional linking completed: ${defaultResult.forwardLinks} forward, ${defaultResult.backwardLinks} backward`);
            }

            // 🎯 更新citation版本号，通知图谱刷新
            const { citationVersion } = get();
            set({ citationVersion: citationVersion + 1 });
            console.log(`🔄 Citation version updated: ${citationVersion} → ${citationVersion + 1}`);

          } catch (linkError) {
            console.error('❌ Auto-linking failed:', linkError);
            // 不抛出错误，因为数据同步已经成功，链接失败不应该影响主流程
          }
        } else {
          console.log('ℹ️ No references to link for this literature');
        }
      } else {
        // 没有literature_id，只更新任务状态
        console.log('⚠️ No literature_id in response, only updating task status');

        const { items } = get();
        const updatedItems = items.map(item => {
          if (item.id === literatureId) {
            return {
              ...item,
              backendTask: response,
              updatedAt: new Date()
            };
          }
          return item;
        });

        set({ items: updatedItems });

        await libraryService.updateLibraryItem(literatureId, {
          backendTask: response,
          updatedAt: new Date()
        });

        console.log('✅ Task status updated without literature data');
      }
    } catch (error) {
      console.error('❌ Failed to sync final literature data:', error);
    }
  },

  // Select tree action
  selectTree: async (treeId: string) => {
    try {
      set({ isLoading: true, error: null });

      const treeData = await libraryService.getTreeById(treeId);

      if (!treeData) {
        throw new Error(`Tree with id ${treeId} not found`);
      }

      const newController = new TreeController(treeData, libraryService);

      set({
        activeTreeController: newController,
        isLoading: false,
        treeVersion: get().treeVersion + 1
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to select tree'
      });
    }
  },

  // Run MCTS action
  runMCTS: async () => {
    try {
      const { activeTreeController } = get();

      if (!activeTreeController) {
        throw new Error('No active tree controller. Please select a tree first.');
      }

      set({ isLoading: true, error: null });

      // Run MCTS simulation
      activeTreeController.runSimulation();

      // Save the updated tree
      await activeTreeController.save();

      // Update the tree version to trigger UI updates
      set({
        isLoading: false,
        treeVersion: get().treeVersion + 1
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to run MCTS simulation'
      });
    }
  },

  // 批量添加文献条目，逻辑参考 masterAddLiterature，支持后端查重与异步处理
  addLibraryItems: async (
    itemsData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>[]
  ) => {
    try {
      set({ isLoading: true, error: null });

      const results: any[] = [];
      const totalFiles = itemsData.length;

      console.log(`📤 批量添加 ${totalFiles} 个文献条目...`);

      for (let i = 0; i < totalFiles; i++) {
        const itemData = itemsData[i];
        try {
          // 1. 查重（本地）
          let isDuplicate = false;
          let duplicateId = '';
          if (itemData.title && itemData.title.trim() !== '') {
            const duplicates = await libraryService.checkDuplicateByTitle(itemData.title.trim());
            if (duplicates.length > 0) {
              isDuplicate = true;
              duplicateId = duplicates[0].id;
            }
          }

          if (isDuplicate) {
            results.push({
              success: false,
              error: '已存在重复文献',
              title: itemData.title,
              duplicateId
            });
            console.warn(`❌ [${i + 1}/${totalFiles}] 跳过重复文献: ${itemData.title}`);
            continue;
          }

          // 2. 判断是否可后端处理（有DOI或URL）
          const canBeProcessedByBackend = Boolean(itemData.doi || itemData.url);

          if (canBeProcessedByBackend && apiClient.submitLiterature) {
            // 2.1 有DOI/URL，走后端异步任务
            const taskId = await apiClient.submitLiterature({
              source: {
                title: itemData.title,
                authors: itemData.authors,
                doi: itemData.doi,
                url: itemData.url,
                year: itemData.year,
                journal: itemData.publication
              }
            });
            // 这里可以考虑轮询任务状态，或直接标记为已提交
            results.push({
              success: true,
              itemId: taskId,
              title: itemData.title,
              backendTask: true
            });
            console.log(`🚀 [${i + 1}/${totalFiles}] 已提交后端异步任务: ${itemData.title}`);
          } else if (apiClient.submitLiterature) {
            // 2.2 无DOI/URL，直接创建
            const createdItem = await apiClient.submitLiterature({
              source: {
                title: itemData.title,
                authors: itemData.authors,
                doi: itemData.doi,
                url: itemData.url,
                year: itemData.year,
                journal: itemData.publication
              }
            });
            // 同步到本地缓存
            await libraryService.addLibraryItem(createdItem);

            results.push({
              success: true,
              itemId: createdItem,
              title: itemData.title
            });
            console.log(`✅ [${i + 1}/${totalFiles}] 已创建: ${createdItem.title}`);
          } else {
            // 没有可用API
            results.push({
              success: false,
              error: '未找到可用的文献创建API',
              title: itemData.title
            });
            console.error(`❌ [${i + 1}/${totalFiles}] 无法创建: ${itemData.title}`);
          }
        } catch (error) {
          console.error(`❌ [${i + 1}/${totalFiles}] 创建失败: ${itemData.title}`, error);
          results.push({
            success: false,
            error: error instanceof Error ? error.message : '未知错误',
            title: itemData.title
          });
        }
      }

      // 刷新本地文献列表
      const updatedItems = await libraryService.getAllLibraryItems();
      set({
        items: updatedItems,
        isLoading: false
      });

      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      return {
        success: true,
        results,
        totalAdded: successCount,
        totalErrors: errorCount,
        itemsAdded: successCount,
        itemsSkipped: errorCount
      };
    } catch (error) {
      console.error('[LibraryStore] addLibraryItems error:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : '批量添加文献失败'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : '批量添加文献失败',
        results: [],
        totalAdded: 0,
        totalErrors: itemsData.length
      };
    }
  },

  // 🎯 统一的添加文献主函数 - 整合所有添加流程
  masterAddLiterature: async (
    itemData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>,
    options?: {
      onProgress?: (stage: string, progress: number) => void;
      onTaskCreated?: (taskId: string, itemId: string) => void;
      onComplete?: (itemId: string, result: 'created' | 'duplicate') => void;
      onError?: (error: Error) => void;
      linkingStrategy?: {
        mode: 'bidirectional' | 'unidirectional' | 'source-to-target';
        sourceItemId?: string; // 当mode为'source-to-target'时必需
      };
      preCheckDuplicate?: boolean;
    }
  ) => {
    const { onProgress, onTaskCreated, onComplete, onError, linkingStrategy, preCheckDuplicate = true } = options || {};

    try {
      set({ isLoading: true, error: null });
      onProgress?.('开始处理...', 0);

      const { items } = get();
      const itemId = generateLibraryItemId();

      // 🔍 智能查重检查 - 使用新的MatchingEngine
      onProgress?.('检查重复文献...', 10);
      if (preCheckDuplicate && itemData.title && itemData.title.trim() !== '') {
        console.log('🔍 [Master] Using intelligent matching engine for duplicate check:', itemData.title);
        
        // 使用新的智能匹配引擎进行查重
        const { matchingEngine } = await import('../libs/db/matching');
        const existingItem = await matchingEngine.findItemByUrlOrDoi(
          itemData.url,
          itemData.doi,
          itemData.title,
          itemData.authors,
          itemData.year
        );
        
        if (existingItem) {
          console.log('❌ [Master] Intelligent matching found duplicate:', existingItem.title);
          set({
            isLoading: false,
            error: 'Duplicate literature found via intelligent matching'
          });
          onComplete?.(existingItem.id, 'duplicate');
          return { success: false, duplicate: [existingItem], itemId: existingItem.id };
        }
        console.log('✅ [Master] No duplicates found via intelligent matching, proceeding...');
      }

      // 检查是否有可以让后端处理的信息 (DOI 或 URL)
      const canBeProcessedByBackend = Boolean(itemData.doi || itemData.url);

      if (canBeProcessedByBackend) {
        // 🚀 有DOI或URL，提交给后端进行异步处理
        onProgress?.('提交后端处理...', 20);
        console.log('📤 [Master] Submitting literature for backend processing...', itemData.title);

        const taskId = await apiClient.submitLiterature({
          source: {
            title: itemData.title,
            authors: itemData.authors,
            doi: itemData.doi,
            url: itemData.url,
            year: itemData.year,
            journal: itemData.publication
          }
        });

        // 创建本地临时文献条目（状态为PROCESSING）
        const temporaryItem: LibraryItem = {
          id: itemId,
          title: itemData.title || 'Untitled Literature',
          authors: itemData.authors && itemData.authors.length > 0 ? itemData.authors : ['Unknown Author'],
          year: itemData.year,
          source: itemData.source || DEFAULT_LIBRARY_ITEM_SOURCE,
          publication: itemData.publication,
          abstract: itemData.abstract,
          summary: itemData.summary,
          zoteroKey: itemData.zoteroKey,
          doi: itemData.doi,
          url: itemData.url || undefined, // 确保空字符串被转为undefined
          pdfPath: itemData.pdfPath,
          backendTask: {
            task_id: taskId,
            execution_status: 'processing',
            result_type: 'created',
            literature_id: null,
            literature_status: null,
            status: 'processing',
            overall_progress: 0,
            current_stage: '正在提交处理任务',
            resource_url: null,
            error_info: null
          }, // 保存完整的后端任务状态
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // 添加到本地状态和缓存
        onProgress?.('创建本地条目...', 40);
        try {
          await libraryService.addLibraryItem(temporaryItem);
          console.log('✅ [Master] Temporary item added to local cache successfully');

          const updatedItems = [...items, temporaryItem];
          set({
            items: updatedItems,
            isLoading: false
          });
        } catch (cacheError) {
          console.error('❌ [Master] Failed to add temporary item to local cache:', cacheError);
          const error = new Error(`Failed to cache literature item: ${cacheError instanceof Error ? cacheError.message : 'Unknown error'}`);
          onError?.(error);
          throw error;
        }

        // 🚀 将任务添加到轮询列表
        get().addTaskToPolling(taskId, itemId, itemData.title);

        // 🎯 注册任务完成回调
        if (onComplete || onError || linkingStrategy) {
          const { taskCallbacks } = get();
          const newCallbacks = new Map(taskCallbacks);
          newCallbacks.set(taskId, { onComplete, onError, linkingStrategy });
          set({ taskCallbacks: newCallbacks });
        }

        onTaskCreated?.(taskId, itemId);
        onProgress?.('任务已提交，等待处理完成...', 60);

        console.log(`✅ [Master] Literature submitted for processing, task_id: ${taskId}`);
        return { success: true, itemId, taskId, processingMode: 'backend' };

      } else {
        // 📝 仅有元数据，直接创建本地条目（不发送后端处理）
        onProgress?.('创建本地条目...', 50);
        console.log('📝 [Master] Creating local literature item (metadata only)...', itemData.title);

        const localItem: LibraryItem = {
          id: itemId,
          title: itemData.title || 'Untitled Literature',
          authors: itemData.authors && itemData.authors.length > 0 ? itemData.authors : ['Unknown Author'],
          year: itemData.year,
          source: itemData.source || DEFAULT_LIBRARY_ITEM_SOURCE,
          publication: itemData.publication,
          abstract: itemData.abstract,
          summary: itemData.summary,
          zoteroKey: itemData.zoteroKey,
          doi: itemData.doi,
          url: itemData.url || undefined, // 确保空字符串被转为undefined
          pdfPath: itemData.pdfPath,
          parsingStatus: 'IDLE', // 无需处理，状态为空闲
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // 查重检查已在函数开头统一处理

        // 添加到本地状态和缓存
        try {
          await libraryService.addLibraryItem(localItem);
          console.log('✅ [Master] Local item added to cache successfully');

          const updatedItems = [...items, localItem];
          set({
            items: updatedItems,
            isLoading: false
          });
        } catch (cacheError) {
          console.error('❌ [Master] Failed to add local item to cache:', cacheError);
          const error = new Error(`Failed to cache literature item: ${cacheError instanceof Error ? cacheError.message : 'Unknown error'}`);
          onError?.(error);
          throw error;
        }

        onProgress?.('完成', 100);
        onComplete?.(itemId, 'created');
        console.log('✅ [Master] Local literature item created successfully:', localItem.title);
        return { success: true, itemId, processingMode: 'local' };
      }

    } catch (error) {
      console.error('❌ [Master] Failed to add literature item:', error);
      const errorObj = error instanceof Error ? error : new Error('Failed to add literature item');

      set({
        isLoading: false,
        error: errorObj.message
      });

      onError?.(errorObj);
      return { success: false, error: errorObj.message };
    }
  },

  // Add library item action - 🚀 重构为支持异步任务流程 (保持向后兼容)
  addLibraryItem: async (itemData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    // 🔄 直接调用新的统一函数，保持向后兼容
    console.log('📞 [Compat] Calling masterAddLiterature via legacy addLibraryItem');
    return await get().masterAddLiterature(itemData);
  },

  // Update library item action - 📝 前端本地数据管理
  updateLibraryItem: async (id: string, itemData: Partial<LibraryItem>) => {
    try {
      set({ isLoading: true, error: null });

      const { items } = get();
      const existingItem = items.find(item => item.id === id);

      if (!existingItem) {
        throw new Error(`Library item with id ${id} not found`);
      }

      // 🔍 检查是否新增了可解析信息 (URL/DOI)
      const oldCanBeProcessed = Boolean(existingItem.doi || existingItem.url);
      const newCanBeProcessed = Boolean(
        (itemData.doi !== undefined ? itemData.doi : existingItem.doi) ||
        (itemData.url !== undefined ? itemData.url : existingItem.url)
      );
      const shouldTriggerBackendProcessing = !oldCanBeProcessed && newCanBeProcessed;

      // 📝 直接更新本地数据库 (前端自治管理)
      console.log('📝 Updating literature item in local database...', id);
      const updateData = { ...itemData, updatedAt: new Date() };
      await libraryService.updateLibraryItem(id, updateData);

      // 🔄 更新本地状态 (UI刷新)
      const updatedItem = { ...existingItem, ...updateData };

      // 🚀 如果新增了可解析信息，提交给后端处理
      if (shouldTriggerBackendProcessing) {
        console.log('🚀 New parseable info detected, submitting to backend...', updatedItem.title);
        try {
          const taskId = await apiClient.submitLiterature({
            source: {
              title: updatedItem.title,
              authors: updatedItem.authors,
              doi: updatedItem.doi,
              url: updatedItem.url,
              year: updatedItem.year,
              journal: updatedItem.publication
            }
          });

          // 更新条目状态为"处理中"并保存任务ID
          const processingItem = {
            ...updatedItem,
            backendTask: {
              task_id: taskId,
              execution_status: 'processing',
              result_type: 'created',
              literature_id: null,
              literature_status: null,
              status: 'processing',
              overall_progress: 0,
              current_stage: '正在提交处理任务',
              resource_url: null,
              error_info: null
            }
          };

          await libraryService.updateLibraryItem(id, {
            backendTask: {
              task_id: taskId,
              execution_status: 'processing',
              result_type: 'created',
              literature_id: null,
              literature_status: null,
              status: 'processing',
              overall_progress: 0,
              current_stage: '正在提交处理任务',
              resource_url: null,
              error_info: null
            }
          });

          // 添加到轮询列表
          get().addTaskToPolling(taskId, id, updatedItem.title);

          const updatedItems = items.map(item =>
            item.id === id ? processingItem : item
          );

          set({
            items: updatedItems,
            isLoading: false
          });

          console.log(`✅ Literature updated and submitted for backend processing, task_id: ${taskId}`);
        } catch (backendError) {
          console.error('❌ Failed to submit to backend, but local update succeeded:', backendError);
          // 即使后端提交失败，本地更新也已成功，继续正常流程
          const updatedItems = items.map(item =>
            item.id === id ? updatedItem : item
          );

          set({
            items: updatedItems,
            isLoading: false
          });
        }
      } else {
        // 没有新增可解析信息，只是常规更新
        const updatedItems = items.map(item =>
          item.id === id ? updatedItem : item
        );

        set({
          items: updatedItems,
          isLoading: false
        });

        console.log('✅ Literature item updated successfully in local database:', updatedItem.title);
      }
    } catch (error) {
      console.error('❌ Failed to update literature item:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update library item'
      });
    }
  },

  // Delete library item action - 🗑️ 前端本地数据管理
  deleteLibraryItem: async (id: string) => {
    try {
      set({ isLoading: true, error: null });

      // 🗑️ 直接删除本地数据库记录 (前端自治管理)
      console.log('🗑️ Deleting literature item from local database...', id);
      await libraryService.deleteLibraryItem(id);

      // 🔄 更新本地状态 (UI刷新)
      const { items } = get();
      const updatedItems = items.filter(item => item.id !== id);

      set({
        items: updatedItems,
        isLoading: false
      });

      console.log('✅ Literature item deleted successfully from local database');
    } catch (error) {
      console.error('❌ Failed to delete literature item:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to delete library item'
      });
    }
  },

  // Delete multiple library items in batch
  deleteLibraryItems: async (ids: string[]) => {
    try {
      set({ isLoading: true, error: null });

      console.log(`[LibraryStore] Batch deleting ${ids.length} items`);

      // Delete all items in parallel for better performance
      const deletePromises = ids.map(id => libraryService.deleteLibraryItem(id));
      await Promise.all(deletePromises);

      // Update local state in one operation
      const { items } = get();
      const updatedItems = items.filter(item => !ids.includes(item.id));

      console.log(`[LibraryStore] Batch delete completed. ${updatedItems.length} items remaining`);

      set({
        items: updatedItems,
        isLoading: false
      });
    } catch (error) {
      console.error('[LibraryStore] Batch delete error:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to delete library items'
      });
    }
  },

  // Search and filtering actions
  setSourceFilter: (source: LiteratureSource | 'all') => {
    set({ sourceFilter: source });
  },

  setSearchTerm: (term: string) => {
    set({ searchTerm: term });
  },

  getFilteredItems: () => {
    const { items, sourceFilter, searchTerm, topicFilter } = get();

    let filtered = items;

    // Filter by source
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(item => item.source === sourceFilter);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(term) ||
        item.authors.some(author => author.toLowerCase().includes(term)) ||
        item.publication?.toLowerCase().includes(term) ||
        item.abstract?.toLowerCase().includes(term)
      );
    }

    // 🏷️ Filter by topics
    if (topicFilter.length > 0) {
      filtered = filtered.filter(item => {
        if (!item.topics || item.topics.length === 0) {
          return false; // 没有topics的文献不匹配任何话题过滤
        }
        // 只要文献的topics中包含任一选中的话题就匹配
        return topicFilter.some(selectedTopic => 
          item.topics!.includes(selectedTopic)
        );
      });
    }

    return filtered;
  },

  // Zotero integration actions
  configureZotero: async (config: ZoteroConfig) => {
    try {
      set({ isLoading: true, error: null });

      zoteroService.setConfig(config);
      const isConnected = await zoteroService.testConnection();

      if (isConnected) {
        set({
          zoteroConfig: config,
          isZoteroConfigured: true,
          isLoading: false
        });
        return true;
      } else {
        throw new Error('Failed to connect to Zotero');
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to configure Zotero'
      });
      return false;
    }
  },

  syncWithZotero: async () => {
    try {
      set({ isLoading: true, error: null });

      if (!get().isZoteroConfigured) {
        throw new Error('Zotero not configured');
      }

      const { items } = get();
      const syncResult = await zoteroService.syncItems(items);

      if (syncResult.success) {
        // Refresh items list after sync
        const updatedItems = await libraryService.getAllLibraryItems();
        set({
          items: updatedItems,
          zoteroSyncResult: syncResult,
          isLoading: false
        });
      } else {
        throw new Error(syncResult.errors.join('; '));
      }

      return syncResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync with Zotero';
      set({
        isLoading: false,
        error: errorMessage,
        zoteroSyncResult: {
          success: false,
          itemsAdded: 0,
          itemsUpdated: 0,
          itemsSkipped: 0,
          errors: [errorMessage]
        }
      });
      return get().zoteroSyncResult!;
    }
  },

  clearZoteroConfig: () => {
    set({
      zoteroConfig: null,
      isZoteroConfigured: false,
      zoteroSyncResult: null
    });
  },

  // PDF upload and processing actions
  setCurrentDetailItem: (item: LibraryItem | null) => {
    set({ currentDetailItem: item });
  },

  uploadPdfForItem: async (itemId: string, file: File) => {
    try {
      set({ isUploadingPdf: true, error: null });

      // 🚀 使用API客户端上传PDF
      console.log('📤 Uploading PDF for item via API client...', itemId);
      const formData = new FormData();
      formData.append('file', file);
      await apiClient.uploadPdf(itemId, formData);

      // Refresh the items list
      const updatedItems = await libraryService.getAllLibraryItems();
      set({
        items: updatedItems,
        isUploadingPdf: false
      });

      console.log('✅ PDF uploaded successfully');
    } catch (error) {
      console.error('❌ Failed to upload PDF:', error);
      set({
        isUploadingPdf: false,
        error: error instanceof Error ? error.message : 'Failed to upload PDF'
      });
    }
  },

  bulkUploadPdfs: async (files: File[]) => {
    try {
      set({ isUploadingPdf: true, error: null });

      const totalFiles = files.length;
      const { uploadProgress } = get();

      for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        const tempId = `upload_${i}`;

        // Update progress
        set({
          uploadProgress: {
            ...uploadProgress,
            [tempId]: ((i + 1) / totalFiles) * 100
          }
        });

        // 🚀 使用API客户端创建文献并上传PDF
        const fileName = file.name.replace('.pdf', '');
        const newItem = await apiClient.createLibraryItem({
          title: fileName,
          authors: ['Unknown'],
          year: new Date().getFullYear(),
          source: 'manual'
        });

        // 上传PDF
        const formData = new FormData();
        formData.append('file', file);
        await apiClient.uploadPdf(newItem.id, formData);
      }

      // Refresh the items list
      const updatedItems = await libraryService.getAllLibraryItems();
      set({
        items: updatedItems,
        isUploadingPdf: false,
        uploadProgress: {}
      });
    } catch (error) {
      set({
        isUploadingPdf: false,
        error: error instanceof Error ? error.message : 'Failed to upload PDFs',
        uploadProgress: {}
      });
    }
  },

  // Auto-metadata extraction settings
  setAutoExtractMetadata: (enabled: boolean) => {
    set({ autoExtractMetadata: enabled });
    // TODO: 将此设置移动到全局设置系统中
    // 应该持久化到localStorage或设置数据库中
    try {
      localStorage.setItem('library.autoExtractMetadata', JSON.stringify(enabled));
    } catch (error) {
      console.warn('Failed to save autoExtractMetadata setting to localStorage:', error);
    }
  },

  // ✏️ 更新引文信息
  updateExtractedReference: async (itemId: string, referenceIndex: number, updatedReference: any) => {
    try {
      set({ isLoading: true, error: null });

      await libraryService.updateExtractedReference(itemId, referenceIndex, updatedReference);

      // 刷新文献列表以反映更新
      const updatedItems = await libraryService.getAllLibraryItems();
      set({
        items: updatedItems,
        isLoading: false
      });

      console.log(`[LibraryStore] Updated reference ${referenceIndex} for item ${itemId}`);
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update reference'
      });
      throw error;
    }
  },

  // ➕ 添加新引文信息
  addExtractedReference: async (itemId: string, newReference: any) => {
    try {
      set({ isLoading: true, error: null });

      await libraryService.addExtractedReference(itemId, newReference);

      // 刷新文献列表以反映更新
      const updatedItems = await libraryService.getAllLibraryItems();
      set({
        items: updatedItems,
        isLoading: false
      });

      console.log(`[LibraryStore] Added new reference for item ${itemId}`);
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to add reference'
      });
      throw error;
    }
  },

  // 🔗 创建手动引文链接
  createManualCitationLink: async (sourceItemId: string, targetItemId: string) => {
    try {
      set({ isLoading: true, error: null });

      const success = await libraryService.createManualCitationLink(sourceItemId, targetItemId);

      // 🎯 更新citation版本号，通知图谱刷新
      if (success) {
        const { citationVersion } = get();
        set({ citationVersion: citationVersion + 1, isLoading: false });
        console.log(`[LibraryStore] Created manual citation link: ${sourceItemId} -> ${targetItemId}`);
        console.log(`🔄 Citation version updated after manual link: ${citationVersion} → ${citationVersion + 1}`);
      } else {
        set({ isLoading: false });
        console.log(`[LibraryStore] Citation link already exists: ${sourceItemId} -> ${targetItemId}`);
      }

      return success;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create citation link'
      });
      throw error;
    }
  },

  // 🗑️ 删除引文链接
  deleteCitationLink: async (sourceItemId: string, targetItemId: string) => {
    try {
      set({ isLoading: true, error: null });

      await libraryService.deleteCitationLink(sourceItemId, targetItemId);

      // 🎯 更新citation版本号，通知图谱刷新
      const { citationVersion } = get();
      set({ citationVersion: citationVersion + 1, isLoading: false });

      console.log(`[LibraryStore] Deleted manual citation link: ${sourceItemId} -> ${targetItemId}`);
      console.log(`🔄 Citation version updated after link deletion: ${citationVersion} → ${citationVersion + 1}`);

    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to delete citation link'
      });
      throw error;
    }
  },

  // 🏷️ Topics filtering actions
  setTopicFilter: (topics: string[]) => {
    set({ topicFilter: topics });
    console.log(`[LibraryStore] Topic filter updated:`, topics);
  },

  addTopicToFilter: (topic: string) => {
    const { topicFilter } = get();
    if (!topicFilter.includes(topic)) {
      const newFilter = [...topicFilter, topic];
      set({ topicFilter: newFilter });
      console.log(`[LibraryStore] Added topic to filter: ${topic}`);
    }
  },

  removeTopicFromFilter: (topic: string) => {
    const { topicFilter } = get();
    const newFilter = topicFilter.filter(t => t !== topic);
    set({ topicFilter: newFilter });
    console.log(`[LibraryStore] Removed topic from filter: ${topic}`);
  },

  loadAvailableTopics: async () => {
    try {
      // 🎯 统一话题概念：只从深度研究历史中收集话题
      const topicsSet = new Set<string>();
      
      try {
        // 从useHistoryStore获取研究历史
        const { history } = await import('@/store/history').then(m => m.useHistoryStore.getState());
        if (history && history.length > 0) {
          history.forEach((session: any) => {
            if (session.question && session.question.trim()) {
              topicsSet.add(session.question.trim());
            }
            if (session.title && session.title.trim()) {
              topicsSet.add(session.title.trim());
            }
          });
        }

        // 从当前任务中获取话题
        const taskData = localStorage.getItem('task-store');
        if (taskData) {
          const task = JSON.parse(taskData);
          if (task?.state?.question && task.state.question.trim()) {
            topicsSet.add(task.state.question.trim());
          }
          if (task?.state?.title && task.state.title.trim()) {
            topicsSet.add(task.state.title.trim());
          }
        }

        console.log(`[LibraryStore] 🎯 Found ${topicsSet.size} research topics from history`);
      } catch (error) {
        console.error('[LibraryStore] Failed to load research topics:', error);
      }
      
      const availableTopics = Array.from(topicsSet)
        .filter(topic => topic.length > 0) // 过滤空字符串
        .sort();
      
      set({ availableTopics });
      
      console.log(`[LibraryStore] 🎯 Loaded ${availableTopics.length} research topics:`, availableTopics);
    } catch (error) {
      console.error('[LibraryStore] Failed to load available topics:', error);
    }
  }
}));