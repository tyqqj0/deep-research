/**
 * 🎯 主页面树会话底座 - MainPageTreeSession
 * 
 * 核心职责：
 * - 自动化当前会话的树ID管理（从TaskStore获取）
 * - 封装来自LibraryStore的复杂树操作
 * - 提供简单的树操作接口，无需手动指定树ID
 * 
 * 设计原则：
 * - 不是状态管理器，只是ID自动化的简单封装层
 * - 所有操作自动使用当前会话的树ID
 * - 出错时提供清晰的错误信息
 */

import { useTaskStore } from '@/store/task';
import { useLibraryStore } from '@/store/libraryStore';
import { useHistoryStore } from '@/store/history';
import { treeService } from '@/libs/tree/TreeService';
import { libraryService } from '@/libs/db/LibraryService';
import { TreeController } from '@/libs/tree/TreeController';
import { SGMCTSController } from '@/libs/mcts/SGMCTSController';
import { AlgorithmFactory, createDefaultAlgorithmSuite, createDefaultModularAlgorithmSuite } from '@/libs/mcts/algorithms/AlgorithmFactory';
import { LiteratureTree, MCTSNode } from '@/libs/db';
import { toast } from 'sonner';

export interface TreeVisualizationProps {
  treeId: string | undefined;
  mode?: 'view' | 'edit' | 'embedded';
  height?: string;
  showControls?: boolean;
  showMiniMap?: boolean;
  showTreeSelector?: boolean;
  showNodeStats?: boolean;
  enablePhysics?: boolean;
}

export class MainPageTreeSession {
  private static instance: MainPageTreeSession | null = null;
  
  // 🎯 单例模式，确保整个应用只有一个会话管理器
  static getInstance(): MainPageTreeSession {
    if (!MainPageTreeSession.instance) {
      MainPageTreeSession.instance = new MainPageTreeSession();
    }
    return MainPageTreeSession.instance;
  }

  private constructor() {
    console.log('🎯 [MainPageTreeSession] 初始化会话管理器');
  }

  /**
   * 📊 获取当前会话的树ID（从TaskStore自动获取）
   */
  getCurrentTreeId(): string | null {
    const treeId = useTaskStore.getState().treeId || null;
    // console.log(`🔍 [MainPageTreeSession] 当前树ID: ${treeId}`);
    return treeId;
  }

  /**
   * 🔍 检查当前是否有活跃的树
   */
  hasActiveTree(): boolean {
    return this.getCurrentTreeId() !== null;
  }

  /**
   * 📋 获取当前会话状态摘要
   */
  getSessionSummary() {
    const taskStore = useTaskStore.getState();
    const treeId = this.getCurrentTreeId();
    
    return {
      topic: taskStore.title || '未命名话题',
      treeId,
      hasTree: treeId !== null,
      isReady: treeId !== null && taskStore.title !== ''
    };
  }

  /**
   * 🌳 创建新的会话树（自动关联到当前话题）
   */
  async createTree(rootItemId: string): Promise<string> {
    try {
      const taskStore = useTaskStore.getState();
      // 🎯 优先使用title，如果title为空则使用question
      const currentTopic = taskStore.title || taskStore.question || '研究话题';
      
      console.log(`🌱 [MainPageTreeSession] 创建新树`, {
        topic: currentTopic,
        rootItemId
      });

      // 检查是否已有树，询问用户是否替换
      const existingTreeId = this.getCurrentTreeId();
      if (existingTreeId) {
        const shouldReplace = confirm(
          `当前话题 "${currentTopic}" 已有关联的研究树。\n\n` +
          `点击确定：创建新树（将替换现有关联）\n` +
          `点击取消：保持现有树`
        );
        
        if (!shouldReplace) {
          console.log('📋 [MainPageTreeSession] 用户取消了树替换');
          return existingTreeId;
        }
      }

      // 创建新树
      const treeName = `研究树 - ${currentTopic}`;
      const newTree = await treeService.createTree(treeName, rootItemId);
      
      if (!newTree || !newTree.id) {
        throw new Error('树创建失败：服务返回无效的树对象');
      }

      // 更新TaskStore中的树关联
      taskStore.setTreeId(newTree.id);

      // 🎯 只有当title为空时才设置，避免覆盖现有的title
      if (!taskStore.title && taskStore.question) {
        taskStore.setTitle(taskStore.question);
        console.log(`🎯 [MainPageTreeSession] 将question设置为title: ${taskStore.question}`);
      }

      // 保存到历史记录
      await this.saveCurrentSessionToHistory();

      // 自动选择新树
      await useLibraryStore.getState().selectTree(newTree.id);

      console.log(`✅ [MainPageTreeSession] 树创建成功`, {
        treeId: newTree.id,
        treeName: newTree.name,
        topic: currentTopic
      });

      toast.success('会话树创建成功！', {
        description: `已为话题 "${currentTopic}" 创建研究树`,
        duration: 3000
      });

      return newTree.id;

    } catch (error) {
      console.error('❌ [MainPageTreeSession] 树创建失败:', error);
      toast.error('创建会话树失败', {
        description: error instanceof Error ? error.message : '未知错误',
        duration: 5000
      });
      throw error;
    }
  }

