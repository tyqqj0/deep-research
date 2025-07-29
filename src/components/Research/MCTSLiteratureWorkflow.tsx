"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  TreePine,
  BookOpen,
  Search,
  Settings,
  Maximize2,
  Minimize2,
  LoaderCircle,
  CircleCheck,
  TextSearch,
  Hourglass,
  XCircle,
  Play,
  Pencil,
  Save,
  RotateCcw,
  Trash,
  NotebookText,
  Download
} from 'lucide-react';
import { toast } from 'sonner';

// 导入新的Hook和store
import useLiteratureResearch from '@/hooks/useLiteratureResearch';
import { useTreeBuilder } from '@/hooks/useTreeBuilder';
import { useTaskStore } from '@/store/task';
import { useLibraryStore } from '@/store/libraryStore';
import { LibraryItem } from '@/libs/db';
import { createSessionLiteratureConnector } from '@/libs/research/SessionLiteratureConnector';

// 导入组件
import LiteratureInfoPanel from './LiteratureInfoPanel';
import MCTSControlPanel from './MCTSControlPanel';
import SearchResult from './SearchResult';
import { TreeVisualization } from '@/components/Library/TreeVisualization';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// 🎯 MCTS研究工作流 - 回归原有架构的三块UI布局
// 1. 文献信息面板（上） 2. 树交互窗口（中） 3. 搜索任务面板（下 - 复用SearchResult逻辑）

interface MCTSLiteratureWorkflowProps {
  topic: string;
  reportPlan?: string;
  onTopicChange?: (topic: string) => void;
  treeId?: string;
  className?: string;
}

// 任务状态图标组件 - 复用SearchResult逻辑
function TaskState({ state }: { state: SearchTask["state"] }) {
  if (state === "completed") {
    return <CircleCheck className="h-5 w-5" />;
  } else if (state === "processing") {
    return <LoaderCircle className="animate-spin h-5 w-5" />;
  } else if (state === "waiting") {
    return <Hourglass className="h-5 w-5" />;
  } else if (state === "cancelled") {
    return <XCircle className="h-5 w-5" />;
  } else {
    return <TextSearch className="h-5 w-5" />;
  }
}

