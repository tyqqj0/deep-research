"use client";

import { useTaskStore } from '@/store/task';
import { useTreeBuilder } from '@/hooks/useTreeBuilder';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestArchitecturePage() {
  const taskStore = useTaskStore();
  const treeBuilder = useTreeBuilder();

  const handleInitializeAlgorithm = () => {
    taskStore.initializeAlgorithmState('测试研究话题');
  };

  const handleClearAlgorithm = () => {
    taskStore.clearAlgorithmState();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">🎯 架构重构测试页面</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* TaskStore 状态 */}
        <Card>
          <CardHeader>
            <CardTitle>TaskStore 状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <strong>话题:</strong> {taskStore.title || '未设置'}
            </div>
            <div>
              <strong>树ID:</strong> {taskStore.treeId || '未设置'}
            </div>
            <div>
              <strong>算法状态:</strong> {taskStore.algorithmState ? '已初始化' : '未初始化'}
            </div>
            {taskStore.algorithmState ? (
              <div className="ml-4 space-y-2">
                <div><strong>构建状态:</strong> {taskStore.algorithmState.buildingStatus}</div>
                <div><strong>当前迭代:</strong> {taskStore.algorithmState.currentIteration}</div>
                <div><strong>最大迭代:</strong> {taskStore.algorithmState.maxIterations}</div>
                <div><strong>是否构建中:</strong> {taskStore.algorithmState.isBuilding ? '是' : '否'}</div>
              </div>
            ) : (
              <div className="ml-4 text-gray-500">
                算法状态未初始化
              </div>
            )}
            
            <div className="flex gap-2">
              <Button onClick={handleInitializeAlgorithm}>
                初始化算法状态
              </Button>
              <Button variant="destructive" onClick={handleClearAlgorithm}>
                清除算法状态
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* TreeBuilder Hook 状态 */}
        <Card>
          <CardHeader>
            <CardTitle>TreeBuilder Hook 状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <strong>当前树ID:</strong> {treeBuilder.currentTreeId || '未设置'}
            </div>
            <div>
              <strong>构建状态:</strong> {treeBuilder.buildingStatus}
            </div>
            <div>
              <strong>当前迭代:</strong> {treeBuilder.currentIteration}
            </div>
            <div>
              <strong>最大迭代:</strong> {treeBuilder.maxIterations}
            </div>
            <div>
              <strong>是否构建中:</strong> {treeBuilder.isBuilding ? '是' : '否'}
            </div>
            <div>
              <strong>当前会话:</strong> {treeBuilder.currentSession ? '存在' : '不存在'}
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => treeBuilder.setMaxIterations(100)}
                disabled={!taskStore.algorithmState}
              >
                设置最大迭代100
              </Button>
              <Button 
                onClick={() => taskStore.updateBuildingStatus('测试状态更新')}
                disabled={!taskStore.algorithmState}
              >
                更新构建状态
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 状态同步验证 */}
      <Card>
        <CardHeader>
          <CardTitle>🔄 状态同步验证</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <strong>TaskStore.algorithmState.buildingStatus:</strong> {
                taskStore.algorithmState ?
                  taskStore.algorithmState.buildingStatus :
                  '算法状态未初始化'
              }
            </div>
            <div>
              <strong>TreeBuilder.buildingStatus:</strong> {treeBuilder.buildingStatus}
            </div>
            <div className={`text-sm ${
              (taskStore.algorithmState?.buildingStatus || (taskStore.algorithmState ? '等待开始构建' : '未初始化')) === treeBuilder.buildingStatus
                ? 'text-green-600'
                : 'text-red-600'
            }`}>
              {(taskStore.algorithmState?.buildingStatus || (taskStore.algorithmState ? '等待开始构建' : '未初始化')) === treeBuilder.buildingStatus
                ? '✅ 状态同步正常'
                : '❌ 状态不同步'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 架构说明 */}
      <Card>
        <CardHeader>
          <CardTitle>🏗️ 新架构说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div>✅ <strong>TaskStore</strong> - 统一的状态管理，包含算法状态</div>
            <div>✅ <strong>useTreeBuilder</strong> - 从TaskStore读取状态，不再依赖TreeBuilderStore</div>
            <div>✅ <strong>SGMCTSController</strong> - 纯算法执行引擎，不管理状态</div>
            <div>✅ <strong>完整持久化</strong> - 所有状态都能正确保存和恢复</div>
            <div>✅ <strong>父子关系</strong> - 话题→算法状态→执行引擎</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
