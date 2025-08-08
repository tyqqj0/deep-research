/**
 * 演示控制器组件
 * 提供逐步构建树的动画控制
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Play, Pause, Square, RotateCcw, FastForward } from 'lucide-react';
import { demoDataProcessor, DemoStep } from './DemoDataProcessor';
import { useLibraryStore } from '../../store/libraryStore';
import { treeService } from '../../libs/tree/TreeService';

interface DemoControllerProps {
  onStepExecuted?: (step: DemoStep, stepIndex: number, totalSteps: number) => void;
  onDemoComplete?: () => void;
  onDemoReset?: () => void;
  onTreeCreated?: (treeId: string) => void;
}

export const DemoController: React.FC<DemoControllerProps> = ({
  onStepExecuted,
  onDemoComplete,
  onDemoReset,
  onTreeCreated,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [demoSteps, setDemoSteps] = useState<DemoStep[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [speed, setSpeed] = useState(1); // 播放速度倍数

  const { addLibraryItem, items } = useLibraryStore();

  // 初始化演示数据
  const initializeDemoData = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('🚀 Initializing demo data...');
      
      // 加载JSON数据
      await demoDataProcessor.loadJsonData();
      
      // 生成演示步骤
      const steps = demoDataProcessor.generateDemoSteps();
      setDemoSteps(steps);
      
      // 添加文献到库中（如果需要）
      const literatureItems = demoDataProcessor.getLiteratureItems();
      console.log(`📚 Processing ${literatureItems.length} literature items...`);

      let addedCount = 0;
      let skippedCount = 0;

      // 建立JSON ID到现有文献ID的映射
      const jsonToExistingLiteratureMap = new Map<string, string>();

      for (const item of literatureItems) {
        // 预检查：检查是否已存在相同标题的文献
        const existingItem = items.find(existing =>
          existing.title.toLowerCase().trim() === item.title.toLowerCase().trim()
        );

        if (existingItem) {
          skippedCount++;
          console.log(`📋 Using existing: ${item.title} -> ${existingItem.id}`);

          // 建立映射关系：JSON标题 -> 现有文献ID
          jsonToExistingLiteratureMap.set(item.title, existingItem.id);
          continue;
        }

        try {
          const result = await addLibraryItem({
            title: item.title,
            authors: item.authors,
            year: item.year,
            source: item.source,
            abstract: item.abstract,
          });

          if (result.success) {
            addedCount++;
            console.log(`✅ Added: ${item.title}`);
          } else {
            skippedCount++;
            console.log(`📋 Skipped (duplicate): ${item.title}`);
          }
        } catch (error) {
          // 处理重复项错误
          if (error instanceof Error && error.message.includes('Duplicate item found')) {
            skippedCount++;
            console.log(`📋 Skipped (duplicate): ${item.title}`);
          } else {
            console.error(`❌ Failed to add item: ${item.title}`, error);
          }
        }
      }

      console.log(`✅ Demo data processing completed:`);
      console.log(`  - Added: ${addedCount} new items`);
      console.log(`  - Skipped: ${skippedCount} duplicates`);

      // 更新DemoDataProcessor的映射，包含现有文献
      demoDataProcessor.updateExistingLiteratureMapping(jsonToExistingLiteratureMap);

      // 创建演示树
      console.log(`🌳 Creating demo tree...`);

      // 直接获取根节点对应的文献ID
      const rootLiteratureId = demoDataProcessor.getRootLiteratureId();
      console.log(`🔍 Root literature ID found:`, rootLiteratureId);

      if (rootLiteratureId) {
        try {
          const tree = await treeService.createTree(
            `演示树 - ${new Date().toLocaleString()}`,
            rootLiteratureId
          );
          console.log(`✅ Demo tree created: ${tree.id}`);
          onTreeCreated?.(tree.id);
        } catch (error) {
          console.error('❌ Failed to create demo tree:', error);
        }
      } else {
        console.error('❌ Root literature ID not found');
        console.log('Available literature items:', demoDataProcessor.getLiteratureItems().map(item => ({ id: item.id, title: item.title })));
      }

      console.log(`✅ Demo initialized with ${steps.length} steps and ${literatureItems.length} literature items`);
    } catch (error) {
      console.error('❌ Failed to initialize demo data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [addLibraryItem]);

  // 执行单个步骤
  const executeStep = useCallback(async (step: DemoStep, stepIndex: number) => {
    console.log(`🎬 Executing step ${stepIndex + 1}/${demoSteps.length}:`, step);

    try {
      if (step.type === 'node' && step.nodeId) {
        // 添加节点
        const mctsNodes = demoDataProcessor.getMCTSNodes();
        const nodeData = mctsNodes.find(n => n.id === step.nodeId);

        console.log(`🔍 Looking for node ${step.nodeId}:`, nodeData);

        if (nodeData) {
          console.log(`✅ Found node data, calling onStepExecuted`);
          // 这里我们通过回调通知父组件添加节点
          onStepExecuted?.(step, stepIndex, demoSteps.length);
        } else {
          console.error(`❌ Node data not found for ${step.nodeId}`);
          console.log(`Available nodes:`, mctsNodes.map(n => ({ id: n.id, libraryItemId: n.libraryItemId })));
        }
      } else if (step.type === 'edge' && step.sourceId && step.targetId) {
        // 添加边
        console.log(`🔗 Adding edge ${step.sourceId} -> ${step.targetId}`);
        onStepExecuted?.(step, stepIndex, demoSteps.length);
      }
    } catch (error) {
      console.error('❌ Failed to execute step:', error);
    }
  }, [demoSteps.length, onStepExecuted]);

  // 播放演示
  const playDemo = useCallback(() => {
    if (currentStepIndex >= demoSteps.length) {
      console.log('🎉 Demo completed!');
      onDemoComplete?.();
      return;
    }

    setIsPlaying(true);
    setIsPaused(false);

    const step = demoSteps[currentStepIndex];
    const delay = step.delay / speed; // 根据速度调整延迟

    const timeoutId = setTimeout(() => {
      executeStep(step, currentStepIndex);
      setCurrentStepIndex(prev => prev + 1);
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [currentStepIndex, demoSteps, speed, executeStep, onDemoComplete]);

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
    onDemoReset?.();
  }, [onDemoReset]);

  // 重置演示
  const resetDemo = useCallback(() => {
    stopDemo();
    console.log('🔄 Demo reset');
  }, [stopDemo]);

  // 快进到下一步
  const nextStep = useCallback(() => {
    if (currentStepIndex < demoSteps.length) {
      executeStep(demoSteps[currentStepIndex], currentStepIndex);
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [currentStepIndex, demoSteps, executeStep]);

  // 自动播放逻辑
  useEffect(() => {
    if (isPlaying && !isPaused && currentStepIndex < demoSteps.length) {
      const cleanup = playDemo();
      return cleanup;
    } else if (currentStepIndex >= demoSteps.length && isPlaying) {
      setIsPlaying(false);
      onDemoComplete?.();
    }
  }, [isPlaying, isPaused, currentStepIndex, demoSteps.length, playDemo, onDemoComplete]);

  // 初始化数据
  useEffect(() => {
    initializeDemoData();
  }, [initializeDemoData]);

  const progress = demoSteps.length > 0 ? (currentStepIndex / demoSteps.length) * 100 : 0;

  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-lg shadow-lg border">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">🎬 树构建演示</h3>
        <div className="text-sm text-gray-600">
          步骤: {currentStepIndex} / {demoSteps.length}
        </div>
      </div>

      {/* 进度条 */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 控制按钮 */}
      <div className="flex items-center gap-2">
        {!isPlaying ? (
          <Button
            onClick={() => setIsPlaying(true)}
            disabled={isLoading || currentStepIndex >= demoSteps.length}
            className="flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            {currentStepIndex === 0 ? '开始演示' : '继续'}
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
          disabled={currentStepIndex >= demoSteps.length}
          className="flex items-center gap-2"
        >
          <FastForward className="w-4 h-4" />
          下一步
        </Button>
      </div>

      {/* 速度控制 */}
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

      {/* 状态显示 */}
      <div className="text-xs text-gray-500">
        {isLoading && '🔄 加载演示数据...'}
        {isPlaying && !isPaused && '▶️ 演示进行中...'}
        {isPaused && '⏸️ 演示已暂停'}
        {currentStepIndex >= demoSteps.length && demoSteps.length > 0 && '✅ 演示完成！'}
      </div>
    </div>
  );
};

export default DemoController;