export default function MCTSLiteratureWorkflow({
  topic,
  reportPlan,
  onTopicChange,
  treeId,
  className = ''
}: MCTSLiteratureWorkflowProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const libraryStore = useLibraryStore();
  const libraryItems = useLibraryStore(state => state.items); // 🚀 直接订阅items状态
  const taskStore = useTaskStore();

  // 🚀 新的简化Hook
  const { status, runLiteratureSeeding, cancelTask } = useLiteratureResearch();

  // 🌳 TreeBuilder Hook - SG-MCTS功能
  const treeBuilder = useTreeBuilder();

  // 🔗 会话文献连接件
  const sessionConnector = useMemo(() => {
    return createSessionLiteratureConnector({
      topic,
      autoTag: true,
      filterByTopic: true
    });
  }, [topic]);

  // 🚀 直接计算会话文献，不依赖SessionLiteratureConnector的内部状态
  const sessionLiteratureFromStore = useMemo(() => {
    if (!topic || !topic.trim()) return [];
    
    const topicLower = topic.toLowerCase();
    const filteredItems = libraryItems.filter(item => {
      // 检查topics标签
      if (item.topics?.some(itemTopic => itemTopic.toLowerCase().includes(topicLower))) {
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
      // 检查关键词
      if (item.keywords?.some(keyword => keyword.toLowerCase().includes(topicLower))) {
        return true;
      }
      return false;
    });

    return filteredItems.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [libraryItems, topic]);

  // 本地状态
  const [isTreeMaximized, setIsTreeMaximized] = useState(false);
  const [sessionLiterature, setSessionLiterature] = useState<LibraryItem[]>([]);
  const [workflowStarted, setWorkflowStarted] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [originalTasks, setOriginalTasks] = useState<Record<string, SearchTask>>({});
  const [isGeneratingMockData, setIsGeneratingMockData] = useState(false);

  // 刷新会话文献列表 - 使用SessionLiteratureConnector
  const refreshSessionLiterature = useCallback(() => {
    const topicLiterature = sessionConnector.getTopicLiterature();

    const sortedLiterature = topicLiterature.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    setSessionLiterature(sortedLiterature);

    // 调试信息
    console.log(`[MCTSWorkflow] 刷新会话文献: ${sortedLiterature.length} 篇，话题: ${topic}`);
  }, [sessionConnector, libraryItems]); // 🚀 使用直接订阅的libraryItems而不是libraryStore.items

  useEffect(() => {
    refreshSessionLiterature();
  }, [refreshSessionLiterature]);

  // 🌱 开始文献播种
  const handleLiteratureSeeding = useCallback(async () => {
    try {
      setWorkflowStarted(true);
      await runLiteratureSeeding(topic, reportPlan);
      refreshSessionLiterature();
    } catch (error) {
      console.error('Failed to start literature seeding:', error);
      if (error instanceof Error) {
        toast.error(`文献播种失败: ${error.message}`);
      } else {
        toast.error(`文献播种失败: 发生未知错误`);
      }
    }
  }, [topic, reportPlan, runLiteratureSeeding, refreshSessionLiterature]);

  // 前往Library页面
  const handleViewLibrary = useCallback(() => {
    router.push('/library');
  }, [router]);

  // 树形可视化最大化切换
  const toggleTreeMaximize = useCallback(() => {
    setIsTreeMaximized(!isTreeMaximized);
  }, [isTreeMaximized]);

  // 🌳 设为根节点处理函数
  const handleSetAsRoot = useCallback(async (item: LibraryItem) => {
    try {
      toast.loading('正在创建知识树...', { id: 'tree-creation' });

      await treeBuilder.startTreeBuilding(item, topic);

      toast.success(`已将"${item.title}"设为根节点`, { id: 'tree-creation' });

      // 可选：切换到树可视化模式
      setIsTreeMaximized(false);

    } catch (error) {
      console.error('设置根节点失败:', error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      toast.error(`设置根节点失败: ${errorMsg}`, { id: 'tree-creation' });
    }
  }, [topic, treeBuilder]);

  // 🧪 生成模拟数据处理函数
  const handleGenerateMockData = useCallback(async () => {
    if (isGeneratingMockData) return;

    setIsGeneratingMockData(true);

    try {
      // 预定义的模拟URL列表 - 包含一些无效URL来测试错误处理
      const mockUrls = [
        'https://arxiv.org/abs/2301.00001', // 示例arXiv论文
        'https://fake-journal.com/article/123456', // 🔗 测试无效URL
        'https://www.nature.com/articles/s41586-023-00001-0', // Nature文章
        'https://science.sciencemag.org/content/379/6628/123', // Science文章
        'https://invalid-domain-test.fake/paper/123', // 🔗 测试无效域名
        'https://link.springer.com/article/10.1007/s00000-023-00001-0', // Springer文章
        'https://www.cell.com/cell/fulltext/S0092-8674(23)00001-0', // Cell期刊
        'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0000001' // PLOS ONE
      ];

      console.log(`[MockDataGen] 开始为话题 "${topic}" 生成模拟数据`);

      // 使用SessionLiteratureConnector批量添加
      const result = await sessionConnector.batchAddFromUrls(mockUrls);

      // 刷新文献列表
      refreshSessionLiterature();

      // 显示结果统计
      const resultMsg = `模拟数据生成完成：成功添加 ${result.success} 篇，重复 ${result.duplicates} 篇，失败 ${result.errors} 篇`;

      if (result.errors > 0) {
        toast.warning(resultMsg);
        console.warn('[MockDataGen] 部分URL添加失败:', result.errorDetails);
      } else {
        toast.success(resultMsg);
      }

      console.log('[MockDataGen] 模拟数据生成完成:', result);

    } catch (error) {
      console.error('[MockDataGen] 生成模拟数据失败:', error);
      toast.error(`生成模拟数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsGeneratingMockData(false);
    }
  }, [topic, sessionConnector, refreshSessionLiterature, isGeneratingMockData]);

  // 检查是否有正在进行的任务
  const isRunning = status.includes('正在') || status.includes('生成');
  const hasActiveTasks = taskStore.tasks.length > 0;

  // 🐛 只要有topic就显示完整面板，不需要等待工作流开始
  const shouldShowLayout = !!(topic && topic.trim());

  // 只在状态变化时输出调试信息
  useEffect(() => {
    console.log('🔧 [MCTSWorkflow] UI状态变化:', {
      topic,
      hasActiveTasks,
      isRunning,
      shouldShowLayout,
      tasksCount: taskStore.tasks.length,
      status: status.slice(0, 100)
    });
  }, [topic, hasActiveTasks, isRunning, shouldShowLayout, taskStore.tasks.length, status]);

  return (
    <div className={`h-full ${className}`}>
      {/* 🎯 统一的MCTS工作流主容器 */}
      <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl border shadow-lg p-6 h-full">

        {/* 工作流标题区域 - 统一包裹 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TreePine className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">二、文献研究</h2>
                <p className="text-sm text-gray-600">话题: {topic}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* 工作流控制按钮 */}
              {!hasActiveTasks ? (
                <Button
                  onClick={handleLiteratureSeeding}
                  disabled={isRunning}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md"
                >
                  {isRunning ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      播种中...
                    </>
                  ) : (
                    <>
                      <BookOpen className="h-4 w-4 mr-2" />
                      🌱 开始文献播种
                    </>
                  )}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      taskStore.update([]);
                      setWorkflowStarted(false);
                    }}
                    variant="outline"
                    size="sm"
                    className="border-gray-300 hover:bg-gray-50"
                  >
                    重置工作流
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* 状态指示区域 */}
          {isRunning && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <div className="flex-1">
                <div className="text-sm font-medium text-blue-800">{status}</div>
                <div className="text-xs text-blue-600">已生成 {taskStore.tasks.length} 个搜索任务</div>
              </div>
            </div>
          )}
        </div>

        {/* 三面板核心区域 - 提升高度 */}
        {shouldShowLayout ? (
          isTreeMaximized ? (
            // 树形可视化全屏模式
            <Card className="h-[calc(100vh-180px)] shadow-lg border-gray-200">
              <CardHeader className="pb-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <TreePine className="h-5 w-5 text-green-600" />
                    知识树可视化 - 全屏模式
                  </CardTitle>
                  <Button onClick={toggleTreeMaximize} variant="outline" size="sm">
                    <Minimize2 className="h-4 w-4 mr-1" />
                    还原
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="h-[calc(100%-80px)] p-6">
                <TreeVisualization
                  treeId={treeId}
                  mode="edit"
                  height="100%"
                  showControls={true}
                  showMiniMap={true}
                  enablePhysics={true}
                  className="w-full h-full rounded-lg"
                />
              </CardContent>
            </Card>
          ) : (
            // 三面板布局模式 - 固定大小，优化比例分配
            <div className="h-[calc(100vh+220px)] flex flex-col rounded-lg overflow-hidden shadow-lg border border-gray-200">

              {/* 1. 会话文献信息面板（上） - 增大到50%，确保内容完整显示 */}
              <div className="h-[37%] bg-white border-b border-gray-200">
                <LiteratureInfoPanel
                  sessionLiterature={sessionLiterature}
                  topic={topic}
                  onViewLibrary={handleViewLibrary}
                  onSetAsRoot={handleSetAsRoot}
                  hasActiveTreeBuilding={treeBuilder.isBuilding || !!treeBuilder.currentSession}
                  onGenerateMockData={handleGenerateMockData}
                  className="h-full"
                />
              </div>

              {/* 2. 知识树可视化 + MCTS控制面板（中） - 集成布局 */}
              <div className="h-[45%] border-b border-gray-200">
                <Card className="h-full bg-gradient-to-br from-green-50 to-emerald-50/30 border-0 rounded-none">
                  {/* 集成的标题栏 */}
                  <CardHeader className="pb-2 border-b border-green-100">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <TreePine className="h-5 w-5 text-green-600" />
                        知识树可视化 & MCTS控制
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button onClick={toggleTreeMaximize} variant="outline" size="sm" className="border-green-200 hover:bg-green-100">
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {/* 集成的内容区域 */}
                  <CardContent className="h-[calc(100%-60px)] p-3 flex gap-3">
                    {/* 左侧：树可视化区域 */}
                    <div className="flex-1 bg-white rounded-lg border border-green-100 flex items-center justify-center text-gray-500 shadow-sm">
                      <div className="text-center">
                        <TreePine className="h-8 w-8 mx-auto mb-2 text-green-400 opacity-60" />
                        <p className="text-sm font-medium text-gray-600">知识树可视化</p>
                        <p className="text-xs text-gray-400 mt-1">树状图将在此显示</p>
                      </div>
                    </div>

                    {/* 右侧：MCTS控制区域 */}
                    <div className="w-80 bg-white rounded-lg border border-green-100 shadow-sm overflow-hidden">
                      <MCTSControlPanel
                        treeBuilder={treeBuilder}
                        className="h-full border-0 bg-transparent"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 3. 文献搜索面板（下） - 18%高度，搜索任务管理 */}
              <div className="h-[18%] flex-shrink-0 bg-white">
                <SearchResult />
              </div>
            </div>
          )
        ) : (
          // 空状态显示
          <div className="h-[calc(100vh-180px)] flex items-center justify-center bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="text-center text-gray-500 max-w-md">
              <TreePine className="h-16 w-16 mx-auto mb-4 text-green-400 opacity-60" />
              <h3 className="text-lg font-semibold mb-2 text-gray-700">二、文献研究</h3>
              <p className="text-sm mb-4">点击上方"开始文献播种"按钮启动工作流</p>
              <div className="space-y-2 text-xs text-gray-400">
                <p>🌱 播种模式：为研究主题创建初始文献库</p>
                <p>📚 将自动生成搜索任务，搜索并添加相关文献</p>
                <p>🔍 支持三面板布局：文献信息 + 树可视化 + MCTS控制</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
