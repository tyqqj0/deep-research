"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import LiteratureSearchPanel from '@/components/Research/LiteratureSearchPanel';
import { SEARCH_CONFIGS } from '@/libs/research/LiteratureSearchManager';

// 🧪 测试页面：统一文献搜索管理系统
// 演示MCTS 2.1播种和2.2扩展功能

export default function LiteratureSearchTestPage() {
  const [seedingResults, setSeedingResults] = useState<any>(null);
  const [expandingResults, setExpandingResults] = useState<any>(null);
  const [currentTopic, setCurrentTopic] = useState('深度学习在自然语言处理中的应用');

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 标题和说明 */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">MCTS文献搜索管理系统</h1>
        <p className="text-gray-600">
          统一支持2.1预搜索数据库和2.2边搜边建两个阶段
        </p>
        <div className="flex justify-center gap-2">
          <Badge variant="outline">智能查重</Badge>
          <Badge variant="outline">参数化配置</Badge>
          <Badge variant="outline">进度追踪</Badge>
          <Badge variant="outline">动态扩展</Badge>
        </div>
      </div>

      {/* 配置信息展示 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">预定义配置模板</CardTitle>
          <CardDescription>
            系统提供三种预定义配置，可根据需要调整参数
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium text-sm mb-2">初始播种 (INITIAL_SEEDING)</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <div>模式: seeding</div>
                <div>任务数: 3-8</div>
                <div>策略: parallel</div>
                <div>批次: 3</div>
              </div>
            </div>
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium text-sm mb-2">持续扩展 (CONTINUOUS_EXPANSION)</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <div>模式: expanding</div>
                <div>任务数: 1-5</div>
                <div>策略: sequential</div>
                <div>批次: 2</div>
              </div>
            </div>
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium text-sm mb-2">深度探索 (DEEP_EXPLORATION)</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <div>模式: expanding</div>
                <div>任务数: 2-12</div>
                <div>策略: parallel</div>
                <div>批次: 4</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 主要功能演示 */}
      <Tabs defaultValue="seeding" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="seeding" className="flex items-center gap-2">
            <Badge variant="default" className="text-xs">2.1</Badge>
            文献播种
          </TabsTrigger>
          <TabsTrigger value="expanding" className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">2.2</Badge>
            文献扩展
          </TabsTrigger>
        </TabsList>

        <TabsContent value="seeding" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge>2.1</Badge>
                预搜索数据库 (文献播种)
              </CardTitle>
              <CardDescription>
                初始阶段，基于研究话题生成多个搜索查询，广泛收集相关文献作为知识树的种子
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LiteratureSearchPanel
                mode="seeding"
                topic={currentTopic}
                onTopicChange={setCurrentTopic}
                onComplete={(results) => {
                  setSeedingResults(results);
                  console.log('🌱 Seeding completed:', results);
                }}
              />
              
              {seedingResults && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-2">播种完成！</h4>
                  <div className="text-sm text-green-700 space-y-1">
                    <div>✅ 成功添加 {seedingResults.totalAdded} 篇文献</div>
                    <div>🔍 发现 {seedingResults.totalDuplicates} 篇重复文献</div>
                    <div>📝 会话ID: {seedingResults.sessionId}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expanding" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="secondary">2.2</Badge>
                边搜边建 (文献扩展)
              </CardTitle>
              <CardDescription>
                基于现有文献和MCTS分析结果，动态生成更精确的搜索查询，持续扩展知识树
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LiteratureSearchPanel
                mode="expanding"
                topic={currentTopic}
                onTopicChange={setCurrentTopic}
                onComplete={(results) => {
                  setExpandingResults(results);
                  console.log('🔄 Expanding completed:', results);
                }}
              />
              
              {expandingResults && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">扩展完成！</h4>
                  <div className="text-sm text-blue-700 space-y-1">
                    <div>✅ 成功添加 {expandingResults.totalAdded} 篇文献</div>
                    <div>🔍 发现 {expandingResults.totalDuplicates} 篇重复文献</div>
                    <div>📝 会话ID: {expandingResults.sessionId}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 技术说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">技术架构特点</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">🏗️ 架构优势</h4>
              <ul className="text-sm text-gray-600 space-y-1 pl-4">
                <li>• 统一管理器支持两种模式</li>
                <li>• 复用现有LiteratureDiscoveryService</li>
                <li>• 智能匹配引擎避免重复</li>
                <li>• 参数化配置灵活调整</li>
                <li>• 实时进度追踪和状态管理</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">🔧 核心特性</h4>
              <ul className="text-sm text-gray-600 space-y-1 pl-4">
                <li>• 并行/顺序执行策略</li>
                <li>• 可中断、可恢复的搜索流程</li>
                <li>• 动态查询扩展 (2.2阶段)</li>
                <li>• 批次处理控制并发数</li>
                <li>• 完整的错误处理和重试机制</li>
              </ul>
            </div>
          </div>
          
          <div className="p-3 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-sm mb-2">💡 使用建议</h4>
            <p className="text-xs text-gray-600">
              建议先使用"文献播种"模式建立初始文献库，然后根据MCTS分析结果使用"文献扩展"模式进行有针对性的深度搜索。
              两个模式可以在同一个研究项目中交替使用，形成迭代优化的文献收集策略。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}