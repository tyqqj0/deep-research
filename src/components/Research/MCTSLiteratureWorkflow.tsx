"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { 
  TreePine, 
  BookOpen, 
  Search,
  Settings,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { toast } from 'sonner';

// 导入组件
import LiteratureInfoPanel from './LiteratureInfoPanel';
import SearchStatusPanel from './SearchStatusPanel';
import { TreeVisualization } from '@/components/Library/TreeVisualization';
import useLiteratureSearchManager from '@/hooks/useLiteratureSearchManager';
import { useLibraryStore } from '@/store/libraryStore';
import { LibraryItem } from '@/libs/db';
import { SEARCH_CONFIGS } from '@/libs/research/LiteratureSearchManager';

// 🎯 MCTS研究工作流第二部分 - 三块UI布局集成
// 1. 文献信息面板（上） 2. 树交互窗口（中） 3. 搜索状态面板（下）

interface MCTSLiteratureWorkflowProps {
  topic: string;
  reportPlan?: string;              // 🆕 研究计划（用于AI生成搜索任务）
  onTopicChange?: (topic: string) => void;
  treeId?: string;
  className?: string;
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
  
  // 本地状态
  const [isTreeMaximized, setIsTreeMaximized] = useState(false);
  const [sessionLiterature, setSessionLiterature] = useState<LibraryItem[]>([]);

  // 搜索管理Hook
  const {
    currentSession,
    isSearching,
    startSeedingSearch,
    startExpandingSearch,
    pauseSearch,
    resumeSearch,
    cancelSearch,
    expandSearch,
    reset
  } = useLiteratureSearchManager({
    onComplete: (session) => {
      toast.success(`搜索完成！共添加 ${session.totalAdded} 篇文献`);
      // 刷新会话文献列表
      refreshSessionLiterature();
    },
    onError: (error) => {
      toast.error(`搜索失败: ${error.message}`);
    },
    onProgress: (session) => {
      // 实时更新会话文献列表
      refreshSessionLiterature();
    }
  });

  // 刷新会话文献列表
  const refreshSessionLiterature = useCallback(() => {
    // 获取当前话题相关的文献
    const topicRelatedLiterature = libraryStore.items.filter(item => 
      item.topics?.includes(topic) || 
      item.title.toLowerCase().includes(topic.toLowerCase()) ||
      item.abstract?.toLowerCase().includes(topic.toLowerCase())
    );
    
    // 按创建时间排序，最新的在前
    const sortedLiterature = topicRelatedLiterature.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    setSessionLiterature(sortedLiterature);
  }, [libraryStore.items, topic]);

  // 监听文献库变化
  useEffect(() => {
    refreshSessionLiterature();
  }, [refreshSessionLiterature]);

  // 快速搜索方法
  const handleQuickSeeding = useCallback(async () => {
    try {
      await startSeedingSearch(topic, {
        ...SEARCH_CONFIGS.INITIAL_SEEDING,
        minTasks: 3,
        maxTasks: 6,
        reportPlan,                     // 🆕 传递研究计划
        useAI: Boolean(reportPlan)      // 🆕 有reportPlan时启用AI
      });
    } catch (error) {
      console.error('Failed to start seeding:', error);
    }
  }, [topic, reportPlan, startSeedingSearch]);

  const handleQuickExpanding = useCallback(async () => {
    try {
      await startExpandingSearch(topic, [], {
        ...SEARCH_CONFIGS.CONTINUOUS_EXPANSION,
        minTasks: 2,
        maxTasks: 4,
        reportPlan,                     // 🆕 传递研究计划
        useAI: Boolean(reportPlan)      // 🆕 有reportPlan时启用AI
      });
    } catch (error) {
      console.error('Failed to start expanding:', error);
    }
  }, [topic, reportPlan, startExpandingSearch]);

  // 前往Library页面
  const handleViewLibrary = useCallback(() => {
    router.push('/library');
  }, [router]);

  // 搜索控制方法
  const handlePauseSearch = useCallback(async () => {
    try {
      await pauseSearch();
    } catch (error) {
      console.error('Failed to pause search:', error);
      toast.error('暂停搜索失败');
    }
  }, [pauseSearch]);

