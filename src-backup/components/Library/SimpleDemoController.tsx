/**
 * 简化的演示控制器组件
 * 方案A：基于TreeService的直接构建
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Play, Pause, Square, RotateCcw, FastForward } from 'lucide-react';
import { simpleDemoDataProcessor, BuildStep } from './SimpleDemoDataProcessor';
import { treeService } from '../../libs/tree/TreeService';
import { useLibraryStore } from '../../store/libraryStore';

interface SimpleDemoControllerProps {
  onTreeCreated?: (treeId: string) => void;
  onStepExecuted?: (step: BuildStep, stepIndex: number, totalSteps: number) => void;
  onDemoComplete?: () => void;
  onDemoReset?: () => void;
}

export const SimpleDemoController: React.FC<SimpleDemoControllerProps> = ({
  onTreeCreated,
  onStepExecuted,
  onDemoComplete,
  onDemoReset,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [buildSteps, setBuildSteps] = useState<BuildStep[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [demoTreeId, setDemoTreeId] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);

  const { addLibraryItem, items } = useLibraryStore();

  // 初始化演示数据
  const initializeDemoData = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('🚀 Initializing simple demo data...');
      
      // 1. 强制重新加载JSON数据（清除缓存）
      console.log('🔄 Force reloading JSON data...');
      await simpleDemoDataProcessor.loadJsonData();
      
      // 2. 准备文献数据
      console.log('📚 Preparing literature data...');
      console.log(`📊 Current library items: ${items.length}`);

      // 首先更新现有文献的映射
      simpleDemoDataProcessor.updateExistingLiteratureMapping(items);

      // 然后添加新文献（可能会有重复错误，但会被静默处理）
      await simpleDemoDataProcessor.prepareLiterature(addLibraryItem);

      // 重新获取最新的文献列表（因为可能有新添加的）
      console.log('🔄 Refreshing library state...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // 等待状态更新

      // 再次更新映射，确保重复的文献也被映射
      console.log('🔄 Final mapping update...');
      try {
        // 手动获取最新的文献列表
        const { libraryService } = await import('../../libs/db/LibraryService');
        const allItems = await libraryService.getAllLibraryItems();
        console.log(`📊 Retrieved ${allItems.length} items from library service`);
        simpleDemoDataProcessor.updateExistingLiteratureMapping(allItems);
      } catch (error) {
        console.error('Failed to get latest items:', error);
        // 回退到使用当前的items
        simpleDemoDataProcessor.updateExistingLiteratureMapping(items);
      }

      // 3. 创建根节点树
      console.log('🌳 Creating demo tree...');
      const rootLiteratureId = simpleDemoDataProcessor.getRootLiteratureId();

      console.log('🔍 Root literature ID:', rootLiteratureId);
      console.log('🗺️ Total mappings:', simpleDemoDataProcessor.getAllMappings().size);

      // 调试：显示根节点信息和第一个构建步骤的父节点
      const buildStepsPreview = simpleDemoDataProcessor.generateBuildSteps();
      const firstStep = buildStepsPreview[0];
      const rootJsonId = simpleDemoDataProcessor.getRootJsonId();
      console.log('🔍 Root vs First Step comparison:', {
        rootJsonId: rootJsonId,
        rootLiteratureId: rootLiteratureId,
        firstStepParentJsonId: firstStep?.parentJsonId,
        firstStepParentLiteratureId: firstStep ? simpleDemoDataProcessor.getLiteratureId(firstStep.parentJsonId) : null,
        match: rootLiteratureId === (firstStep ? simpleDemoDataProcessor.getLiteratureId(firstStep.parentJsonId) : null)
      });

      if (!rootLiteratureId) {
        console.error('❌ Root literature ID not found');
        console.log('📊 Available mappings:', Array.from(simpleDemoDataProcessor.getAllMappings().entries()));
        throw new Error('Root literature ID not found');
      }
      
      const tree = await treeService.createTree(
        `智能演示树 - ${new Date().toLocaleString()}`,
        rootLiteratureId
      );
      
      setDemoTreeId(tree.id);
      console.log(`✅ Demo tree created: ${tree.id}`);
      
      // 4. 生成构建步骤
      const steps = simpleDemoDataProcessor.generateBuildSteps();
      setBuildSteps(steps);
      
      // 5. 通知父组件
      onTreeCreated?.(tree.id);
      
      setIsInitialized(true);
      
      // 6. 输出统计信息
      const stats = simpleDemoDataProcessor.getStats();
      console.log('📊 Demo initialization completed:', stats);
      
    } catch (error) {
      console.error('❌ Failed to initialize demo data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [addLibraryItem, items, onTreeCreated]);

  // 执行单个构建步骤
  const executeStep = useCallback(async (step: BuildStep, stepIndex: number) => {
    if (!demoTreeId) {
      console.error('❌ Demo tree ID not available');
      return;
    }

    console.log(`🏗️ Executing step ${stepIndex + 1}/${buildSteps.length}:`, step);

    try {
      // 获取父节点和子节点的文献ID
      const parentLiteratureId = simpleDemoDataProcessor.getLiteratureId(step.parentJsonId);
      const childLiteratureId = simpleDemoDataProcessor.getLiteratureId(step.childJsonId);

      console.log(`🔍 Literature ID lookup:`, {
        parentJsonId: step.parentJsonId,
        parentLiteratureId,
        childJsonId: step.childJsonId,
        childLiteratureId
      });

      if (!parentLiteratureId || !childLiteratureId) {
        console.error('❌ Literature IDs not found:', {
          parentJsonId: step.parentJsonId,
          parentLiteratureId,
          childJsonId: step.childJsonId,
          childLiteratureId
        });
        return;
      }

      // 获取当前树状态，找到父节点在树中的ID
      const tree = await treeService.getTreeById(demoTreeId);

      if (!tree) {
        console.error('❌ Tree not found:', demoTreeId);
        return;
      }

      const parentTreeNode = Object.values(tree.nodes).find(
        node => node.libraryItemId === parentLiteratureId
      );

      console.log(`🔍 Tree node search:`, {
        searchingForLiteratureId: parentLiteratureId,
        totalNodesInTree: Object.keys(tree.nodes).length,
        availableNodes: Object.values(tree.nodes).map(n => ({
          id: n.id,
          libraryItemId: n.libraryItemId
        })),
        parentTreeNodeFound: !!parentTreeNode
      });

      // 详细显示树中的节点信息
      console.log(`🌳 Tree root node details:`, {
        treeRootNodeId: tree.rootNodeId,
        rootNodeInNodes: tree.nodes[tree.rootNodeId],
        allNodeIds: Object.keys(tree.nodes)
      });

      if (!parentTreeNode) {
        console.error('❌ Parent tree node not found:', {
          parentJsonId: step.parentJsonId,
          parentLiteratureId,
          searchedInNodes: Object.values(tree.nodes).map(n => n.libraryItemId),
          availableNodes: Object.values(tree.nodes).map(n => ({
            id: n.id,
            libraryItemId: n.libraryItemId
          }))
        });
        return;
      }

      // 添加子节点到树中
      const newTreeNode = await treeService.addNodeToTree(
        demoTreeId,
        parentTreeNode.id,
        childLiteratureId
      );

      console.log(`✅ Added node to tree: ${step.childJsonId} -> ${newTreeNode.id}`);

      // 通知父组件
      onStepExecuted?.(step, stepIndex, buildSteps.length);

    } catch (error) {
      console.error('❌ Failed to execute step:', error);
    }
  }, [demoTreeId, buildSteps.length, onStepExecuted]);

  // 播放演示
  const playDemo = useCallback(() => {
    if (currentStepIndex >= buildSteps.length) {
      console.log('🎉 Demo completed!');
      setIsPlaying(false);
      onDemoComplete?.();
      return;
    }

    setIsPlaying(true);
    setIsPaused(false);

    const step = buildSteps[currentStepIndex];
    const delay = step.delay / speed;

    const timeoutId = setTimeout(() => {
      executeStep(step, currentStepIndex);
      setCurrentStepIndex(prev => prev + 1);
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [currentStepIndex, buildSteps, speed, executeStep, onDemoComplete]);

  // 暂停演示
  const pauseDemo = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(true);
  }, []);

  // 停止演示
  const stopDemo = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentStepIndex(0);
  }, []);

  // 重置演示
  const resetDemo = useCallback(() => {
    stopDemo();
    setIsInitialized(false);
    setDemoTreeId(null);
    setBuildSteps([]);
    onDemoReset?.();
    console.log('🔄 Demo reset');
  }, [stopDemo, onDemoReset]);

  // 下一步
  const nextStep = useCallback(() => {
    if (currentStepIndex < buildSteps.length) {
      executeStep(buildSteps[currentStepIndex], currentStepIndex);
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [currentStepIndex, buildSteps, executeStep]);

  // 自动播放逻辑
  useEffect(() => {
    if (isPlaying && !isPaused && currentStepIndex < buildSteps.length) {
      const cleanup = playDemo();
      return cleanup;
    } else if (currentStepIndex >= buildSteps.length && isPlaying) {
      setIsPlaying(false);
      onDemoComplete?.();
    }
  }, [isPlaying, isPaused, currentStepIndex, buildSteps.length, playDemo, onDemoComplete]);

  const progress = buildSteps.length > 0 ? (currentStepIndex / buildSteps.length) * 100 : 0;

  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-lg shadow-lg border">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">🎬 智能树构建演示</h3>
        <div className="text-sm text-gray-600">
          步骤: {currentStepIndex} / {buildSteps.length}
        </div>
      </div>

      {/* 进度条 */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 初始化按钮 */}
      {!isInitialized && (
        <Button
          onClick={initializeDemoData}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <Play className="w-4 h-4" />
          {isLoading ? '初始化中...' : '初始化演示'}
        </Button>
      )}

      {/* 控制按钮 */}
      {isInitialized && (
        <div className="flex items-center gap-2">
          {!isPlaying ? (
            <Button
              onClick={() => setIsPlaying(true)}
              disabled={currentStepIndex >= buildSteps.length}
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              {currentStepIndex === 0 ? '开始构建' : '继续'}
            </Button>
          ) : (
            <Button
              onClick={pauseDemo}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Pause className="w-4 h-4" />
              暂停
            </Button>
          )}

          <Button
            onClick={stopDemo}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Square className="w-4 h-4" />
            停止
          </Button>

          <Button
            onClick={resetDemo}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            重置
          </Button>

          <Button
            onClick={nextStep}
            variant="outline"
            disabled={currentStepIndex >= buildSteps.length}
            className="flex items-center gap-2"
          >
            <FastForward className="w-4 h-4" />
            下一步
          </Button>
        </div>
      )}

      {/* 速度控制 */}
      {isInitialized && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">播放速度:</span>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="px-2 py-1 border rounded text-sm"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
          </select>
        </div>
      )}

      {/* 状态显示 */}
      <div className="text-xs text-gray-500">
        {isLoading && '🔄 初始化演示数据...'}
        {isInitialized && !isPlaying && !isPaused && '✅ 演示已准备就绪'}
        {isPlaying && !isPaused && '▶️ 演示进行中...'}
        {isPaused && '⏸️ 演示已暂停'}
        {currentStepIndex >= buildSteps.length && buildSteps.length > 0 && '🎉 演示完成！'}
      </div>
    </div>
  );
};

export default SimpleDemoController;
