import { nanoid } from 'nanoid';
import { toast } from 'sonner';
import { streamText } from 'ai';
import { parsePartialJson } from '@ai-sdk/ui-utils';
import { z } from 'zod';
import { removeJsonMarkdown, ThinkTagStreamProcessor } from '@/utils/text';

// 🎯 统一搜索管理器 - 支持MCTS 2.1和2.2阶段的文献搜索

// ===== 类型定义 =====

export interface SearchConfig {
  mode: 'seeding' | 'expanding';  // 播种模式 vs 扩展模式
  minTasks: number;               // 最小搜索任务数量
  maxTasks: number;               // 最大搜索任务数量
  topic: string;                  // 研究话题
  reportPlan?: string;            // 🆕 研究计划（用于LLM智能生成搜索任务）
  batchSize?: number;             // 批次大小 (用于控制并发)
  strategy?: 'parallel' | 'sequential'; // 执行策略
  queries?: string[];             // 可选的预定义查询列表
  useAI?: boolean;                // 🆕 是否使用AI生成搜索任务
}

export interface SearchUnit {
  id: string;
  query: string;
  title?: string;                 // 🆕 任务标题（AI生成）
  researchGoal?: string;          // 🆕 研究目标（AI生成）
  topic: string;
  state: 'pending' | 'waiting' | 'searching' | 'parsing' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  result?: {
    addedCount: number;
    duplicateCount: number;
    addedItemIds: string[];
    duplicateItems?: any[];
  };
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  timerId?: NodeJS.Timeout; // 🆕 用于等待模式的计时器
}

export interface SearchSession {
  id: string;
  config: SearchConfig;
  state: 'preparing' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  units: SearchUnit[];
  progress: number; // 整体进度 0-100
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  totalAdded: number;
  totalDuplicates: number;
  error?: string;
}

// 预定义配置模板
export const SEARCH_CONFIGS = {
  INITIAL_SEEDING: {
    mode: 'seeding' as const,
    minTasks: 3,
    maxTasks: 8,
    strategy: 'parallel' as const,
    batchSize: 3
  },
  CONTINUOUS_EXPANSION: {
    mode: 'expanding' as const, 
    minTasks: 1,
    maxTasks: 5,
    strategy: 'sequential' as const,
    batchSize: 2
  },
  DEEP_EXPLORATION: {
    mode: 'expanding' as const,
    minTasks: 2,
    maxTasks: 12,
    strategy: 'parallel' as const,
    batchSize: 4
  }
} as const;

// ===== 任务生成策略 =====

interface TaskGenerationStrategy {
  generateTasks(config: SearchConfig, onProgress?: (units: SearchUnit[]) => void): Promise<SearchUnit[]>;
}

// 🆕 LLM生成的搜索任务结构
const LiteratureSearchTaskSchema = z.object({
  query: z.string().describe('具体的搜索查询字符串'),
  title: z.string().describe('任务标题'),
  researchGoal: z.string().describe('详细的研究目标描述')
});

const LiteratureSearchTasksSchema = z.array(LiteratureSearchTaskSchema);

class SeedingStrategy implements TaskGenerationStrategy {
  async generateTasks(config: SearchConfig, onProgress?: (units: SearchUnit[]) => void): Promise<SearchUnit[]> {
    const { topic, minTasks, maxTasks, queries, reportPlan, useAI = false } = config;
    
    // 如果已有预定义查询，直接使用
    if (queries && queries.length > 0) {
      return queries.slice(0, maxTasks).map(query => ({
        id: nanoid(),
        query,
        title: query,
        researchGoal: `Search for literature related to: ${query}`,
        topic,
        state: 'pending' as const,
        progress: 0,
        createdAt: new Date()
      }));
    }

    // 🚀 如果有研究计划且启用AI，使用LLM生成智能搜索任务
    if (useAI && reportPlan && reportPlan.trim()) {
      try {
        return await this.generateAITasks(topic, reportPlan, minTasks, maxTasks, onProgress);
      } catch (error) {
        console.warn('🤖 [SeedingStrategy] AI generation failed, falling back to manual queries:', error);
        // AI失败时降级到手动生成
      }
    }

    // 🎯 基于话题生成多样化的搜索查询（降级方案）
    const baseQueries = this.generateSeedingQueries(topic, minTasks, maxTasks);
    
    return baseQueries.map(query => ({
      id: nanoid(),
      query,
      title: query,
      researchGoal: `Search for literature related to: ${query}`,
      topic,
      state: 'pending' as const,
      progress: 0,
      createdAt: new Date()
    }));
  }

