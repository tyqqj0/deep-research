"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TreePine, Play, BookOpen } from 'lucide-react';
import MCTSLiteratureWorkflow from '@/components/Research/MCTSLiteratureWorkflow';

// 🧪 MCTS文献工作流集成测试页面

export default function MCTSIntegrationTestPage() {
  const [topic, setTopic] = useState('深度学习在自然语言处理中的应用');
  const [isActive, setIsActive] = useState(false);

  const handleStartWorkflow = () => {
    setIsActive(true);
    console.log('🚀 Starting MCTS Literature Workflow with topic:', topic);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <TreePine className="h-6 w-6 text-green-600" />
            MCTS文献工作流集成测试
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Badge variant="outline">集成测试</Badge>
            <Badge variant="outline">Research工作流第二部分</Badge>
            <Badge variant="outline">三块UI布局</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-1">第一块</h4>
              <p className="text-sm text-blue-600">文献信息面板</p>
              <p className="text-xs text-gray-500">会话文献库、统计信息、Library入口</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-800 mb-1">第二块</h4>
              <p className="text-sm text-green-600">树交互窗口</p>
              <p className="text-xs text-gray-500">知识树可视化、全屏切换、物理效果</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <h4 className="font-medium text-purple-800 mb-1">第三块</h4>
              <p className="text-sm text-purple-600">搜索状态面板</p>
              <p className="text-xs text-gray-500">任务管理、进度追踪、控制操作</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 启动控制 */}
      {!isActive && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">启动工作流</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">研究话题</label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="输入研究话题..."
              />
            </div>
            <Button 
              onClick={handleStartWorkflow}
              disabled={!topic.trim()}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              启动MCTS文献工作流
            </Button>
          </CardContent>
        </Card>
      )}

      {/* MCTS文献工作流 */}
      {isActive && (
        <div className="min-h-[800px]">
          <MCTSLiteratureWorkflow
            topic={topic}
            onTopicChange={setTopic}
            className="h-full"
          />
        </div>
      )}

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">集成说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
            <h4 className="font-medium text-yellow-800 mb-1">🎯 集成位置</h4>
            <p className="text-yellow-700">
              此组件已集成到 <code>src/components/Research/SearchResult.tsx</code> 中，
              作为Research工作流的第二个部分显示。
            </p>
          </div>
          
          <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-400">
            <h4 className="font-medium text-blue-800 mb-1">📊 数据绑定</h4>
            <p className="text-blue-700">
              研究话题来自 <code>taskStore.question</code>，与现有的研究工作流完全集成。
              文献数据会自动从 <code>libraryStore</code> 中筛选话题相关的内容。
            </p>
          </div>
          
          <div className="bg-green-50 p-3 rounded border-l-4 border-green-400">
            <h4 className="font-medium text-green-800 mb-1">⚡ 核心功能</h4>
            <ul className="text-green-700 space-y-1 ml-4 list-disc">
              <li>2.1 播种模式：广泛收集初始文献作为知识树种子</li>
              <li>2.2 扩展模式：基于现有文献动态扩展搜索</li>
              <li>智能查重：复用现有的MatchingEngine避免重复</li>
              <li>实时进度：支持暂停、恢复、取消等控制操作</li>
              <li>可视化树：集成现有TreeVisualization组件</li>
            </ul>
          </div>
          
          <div className="bg-gray-50 p-3 rounded border-l-4 border-gray-400">
            <h4 className="font-medium text-gray-800 mb-1">🔧 技术架构</h4>
            <p className="text-gray-700">
              基于现有的LiteratureDiscoveryService，通过LiteratureSearchManager提供统一管理，
              使用useLiteratureSearchManager Hook进行状态管理，完全复用现有基础设施。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}