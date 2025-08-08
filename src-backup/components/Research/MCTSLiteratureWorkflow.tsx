"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  TreePine,
  BookOpen,
  Search,
  Settings,
  Maximize2,
  Minimize2,
  LoaderCircle,
  CircleCheck,
  TextSearch,
  Hourglass,
  XCircle,
  Play,
  Pencil,
  Save,
  RotateCcw,
  Trash,
  NotebookText,
  Download
} from 'lucide-react';
import { toast } from 'sonner';

// 导入新的Hook和store
import useLiteratureResearch from '@/hooks/useLiteratureResearch';
import { useTreeBuilder } from '@/hooks/useTreeBuilder';
import { useTaskStore } from '@/store/task';
import { useLibraryStore } from '@/store/libraryStore';
import { LibraryItem } from '@/libs/db';
import { createSessionLiteratureConnector } from '@/libs/research/SessionLiteratureConnector';

// 导入组件
import LiteratureInfoPanel from './LiteratureInfoPanel';
import MCTSControlPanel from './MCTSControlPanel';
import SearchResult from './SearchResult';
import { TreeVisualization } from '@/components/Library/TreeVisualization';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// 🎯 MCTS研究工作流 - 回归原有架构的三块UI布局
// 1. 文献信息面板（上） 2. 树交互窗口（中） 3. 搜索任务面板（下 - 复用SearchResult逻辑）

interface MCTSLiteratureWorkflowProps {
  topic: string;
  reportPlan?: string;
  onTopicChange?: (topic: string) => void;
  treeId?: string;
  className?: string;
}

// 任务状态图标组件 - 复用SearchResult逻辑
function TaskState({ state }: { state: SearchTask["state"] }) {
  if (state === "completed") {
    return <CircleCheck className="h-5 w-5" />;
  } else if (state === "processing") {
    return <LoaderCircle className="animate-spin h-5 w-5" />;
  } else if (state === "waiting") {
    return <Hourglass className="h-5 w-5" />;
  } else if (state === "cancelled") {
    return <XCircle className="h-5 w-5" />;
  } else {
    return <TextSearch className="h-5 w-5" />;
  }
}

