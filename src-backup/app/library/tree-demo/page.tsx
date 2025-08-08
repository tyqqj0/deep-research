"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TreeVisualization } from "@/components/Library/TreeVisualization";
import { mockDataGenerator } from "@/libs/tree/MockDataGenerator";
import { SimpleDemoController } from "@/components/Library/SimpleDemoController";
import { simpleDemoDataProcessor, BuildStep } from "@/components/Library/SimpleDemoDataProcessor";
import { treeService } from "@/libs/tree/TreeService";
import { useLibraryStore } from "@/store/libraryStore";
import { useTree } from "@/hooks/useTree";
import { toast } from "sonner";
import { 
  TreePine, 
  Play, 
  Trash2, 
  RefreshCw, 
  Database,
  Sparkles,
  BarChart3
} from "lucide-react";

export default function TreeDemoPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [demoTreeId, setDemoTreeId] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [currentStep, setCurrentStep] = useState<BuildStep | null>(null);

  const { trees, items, initialize } = useLibraryStore();
  const { createTree, addNode } = useTree(demoTreeId);

  // 生成模拟数据
  const handleGenerateMockData = async () => {
    setIsGenerating(true);
    try {
      toast.info('开始生成经典AI论文数据...');
      
      // 生成所有树结构
      const createdTrees = await mockDataGenerator.createAllTreeStructures();
      
      // 刷新store数据
      await initialize();
      
      toast.success(`成功创建 ${createdTrees.length} 个文献树！`);
    } catch (error) {
      console.error('生成模拟数据失败:', error);
      toast.error(`生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 开始演示模式
  const handleStartDemo = () => {
    setIsDemoMode(true);
    toast.info('启动智能演示模式...');
  };

  // 处理树创建完成
  const handleTreeCreated = (treeId: string) => {
    console.log(`🌳 Tree created: ${treeId}`);
    setDemoTreeId(treeId);
    toast.success(`智能演示树创建成功！`);

    // 刷新全局状态以确保树被加载
    initialize();
  };

  // 处理演示步骤
  const handleDemoStep = (step: BuildStep, stepIndex: number, totalSteps: number) => {
    console.log(`🏗️ Step ${stepIndex + 1}/${totalSteps}: Adding ${step.childJsonId} to parent ${step.parentJsonId}`);
    setCurrentStep(step);
  };

  // 演示完成
  const handleDemoComplete = () => {
    toast.success('🎉 智能演示完成！');
    console.log('🎉 Tree construction demo completed!');
  };

  // 重置演示
  const handleDemoReset = () => {
    setDemoTreeId(null);
    setIsDemoMode(false);
    setCurrentStep(null);
    toast.info('演示已重置');
  };

  // 清理模拟数据
  const handleClearMockData = async () => {
    setIsClearing(true);
    try {
      toast.info('开始清理模拟数据...');
      
      await mockDataGenerator.cleanupMockData();
      
      // 刷新store数据
      await initialize();
      
      toast.success('模拟数据清理完成！');
    } catch (error) {
      console.error('清理模拟数据失败:', error);
      toast.error(`清理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsClearing(false);
    }
  };

  // 刷新数据
  const handleRefresh = async () => {
    try {
      await initialize();
      toast.success('数据刷新完成！');
    } catch (error) {
      toast.error('刷新失败');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TreePine className="h-8 w-8 text-green-600" />
            文献树可视化演示
          </h1>
          <p className="text-gray-600 mt-2">
            基于经典AI论文的树形数据结构可视化系统演示
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
        </div>
      </div>

      {/* 控制面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            数据管理
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 数据统计 */}
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900">当前数据统计</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">文献数量:</span>
                  <Badge variant="outline">{items.length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">文献树数量:</span>
                  <Badge variant="outline">{trees.length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">总节点数:</span>
                  <Badge variant="outline">
                    {trees.reduce((sum, tree) => sum + Object.keys(tree.nodes).length, 0)}
                  </Badge>
                </div>
              </div>
            </div>

            {/* 数据生成 */}
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900">模拟数据生成</h3>
              <div className="space-y-2">
                <Button
                  onClick={handleGenerateMockData}
                  disabled={isGenerating}
                  className="w-full flex items-center gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  {isGenerating ? '生成中...' : '生成经典AI论文树'}
                </Button>
                <p className="text-xs text-gray-500">
                  将创建Transformer、RNN/LSTM、CNN等经典论文的发展脉络树
                </p>
              </div>
            </div>

            {/* 数据清理 */}
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900">数据清理</h3>
              <div className="space-y-2">
                <Button
                  onClick={handleClearMockData}
                  disabled={isClearing || trees.length === 0}
                  variant="destructive"
                  className="w-full flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  {isClearing ? '清理中...' : '清理所有树数据'}
                </Button>
                <p className="text-xs text-gray-500">
                  将删除所有文献树（不删除文献本身）
                </p>
              </div>
            </div>

            {/* 演示控制 */}
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900">智能演示</h3>
              <div className="space-y-2">
                <Button
                  onClick={handleStartDemo}
                  disabled={isDemoMode}
                  className="w-full flex items-center gap-2"
                  variant="outline"
                >
                  <Play className="h-4 w-4" />
                  {isDemoMode ? '演示进行中' : '启动智能演示'}
                </Button>
                <p className="text-xs text-gray-500">
                  基于真实论文数据的智能树构建演示
                </p>
                <p className="text-xs text-blue-600">
                  🚀 全新简化架构，更稳定更直观
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 智能演示控制器 */}
      {isDemoMode && (
        <SimpleDemoController
          onTreeCreated={handleTreeCreated}
          onStepExecuted={handleDemoStep}
          onDemoComplete={handleDemoComplete}
          onDemoReset={handleDemoReset}
        />
      )}

      {/* 可视化演示区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            树形可视化演示
            {isDemoMode && (
              <Badge variant="secondary" className="ml-2">
                演示模式 {demoTreeId ? `(${demoTreeId.slice(0, 8)}...)` : '(准备中)'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(trees.length === 0 && !isDemoMode) ? (
            <div className="text-center py-12">
              <TreePine className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无文献树数据</h3>
              <p className="text-gray-600 mb-4">
                点击上方"生成经典AI论文树"按钮或"启动智能演示"来创建演示数据
              </p>
              <Button
                onClick={handleGenerateMockData}
                disabled={isGenerating}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {isGenerating ? '生成中...' : '开始生成'}
              </Button>
            </div>
          ) : (
            <TreeVisualization
              treeId={isDemoMode && demoTreeId ? demoTreeId : (trees.length > 0 ? trees[0].id : undefined)}
              mode="edit"
              height="800px"
              showControls={true}
              showMiniMap={true}
              showTreeSelector={!isDemoMode} // 演示模式下隐藏树选择器
              showNodeStats={true}
              enablePhysics={true}
              onNodeSelect={(node) => {
                console.log('选中节点:', node);
                toast.info(`选中节点: ${node.id}`);
              }}
              onTreeChange={(treeId) => {
                console.log('切换树:', treeId);
                toast.info('切换到新的文献树');
              }}
              onNodeAdd={(parentId, itemId) => {
                console.log('添加节点:', parentId, itemId);
                toast.success('节点添加成功');
              }}
              onNodeDelete={(nodeId) => {
                console.log('删除节点:', nodeId);
                toast.success('节点删除成功');
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-3">功能特性</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• 基于React Flow的树形可视化</li>
                <li>• 🆕 物理引擎：D3-Force驱动的动态布局</li>
                <li>• 支持MCTS算法的节点统计显示</li>
                <li>• 交互式节点操作（添加、删除、移动）</li>
                <li>• 层级约束：同层水平对齐，不同层垂直分离</li>
                <li>• 多种显示模式（编辑、查看、嵌入）</li>
                <li>• 实时数据同步</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-3">操作指南</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• 点击节点查看详细信息</li>
                <li>• 右键节点菜单进行操作</li>
                <li>• 使用"运行MCTS"按钮执行算法</li>
                <li>• "重新布局"可优化节点排列</li>
                <li>• 🆕 "物理效果"按钮切换动态/静态布局</li>
                <li>• 支持缩放和拖拽操作</li>
                <li>• 小地图帮助导航大型树结构</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