  // 🤖 使用LLM生成智能搜索任务
  private async generateAITasks(
    topic: string, 
    reportPlan: string, 
    minTasks: number, 
    maxTasks: number, 
    onProgress?: (units: SearchUnit[]) => void
  ): Promise<SearchUnit[]> {
    console.log('🤖 [SeedingStrategy] Using AI to generate search tasks...');
    
    // 动态导入LLM相关模块
    const { createModelProvider, getModel } = await this.loadAIModules();
    const { getSystemPrompt } = await import('@/utils/deep-research/prompts');
    
    const { thinkingModel } = getModel();
    const prompt = this.buildLiteratureSearchPrompt(topic, reportPlan, minTasks, maxTasks);
    
    const thinkTagStreamProcessor = new ThinkTagStreamProcessor();
    const result = streamText({
      model: await createModelProvider(thinkingModel),
      system: getSystemPrompt(),
      prompt: prompt,
      onError: (error) => {
        console.error('🤖 [SeedingStrategy] AI generation error:', error);
        throw error;
      }
    });

    let content = '';
    let reasoning = '';
    let generatedTasks: SearchUnit[] = [];
    
    for await (const textPart of result.textStream) {
      thinkTagStreamProcessor.processChunk(
        textPart,
        (text) => {
          content += text;
          const data = parsePartialJson(removeJsonMarkdown(content));
          
          if (LiteratureSearchTasksSchema.safeParse(data.value) && 
              (data.state === 'successful-parse' || data.state === 'repaired-parse')) {
            if (data.value) {
              generatedTasks = data.value.map((item: any) => ({
                id: nanoid(),
                query: item.query,
                title: item.title || item.query,
                researchGoal: item.researchGoal || `Research about: ${item.query}`,
                topic,
                state: 'pending' as const,
                progress: 0,
                createdAt: new Date()
              }));
              
              // 实时进度回调
              onProgress?.(generatedTasks);
            }
          }
        },
        (text) => {
          reasoning += text;
        }
      );
    }
    
    if (reasoning) console.log('🤖 [SeedingStrategy] AI reasoning:', reasoning);
    
    if (generatedTasks.length === 0) {
      throw new Error('AI failed to generate valid search tasks');
    }
    
    console.log(`🤖 [SeedingStrategy] AI generated ${generatedTasks.length} search tasks`);
    return generatedTasks.slice(0, maxTasks);
  }
  
  // 构建文献搜索提示词
  private buildLiteratureSearchPrompt(topic: string, reportPlan: string, minTasks: number, maxTasks: number): string {
    return `Based on the following research plan, generate ${minTasks} to ${maxTasks} specific literature search queries.

Research Topic: ${topic}

Research Plan:
${reportPlan}

Generate search queries that will help find relevant academic literature for this research. Each query should be:
1. Specific and targeted for academic databases
2. Cover different aspects of the research plan
3. Include key terms and concepts from the plan
4. Be suitable for literature databases like Google Scholar, PubMed, IEEE, etc.

For each search query, provide:
- query: The actual search string
- title: A descriptive title for this search task
- researchGoal: Detailed explanation of what this search aims to find

Respond with a JSON array of search tasks. Example format:
\`\`\`json
[
  {
    "query": "machine learning interpretability explainable AI",
    "title": "Interpretability in Machine Learning",
    "researchGoal": "Find literature on methods and techniques for making machine learning models more interpretable and explainable to users."
  }
]
\`\`\``;
  }
  
  // 动态加载AI模块（避免循环依赖）
  private async loadAIModules() {
    const useModelProvider = await import('@/hooks/useAiProvider');
    return useModelProvider.default();
  }

  private generateSeedingQueries(topic: string, min: number, max: number): string[] {
    // 🚀 简化版本：基于话题生成不同角度的查询
    const variations = [
      topic, // 原始话题
      `${topic} review`, // 综述
      `${topic} applications`, // 应用
      `${topic} methods`, // 方法
      `${topic} recent advances`, // 最新进展
      `${topic} challenges`, // 挑战
      `${topic} future directions`, // 未来方向
      `${topic} survey`, // 调研
    ];

    const actualCount = Math.min(Math.max(min, 3), Math.min(max, variations.length));
    return variations.slice(0, actualCount);
  }
}