  /**
   * 📖 获取当前会话的树对象（使用useTree Hook的实时数据）
   */
  async getCurrentTree(): Promise<LiteratureTree | null> {
    const treeId = this.getCurrentTreeId();
    if (!treeId) {
      console.log('ℹ️ [MainPageTreeSession] 当前没有活跃的树');
      return null;
    }

    try {
      // 🎯 使用TreeService但保持fallback机制
      const tree = await treeService.getTreeById(treeId);
      if (!tree) {
        console.warn(`⚠️ [MainPageTreeSession] 树 ${treeId} 不存在，执行自动清理`);
        await this.handleInvalidTreeReference(treeId);
        return null;
      }

      return tree;
    } catch (error) {
      console.error('❌ [MainPageTreeSession] 获取树失败:', error);
      await this.handleInvalidTreeReference(treeId);
      return null;
    }
  }

  /**
   * 🎯 获取useTree Hook的配置（供组件使用）
   */
  getTreeHookProps() {
    return {
      treeId: this.getCurrentTreeId(),
      // 可以添加其他配置
    };
  }

  /**
   * 🎨 获取TreeVisualization组件的统一配置
   */
  getTreeVisualizationProps(overrides: any = {}) {
    const currentTreeId = this.getCurrentTreeId();

    return {
      treeId: currentTreeId,
      mode: 'edit' as const,
      height: '600px',
      showControls: true,
      showMiniMap: true,
      showTreeSelector: true,
      showNodeStats: true,
      enablePhysics: true,
      ...overrides,
      // 🎯 确保treeId始终来自当前会话
      treeId: overrides.treeId || currentTreeId,
    };
  }

  /**
   * 🧹 处理无效树引用的自动清理
   */
  private async handleInvalidTreeReference(invalidTreeId: string): Promise<void> {
    try {
      console.log(`🧹 [MainPageTreeSession] 开始清理无效树引用: ${invalidTreeId}`);

      const taskStore = useTaskStore.getState();
      const historyStore = useHistoryStore.getState();

      // 1. 清理TaskStore中的树ID引用
      taskStore.setTreeId(undefined);

      // 2. 清理算法状态
      taskStore.clearAlgorithmState();

      // 3. 更新历史记录，移除对无效树的引用
      const currentTitle = taskStore.title;
      if (currentTitle) {
        const existingHistory = historyStore.history.find(record => record.title === currentTitle);
        if (existingHistory && existingHistory.treeId === invalidTreeId) {
          const updatedState = { ...existingHistory, treeId: undefined };
          historyStore.update(existingHistory.id, updatedState);
          console.log(`🧹 [MainPageTreeSession] 已更新历史记录，移除无效树引用`);
        }
      }

      // 4. 显示用户友好的提示
      toast.info('检测到无效的树引用，已自动清理', {
        description: '请重新选择文献创建新的研究树',
        duration: 4000
      });

      console.log(`✅ [MainPageTreeSession] 无效树引用清理完成`);

    } catch (error) {
      console.error('❌ [MainPageTreeSession] 清理无效树引用失败:', error);
    }
  }

