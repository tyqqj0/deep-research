/**
 * 🎮 MCTS控制面板 - 树构建执行控制组件
 * 
 * 功能特性：
 * - 单步/连续执行控制
 * - 暂停/恢复/停止控制
 * - 算法参数实时调节
 * - 迭代统计和进度显示
 * - 会话状态监控
 */

"use client";

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Play,
  Pause,
  Square,
  SkipForward,
  Settings,
  BarChart3,
  Clock,
  Target,
  Zap,
  Brain,
  GitBranch,
  AlertCircle,
  CheckCircle2,
  Timer,
  Activity
} from 'lucide-react';
import { TreeBuilderData, TreeBuilderActions } from '@/hooks/useTreeBuilder';
import { toast } from 'sonner';
import { treeService } from '@/libs/tree/TreeService';
import { useTaskStore } from '@/store/task';
import { useHistoryStore } from '@/store/history';

// ==================== 组件接口 ====================

interface MCTSControlPanelProps {
  treeBuilder: TreeBuilderData & TreeBuilderActions;
  className?: string;
}

// ==================== 主组件 ====================

export default function MCTSControlPanel({
  treeBuilder,
  className = ''
}: MCTSControlPanelProps) {
  
  // 本地状态
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const taskStore = useTaskStore();
  const [selectedPreset, setSelectedPreset] = useState('default');

  // ==================== 执行控制处理函数 ====================

  const handleSingleIteration = useCallback(async () => {
    if (!treeBuilder.currentSession) {
      toast.warning('请先选择根节点创建会话');
      return;
    }
    
    try {
      const result = await treeBuilder.runSingleIteration();
      if (result) {
        toast.success(`迭代完成，奖励值: ${result.reward.toFixed(3)}`);
      }
    } catch (error) {
      console.error('单步迭代失败:', error);
      toast.error('单步迭代执行失败');
    }
  }, [treeBuilder]);

  const handleContinuousExecution = useCallback(async () => {
    if (!treeBuilder.currentSession) {
      toast.warning('请先选择根节点创建会话');
      return;
    }
    
    try {
      await treeBuilder.runContinuousBuilding();
    } catch (error) {
      console.error('连续执行失败:', error);
      toast.error('连续执行失败');
    }
  }, [treeBuilder]);

  const handlePause = useCallback(() => {
    treeBuilder.pauseBuilding();
  }, [treeBuilder]);

  const handleResume = useCallback(() => {
    treeBuilder.resumeBuilding();
  }, [treeBuilder]);

  const handleStop = useCallback(() => {
    treeBuilder.stopBuilding();
  }, [treeBuilder]);

  // ==================== 配置处理函数 ====================

  const handleMaxIterationsChange = useCallback((value: number[]) => {
    treeBuilder.setMaxIterations(value[0]);
  }, [treeBuilder]);

  const handleStepModeToggle = useCallback((checked: boolean) => {
    treeBuilder.setStepMode(checked);
  }, [treeBuilder]);

  const handlePresetChange = useCallback((preset: string) => {
    setSelectedPreset(preset);
    treeBuilder.switchAlgorithmPreset(preset);
  }, [treeBuilder]);

  // 🗑️ 智能删除当前树
  const handleDeleteCurrentTree = useCallback(async () => {
    const currentTreeId = treeBuilder.currentTreeId;

    if (!currentTreeId) {
      // 🎯 没有树ID时，提供状态清理选项
      if (confirm('当前没有关联的树。是否清理算法状态和相关数据？')) {
        try {
          // 停止当前构建
          if (treeBuilder.isBuilding) {
            treeBuilder.stopBuilding();
          }

          // 清理所有相关状态
          taskStore.setTreeId(undefined);
          taskStore.clearAlgorithmState();

          toast.success('状态已清理');
        } catch (error) {
          console.error('清理状态失败:', error);
          toast.error('清理状态失败');
        }
      }
      return;
    }

    if (confirm(`确定要删除当前文献树吗？\n\n树ID: ${currentTreeId.substring(0, 8)}...\n\n此操作不可撤销，将同时清除算法状态和历史记录。`)) {
      try {
        // 停止当前构建
        if (treeBuilder.isBuilding) {
          treeBuilder.stopBuilding();
        }

        // 🎯 容错删除：即使树不存在也要清理状态
        let deleteSuccess = false;
        try {
          await treeService.deleteTree(currentTreeId);
          deleteSuccess = true;
          console.log(`✅ 成功删除树: ${currentTreeId}`);
        } catch (deleteError) {
          console.warn(`⚠️ 删除树失败，但继续清理状态: ${deleteError.message}`);
        }

        // 🎯 无论删除是否成功，都要清理状态
        taskStore.setTreeId(undefined);
        taskStore.clearAlgorithmState();

        // 🎯 更新历史记录，移除对已删除树的引用
        const currentTitle = taskStore.title;
        if (currentTitle) {
          const updatedState = taskStore.backup();
          const historyStore = useHistoryStore.getState();
          const existingHistory = historyStore.history.find(record => record.title === currentTitle);

          if (existingHistory) {
            historyStore.update(existingHistory.id, updatedState);
            console.log('🧹 已更新历史记录，移除树引用');
          }
        }

        if (deleteSuccess) {
          toast.success('文献树已删除，状态已清理');
        } else {
          toast.success('状态已清理（树可能已不存在）');
        }
      } catch (error) {
        console.error('操作失败:', error);
        toast.error('操作失败，请重试');
      }
    }
  }, [treeBuilder, taskStore]);

  // ==================== 状态计算 ====================

  const progressPercent = treeBuilder.maxIterations > 0 ?
    (treeBuilder.currentIteration / treeBuilder.maxIterations) * 100 : 0;

  const canExecute = !treeBuilder.isBuilding && !!treeBuilder.currentSession;
  const canPause = treeBuilder.isBuilding;
  const canResume = treeBuilder.canResume && !treeBuilder.isBuilding;

  // 获取执行状态颜色
  const getStatusColor = () => {
    if (treeBuilder.error) return 'text-red-600';
    if (treeBuilder.isBuilding) return 'text-blue-600';
    if (treeBuilder.currentSession) return 'text-green-600';
    return 'text-gray-500';
  };

  // 获取状态图标
  const getStatusIcon = () => {
    if (treeBuilder.error) return <AlertCircle className="h-4 w-4" />;
    if (treeBuilder.isBuilding) return <Play className="h-4 w-4" />;
    if (treeBuilder.currentSession) return <CheckCircle2 className="h-4 w-4" />;
    return <Target className="h-4 w-4" />;
  };

  return (
    <Card className={`h-full bg-gradient-to-br from-purple-50 to-indigo-50/30 border-0 rounded-none ${className}`}>
      <CardHeader className="pb-2 border-b border-purple-100">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-purple-600" />
          MCTS执行控制
          {treeBuilder.currentSession && (
            <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-700 text-xs">
              会话活跃
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="h-[calc(100%-60px)] overflow-auto p-3 space-y-4">
        
        {/* 状态概览 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className={`text-sm font-medium ${getStatusColor()}`}>
                {treeBuilder.buildingStatus}
              </span>
            </div>
            {treeBuilder.isBuilding && (
              <div className="animate-pulse">
                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
              </div>
            )}
          </div>

          {/* 进度条 */}
          {treeBuilder.currentSession && (
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs text-gray-600">
                <span>迭代进度</span>
                <span>{treeBuilder.currentIteration}/{treeBuilder.maxIterations}</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          )}

          {/* 快速统计 */}
          {treeBuilder.statistics && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center p-2 bg-white/50 rounded border">
                <div className="font-semibold text-blue-600">
                  {treeBuilder.statistics.totalIterations}
                </div>
                <div className="text-gray-500">总迭代</div>
              </div>
              <div className="text-center p-2 bg-white/50 rounded border">
                <div className="font-semibold text-green-600">
                  {treeBuilder.statistics.successfulExpansions}
                </div>
                <div className="text-gray-500">成功扩展</div>
              </div>
              <div className="text-center p-2 bg-white/50 rounded border">
                <div className="font-semibold text-purple-600">
                  {(treeBuilder.statistics?.averageIterationTime || 0).toFixed(0)}ms
                </div>
                <div className="text-gray-500">平均耗时</div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* 执行控制区域 */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Play className="h-4 w-4" />
            执行控制
          </h4>

          {/* 主要控制按钮 */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleSingleIteration}
              disabled={!canExecute}
              size="sm"
              variant="outline"
              className="flex items-center gap-1"
            >
              <SkipForward className="h-3 w-3" />
              单步执行
            </Button>
            <Button
              onClick={handleContinuousExecution}
              disabled={!canExecute}
              size="sm"
              className="flex items-center gap-1"
            >
              <Play className="h-3 w-3" />
              连续执行
            </Button>
          </div>

          {/* 暂停/恢复/停止按钮 */}
          <div className="flex gap-2">
            {canPause && (
              <Button
                onClick={handlePause}
                size="sm"
                variant="outline"
                className="flex-1 flex items-center gap-1"
              >
                <Pause className="h-3 w-3" />
                暂停
              </Button>
            )}
            {canResume && (
              <Button
                onClick={handleResume}
                size="sm"
                variant="outline"
                className="flex-1 flex items-center gap-1"
              >
                <Play className="h-3 w-3" />
                恢复
              </Button>
            )}
            {(treeBuilder.isBuilding || treeBuilder.canResume) && (
              <Button
                onClick={handleStop}
                size="sm"
                variant="destructive"
                className="flex-1 flex items-center gap-1"
              >
                <Square className="h-3 w-3" />
                停止
              </Button>
            )}
          </div>
        </div>

        <Separator />

        {/* 配置区域 */}
        <Accordion type="single" collapsible className="space-y-0">
          <AccordionItem value="config" className="border-0">
            <AccordionTrigger className="py-2 text-sm">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                执行配置
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              
              {/* 最大迭代次数 */}
              <div className="space-y-2">
                <Label className="text-xs">最大迭代次数: {treeBuilder.maxIterations}</Label>
                <Slider
                  value={[treeBuilder.maxIterations]}
                  onValueChange={handleMaxIterationsChange}
                  max={200}
                  min={5}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* 执行模式 */}
              <div className="flex items-center justify-between">
                <Label className="text-xs">单步执行模式</Label>
                <Switch
                  checked={true} // 从store获取
                  onCheckedChange={handleStepModeToggle}
                />
              </div>

              {/* 算法预设 */}
              <div className="space-y-2">
                <Label className="text-xs">算法预设</Label>
                <Select value={selectedPreset} onValueChange={handlePresetChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">默认平衡</SelectItem>
                    <SelectItem value="exploration">探索优先</SelectItem>
                    <SelectItem value="exploitation">利用优先</SelectItem>
                    <SelectItem value="semantic">语义增强</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </AccordionContent>
          </AccordionItem>

          {/* 高级统计 */}
          <AccordionItem value="stats" className="border-0">
            <AccordionTrigger className="py-2 text-sm">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                详细统计
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pt-2">
              
              {treeBuilder.statistics ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>成功率:</span>
                    <span className="font-medium">
                      {(treeBuilder.statistics?.totalIterations || 0) > 0 ?
                        (((treeBuilder.statistics?.successfulExpansions || 0) / (treeBuilder.statistics?.totalIterations || 1)) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>节点创建:</span>
                    <span className="font-medium">{treeBuilder.statistics?.nodesGenerated || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>最大深度:</span>
                    <span className="font-medium">{treeBuilder.statistics?.maxTreeDepth || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>总构建时间:</span>
                    <span className="font-medium">
                      {((treeBuilder.statistics?.totalBuildingTime || 0) / 1000).toFixed(1)}s
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-500 text-center py-2">
                  暂无统计数据
                </div>
              )}

            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* 错误显示 */}
        {treeBuilder.error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs">
            <div className="flex items-center gap-2 text-red-700 font-medium mb-1">
              <AlertCircle className="h-3 w-3" />
              执行错误
            </div>
            <div className="text-red-600">
              {treeBuilder.error.message}
            </div>
            <Button
              onClick={treeBuilder.clearError}
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs mt-2"
            >
              清除错误
            </Button>
          </div>
        )}

        {/* 会话信息 */}
        {treeBuilder.currentSession && (
          <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs">
            <div className="font-medium text-blue-700 mb-1">当前会话</div>
            <div className="text-blue-600 space-y-1">
              <div>研究主题: {treeBuilder.currentSession.researchTopic}</div>
              <div>开始时间: {new Date(treeBuilder.currentSession.startTime).toLocaleTimeString()}</div>
              <div>会话ID: {treeBuilder.currentSession.id.substring(0, 8)}...</div>
              {treeBuilder.currentTreeId && (
                <div>树ID: {treeBuilder.currentTreeId.substring(0, 8)}...</div>
              )}
            </div>

            {/* 🗑️ 树管理按钮 */}
            <div className="mt-2 pt-2 border-t border-blue-200">
              <Button
                onClick={handleDeleteCurrentTree}
                variant="destructive"
                size="sm"
                className="h-6 px-2 text-xs"
                disabled={treeBuilder.isBuilding}
              >
                🗑️ 删除当前树
              </Button>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}