class ExpandingStrategy implements TaskGenerationStrategy {
  async generateTasks(config: SearchConfig, onProgress?: (units: SearchUnit[]) => void): Promise<SearchUnit[]> {
    const { topic, minTasks, maxTasks, queries, reportPlan, useAI = false } = config;
    
    // 如果已有预定义查询，直接使用
    if (queries && queries.length > 0) {
      return queries.slice(0, maxTasks).map(query => ({
        id: nanoid(),
        query,
        title: query,
        researchGoal: `Expand literature search for: ${query}`,
        topic,
        state: 'pending' as const,
        progress: 0,
        createdAt: new Date()
      }));
    }

    // 🚀 如果有研究计划且启用AI，使用LLM生成智能扩展任务
    if (useAI && reportPlan && reportPlan.trim()) {
      try {
        return await this.generateAIExpandingTasks(topic, reportPlan, minTasks, maxTasks, onProgress);
      } catch (error) {
        console.warn('🤖 [ExpandingStrategy] AI generation failed, falling back to manual queries:', error);
        // AI失败时降级到手动生成
      }
    }

    // 🎯 基于现有文献生成targeted queries（降级方案）
    const targetedQueries = this.generateExpandingQueries(topic, minTasks, maxTasks);
    
    return targetedQueries.map(query => ({
      id: nanoid(),
      query,
      title: query,
      researchGoal: `Expand literature search for: ${query}`,
      topic,
      state: 'pending' as const,
      progress: 0,
      createdAt: new Date()
    }));
  }

  // 🤖 使用LLM生成智能扩展任务
  private async generateAIExpandingTasks(
    topic: string, 
    reportPlan: string, 
    minTasks: number, 
    maxTasks: number, 
    onProgress?: (units: SearchUnit[]) => void
  ): Promise<SearchUnit[]> {
    console.log('🤖 [ExpandingStrategy] Using AI to generate expanding tasks...');
    
    // 复用SeedingStrategy的AI生成能力，但使用不同的提示词
    const seedingStrategy = new SeedingStrategy();
    const expandingPrompt = this.buildExpandingPrompt(topic, reportPlan, minTasks, maxTasks);
    
    // 动态导入LLM相关模块
    const { createModelProvider, getModel } = await (seedingStrategy as any).loadAIModules();
    const { getSystemPrompt } = await import('@/utils/deep-research/prompts');
    
    const { thinkingModel } = getModel();
    const thinkTagStreamProcessor = new ThinkTagStreamProcessor();
    const result = streamText({
      model: await createModelProvider(thinkingModel),
      system: getSystemPrompt(),
      prompt: expandingPrompt,
      onError: (error) => {
        console.error('🤖 [ExpandingStrategy] AI generation error:', error);
        throw error;
      }
    });

    let content = '';
    let reasoning = '';
    let generatedTasks: SearchUnit[] = [];
    
    for await (const textPart of result.textStream) {
      thinkTagStreamProcessor.processChunk(
        textPart,
        (text) => {
          content += text;
          const data = parsePartialJson(removeJsonMarkdown(content));
          
          if (LiteratureSearchTasksSchema.safeParse(data.value) && 
              (data.state === 'successful-parse' || data.state === 'repaired-parse')) {
            if (data.value) {
              generatedTasks = data.value.map((item: any) => ({
                id: nanoid(),
                query: item.query,
                title: item.title || item.query,
                researchGoal: item.researchGoal || `Expand research on: ${item.query}`,
                topic,
                state: 'pending' as const,
                progress: 0,
                createdAt: new Date()
              }));
              
              // 实时进度回调
              onProgress?.(generatedTasks);
            }
          }
        },
        (text) => {
          reasoning += text;
        }
      );
    }
    
    if (reasoning) console.log('🤖 [ExpandingStrategy] AI reasoning:', reasoning);
    
    if (generatedTasks.length === 0) {
      throw new Error('AI failed to generate valid expanding tasks');
    }
    
    console.log(`🤖 [ExpandingStrategy] AI generated ${generatedTasks.length} expanding tasks`);
    return generatedTasks.slice(0, maxTasks);
  }
  