  const handleResumeSearch = useCallback(async () => {
    try {
      await resumeSearch();
    } catch (error) {
      console.error('Failed to resume search:', error);
      toast.error('恢复搜索失败');
    }
  }, [resumeSearch]);

  const handleCancelSearch = useCallback(async () => {
    try {
      await cancelSearch();
    } catch (error) {
      console.error('Failed to cancel search:', error);
      toast.error('取消搜索失败');
    }
  }, [cancelSearch]);

  const handleExpandSearch = useCallback(async (queries: string[]) => {
    try {
      await expandSearch(queries);
      toast.success(`已添加 ${queries.length} 个新搜索任务`);
    } catch (error) {
      console.error('Failed to expand search:', error);
      toast.error('扩展搜索失败');
    }
  }, [expandSearch]);

  // 树形可视化最大化切换
  const toggleTreeMaximize = useCallback(() => {
    setIsTreeMaximized(!isTreeMaximized);
  }, [isTreeMaximized]);

  return (
    <div className={`h-full ${className}`}>
      {/* 🔍 Debug: 显示当前状态 */}
      <div className="text-xs text-gray-400 mb-2">
        Debug: currentSession={currentSession ? currentSession.state : 'none'} | isSearching={isSearching} | reportPlan={reportPlan ? 'exists' : 'none'}
      </div>
      
      {/* 标题栏 */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TreePine className="h-5 w-5 text-green-600" />
              MCTS文献研究工作流
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">话题: {topic}</span>
              {!currentSession && (
                <div className="flex gap-2">
                  <Button 
                    onClick={handleQuickSeeding} 
                    size="sm" 
                    disabled={isSearching}
                  >
                    <BookOpen className="h-3 w-3 mr-1" />
                    2.1 播种
                  </Button>
                  <Button 
                    onClick={handleQuickExpanding} 
                    variant="outline" 
                    size="sm"
                    disabled={isSearching}
                  >
                    <Search className="h-3 w-3 mr-1" />
                    2.2 扩展
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 主要布局 */}
      {isTreeMaximized ? (
        // 树形可视化全屏模式
        <Card className="h-[calc(100%-120px)]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">知识树可视化</CardTitle>
              <Button onClick={toggleTreeMaximize} variant="outline" size="sm">
                <Minimize2 className="h-3 w-3 mr-1" />
                还原
              </Button>
            </div>
          </CardHeader>
          <CardContent className="h-[calc(100%-80px)]">
            <TreeVisualization
              treeId={treeId}
              mode="edit"
              height="100%"
              showControls={true}
              showMiniMap={true}
              enablePhysics={true}
              className="w-full h-full"
            />
          </CardContent>
        </Card>
      ) : (
        // 三块布局模式
        <ResizablePanelGroup direction="vertical" className="h-[calc(100%-120px)]">
          {/* 1. 文献信息面板（上） */}
          <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
            <LiteratureInfoPanel
              sessionLiterature={sessionLiterature}
              topic={topic}
              onViewLibrary={handleViewLibrary}
              className="h-full"
            />
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          {/* 2. 树交互窗口（中） */}
          <ResizablePanel defaultSize={45} minSize={30}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TreePine className="h-4 w-4 text-green-600" />
                    知识树可视化
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button onClick={toggleTreeMaximize} variant="outline" size="sm">
                      <Maximize2 className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Settings className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="h-[calc(100%-80px)]">
                <TreeVisualization
                  treeId={treeId}
                  mode="embedded"
                  height="100%"
                  showControls={false}
                  showMiniMap={false}
                  enablePhysics={true}
                  className="w-full h-full"
                />
              </CardContent>
            </Card>
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          {/* 3. 搜索状态面板（下） */}
          <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
            <SearchStatusPanel
              session={currentSession}
              onPauseSearch={handlePauseSearch}
              onResumeSearch={handleResumeSearch}
              onCancelSearch={handleCancelSearch}
              onExpandSearch={handleExpandSearch}
              onRetryUnit={(unitId) => {
                console.log('Retry unit:', unitId);
                // TODO: 实现重试单个任务
              }}
              onDeleteUnit={(unitId) => {
                console.log('Delete unit:', unitId);
                // TODO: 实现删除单个任务
              }}
              className="h-full"
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
}