export default function MCTSLiteratureWorkflow({
  topic,
  reportPlan,
  onTopicChange,
  treeId,
  className = ''
}: MCTSLiteratureWorkflowProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const libraryStore = useLibraryStore();
  const libraryItems = useLibraryStore(state => state.items); // 🚀 直接订阅items状态
  const taskStore = useTaskStore();

  // 🚀 新的简化Hook
  const { status, runLiteratureSeeding, cancelTask } = useLiteratureResearch();

  // 🌳 TreeBuilder Hook - SG-MCTS功能
  const treeBuilder = useTreeBuilder();

  // 🎯 使用TaskStore中的全局树ID
  const currentTreeId = treeBuilder.currentTreeId || treeId;

  // 🔗 会话文献连接件
  const sessionConnector = useMemo(() => {
    return createSessionLiteratureConnector({
      topic,
      autoTag: true,
      filterByTopic: true
    });
  }, [topic]);

  // 🚀 直接计算会话文献，基于会话ID精确匹配
  const sessionLiteratureFromStore = useMemo(() => {
    if (!topic || !topic.trim()) return [];

    // 🎯 获取当前会话ID
    const currentSessionId = taskStore.id;
    if (!currentSessionId) return [];

    const filteredItems = libraryItems.filter(item => {
      // 🎯 优先检查会话ID关联（精确匹配）
      if (item.associatedSessions?.includes(currentSessionId)) {
        return true;
      }

      // 🔄 兼容性：检查是否有基于topic名称的关联（旧数据）
      const topicLower = topic.toLowerCase();
      if (item.associatedSessions?.some((session: string) => session.toLowerCase().includes(topicLower))) {
        return true;
      }

      // 🔍 内容匹配（作为补充）
      if (item.title.toLowerCase().includes(topicLower)) {
        return true;
      }
      if (item.abstract?.toLowerCase().includes(topicLower)) {
        return true;
      }
      //   return true;
      // }
      return false;
    });

    return filteredItems.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [libraryItems, topic]);

  // 本地状态
  const [isTreeMaximized, setIsTreeMaximized] = useState(false);
  const [workflowStarted, setWorkflowStarted] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [originalTasks, setOriginalTasks] = useState<Record<string, SearchTask>>({});
  const [isGeneratingMockData, setIsGeneratingMockData] = useState(false);

  // 调试信息 - 显示会话文献数量变化
  useEffect(() => {
    // console.log(`[MCTSWorkflow] 会话文献更新: ${sessionLiteratureFromStore.length} 篇，话题: ${topic}`);
  }, [sessionLiteratureFromStore.length, topic]);

  // 🌱 开始文献播种
  const handleLiteratureSeeding = useCallback(async () => {
    try {
      setWorkflowStarted(true);
      await runLiteratureSeeding(topic, reportPlan);
      // 不需要手动刷新，sessionLiteratureFromStore会自动更新
    } catch (error) {
      console.error('Failed to start literature seeding:', error);
      if (error instanceof Error) {
        toast.error(`文献播种失败: ${error.message}`);
      } else {
        toast.error(`文献播种失败: 发生未知错误`);
      }
    }
  }, [topic, reportPlan, runLiteratureSeeding]);

  // 前往Library页面
  const handleViewLibrary = useCallback(() => {
    router.push('/library');
  }, [router]);

  // 树形可视化最大化切换
  const toggleTreeMaximize = useCallback(() => {
    setIsTreeMaximized(!isTreeMaximized);
  }, [isTreeMaximized]);

  // 🌳 设为根节点处理函数
  const handleSetAsRoot = useCallback(async (item: LibraryItem) => {
    try {
      toast.loading('正在创建知识树...', { id: 'tree-creation' });

      // 🎯 获取创建的树ID
      const createdTreeId = await treeBuilder.startTreeBuilding(item, topic);

      toast.success(`已将"${item.title}"设为根节点，树可视化已更新`, { id: 'tree-creation' });

      // 确保在三面板模式下显示树（不自动最大化）
      setIsTreeMaximized(false);

      console.log('🌳 [MCTSWorkflow] Tree created successfully with ID:', createdTreeId);

    } catch (error) {
      console.error('设置根节点失败:', error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      toast.error(`设置根节点失败: ${errorMsg}`, { id: 'tree-creation' });
    }
  }, [topic, treeBuilder]);

  // 🧪 生成模拟数据处理函数
  const handleGenerateMockData = useCallback(async () => {
    if (isGeneratingMockData) return;

    setIsGeneratingMockData(true);

    try {
      // 预定义的模拟URL列表 - 包含一些无效URL来测试错误处理
      // const mockUrls = [
      //   'https://arxiv.org/abs/2301.00001', // 示例arXiv论文
      //   'https://fake-journal.com/article/123456', // 🔗 测试无效URL
      //   'https://www.nature.com/articles/s41586-023-00001-0', // Nature文章
      //   'https://science.sciencemag.org/content/379/6628/123', // Science文章
      //   'https://invalid-domain-test.fake/paper/123', // 🔗 测试无效域名
      //   'https://link.springer.com/article/10.1007/s00000-023-00001-0', // Springer文章
      //   'https://www.cell.com/cell/fulltext/S0092-8674(23)00001-0', // Cell期刊
      //   'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0000001' // PLOS ONE
      // ];
            const mockUrls = [
        // --- Part 1: 基石与经典 (Foundations & Classics) ---
        // 1. Backpropagation (反向传播) - 神经网络训练的核心算法
        'https://ieeexplore.ieee.org/document/726791', 
        // 2. Word2Vec - 现代词嵌入技术的开创者，让词语有了向量表示
        'https://arxiv.org/abs/1301.3781', 
        // 3. GloVe - 另一种经典的词嵌入方法，结合了全局矩阵分解和局部上下文窗口
        'https://arxiv.org/abs/1406.2661',

        // --- Part 2: 序列模型与RNN时代 (Sequence Models & The RNN Era) ---
        // 4. LSTM (Long Short-Term Memory) - 经典RNN，解决了长序列依赖问题。注意：这是1997年的原始论文，不在Arxiv上，这里放一个后来的重要综述。
        // 'https://www.bioinf.jku.at/publications/older/2604.pdf', // 原始论文链接
        'https://arxiv.org/abs/1412.3555', // LSTM: A Search Space Odyssey，一篇很好的综述和分析
        // 5. Seq2Seq - 经典的编码器-解码器架构，是后续所有注意力模型和Transformer的基础
        'https://arxiv.org/abs/1409.3215',
        // 6. GRU (Gated Recurrent Unit) - LSTM的简化变体，效果类似但更易于计算
        'https://arxiv.org/abs/1406.1078',
        // 7. Bahdanau Attention - 首次将注意力机制引入NLP的Seq2Seq模型，是Transformer注意力的前身
        'https://arxiv.org/abs/1409.0473',

        // --- Part 3: 注意力与Transformer的革命 (The Attention & Transformer Revolution) ---
        // 8. Attention Is All You Need (Transformer) - 革命性的论文，宣告了Transformer时代的到来
        'https://arxiv.org/abs/1706.03762',
        // 9. BERT - 基于Transformer的预训练语言模型，通过双向编码器理解上下文，刷新了多项NLP任务记录
        'https://arxiv.org/abs/1810.04805',
        // 10. RoBERTa - BERT的强大优化版，通过改进训练策略和更多数据显著提升了性能
        'https://arxiv.org/abs/1907.11692',
        // 11. T5 (Text-to-Text Transfer Transformer) - 谷歌提出的将所有NLP任务统一为文本到文本格式的模型
        'https://arxiv.org/abs/1910.10683',

        // --- Part 4: GPT系列与大语言模型 (The GPT Series & LLMs) ---
        // 12. GPT-1 - GPT系列的开山之作，证明了生成式预训练的巨大潜力
        // 'https://s3-us-west-2.amazonaws.com/openai-assets/research-papers/language-unsupervised-generative-pre-training.pdf', // OpenAI 官网PDF
        // 13. GPT-2 - 展示了LLM在无监督多任务学习上的惊人能力，因其强大而最初未完全开源
        // 'https://d4mucfpksywv.cloudfront.net/better-language-models/language_models_are_unsupervised_multitask_learners.pdf', // OpenAI 官网PDF
        // 14. GPT-3 - 开启大模型时代，展示了强大的零样本和少样本学习能力
        'https://arxiv.org/abs/2005.14165',
        // 15. InstructGPT - 提出了基于人类反馈的强化学习（RLHF）来对齐模型与人类意图，是ChatGPT的技术基础
        'https://arxiv.org/abs/2203.02155',
        // 16. PaLM - 谷歌发布的大规模模型，展示了在推理等方面的卓越性能
        'https://arxiv.org/abs/2204.02311',
        
        // --- Part 5: LLM推理、增强与微调 (Reasoning, Enhancement & Fine-tuning) ---
        // 17. Chain-of-Thought (CoT) - 提示LLM进行逐步思考，显著提升了其在复杂推理任务上的表现
        'https://arxiv.org/abs/2201.11903',
        // 18. Self-Consistency - CoT的改进，通过生成多个推理路径并投票选出最一致的答案，进一步提升准确性
        'https://arxiv.org/abs/2203.11171',
        // 19. RAG (Retrieval-Augmented Generation) - 结合检索系统与生成模型，让LLM能利用外部知识回答问题
        'https://arxiv.org/abs/2005.11401',
        // 20. Toolformer - 让LLM自主学习使用外部工具（如计算器、搜索引擎），增强其能力边界
        'https://arxiv.org/abs/2302.04761',
        // 21. LoRA - 高效微调（PEFT）的代表性技术，通过低秩适配器在少量参数上实现LLM微调
        'https://arxiv.org/abs/2106.09685',
        // 22. PAL (Program-aided Language Models) - 让模型生成代码（如Python）来解决复杂问题，而不是直接生成答案
        'https://arxiv.org/abs/2211.10435',

        // --- Part 6: 当代开源模型与创新 (Modern Open Models & Innovations) ---
        // 23. LLaMA - Meta发布的开源模型，开启了高质量开源LLM的生态
        'https://arxiv.org/abs/2302.13971',
        // 24. Llama 2 - LLaMA的第二代，提供了更强大的基座和可商用的对话模型
        'https://arxiv.org/abs/2307.09288',
        // 25. Mistral 7B - Mistral AI发布的强大7B模型，在同尺寸模型中表现卓越
        'https://arxiv.org/abs/2310.06825',
        // 26. Switch Transformers (MoE) - 谷歌提出的稀疏激活的混合专家模型（MoE）架构，能以更低成本扩展模型规模
        'https://arxiv.org/abs/2101.03961',
        // 27. Mixtral of Experts - Mistral AI发布的开源MoE模型，性能媲美GPT-3.5
        'https://arxiv.org/abs/2401.04088',
        // 28. Phi-2 - 微软发布的高质量小模型（SLM），证明了“小而精”模型的潜力
        'https://arxiv.org/abs/2312.17238',
        // 29. DeepSeek-LLM - DeepSeek发布的强大的开源基座模型
        'https://arxiv.org/abs/2401.15950',
        // 30. DeepSeek-Coder - DeepSeek发布的在代码生成方面非常强大的模型
        'https://arxiv.org/abs/2401.02385',
        // 31. DeepSeekMath - DeepSeek发布的在数学推理方面领先的开源模型
        'https://arxiv.org/abs/2311.16101',
        // 32. Gemma - 谷歌发布的轻量级开源模型系列，源自其Gemini技术
        'https://arxiv.org/abs/2403.08295',
        // 33. vLLM - 一个高效的LLM推理和服务引擎，极大地提升了LLM的吞吐量
        'https://arxiv.org/abs/2309.06180',
      ];



      console.log(`[MockDataGen] 开始为话题 "${topic}" 生成模拟数据`);

      // 使用SessionLiteratureConnector批量添加
      const result = await sessionConnector.batchAddFromUrls(mockUrls);

      // 不需要手动刷新，sessionLiteratureFromStore会自动更新

      // 显示结果统计
      const resultMsg = `模拟数据生成完成：成功添加 ${result.success} 篇，重复 ${result.duplicates} 篇，失败 ${result.errors} 篇`;

      if (result.errors > 0) {
        toast.warning(resultMsg);
        console.warn('[MockDataGen] 部分URL添加失败:', result.errorDetails);
      } else {
        toast.success(resultMsg);
      }

      console.log('[MockDataGen] 模拟数据生成完成:', result);

    } catch (error) {
      console.error('[MockDataGen] 生成模拟数据失败:', error);
      toast.error(`生成模拟数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsGeneratingMockData(false);
    }
  }, [topic, sessionConnector, isGeneratingMockData]);

  // 检查是否有正在进行的任务
  const isRunning = status.includes('正在') || status.includes('生成');
  const hasActiveTasks = taskStore.tasks.length > 0;

  // 🐛 只要有研究方案就显示完整面板，不需要等待工作流开始
  const shouldShowLayout = !!(reportPlan && reportPlan.trim());

  // 只在状态变化时输出调试信息
  useEffect(() => {
    // console.log('🔧 [MCTSWorkflow] UI状态变化:', {
    //   topic,
    //   hasActiveTasks,
    //   isRunning,
    //   shouldShowLayout,
    //   tasksCount: taskStore.tasks.length,
    //   status: status.slice(0, 100)
    // });
  }, [topic, hasActiveTasks, isRunning, shouldShowLayout, taskStore.tasks.length, status]);

  return (
    <div className={`h-full ${className}`}>
      {/* 🎯 统一的MCTS工作流主容器 */}
      <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl border shadow-lg p-6 h-full">

        {/* 工作流标题区域 - 统一包裹 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TreePine className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">二、文献研究</h2>
                <p className="text-sm text-gray-600">话题: {topic}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* 工作流控制按钮 */}
              {!hasActiveTasks ? (
                <Button
                  onClick={handleLiteratureSeeding}
                  disabled={isRunning}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md"
                >
                  {isRunning ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      播种中...
                    </>
                  ) : (
                    <>
                      <BookOpen className="h-4 w-4 mr-2" />
                      🌱 开始文献播种
                    </>
                  )}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      taskStore.update([]);
                      setWorkflowStarted(false);
                    }}
                    variant="outline"
                    size="sm"
                    className="border-gray-300 hover:bg-gray-50"
                  >
                    重置工作流
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* 状态指示区域 */}
          {isRunning && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <div className="flex-1">
                <div className="text-sm font-medium text-blue-800">{status}</div>
                <div className="text-xs text-blue-600">已生成 {taskStore.tasks.length} 个搜索任务</div>
              </div>
            </div>
          )}
        </div>

        {/* 三面板核心区域 - 提升高度 */}
        {shouldShowLayout ? (
          isTreeMaximized ? (
            // 树形可视化全屏模式
            <Card className="h-[calc(100vh-180px)] shadow-lg border-gray-200">
              <CardHeader className="pb-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <TreePine className="h-5 w-5 text-green-600" />
                    知识树可视化 - 全屏模式
                  </CardTitle>
                  <Button onClick={toggleTreeMaximize} variant="outline" size="sm">
                    <Minimize2 className="h-4 w-4 mr-1" />
                    还原
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="h-[calc(100%-80px)] p-6">
                <TreeVisualization
                  treeId={currentTreeId}
                  mode="edit"
                  height="100%"
                  showControls={true}
                  showMiniMap={true}
                  enablePhysics={true}
                  className="w-full h-full rounded-lg"
                />
              </CardContent>
            </Card>
          ) : (
            // 三面板布局模式 - 固定大小，优化比例分配
            <div className="h-[calc(100vh+220px)] flex flex-col rounded-lg overflow-hidden shadow-lg border border-gray-200">

              {/* 1. 会话文献信息面板（上） - 增大到50%，确保内容完整显示 */}
              <div className="h-[37%] bg-white border-b border-gray-200">
                <LiteratureInfoPanel
                  sessionLiterature={sessionLiteratureFromStore}
                  topic={topic}
                  onViewLibrary={handleViewLibrary}
                  onSetAsRoot={handleSetAsRoot}
                  hasActiveTreeBuilding={!!treeBuilder.currentTreeId}
                  onGenerateMockData={handleGenerateMockData}
                  className="h-full"
                />
              </div>

              {/* 2. 知识树可视化 + MCTS控制面板（中） - 集成布局 */}
              <div className="h-[45%] border-b border-gray-200">
                <Card className="h-full bg-gradient-to-br from-green-50 to-emerald-50/30 border-0 rounded-none">
                  {/* 集成的标题栏 */}
                  <CardHeader className="pb-2 border-b border-green-100">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <TreePine className="h-5 w-5 text-green-600" />
                        知识树可视化 & MCTS控制
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button onClick={toggleTreeMaximize} variant="outline" size="sm" className="border-green-200 hover:bg-green-100">
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {/* 集成的内容区域 */}
                  <CardContent className="h-[calc(100%-60px)] p-3 flex gap-3">
                    {/* 左侧：树可视化区域 */}
                    <div className="flex-1 bg-white rounded-lg border border-green-100 shadow-sm">
                      {currentTreeId ? (
                        <TreeVisualization
                          treeId={currentTreeId}
                          mode="view"
                          height="100%"
                          showControls={false}
                          showMiniMap={false}
                          showTreeSelector={false}
                          showNodeStats={false}
                          enablePhysics={true}
                          className="w-full h-full rounded-lg"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          <div className="text-center">
                            <TreePine className="h-8 w-8 mx-auto mb-2 text-green-400 opacity-60" />
                            <p className="text-sm font-medium text-gray-600">知识树可视化</p>
                            <p className="text-xs text-gray-400 mt-1">点击"设为根节点"开始构建树</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 右侧：MCTS控制区域 */}
                    <div className="w-80 bg-white rounded-lg border border-green-100 shadow-sm overflow-hidden">
                      <MCTSControlPanel
                        treeBuilder={treeBuilder}
                        className="h-full border-0 bg-transparent"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 3. 文献搜索面板（下） - 18%高度，搜索任务管理 */}
              <div className="h-[18%] flex-shrink-0 bg-white">
                <SearchResult />
              </div>
            </div>
          )
        ) : (
          // 空状态显示
          <div className="h-[calc(100vh-180px)] flex items-center justify-center bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="text-center text-gray-500 max-w-md">
              <TreePine className="h-16 w-16 mx-auto mb-4 text-green-400 opacity-60" />
              <h3 className="text-lg font-semibold mb-2 text-gray-700">二、文献研究</h3>
              <p className="text-sm mb-4">点击上方"开始文献播种"按钮启动工作流</p>
              <div className="space-y-2 text-xs text-gray-400">
                <p>🌱 播种模式：为研究主题创建初始文献库</p>
                <p>📚 将自动生成搜索任务，搜索并添加相关文献</p>
                <p>🔍 支持三面板布局：文献信息 + 树可视化 + MCTS控制</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