  private buildExpandingPrompt(topic: string, reportPlan: string, minTasks: number, maxTasks: number): string {
    return `Based on the research plan, generate ${minTasks} to ${maxTasks} EXPANDING literature search queries.

Research Topic: ${topic}

Research Plan:
${reportPlan}

These are EXPANDING searches to find more specific, detailed, or niche literature. Focus on:
1. Specific implementations and case studies
2. Detailed methodologies and techniques
3. Comparative studies and evaluations
4. Emerging trends and cutting-edge research
5. Domain-specific applications

For each search query, provide:
- query: Specific search string for deeper exploration
- title: Descriptive title for this expanding search
- researchGoal: What specific aspect this search will explore in depth

Respond with a JSON array of search tasks.`;
  }

  private generateExpandingQueries(topic: string, min: number, max: number): string[] {
    // 🚀 简化版本：生成更具体的查询
    const specificVariations = [
      `${topic} case study`,
      `${topic} implementation`,
      `${topic} evaluation`,
      `${topic} comparison`,
      `${topic} optimization`,
      `${topic} framework`,
    ];

    const actualCount = Math.min(Math.max(min, 1), Math.min(max, specificVariations.length));
    return specificVariations.slice(0, actualCount);
  }
}

// ===== 主要管理器类 =====

export class LiteratureSearchManager {
  private sessions = new Map<string, SearchSession>();
  private strategies: Record<SearchConfig['mode'], TaskGenerationStrategy>;
  private eventListeners = new Map<string, ((session: SearchSession) => void)[]>();

  constructor() {
    this.strategies = {
      seeding: new SeedingStrategy(),
      expanding: new ExpandingStrategy()
    };
  }

  // 🎯 主要API
  async startSearch(config: SearchConfig): Promise<string> {
    console.log('🚀 [SearchManager] Starting search session:', config);
    
    const sessionId = nanoid();
    const session: SearchSession = {
      id: sessionId,
      config,
      state: 'preparing',
      units: [],
      progress: 0,
      createdAt: new Date(),
      totalAdded: 0,
      totalDuplicates: 0
    };

    this.sessions.set(sessionId, session);
    this.notifyListeners(sessionId, session);

    try {
      // 生成搜索任务
      const strategy = this.strategies[config.mode];
      
      // 🆕 支持AI生成任务的实时进度回调
      const onTaskProgress = (units: SearchUnit[]) => {
        session.units = units;
        console.log(`📋 [SearchManager] Generating ${units.length} search units for session ${sessionId}...`);
        this.notifyListeners(sessionId, session);
      };
      
      const units = await strategy.generateTasks(config, onTaskProgress);
      
      session.units = units;
      session.state = 'running';
      session.startedAt = new Date();
      
      console.log(`📋 [SearchManager] Generated ${units.length} search units for session ${sessionId}`);
      this.notifyListeners(sessionId, session);

      // 开始执行搜索
      this.executeSearch(sessionId);
      
      return sessionId;
    } catch (error) {
      console.error('❌ [SearchManager] Failed to start search:', error);
      session.state = 'failed';
      session.error = error instanceof Error ? error.message : 'Failed to start search';
      this.notifyListeners(sessionId, session);
      throw error;
    }
  }

  // 🚀 新增：手动开始单个搜索单元
  async startUnitNow(sessionId: string, unitId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const unit = session.units.find(u => u.id === unitId);
    if (!unit) throw new Error('Unit not found');

    // 清除等待计时器
    if (unit.timerId) {
      clearTimeout(unit.timerId);
      unit.timerId = undefined;
    }

    // 立即开始执行
    unit.state = 'pending';
    this.notifyListeners(sessionId, session);
    await this.executeUnit(sessionId, unit);
  }

  // 🚀 新增：取消单个搜索单元
  async cancelUnit(sessionId: string, unitId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const unit = session.units.find(u => u.id === unitId);
    if (!unit) throw new Error('Unit not found');

    // 清除等待计时器
    if (unit.timerId) {
      clearTimeout(unit.timerId);
      unit.timerId = undefined;
    }

    // 设置为取消状态
    unit.state = 'cancelled';
    this.notifyListeners(sessionId, session);
    this.updateSessionProgress(sessionId);
  }

  async pauseSearch(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    
    console.log(`⏸️ [SearchManager] Pausing search session: ${sessionId}`);
    session.state = 'paused';
    this.notifyListeners(sessionId, session);
  }

