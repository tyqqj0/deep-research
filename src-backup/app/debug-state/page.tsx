'use client';

import { useTaskStore } from '@/store/task';
import { useHistoryStore } from '@/store/history';
import { useLibraryStore } from '@/store/libraryStore';
import { MainPageTreeSession } from '@/libs/tree/MainPageTreeSession';
import { treeService } from '@/libs/tree/TreeService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export default function DebugStatePage() {
  const taskStore = useTaskStore();
  const historyStore = useHistoryStore();
  const libraryStore = useLibraryStore();
  const [treeExists, setTreeExists] = useState<boolean | null>(null);
  const [localStorageData, setLocalStorageData] = useState<any>(null);

  // 检查树是否存在
  useEffect(() => {
    const checkTreeExists = async () => {
      if (taskStore.treeId) {
        try {
          const tree = await treeService.getTreeById(taskStore.treeId);
          setTreeExists(!!tree);
        } catch (error) {
          setTreeExists(false);
        }
      } else {
        setTreeExists(null);
      }
    };

    checkTreeExists();
  }, [taskStore.treeId]);

  // 读取localStorage数据
  useEffect(() => {
    try {
      const taskStoreData = localStorage.getItem('task-store');
      setLocalStorageData(taskStoreData ? JSON.parse(taskStoreData) : null);
    } catch (error) {
      setLocalStorageData(null);
    }
  }, [taskStore]);

  const handleClearAllStates = async () => {
    if (confirm('确定要清理所有状态吗？这将重置所有数据。')) {
      try {
        // 清理TaskStore
        taskStore.reset();
        
        // 清理历史记录
        historyStore.history.forEach(record => {
          historyStore.remove(record.id);
        });
        
        // 清理MainPageTreeSession
        const treeSession = MainPageTreeSession.getInstance();
        treeSession.clearCurrentSession();
        
        toast.success('所有状态已清理');
      } catch (error) {
        console.error('清理状态失败:', error);
        toast.error('清理状态失败');
      }
    }
  };

  const handleTestFallback = async () => {
    try {
      const treeSession = MainPageTreeSession.getInstance();
      const tree = await treeSession.getCurrentTree();
      toast.info(`Fallback测试完成，树存在: ${!!tree}`);
    } catch (error) {
      toast.error(`Fallback测试失败: ${error.message}`);
    }
  };

  const handleAutoCleanup = async () => {
    try {
      await libraryStore.cleanupInvalidTreeReferences();
      toast.success('自动清理完成');
      // 刷新页面状态
      window.location.reload();
    } catch (error) {
      toast.error(`自动清理失败: ${error.message}`);
    }
  };

  const handleTestTreeSession = async () => {
    try {
      const treeSession = MainPageTreeSession.getInstance();
      const currentTreeId = treeSession.getCurrentTreeId();
      const hasActiveTree = treeSession.hasActiveTree();
      const tree = await treeSession.getCurrentTree();

      toast.info(`TreeSession测试完成`, {
        description: `TreeID: ${currentTreeId || '无'}, 活跃: ${hasActiveTree}, 树存在: ${!!tree}`,
        duration: 5000
      });
    } catch (error) {
      toast.error(`TreeSession测试失败: ${error.message}`);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">🔍 状态诊断工具</h1>
      
      {/* TaskStore状态 */}
      <Card>
        <CardHeader>
          <CardTitle>📊 TaskStore状态</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div><strong>Title:</strong> {taskStore.title || '未设置'}</div>
          <div><strong>TreeId:</strong> {taskStore.treeId || '未设置'}</div>
          <div><strong>算法状态:</strong> {taskStore.algorithmState ? '已初始化' : '未初始化'}</div>
          {taskStore.algorithmState && (
            <div className="ml-4 space-y-1">
              <div><strong>构建状态:</strong> {taskStore.algorithmState.buildingStatus}</div>
              <div><strong>当前迭代:</strong> {taskStore.algorithmState.currentIteration}</div>
              <div><strong>会话:</strong> {taskStore.algorithmState.currentSession ? '存在' : '不存在'}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 树存在性检查 */}
      <Card>
        <CardHeader>
          <CardTitle>🌳 树存在性检查</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <strong>树ID:</strong> {taskStore.treeId || '无'}
            </div>
            <div>
              <strong>树存在:</strong> 
              <span className={`ml-2 px-2 py-1 rounded text-sm ${
                treeExists === true ? 'bg-green-100 text-green-800' :
                treeExists === false ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {treeExists === true ? '✅ 存在' : 
                 treeExists === false ? '❌ 不存在' : 
                 '⚪ 无树ID'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 历史记录状态 */}
      <Card>
        <CardHeader>
          <CardTitle>📚 历史记录状态</CardTitle>
        </CardHeader>
        <CardContent>
          <div><strong>历史记录数量:</strong> {historyStore.history.length}</div>
          {taskStore.title && (
            <div>
              <strong>当前话题的历史:</strong> 
              {historyStore.history.find(r => r.title === taskStore.title) ? '存在' : '不存在'}
            </div>
          )}
          {historyStore.history.length > 0 && (
            <div className="mt-2">
              <strong>最近的记录:</strong>
              <ul className="ml-4 space-y-1">
                {historyStore.history.slice(0, 3).map(record => (
                  <li key={record.id} className="text-sm">
                    {record.title} (TreeId: {record.treeId || '无'})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* localStorage数据 */}
      <Card>
        <CardHeader>
          <CardTitle>💾 localStorage数据</CardTitle>
        </CardHeader>
        <CardContent>
          {localStorageData ? (
            <div className="space-y-2">
              <div><strong>TreeId:</strong> {localStorageData.state?.treeId || '未设置'}</div>
              <div><strong>Title:</strong> {localStorageData.state?.title || '未设置'}</div>
              <div><strong>版本:</strong> {localStorageData.version}</div>
            </div>
          ) : (
            <div>无localStorage数据</div>
          )}
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <Card>
        <CardHeader>
          <CardTitle>🛠️ 诊断操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <Button onClick={handleTestFallback} variant="outline">
              测试Fallback机制
            </Button>
            <Button onClick={handleTestTreeSession} variant="outline">
              🧪 测试TreeSession
            </Button>
            <Button onClick={handleAutoCleanup} variant="secondary">
              🧹 自动清理无效引用
            </Button>
            <Button onClick={handleClearAllStates} variant="destructive">
              清理所有状态
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
