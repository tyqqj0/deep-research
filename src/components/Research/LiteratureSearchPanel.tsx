"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  Play, 
  Pause, 
  Square, 
  Plus,
  Settings,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/Internal/Button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

import useLiteratureSearchManager from '@/hooks/useLiteratureSearchManager';
import { SearchConfig, SearchUnit, SEARCH_CONFIGS } from '@/libs/research/LiteratureSearchManager';

// 🎯 统一的文献搜索管理面板 - 支持MCTS 2.1播种和2.2扩展

interface LiteratureSearchPanelProps {
  mode?: 'seeding' | 'expanding';
  topic: string;
  onTopicChange?: (topic: string) => void;
  onComplete?: (results: { totalAdded: number; totalDuplicates: number; sessionId: string }) => void;
  className?: string;
}

export default function LiteratureSearchPanel({
  mode = 'seeding',
  topic: initialTopic = '',
  onTopicChange,
  onComplete,
  className = ''
}: LiteratureSearchPanelProps) {
  const { t } = useTranslation();

  // 本地状态
  const [topic, setTopic] = useState(initialTopic);
  const [customQueries, setCustomQueries] = useState('');
  const [configMode, setConfigMode] = useState<'simple' | 'advanced'>('simple');
  const [advancedConfig, setAdvancedConfig] = useState({
    minTasks: mode === 'seeding' ? 3 : 1,
    maxTasks: mode === 'seeding' ? 8 : 5,
    strategy: 'parallel' as 'parallel' | 'sequential',
    batchSize: 3
  });
  const [showUnits, setShowUnits] = useState(false);
  // 🚀 新增：等待模式设置
  const [waitingSettings, setWaitingSettings] = useState({
    enableTaskWaitingTime: false,
    taskWaitingTime: 10
  });

  // 🆕 初始化等待设置
  useEffect(() => {
    try {
      const saved = localStorage.getItem('research-waiting-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        setWaitingSettings(settings);
      }
    } catch (error) {
      console.warn('Failed to load waiting settings:', error);
    }
  }, []);

  // 搜索管理Hook
  const {
    currentSession,
    isSearching,
    isLoading,
    error,
    startSeedingSearch,
    startExpandingSearch,
    pauseSearch,
    resumeSearch,
    cancelSearch,
    expandSearch,
    startUnitNow, // 🚀 新增
    cancelUnit,   // 🚀 新增
    getCompletedUnits,
    getFailedUnits,
    getWaitingUnits, // 🚀 新增
    reset
  } = useLiteratureSearchManager({
    onComplete: (session) => {
      toast.success(`搜索完成！共添加 ${session.totalAdded} 篇文献`);
      onComplete?.({
        totalAdded: session.totalAdded,
        totalDuplicates: session.totalDuplicates,
        sessionId: session.id
      });
    },
    onError: (error) => {
      toast.error(`搜索失败: ${error.message}`);
    }
  });

  // 处理话题变化
  const handleTopicChange = useCallback((newTopic: string) => {
    setTopic(newTopic);
    onTopicChange?.(newTopic);
  }, [onTopicChange]);

  // 开始搜索
  const handleStartSearch = useCallback(async () => {
    if (!topic.trim()) {
      toast.error('请输入研究话题');
      return;
    }

    const queries = customQueries
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 0);

    const config: Partial<SearchConfig> = configMode === 'advanced' ? {
      ...advancedConfig,
      queries: queries.length > 0 ? queries : undefined
    } : {
      queries: queries.length > 0 ? queries : undefined
    };

    // 🚀 保存等待设置到localStorage
    try {
      localStorage.setItem('research-waiting-settings', JSON.stringify(waitingSettings));
    } catch (error) {
      console.warn('Failed to save waiting settings:', error);
    }

    try {
      if (mode === 'seeding') {
        await startSeedingSearch(topic, config);
      } else {
        await startExpandingSearch(topic, queries, config);
      }
    } catch (error) {
      console.error('Failed to start search:', error);
    }
  }, [
    topic, 
    customQueries, 
    configMode, 
    advancedConfig, 
    waitingSettings, // 🚀 新增依赖
    mode, 
    startSeedingSearch, 
    startExpandingSearch
  ]);

  // 扩展搜索（仅在expanding模式下可用）
  const handleExpandSearch = useCallback(async () => {
    if (!currentSession || mode !== 'expanding') return;

    const newQueries = customQueries
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 0);

    if (newQueries.length === 0) {
      toast.error('请输入新的搜索查询');
      return;
    }

    try {
      await expandSearch(newQueries);
      setCustomQueries(''); // 清空输入
      toast.success(`已添加 ${newQueries.length} 个新搜索任务`);
    } catch (error) {
      console.error('Failed to expand search:', error);
    }
  }, [currentSession, mode, customQueries, expandSearch]);

  // 获取显示状态文本
  const getStatusText = () => {
    if (!currentSession) return '';
    
    const modeText = mode === 'seeding' ? '预搜索数据库' : '扩展文献库';
    
    switch (currentSession.state) {
      case 'preparing':
        return mode === 'seeding' ? '初始化搜索...' : '准备扩展...';
      case 'running':
        return `${modeText}中...`;
      case 'paused':
        return '已暂停';
      case 'completed':
        return '搜索完成';
      case 'failed':
        return '搜索失败';
      case 'cancelled':
        return '已取消';
      default:
        return '';
    }
  };

  // 获取单元状态图标
  const getUnitStatusIcon = (unit: SearchUnit) => {
    switch (unit.state) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'searching':
      case 'parsing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'waiting': // 🚀 新增等待状态
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'cancelled':
        return <Square className="h-4 w-4 text-gray-400" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 标题和模式指示 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Search className="h-5 w-5" />
          {mode === 'seeding' ? '文献播种' : '文献扩展'}
        </h3>
        <Badge variant={mode === 'seeding' ? 'default' : 'secondary'}>
          {mode === 'seeding' ? '2.1 预搜索' : '2.2 边搜边建'}
        </Badge>
      </div>

      {/* 研究话题输入 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">研究话题</label>
        <Input
          value={topic}
          onChange={(e) => handleTopicChange(e.target.value)}
          placeholder="输入研究话题或方向..."
          disabled={isSearching}
        />
      </div>

      {/* 自定义查询（可选） */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          自定义搜索查询 
          <span className="text-gray-500 text-xs ml-1">(可选，每行一个)</span>
        </label>
        <Textarea
          value={customQueries}
          onChange={(e) => setCustomQueries(e.target.value)}
          placeholder={`输入具体的搜索查询，例如：\n${topic} review\n${topic} applications\n${topic} methods`}
          rows={3}
          disabled={isSearching}
        />
      </div>

      {/* 高级配置 */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-between"
            disabled={isSearching}
          >
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              高级配置
            </span>
            <span className="text-xs text-gray-500">
              {configMode === 'simple' ? '简单' : '高级'}
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 mt-2 p-3 border rounded-md bg-gray-50">
          <div className="flex items-center gap-2">
            <label className="text-sm">配置模式:</label>
            <Select 
              value={configMode} 
              onValueChange={(value) => setConfigMode(value as 'simple' | 'advanced')}
              disabled={isSearching}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">简单</SelectItem>
                <SelectItem value="advanced">高级</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {configMode === 'advanced' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm">最小任务数:</label>
                  <Input
                    type="number"
                    value={advancedConfig.minTasks}
                    onChange={(e) => setAdvancedConfig(prev => ({
                      ...prev,
                      minTasks: parseInt(e.target.value) || 1
                    }))}
                    min={1}
                    max={20}
                    disabled={isSearching}
                  />
                </div>
                <div>
                  <label className="text-sm">最大任务数:</label>
                  <Input
                    type="number"
                    value={advancedConfig.maxTasks}
                    onChange={(e) => setAdvancedConfig(prev => ({
                      ...prev,
                      maxTasks: parseInt(e.target.value) || 5
                    }))}
                    min={1}
                    max={50}
                    disabled={isSearching}
                  />
                </div>
                <div>
                  <label className="text-sm">执行策略:</label>
                  <Select 
                    value={advancedConfig.strategy} 
                    onValueChange={(value) => setAdvancedConfig(prev => ({
                      ...prev,
                      strategy: value as 'parallel' | 'sequential'
                    }))}
                    disabled={isSearching}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parallel">并行</SelectItem>
                      <SelectItem value="sequential">顺序</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm">批次大小:</label>
                  <Input
                    type="number"
                    value={advancedConfig.batchSize}
                    onChange={(e) => setAdvancedConfig(prev => ({
                      ...prev,
                      batchSize: parseInt(e.target.value) || 3
                    }))}
                    min={1}
                    max={10}
                    disabled={isSearching}
                  />
                </div>
              </div>

              {/* 🆕 等待模式设置 */}
              <div className="border-t pt-3">
                <h4 className="text-sm font-medium mb-2">等待模式设置</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="enableTaskWaitingTime"
                      checked={waitingSettings.enableTaskWaitingTime}
                      onChange={(e) => setWaitingSettings(prev => ({
                        ...prev,
                        enableTaskWaitingTime: e.target.checked
                      }))}
                      disabled={isSearching}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="enableTaskWaitingTime" className="text-sm">
                      启用手动确认模式
                    </label>
                  </div>
                  <div>
                    <label className="text-sm">等待时间 (秒):</label>
                    <Input
                      type="number"
                      value={waitingSettings.taskWaitingTime}
                      onChange={(e) => setWaitingSettings(prev => ({
                        ...prev,
                        taskWaitingTime: parseInt(e.target.value) || 10
                      }))}
                      min={1}
                      max={300}
                      disabled={isSearching || !waitingSettings.enableTaskWaitingTime}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  启用后，搜索任务将等待手动确认后开始执行，类似于现有研究工作流
                </p>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* 控制按钮 */}
      <div className="flex gap-2">
        {!currentSession || currentSession.state === 'completed' || currentSession.state === 'failed' || currentSession.state === 'cancelled' ? (
          <Button
            onClick={handleStartSearch}
            disabled={isLoading || !topic.trim()}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                启动中...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                开始{mode === 'seeding' ? '播种' : '扩展'}
              </>
            )}
          </Button>
        ) : (
          <>
            {currentSession.state === 'running' ? (
              <Button
                onClick={pauseSearch}
                variant="outline"
                className="flex-1"
              >
                <Pause className="mr-2 h-4 w-4" />
                暂停
              </Button>
            ) : currentSession.state === 'paused' ? (
              <Button
                onClick={resumeSearch}
                className="flex-1"
              >
                <Play className="mr-2 h-4 w-4" />
                继续
              </Button>
            ) : null}
            
            <Button
              onClick={cancelSearch}
              variant="destructive"
              size="sm"
            >
              <Square className="mr-2 h-4 w-4" />
              取消
            </Button>
          </>
        )}

        {currentSession && mode === 'expanding' && currentSession.state === 'running' && (
          <Button
            onClick={handleExpandSearch}
            variant="outline"
            size="sm"
            disabled={!customQueries.trim()}
          >
            <Plus className="mr-2 h-4 w-4" />
            扩展
          </Button>
        )}

        {currentSession && (currentSession.state === 'completed' || currentSession.state === 'failed' || currentSession.state === 'cancelled') && (
          <Button
            onClick={reset}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            重置
          </Button>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 进度显示 */}
      {currentSession && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{getStatusText()}</span>
            <span className="text-gray-500">
              {currentSession.progress}%
            </span>
          </div>
          
          <Progress value={currentSession.progress} className="h-2" />
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              任务: {currentSession.units.filter(u => u.state === 'completed').length}/{currentSession.units.length}
            </span>
            <span>
              已添加: {currentSession.totalAdded} | 重复: {currentSession.totalDuplicates}
            </span>
          </div>

          {/* 任务单元详情 */}
          <Collapsible open={showUnits} onOpenChange={setShowUnits}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span>任务详情</span>
                <span className="text-xs">
                  {showUnits ? '收起' : '展开'}
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {currentSession.units.map((unit) => (
                  <div
                    key={unit.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getUnitStatusIcon(unit)}
                      <span className="truncate">{unit.query}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* 统计信息 */}
                      <div className="text-xs text-gray-500">
                        {unit.result && unit.state === 'completed' && (
                          <span>+{unit.result.addedCount}</span>
                        )}
                        {unit.state === 'searching' || unit.state === 'parsing' ? (
                          <span>{unit.progress}%</span>
                        ) : null}
                      </div>
                      
                      {/* 🚀 手动控制按钮 */}
                      {unit.state === 'waiting' && (
                        <div className="flex gap-1">
                          <Button
                            onClick={() => startUnitNow(unit.id)}
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                          <Button
                            onClick={() => cancelUnit(unit.id)}
                            variant="destructive"
                            size="sm"
                            className="h-6 px-2 text-xs"
                          >
                            <Square className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
}