  async resumeSearch(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    
    console.log(`▶️ [SearchManager] Resuming search session: ${sessionId}`);
    session.state = 'running';
    this.notifyListeners(sessionId, session);
    this.executeSearch(sessionId);
  }

  async cancelSearch(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    
    console.log(`🛑 [SearchManager] Cancelling search session: ${sessionId}`);
    session.state = 'cancelled';
    session.units.forEach(unit => {
      if (unit.state === 'pending' || unit.state === 'searching') {
        unit.state = 'cancelled';
      }
    });
    this.notifyListeners(sessionId, session);
  }

  // 📊 状态管理
  getSearchSession(sessionId: string): SearchSession | undefined {
    return this.sessions.get(sessionId);
  }

  getActiveUnits(sessionId: string): SearchUnit[] {
    const session = this.sessions.get(sessionId);
    return session?.units.filter(unit => 
      unit.state === 'searching' || unit.state === 'parsing'
    ) || [];
  }

  getAllSessions(): SearchSession[] {
    return Array.from(this.sessions.values());
  }

  // 🔔 事件监听
  addEventListener(sessionId: string, listener: (session: SearchSession) => void): void {
    if (!this.eventListeners.has(sessionId)) {
      this.eventListeners.set(sessionId, []);
    }
    this.eventListeners.get(sessionId)!.push(listener);
  }

