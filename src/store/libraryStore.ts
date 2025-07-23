import { create } from 'zustand';
import { liveQuery } from 'dexie';
import { LibraryItem, LiteratureTree, db } from '../libs/db';
import { LITERATURE_SOURCES, DEFAULT_LIBRARY_ITEM_SOURCE, LiteratureSource } from '../libs/db/constants';
import { libraryService } from '../libs/db/LibraryService';
import { apiClient, BackendTaskResponse, Literature } from '../libs/api'; // 🚀 使用新的API Client和类型
import { TreeController } from '../libs/tree/TreeController';
import { zoteroService, ZoteroConfig, ZoteroSyncResult } from '../libs/zotero';
import { generateLibraryItemId } from '../libs/utils/uuid';

// Define State interface
interface LibraryState {
  items: LibraryItem[];
  trees: LiteratureTree[];
  activeTreeController: TreeController | null;
  isLoading: boolean;
  error: string | null;
  treeVersion: number; // Version number to trigger UI updates
  isInitialized: boolean;

  // Filtering and search
  sourceFilter: LiteratureSource | 'all';
  searchTerm: string;

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
}

// Define Actions interface
interface LibraryActions {
  // Core actions
  initialize: () => Promise<void>;
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
  isInitialized: false,

  // Filtering and search
  sourceFilter: 'all',
  searchTerm: '',

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

    } catch (error) {
      console.error('LibraryStore: Initialization failed:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize library',
        isInitialized: true // also mark as initialized on failure to prevent re-initializing loop
      });
    }
  },

  // 启动实时数据更新监听
  startRealTimeUpdates: () => {
    console.log('📡 Subscribing to real-time library updates with liveQuery...');

    const observable = liveQuery(() => libraryService.getAllLibraryItems());

    const subscription = observable.subscribe({
      next: (updatedItems) => {
        // liveQuery is efficient and only triggers on actual data changes in Dexie.
        // It's better than polling as it avoids unnecessary checks and provides
        // instant updates. We no longer need to check for "processing items"
        // because any relevant change (like status update) will be caught.
        console.log(`🔄 Library updated via liveQuery. Total items: ${updatedItems.length}`);
        set({ items: updatedItems });
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

  // 🚀 处理任务状态更新（内部方法） - 重构为新API结构
  handleTaskStatusUpdate: async (taskInfo: any, response: BackendTaskResponse) => {
    const { activeTasks, items } = get();

    console.log(`🔄 Processing task update: ${taskInfo.taskId} - execution_status: ${response.execution_status}`);

    // 🔄 处理进行中的任务
    if (response.execution_status === 'processing' || response.execution_status === 'pending') {
      const updatedItems = items.map(item => {
        if (item.id === taskInfo.literatureId) {
          return {
            ...item,
            // 🚀 更新backendTask字段为完整的响应数据
            backendTask: response,
            updatedAt: new Date()
          };
        }
        return item;
      });

      set({ items: updatedItems });

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

        // 🔗 自动触发引文链接流程
        if (finalLiterature.references && finalLiterature.references.length > 0) {
          console.log(`🔗 Auto-linking ${finalLiterature.references.length} references...`);

          try {
            if (response.result_type === 'created') {
              // 新创建的文献，使用双向链接
              console.log('🔄 Triggering bidirectional linking for new literature...');
              const linkResult = await libraryService.linkNewItemBidirectionally(literatureId);
              console.log(`✅ Bidirectional linking completed: ${linkResult.forwardLinks} forward, ${linkResult.backwardLinks} backward`);
            } else {
              // 重复文献，使用单向链接
              console.log('➡️ Triggering unidirectional linking for duplicate literature...');
              const linkResult = await libraryService.linkCitationsForItem(literatureId);
              console.log(`✅ Citation linking completed: ${linkResult.linkedCount}/${linkResult.totalReferences} linked`);
            }
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

  // Add multiple library items in batch - 🚀 重构为使用后端API
  addLibraryItems: async (itemsData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    try {
      set({ isLoading: true, error: null });

      const results = [];
      const totalFiles = itemsData.length;

      console.log(`📤 Batch creating ${totalFiles} literature items via backend API...`);

      for (let i = 0; i < totalFiles; i++) {
        const itemData = itemsData[i];

        try {
          // 🚀 调用后端API创建每个文献条目
          const createdItem = await apiClient.createLibraryItem({
            ...itemData,
            source: itemData.source || DEFAULT_LIBRARY_ITEM_SOURCE
          });

          // 同步到本地缓存
          await libraryService.addLibraryItem(createdItem);

          results.push({
            success: true,
            itemId: createdItem.id,
            title: createdItem.title
          });

          console.log(`✅ [${i + 1}/${totalFiles}] Created: ${createdItem.title}`);
        } catch (error) {
          console.error(`❌ [${i + 1}/${totalFiles}] Failed to create: ${itemData.title}`, error);
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            title: itemData.title
          });
        }
      }

      // 🔄 刷新状态列表 (从本地缓存，因为已同步)
      const updatedItems = await libraryService.getAllLibraryItems();

      console.log('[LibraryStore] addLibraryItems completed, refreshed with', updatedItems.length, 'total items');

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
        itemsAdded: successCount, // For Zotero compatibility
        itemsSkipped: errorCount  // For Zotero compatibility
      };
    } catch (error) {
      console.error('[LibraryStore] addLibraryItems error:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to add library items'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add library items',
        results: [],
        totalAdded: 0,
        totalErrors: itemsData.length
      };
    }
  },

  // Add library item action - 🚀 重构为支持异步任务流程
  addLibraryItem: async (itemData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      set({ isLoading: true, error: null });

      const { items } = get();
      const itemId = generateLibraryItemId();

      // 🔍 统一查重检查 - 无论是否有DOI/URL都要先检查重复
      if (itemData.title && itemData.title.trim() !== '') {
        console.log('🔍 Checking for duplicates:', itemData.title);
        const duplicates = await libraryService.checkDuplicateByTitle(itemData.title.trim());
        if (duplicates.length > 0) {
          console.log('❌ Duplicate found:', duplicates[0].title);
          set({
            isLoading: false,
            error: 'Duplicate literature found'
          });
          return { success: false, duplicate: duplicates };
        }
        console.log('✅ No duplicates found, proceeding...');
      }

      // 检查是否有可以让后端处理的信息 (DOI 或 URL)
      const canBeProcessedByBackend = Boolean(itemData.doi || itemData.url);

      if (canBeProcessedByBackend) {
        // 🚀 有DOI或URL，提交给后端进行异步处理
        console.log('📤 Submitting literature for backend processing...', itemData.title);

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
        try {
          await libraryService.addLibraryItem(temporaryItem);
          console.log('✅ [Store] Temporary item added to local cache successfully');

          const updatedItems = [...items, temporaryItem];
          set({
            items: updatedItems,
            isLoading: false
          });
        } catch (cacheError) {
          console.error('❌ [Store] Failed to add temporary item to local cache:', cacheError);
          throw new Error(`Failed to cache literature item: ${cacheError instanceof Error ? cacheError.message : 'Unknown error'}`);
        }

        // 🚀 将任务添加到轮询列表
        get().addTaskToPolling(taskId, itemId, itemData.title);

        console.log(`✅ Literature submitted for processing, task_id: ${taskId}`);
        return { success: true, itemId };

      } else {
        // 📝 仅有元数据，直接创建本地条目（不发送后端处理）
        console.log('📝 Creating local literature item (metadata only)...', itemData.title);

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
          console.log('✅ [Store] Local item added to cache successfully');

          const updatedItems = [...items, localItem];
          set({
            items: updatedItems,
            isLoading: false
          });
        } catch (cacheError) {
          console.error('❌ [Store] Failed to add local item to cache:', cacheError);
          throw new Error(`Failed to cache literature item: ${cacheError instanceof Error ? cacheError.message : 'Unknown error'}`);
        }

        console.log('✅ Local literature item created successfully:', localItem.title);
        return { success: true, itemId };
      }

    } catch (error) {
      console.error('❌ Failed to add literature item:', error);

      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to add literature item'
      });
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add literature item' };
    }
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
    const { items, sourceFilter, searchTerm } = get();

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

      set({ isLoading: false });

      if (success) {
        console.log(`[LibraryStore] Created manual citation link: ${sourceItemId} -> ${targetItemId}`);
      } else {
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

      set({ isLoading: false });

      console.log(`[LibraryStore] Deleted manual citation link: ${sourceItemId} -> ${targetItemId}`);

    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to delete citation link'
      });
      throw error;
    }
  }
}));