"use client";

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search,
  Play,
  Pause,
  Square,
  MoreHorizontal,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  XCircle,
  RefreshCw,
  Save,
  Plus
} from 'lucide-react';
import { SearchSession, SearchUnit } from '@/libs/research/LiteratureSearchManager';

// 🎯 搜索状态管理UI - 类似Task列表设计，适配MCTS工作流

interface SearchStatusPanelProps {
  session: SearchSession | null;
  onPauseSearch: () => void;
  onResumeSearch: () => void;
  onCancelSearch: () => void;
  onExpandSearch?: (queries: string[]) => void;
  onRetryUnit?: (unitId: string) => void;
  onDeleteUnit?: (unitId: string) => void;
  className?: string;
}

// 搜索单元状态图标组件
function SearchUnitState({ state }: { state: SearchUnit['state'] }) {
  switch (state) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'searching':
    case 'parsing':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-gray-400" />;
    case 'cancelled':
      return <XCircle className="h-4 w-4 text-gray-400" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

// 单个搜索单元组件
interface SearchUnitItemProps {
  unit: SearchUnit;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onQueryChange: (query: string) => void;
}

function SearchUnitItem({
  unit,
  isEditing,
  onEdit,
  onSave,
  onDelete,
  onRetry,
  onQueryChange
}: SearchUnitItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const getStateText = (state: SearchUnit['state']) => {
    switch (state) {
      case 'pending': return '等待中';
      case 'searching': return '搜索中';
      case 'parsing': return '解析中';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      case 'cancelled': return '已取消';
      default: return '未知';
    }
  };

  const getStateColor = (state: SearchUnit['state']) => {
    switch (state) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'searching':
      case 'parsing': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-gray-100 text-gray-600';
      case 'cancelled': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <>
      <div className="border rounded-lg mb-2">
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3 flex-1">
              <SearchUnitState state={unit.state} />
              <div className="text-left">
                <div className="font-medium">{unit.query}</div>
                <div className="text-sm text-gray-500 flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${getStateColor(unit.state)}`}>
                    {getStateText(unit.state)}
                  </Badge>
                  {unit.state === 'completed' && unit.result && (
                    <span className="text-green-600">+{unit.result.addedCount}</span>
                  )}
                  {(unit.state === 'searching' || unit.state === 'parsing') && (
                    <span>{unit.progress}%</span>
                  )}
                </div>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  编辑查询
                </DropdownMenuItem>
                {unit.state === 'failed' && (
                  <DropdownMenuItem onClick={onRetry}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重试
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        <div className="px-4 pb-4">
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">搜索查询</label>
                <Input
                  value={unit.query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button onClick={onSave} size="sm">
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                <strong>查询内容:</strong> {unit.query}
              </div>
              
              {(unit.state === 'searching' || unit.state === 'parsing') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>进度</span>
                    <span>{unit.progress}%</span>
                  </div>
                  <Progress value={unit.progress} className="h-2" />
                </div>
              )}
              
              {unit.result && unit.state === 'completed' && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-green-50 p-2 rounded">
                    <div className="font-medium text-green-800">成功添加</div>
                    <div className="text-green-600">{unit.result.addedCount} 篇文献</div>
                  </div>
                  <div className="bg-blue-50 p-2 rounded">
                    <div className="font-medium text-blue-800">发现重复</div>
                    <div className="text-blue-600">{unit.result.duplicateCount} 篇文献</div>
                  </div>
                </div>
              )}
              
              {unit.error && unit.state === 'failed' && (
                <div className="bg-red-50 border border-red-200 p-3 rounded">
                  <div className="font-medium text-red-800 mb-1">错误信息</div>
                  <div className="text-sm text-red-600">{unit.error}</div>
                </div>
              )}
              
              <div className="text-xs text-gray-500 pt-2 border-t">
                创建时间: {new Date(unit.createdAt).toLocaleString()}
                {unit.completedAt && (
                  <> • 完成时间: {new Date(unit.completedAt).toLocaleString()}</>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除搜索任务 "{unit.query}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-red-600 hover:bg-red-700">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function SearchStatusPanel({
  session,
  onPauseSearch,
  onResumeSearch,
  onCancelSearch,
  onExpandSearch,
  onRetryUnit,
  onDeleteUnit,
  className = ''
}: SearchStatusPanelProps) {
  const { t } = useTranslation();
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [expandQueries, setExpandQueries] = useState('');

  if (!session) {
    return (
      <Card className={`h-full ${className}`}>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-center text-gray-500">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">没有活动的搜索会话</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSessionStateText = () => {
    switch (session.state) {
      case 'preparing': return '准备中';
      case 'running': return '运行中';
      case 'paused': return '已暂停';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      case 'cancelled': return '已取消';
      default: return '未知';
    }
  };

  const getSessionStateColor = () => {
    switch (session.state) {
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const handleExpandSearch = () => {
    if (!expandQueries.trim()) return;
    
    const queries = expandQueries
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 0);
    
    onExpandSearch?.(queries);
    setExpandQueries('');
  };

  return (
    <Card className={`h-full ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Search className="h-4 w-4 text-blue-600" />
              搜索状态
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={`text-xs ${getSessionStateColor()}`}>
                {getSessionStateText()}
              </Badge>
              <span className="text-sm text-gray-500">
                {session.config.mode === 'seeding' ? '2.1 播种' : '2.2 扩展'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {session.state === 'running' && (
              <Button onClick={onPauseSearch} variant="outline" size="sm">
                <Pause className="h-3 w-3" />
              </Button>
            )}
            
            {session.state === 'paused' && (
              <Button onClick={onResumeSearch} variant="outline" size="sm">
                <Play className="h-3 w-3" />
              </Button>
            )}
            
            {(session.state === 'running' || session.state === 'paused') && (
              <Button onClick={onCancelSearch} variant="destructive" size="sm">
                <Square className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 整体进度 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>整体进度</span>
            <span>{session.progress}%</span>
          </div>
          <Progress value={session.progress} className="h-2" />
          <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
            <div>任务: {session.units.filter(u => u.state === 'completed').length}/{session.units.length}</div>
            <div>已添加: {session.totalAdded}</div>
            <div>重复: {session.totalDuplicates}</div>
          </div>
        </div>

        <Separator />

        {/* 搜索任务列表 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">搜索任务</h4>
            <span className="text-xs text-gray-500">
              {session.units.length} 个任务
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-0">
            {session.units.map((unit) => (
              <SearchUnitItem
                key={unit.id}
                unit={unit}
                isEditing={editingUnitId === unit.id}
                onEdit={() => setEditingUnitId(unit.id)}
                onSave={() => setEditingUnitId(null)}
                onDelete={() => {
                  onDeleteUnit?.(unit.id);
                  setEditingUnitId(null);
                }}
                onRetry={() => onRetryUnit?.(unit.id)}
                onQueryChange={(query) => {
                  // 这里应该调用更新查询的方法
                  console.log('Update query:', unit.id, query);
                }}
              />
            ))}
          </div>
        </div>

        {/* 扩展搜索（仅在运行中且为扩展模式时显示） */}
        {session.state === 'running' && session.config.mode === 'expanding' && onExpandSearch && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium">动态扩展</h4>
              <textarea
                value={expandQueries}
                onChange={(e) => setExpandQueries(e.target.value)}
                placeholder="输入新的搜索查询，每行一个..."
                className="w-full p-2 text-sm border rounded resize-none"
                rows={3}
              />
              <Button
                onClick={handleExpandSearch}
                disabled={!expandQueries.trim()}
                size="sm"
                className="w-full"
              >
                <Plus className="h-3 w-3 mr-1" />
                添加搜索任务
              </Button>
            </div>
          </>
        )}

        {/* 会话信息 */}
        <div className="text-xs text-gray-500 pt-2 border-t space-y-1">
          <div>话题: {session.config.topic}</div>
          <div>创建: {new Date(session.createdAt).toLocaleString()}</div>
          {session.completedAt && (
            <div>完成: {new Date(session.completedAt).toLocaleString()}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}