  removeEventListener(sessionId: string, listener: (session: SearchSession) => void): void {
    const listeners = this.eventListeners.get(sessionId);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private notifyListeners(sessionId: string, session: SearchSession): void {
    const listeners = this.eventListeners.get(sessionId);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(session);
        } catch (error) {
          console.error('❌ [SearchManager] Error in event listener:', error);
        }
      });
    }
  }

  // 🔄 扩展功能 (为2.2阶段准备)
  async expandSearch(sessionId: string, additionalQueries: string[]): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    
    console.log(`🔄 [SearchManager] Expanding search with ${additionalQueries.length} new queries`);
    
    const newUnits = additionalQueries.map(query => ({
      id: nanoid(),
      query,
      topic: session.config.topic,
      state: 'pending' as const,
      progress: 0,
      createdAt: new Date()
    }));

    session.units.push(...newUnits);
    this.notifyListeners(sessionId, session);

    // 如果会话正在运行，立即执行新任务
    if (session.state === 'running') {
      this.executeNewUnits(sessionId, newUnits);
    }
  }

  // ===== 私有方法 =====

  private async executeSearch(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== 'running') return;

    const { strategy, batchSize = 3 } = session.config;
    const pendingUnits = session.units.filter(unit => unit.state === 'pending');

    if (pendingUnits.length === 0) {
      console.log(`✅ [SearchManager] All units completed for session ${sessionId}`);
      session.state = 'completed';
      session.completedAt = new Date();
      this.notifyListeners(sessionId, session);
      return;
    }

    // 🆕 检查是否启用等待模式
    const enableTaskWaitingTime = this.getWaitingTimeSettings().enableTaskWaitingTime;
    const taskWaitingTime = this.getWaitingTimeSettings().taskWaitingTime;

    if (strategy === 'parallel') {
      // 并行执行，分批处理
      const batches = this.chunkArray(pendingUnits, batchSize);
      for (const batch of batches) {
        if (session.state !== 'running') break; // 检查是否被暂停或取消
        
        if (enableTaskWaitingTime) {
          // 等待模式：设置延时启动
          batch.forEach(unit => this.scheduleUnitExecution(sessionId, unit, taskWaitingTime));
        } else {
          // 立即模式：直接执行
          await Promise.all(batch.map(unit => this.executeUnit(sessionId, unit)));
        }
        this.updateSessionProgress(sessionId);
      }
    } else {
      // 顺序执行
      for (const unit of pendingUnits) {
        if (session.state !== 'running') break; // 检查是否被暂停或取消
        
        if (enableTaskWaitingTime) {
          // 等待模式：设置延时启动
          this.scheduleUnitExecution(sessionId, unit, taskWaitingTime);
        } else {
          // 立即模式：直接执行
          await this.executeUnit(sessionId, unit);
        }
        this.updateSessionProgress(sessionId);
      }
    }

    // 检查是否全部完成
    const remainingUnits = session.units.filter(unit => 
      unit.state === 'pending' || unit.state === 'waiting' || unit.state === 'searching' || unit.state === 'parsing'
    );
    
    if (remainingUnits.length === 0) {
      session.state = 'completed';
      session.completedAt = new Date();
      console.log(`🎉 [SearchManager] Session ${sessionId} completed successfully`);
      toast.success(`文献搜索完成！共添加 ${session.totalAdded} 篇文献，发现 ${session.totalDuplicates} 篇重复`);
    }

    this.notifyListeners(sessionId, session);
  }

  // 🆕 调度单元执行（等待模式）
  private scheduleUnitExecution(sessionId: string, unit: SearchUnit, delaySeconds: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    console.log(`⏰ [SearchManager] Scheduling unit: ${unit.query} (delay: ${delaySeconds}s)`);
    
    unit.state = 'waiting';
    unit.timerId = setTimeout(() => {
      unit.timerId = undefined;
      this.executeUnit(sessionId, unit);
    }, delaySeconds * 1000);
    
    this.notifyListeners(sessionId, session);
  }

  // 🆕 获取等待时间设置（可从settingStore获取，这里先用默认值）
  private getWaitingTimeSettings(): { enableTaskWaitingTime: boolean; taskWaitingTime: number } {
    // 🚀 这里可以集成 useSettingStore，现在先用默认配置
    try {
      // 动态导入设置store（避免循环依赖）
      if (typeof window !== 'undefined') {
        // 客户端环境下可以访问localStorage
        const saved = localStorage.getItem('research-waiting-settings');
        if (saved) {
          return JSON.parse(saved);
        }
      }
    } catch (error) {
      console.warn('Failed to load waiting settings:', error);
    }
    
    return {
      enableTaskWaitingTime: false, // 默认关闭等待模式
      taskWaitingTime: 10 // 默认10秒
    };
  }

  private async executeNewUnits(sessionId: string, units: SearchUnit[]): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const { strategy, batchSize = 3 } = session.config;

    if (strategy === 'parallel') {
      const batches = this.chunkArray(units, batchSize);
      for (const batch of batches) {
        if (session.state !== 'running') break;
        await Promise.all(batch.map(unit => this.executeUnit(sessionId, unit)));
      }
    } else {
      for (const unit of units) {
        if (session.state !== 'running') break;
        await this.executeUnit(sessionId, unit);
      }
    }

    this.updateSessionProgress(sessionId);
    this.notifyListeners(sessionId, session);
  }

  private async executeUnit(sessionId: string, unit: SearchUnit): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== 'running') return;

    console.log(`🔍 [SearchManager] Executing unit: ${unit.query}`);
    
    unit.state = 'searching';
    unit.startedAt = new Date();
    unit.progress = 10;
    this.notifyListeners(sessionId, session);

    try {
      // 🚀 使用现有的 LiteratureDiscoveryService
      const { LiteratureDiscoveryService } = await import('./LiteratureDiscoveryService');
      const discoveryService = new LiteratureDiscoveryService();
      
      unit.state = 'parsing';
      unit.progress = 50;
      this.notifyListeners(sessionId, session);

      // 执行搜索并添加到文献库
      const addedItemIds = await discoveryService.discoverAndAddLiterature(unit.query, unit.topic);
      
      unit.state = 'completed';
      unit.progress = 100;
      unit.completedAt = new Date();
      unit.result = {
        addedCount: addedItemIds.length,
        duplicateCount: 0, // LiteratureDiscoveryService 内部处理重复，这里统计可能不准确
        addedItemIds
      };
      
      // 更新会话统计
      session.totalAdded += addedItemIds.length;
      
      console.log(`✅ [SearchManager] Unit completed: ${unit.query} - Added ${addedItemIds.length} items`);
      
    } catch (error) {
      console.error(`❌ [SearchManager] Unit failed: ${unit.query}`, error);
      unit.state = 'failed';
      unit.progress = 0;
      unit.error = error instanceof Error ? error.message : 'Unknown error';
    }

    this.notifyListeners(sessionId, session);
  }

  private updateSessionProgress(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const totalUnits = session.units.length;
    const completedUnits = session.units.filter(unit => 
      unit.state === 'completed' || unit.state === 'failed' || unit.state === 'cancelled'
    ).length;

    session.progress = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// 🚀 导出单例实例
export const literatureSearchManager = new LiteratureSearchManager();