/**
 * 🌳 话题树连接器 - TopicTreeConnector
 * 
 * 核心职责：
 * - 管理话题(TaskStore)与树(LiteratureTree)的关联关系
 * - 实现话题级别的历史记录和状态恢复
 * - 提供话题-树自动绑定和生命周期管理
 * - 协调话题研究进度与树构建算法
 * 
 * 设计理念：
 * - 一个话题对应一棵树，树ID存储在TaskStore.treeId中
 * - 话题的历史记录包含树的状态和进度
 * - 提供类似SessionLiteratureConnector的接口
 */

import React from 'react';
import { LiteratureTree, MCTSNode } from '@/libs/db';
import { TaskStore, useTaskStore } from '@/store/task';
import { useHistoryStore, ResearchHistory } from '@/store/history';
import { useLibraryStore } from '@/store/libraryStore';
import { treeService } from '@/libs/tree/TreeService';
import { libraryService } from '@/libs/db/LibraryService';
import { TreeController } from '@/libs/tree/TreeController';
import { toast } from 'sonner';

export interface TopicTreeOptions {
  topic: string;
  autoCreateTree?: boolean;  // 是否自动创建树
  persistHistory?: boolean;  // 是否持久化历史
}

export interface TopicTreeState {
  topic: string;
  taskStore: TaskStore;
  tree: LiteratureTree | null;
  treeController: TreeController | null;
  isLoading: boolean;
  error: string | null;
}

export class TopicTreeConnector {
  private topic: string;
  private autoCreateTree: boolean;
  private persistHistory: boolean;
  private state: TopicTreeState;
  
  constructor(options: TopicTreeOptions) {
    this.topic = options.topic;
    this.autoCreateTree = options.autoCreateTree ?? true;
    this.persistHistory = options.persistHistory ?? true;
    
    this.state = {
      topic: this.topic,
      taskStore: useTaskStore.getState(),
      tree: null,
      treeController: null,
      isLoading: false,
      error: null
    };
  }