  // 🗑️ 传统算法已移除，统一使用模块化算法

  /**
   * 🎮 获取MCTS控制器（统一使用模块化TVC算法）
   */
  async getMCTSController(): Promise<SGMCTSController> {
    const tree = await this.getCurrentTree();
    if (!tree) {
      throw new Error('无法获取模块化MCTS控制器：当前没有活跃的树。请先创建或选择一个树。');
    }

    try {
      // 创建模块化算法组件
      const modularAlgorithms = createDefaultModularAlgorithmSuite();
      
      // 创建默认MCTS配置（模块化算法用更保守的参数）
      const config = {
        explorationConstant: 1.41,
        semanticWeight: 0.4,
        maxIterations: 50,
        maxDepth: 8,
        temperatureDecay: 0.9,
        batchSize: 3
      };
      
      // 创建模块化MCTS控制器
      const controller = new SGMCTSController(modularAlgorithms, config);

      console.log(`🚀 [MainPageTreeSession] MCTS控制器创建成功，树ID: ${tree.id}`);
      return controller;

    } catch (error) {
      console.error('❌ [MainPageTreeSession] 创建模块化MCTS控制器失败:', error);
      throw new Error(`创建模块化MCTS控制器失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 🚀 运行MCTS迭代（统一使用模块化TVC算法）
   */
  async runMCTSIteration(): Promise<void> {
    try {
      const tree = await this.getCurrentTree();
      if (!tree) {
        throw new Error('无法运行MCTS：当前没有活跃的树。请先创建或选择一个树。');
      }

      const controller = await this.getMCTSController();

      // 创建评估上下文
      const libraryItems = useLibraryStore.getState().items;
      const taskStore = useTaskStore.getState();
      
      const context = {
        currentPath: [], // 初始为空路径，会在算法执行中更新
        availableLiterature: libraryItems,
        researchTopic: taskStore.title || '未命名研究话题',
        iterationCount: 0, // 这会在控制器内部管理
        treeDepth: Object.keys(tree.nodes).length
      };

      console.log(`🚀 [MainPageTreeSession] 开始MCTS迭代 (模块化TVC算法)`);

      const result = await controller.runSingleIteration(tree, context);

      // 保存更新后的树（如果有新节点被添加）
      if (result.expandedNode) {
        await treeService.updateTree(tree);
        console.log(`💾 [MainPageTreeSession] 树已更新，新增节点: ${result.expandedNode.id}`);
      }

      console.log(`✅ [MainPageTreeSession] MCTS迭代完成`, {
        selectedNode: result.selectedNode.id,
        expandedNode: result.expandedNode?.id || 'none',
        reward: result.reward.toFixed(3),
        executionTime: result.executionTime
      });

      toast.success(`MCTS迭代完成`, {
        description: `模块化TVC算法，奖励: ${result.reward.toFixed(2)}`,
        duration: 2000
      });

    } catch (error) {
      console.error('❌ [MainPageTreeSession] MCTS迭代失败:', error);
      toast.error('MCTS迭代失败', {
        description: error instanceof Error ? error.message : '未知错误',
        duration: 5000
      });
      throw error;
    }
  }

  /**
   * 🎨 获取TreeVisualization组件的Props
   */
  getTreeVisualizationProps(options: Partial<TreeVisualizationProps> = {}): TreeVisualizationProps {
    const currentTreeId = this.getCurrentTreeId();
    const defaultProps: TreeVisualizationProps = {
      treeId: currentTreeId || undefined,
      mode: 'edit',
      height: '600px',
      showControls: true,
      showMiniMap: true,
      showTreeSelector: true,
      showNodeStats: true,
      enablePhysics: true,
      ...options
    };

    console.log(`🎨 [MainPageTreeSession] TreeVisualization Props:`, defaultProps);
    return defaultProps;
  }

  /**
   * 💾 保存当前会话状态到历史记录
   */
  private async saveCurrentSessionToHistory(): Promise<void> {
    try {
      const taskStore = useTaskStore.getState();
      const historyStore = useHistoryStore.getState();
      
      if (!taskStore.title) {
        console.log('ℹ️ [MainPageTreeSession] 话题为空，跳过历史记录保存');
        return;
      }

      // 获取更新后的最新状态
      const updatedTaskStore = useTaskStore.getState();

      // 🎯 基于会话ID查找现有历史记录，而不是title
      const existingHistory = historyStore.history.find(
        record => record.id === updatedTaskStore.id
      );

      if (existingHistory) {
        historyStore.update(existingHistory.id, updatedTaskStore.backup());
        console.log(`💾 [MainPageTreeSession] 更新历史记录`, {
          historyId: existingHistory.id,
          sessionId: updatedTaskStore.id,
          topic: updatedTaskStore.title || updatedTaskStore.question,
          treeId: updatedTaskStore.treeId
        });
      } else {
        const historyId = historyStore.save(updatedTaskStore.backup());
        console.log(`💾 [MainPageTreeSession] 创建新历史记录`, {
          historyId,
          sessionId: updatedTaskStore.id,
          topic: updatedTaskStore.title || updatedTaskStore.question,
          treeId: updatedTaskStore.treeId
        });
      }
    } catch (error) {
      console.warn('⚠️ [MainPageTreeSession] 保存历史记录失败:', error);
    }
  }

  /**
   * 🔄 从历史记录恢复会话状态
   */
  async restoreSessionFromHistory(topicTitle: string): Promise<boolean> {
    try {
      const historyStore = useHistoryStore.getState();
      const history = historyStore.history.find(record => record.title === topicTitle);
      
      if (!history) {
        console.log(`ℹ️ [MainPageTreeSession] 未找到话题 "${topicTitle}" 的历史记录`);
        return false;
      }

      // 恢复TaskStore状态
      const taskStore = useTaskStore.getState();
      taskStore.restore(history);

      console.log(`🔄 [MainPageTreeSession] 从历史记录恢复会话`, {
        topic: topicTitle,
        treeId: history.treeId,
        historyId: history.id
      });

      // 🎯 如果有关联的树，验证其有效性并自动清理无效引用
      if (history.treeId) {
        try {
          const tree = await treeService.getTreeById(history.treeId);
          if (!tree) {
            console.warn(`⚠️ [MainPageTreeSession] 历史记录中的树 ${history.treeId} 不存在，执行自动清理`);
            await this.handleInvalidTreeReference(history.treeId);
          } else {
            console.log(`✅ [MainPageTreeSession] 历史记录中的树 ${history.treeId} 验证成功`);
          }
        } catch (error) {
          console.warn(`⚠️ [MainPageTreeSession] 验证历史记录中的树失败: ${error.message}`);
          await this.handleInvalidTreeReference(history.treeId);
        }
      }

      return true;

    } catch (error) {
      console.error('❌ [MainPageTreeSession] 恢复会话失败:', error);
      return false;
    }
  }

  /**
   * 🧹 清理当前会话（用于切换话题或重置）
   */
  clearCurrentSession(): void {
    console.log('🧹 [MainPageTreeSession] 开始清理当前会话状态');

    const taskStore = useTaskStore.getState();
    const historyStore = useHistoryStore.getState();

    // 1. 清理TaskStore中的树关联
    taskStore.setTreeId(undefined);

    // 2. 清理算法状态
    taskStore.clearAlgorithmState();

    // 3. 更新历史记录，移除树ID引用
    const currentTitle = taskStore.title;
    if (currentTitle) {
      const existingHistory = historyStore.history.find(record => record.title === currentTitle);
      if (existingHistory && existingHistory.treeId) {
        const updatedState = { ...existingHistory, treeId: undefined };
        historyStore.update(existingHistory.id, updatedState);
        console.log(`🧹 [MainPageTreeSession] 已更新历史记录，移除树ID引用`);
      }
    }

    console.log('✅ [MainPageTreeSession] 会话状态清理完成');
  }
}