  /**
   * 🚀 初始化话题树连接器
   * 根据话题恢复或创建树状态
   */
  async initialize(): Promise<void> {
    try {
      this.state.isLoading = true;
      this.state.error = null;

      console.log(`🌳 [TopicTreeConnector] Initializing for topic: ${this.topic}`);

      // 1. 从历史记录中恢复话题状态
      const restoredTaskStore = await this.loadTopicFromHistory();
      
      if (restoredTaskStore) {
        console.log(`📂 Restored topic state from history, treeId: ${restoredTaskStore.treeId}`);
        
        // 恢复TaskStore状态
        useTaskStore.getState().restore(restoredTaskStore);
        this.state.taskStore = restoredTaskStore;
        
        // 如果有关联的树，加载树状态
        if (restoredTaskStore.treeId) {
          await this.loadTree(restoredTaskStore.treeId);
        }
      } else {
        console.log('🆕 No history found, creating new topic state');
        
        // 初始化新的话题状态
        this.state.taskStore = {
          ...useTaskStore.getState(),
          title: this.topic,
          question: '', // 可以根据话题生成默认问题
          treeId: undefined
        };
      }

      // 2. 如果需要且没有树，自动创建树
      if (this.autoCreateTree && !this.state.tree && this.state.taskStore.title) {
        await this.createTreeForTopic();
      }

      this.state.isLoading = false;
      console.log(`✅ [TopicTreeConnector] Initialized successfully`);

    } catch (error) {
      this.state.isLoading = false;
      this.state.error = error instanceof Error ? error.message : 'Initialization failed';
      console.error('❌ [TopicTreeConnector] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * 📂 从历史记录中加载话题状态
   */
  private async loadTopicFromHistory(): Promise<TaskStore | null> {
    if (!this.persistHistory) return null;

    try {
      const historyStore = useHistoryStore.getState();
      
      // 查找匹配话题的历史记录（按title匹配）
      const matchingHistory = historyStore.history.find(
        (record: ResearchHistory) => record.title === this.topic
      );

      if (matchingHistory) {
        console.log(`📂 Found history record: ${matchingHistory.id}`);
        return matchingHistory;
      }

      return null;
    } catch (error) {
      console.warn('Failed to load topic from history:', error);
      return null;
    }
  }

  /**
   * 🌳 为话题创建新的文献树
   */
  private async createTreeForTopic(): Promise<void> {
    try {
      console.log(`🌱 Creating new tree for topic: ${this.topic}`);

      // 使用话题标题作为树名称
      const treeName = `研究树 - ${this.topic}`;
      
      // 这里需要一个根节点的文献项，可以是：
      // 1. 话题相关的第一篇文献
      // 2. 创建一个话题摘要文献项
      // 3. 让用户手动选择根节点
      
      // 暂时跳过自动创建，等待用户手动触发
      console.log(`⏳ Tree creation deferred until user selects root literature`);
      
    } catch (error) {
      console.error('Failed to create tree for topic:', error);
      throw error;
    }
  }

  /**
   * 📖 加载现有的树
   */
  private async loadTree(treeId: string): Promise<void> {
    try {
      console.log(`📖 Loading tree: ${treeId}`);

      const tree = await treeService.getTree(treeId);
      if (!tree) {
        throw new Error(`Tree not found: ${treeId}`);
      }

      this.state.tree = tree;
      this.state.treeController = new TreeController(tree, libraryService);

      console.log(`✅ Tree loaded successfully: ${tree.name}`);
    } catch (error) {
      console.error('Failed to load tree:', error);
      // 清除无效的树ID引用
      this.state.taskStore.treeId = undefined;
      useTaskStore.getState().setTreeId(undefined);
      throw error;
    }
  }

  /**
   * 🌳 为话题设置根节点并创建树
   * 这是用户手动选择文献作为根节点时调用
   */
  async createTreeWithRootItem(rootItemId: string): Promise<string> {
    try {
      console.log(`🌱 Creating tree for topic "${this.topic}" with root item: ${rootItemId}`);

      const treeName = `研究树 - ${this.topic}`;
      const newTree = await treeService.createTree(treeName, rootItemId);

      // 更新状态
      this.state.tree = newTree;
      this.state.treeController = new TreeController(newTree, libraryService);
      this.state.taskStore.treeId = newTree.id;

      // 同步到全局状态
      useTaskStore.getState().setTreeId(newTree.id);

      // 保存历史记录
      if (this.persistHistory) {
        await this.saveToHistory();
      }

      console.log(`✅ Tree created successfully: ${newTree.id}`);
      return newTree.id;

    } catch (error) {
      console.error('Failed to create tree with root item:', error);
      throw error;
    }
  }

  /**
   * 💾 保存当前状态到历史记录
   */
  async saveToHistory(): Promise<void> {
    if (!this.persistHistory) return;

    try {
      const historyStore = useHistoryStore.getState();
      const currentTaskStore = useTaskStore.getState();

      // 检查是否已存在该话题的历史记录
      const existingHistory = historyStore.history.find(
        (record: ResearchHistory) => record.title === this.topic
      );

      if (existingHistory) {
        // 更新现有记录 - 使用backup()获取完整状态快照
        historyStore.update(existingHistory.id, currentTaskStore.backup());
        console.log(`💾 Updated history for topic: ${this.topic}`, {
          historyId: existingHistory.id,
          treeId: currentTaskStore.treeId
        });
      } else {
        // 创建新记录 - 使用backup()获取完整状态快照
        const historyId = historyStore.save(currentTaskStore.backup());
        console.log(`💾 Saved new history for topic: ${this.topic}`, {
          historyId,
          treeId: currentTaskStore.treeId
        });
      }
    } catch (error) {
      console.warn('Failed to save to history:', error);
    }
  }

  /**
   * 🚀 运行MCTS算法
   */
  async runMCTSSimulation(): Promise<void> {
    if (!this.state.treeController) {
      throw new Error('No tree controller available. Please create or load a tree first.');
    }

    try {
      console.log(`🚀 Running MCTS simulation for topic: ${this.topic}`);
      this.state.treeController.runSimulation();
      await this.state.treeController.save();
      
      // 保存历史记录
      await this.saveToHistory();
      
      console.log(`✅ MCTS simulation completed for topic: ${this.topic}`);
    } catch (error) {
      console.error('MCTS simulation failed:', error);
      throw error;
    }
  }

  /**
   * 📊 获取当前状态
   */
  getState(): TopicTreeState {
    return { ...this.state };
  }

  /**
   * 🎯 获取话题关联的树ID
   */
  getTreeId(): string | undefined {
    return this.state.taskStore.treeId;
  }

  /**
   * 🌳 获取树控制器
   */
  getTreeController(): TreeController | null {
    return this.state.treeController;
  }

  /**
   * 📚 获取当前任务存储状态
   */
  getTaskStore(): TaskStore {
    return this.state.taskStore;
  }

  /**
   * 🧹 清理资源
   */
  cleanup(): void {
    // 保存最终状态到历史
    if (this.persistHistory) {
      this.saveToHistory().catch(console.warn);
    }
    
    console.log(`🧹 TopicTreeConnector cleanup for topic: ${this.topic}`);
  }
}

/**
 * 🪝 React Hook 包装器
 * 提供便捷的React集成
 */
export function useTopicTreeConnector(options: TopicTreeOptions) {
  const [connector, setConnector] = React.useState<TopicTreeConnector | null>(null);
  const [state, setState] = React.useState<TopicTreeState | null>(null);

  React.useEffect(() => {
    const newConnector = new TopicTreeConnector(options);
    
    newConnector.initialize()
      .then(() => {
        setConnector(newConnector);
        setState(newConnector.getState());
      })
      .catch((error) => {
        console.error('Failed to initialize TopicTreeConnector:', error);
        toast.error(`话题树连接失败: ${error.message}`);
      });

    return () => {
      if (newConnector) {
        newConnector.cleanup();
      }
    };
  }, [options.topic]);

  return {
    connector,
    state,
    isReady: connector !== null && state !== null,
  };
}