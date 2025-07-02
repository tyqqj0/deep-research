# Deep Research 重构主设计文档

## 📋 项目概述

### 重构目标
将巨型的 `useDeepResearch` hook (1900+ 行) 重构为模块化的架构，解决当前的设计问题：
- 违反单一职责原则
- 函数过大难以维护  
- 状态管理混乱
- UI逻辑与业务逻辑耦合
- 缺乏可测试性

### 核心原则
1. **向后兼容**: 保持现有组件API不变
2. **渐进式重构**: 分阶段实施，避免大爆炸
3. **接口稳定**: 对外接口保持一致，内部实现模块化
4. **分层解耦**: UI、业务逻辑、数据层分离
5. **可测试性**: 每个模块可独立测试

## 🏗️ 目标架构设计

### 新文件结构
```
src/utils/deep-research/
├── index.ts                     # 统一导出入口
├── types/                       # 类型定义
│   ├── index.ts                # 统一类型导出
│   ├── research.ts             # 研究相关类型
│   ├── strategy.ts             # 策略相关类型  
│   ├── task.ts                 # 任务相关类型
│   └── events.ts               # 事件相关类型
├── core/                       # 核心引擎
│   ├── ResearchEngine.ts       # 主研究引擎
│   ├── TaskScheduler.ts        # 任务调度器
│   ├── StateManager.ts         # 状态管理器
│   └── EventBus.ts             # 事件总线
├── strategies/                 # 研究策略
│   ├── index.ts                # 策略统一导出
│   ├── BaseStrategy.ts         # 策略基类
│   ├── SearchStrategy.ts       # 搜索策略 (runSearchTask)
│   ├── DeeperStrategy.ts       # 深度研究策略 (runDeeperResearch)  
│   └── WiderStrategy.ts        # 扩展研究策略 (runWiderResearch)
├── services/                   # 业务服务
│   ├── index.ts                # 服务统一导出
│   ├── RetryManager.ts         # 重试管理
│   ├── TaskRunner.ts           # 任务执行器
│   ├── StreamProcessor.ts      # 流式处理
│   ├── ThinkingProcessor.ts    # 思考处理器
│   └── ValidationService.ts    # 验证服务
├── utils/                      # 工具函数
│   ├── index.ts                # 工具统一导出
│   ├── taskHelpers.ts          # 任务相关工具
│   ├── stateHelpers.ts         # 状态相关工具
│   └── errorHelpers.ts         # 错误处理工具
└── legacy/                     # 兼容层
    ├── index.ts                # 兼容性导出
    └── useDeepResearchAdapter.ts # 适配器
```

### 依赖关系图
```
useDeepResearch (Hook Layer)
    ↓ (使用适配器)
useDeepResearchAdapter (Compatibility Layer)  
    ↓ (调用)
ResearchEngine (Core Layer)
    ↓ (编排)
TaskScheduler + StateManager + EventBus
    ↓ (使用)
Strategies (SearchStrategy/DeeperStrategy/WiderStrategy)
    ↓ (依赖)
Services (RetryManager/TaskRunner/StreamProcessor)
    ↓ (使用)
Utils (taskHelpers/stateHelpers/errorHelpers)
```

## 📐 详细模块设计

### 1. 类型定义模块 (`types/`)

#### `types/research.ts`
```typescript
// 研究引擎配置
export interface ResearchEngineConfig {
  aiProvider: AIProviderConfig;
  searchProvider: SearchProviderConfig;
  settings: ResearchSettings;
}

// 研究会话
export interface ResearchSession {
  id: string;
  query: string;
  status: ResearchStatus;
  tasks: ResearchTask[];
  results: ResearchResult[];
  metadata: SessionMetadata;
}

// 研究状态
export type ResearchStatus = 
  | 'idle' 
  | 'planning' 
  | 'searching' 
  | 'processing' 
  | 'completed' 
  | 'failed';
```

#### `types/strategy.ts`
```typescript
// 策略基础接口
export interface IResearchStrategy {
  name: string;
  version: string;
  execute(context: StrategyContext): Promise<StrategyResult>;
  validate(context: StrategyContext): Promise<ValidationResult>;
  cancel(): Promise<void>;
}

// 策略上下文
export interface StrategyContext {
  session: ResearchSession;
  config: ResearchEngineConfig;
  eventBus: IEventBus;
  services: ServiceContainer;
}

// 策略结果
export interface StrategyResult {
  success: boolean;
  data?: any;
  error?: Error;
  metadata: ResultMetadata;
}
```

#### `types/task.ts`
```typescript
// 任务定义
export interface ResearchTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  dependencies: string[];
  config: TaskConfig;
  result?: TaskResult;
  metadata: TaskMetadata;
}

// 任务类型
export type TaskType = 
  | 'search'
  | 'thinking' 
  | 'deeper'
  | 'wider'
  | 'synthesis';

// 任务状态
export type TaskStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'retrying';
```

### 2. 核心引擎模块 (`core/`)

#### `core/ResearchEngine.ts`
```typescript
export class ResearchEngine {
  private scheduler: TaskScheduler;
  private stateManager: StateManager;
  private eventBus: EventBus;
  private strategies: Map<string, IResearchStrategy>;
  
  constructor(config: ResearchEngineConfig) {
    // 初始化各个组件
  }
  
  // 主要方法
  async startResearch(query: string): Promise<ResearchSession>
  async executeStrategy(strategyName: string, context: StrategyContext): Promise<StrategyResult>
  async pauseResearch(sessionId: string): Promise<void>
  async resumeResearch(sessionId: string): Promise<void>
  async cancelResearch(sessionId: string): Promise<void>
  
  // 兼容性方法 (保持原有API)
  async runSearchTask(tasks: SearchTask[]): Promise<void>
  async runDeeperResearch(taskId: string): Promise<void>
  async runWiderResearch(): Promise<void>
}
```

#### `core/TaskScheduler.ts`
```typescript
export class TaskScheduler {
  private queue: PriorityQueue<ResearchTask>;
  private runners: Map<string, TaskRunner>;
  private config: SchedulerConfig;
  
  async scheduleTask(task: ResearchTask): Promise<void>
  async executeTask(taskId: string): Promise<TaskResult>
  async cancelTask(taskId: string): Promise<void>
  async retryTask(taskId: string, strategy: RetryStrategy): Promise<void>
  
  // 任务生命周期管理
  private async onTaskStart(task: ResearchTask): Promise<void>
  private async onTaskComplete(task: ResearchTask, result: TaskResult): Promise<void>
  private async onTaskFail(task: ResearchTask, error: Error): Promise<void>
}
```

#### `core/StateManager.ts`
```typescript
export class StateManager {
  private state: ResearchState;
  private subscribers: Set<StateSubscriber>;
  
  // 状态管理
  getState(): ResearchState
  setState(updates: Partial<ResearchState>): void
  subscribe(subscriber: StateSubscriber): UnsubscribeFn
  
  // 任务状态管理
  updateTaskStatus(taskId: string, status: TaskStatus): void
  getTasksByStatus(status: TaskStatus): ResearchTask[]
  
  // 会话状态管理
  createSession(query: string): ResearchSession
  updateSession(sessionId: string, updates: Partial<ResearchSession>): void
  getSession(sessionId: string): ResearchSession | null
}
```

### 3. 策略模块 (`strategies/`)

#### `strategies/BaseStrategy.ts`
```typescript
export abstract class BaseStrategy implements IResearchStrategy {
  abstract name: string;
  abstract version: string;
  
  protected eventBus: IEventBus;
  protected services: ServiceContainer;
  
  constructor(eventBus: IEventBus, services: ServiceContainer) {
    this.eventBus = eventBus;
    this.services = services;
  }
  
  abstract execute(context: StrategyContext): Promise<StrategyResult>;
  
  async validate(context: StrategyContext): Promise<ValidationResult> {
    // 通用验证逻辑
  }
  
  async cancel(): Promise<void> {
    // 通用取消逻辑
  }
  
  protected emit(event: string, data: any): void {
    this.eventBus.emit(event, data);
  }
}
```

#### `strategies/SearchStrategy.ts`
```typescript
export class SearchStrategy extends BaseStrategy {
  name = 'search';
  version = '1.0.0';
  
  async execute(context: StrategyContext): Promise<StrategyResult> {
    // 迁移 runSearchTask 的逻辑
    // 1. 任务验证
    // 2. 并行执行管理  
    // 3. 错误处理和重试
    // 4. 状态更新
    // 5. 结果聚合
  }
  
  private async executeSearchTask(task: SearchTask): Promise<TaskResult> {
    // 单个搜索任务执行逻辑
  }
  
  private async handleSearchError(error: Error, task: SearchTask): Promise<void> {
    // 搜索错误处理
  }
}
```

#### `strategies/DeeperStrategy.ts`  
```typescript
export class DeeperStrategy extends BaseStrategy {
  name = 'deeper';
  version = '1.0.0';
  
  async execute(context: StrategyContext): Promise<StrategyResult> {
    // 迁移 runDeeperResearch 的逻辑
    // 1. 深度验证
    // 2. 三阶段思考流程
    // 3. 任务生成和调度
    // 4. 递归深度控制
  }
  
  private async reflectCurrentResearch(context: StrategyContext): Promise<ReflectionResult> {
    // 反思评估阶段
  }
  
  private async planNextStep(reflectionResult: ReflectionResult): Promise<PlanningResult> {
    // 战略思考阶段
  }
  
  private async generateTasks(planningResult: PlanningResult): Promise<TaskGenerationResult> {
    // 任务生成阶段
  }
}
```

### 4. 服务模块 (`services/`)

#### `services/RetryManager.ts`
```typescript
export class RetryManager {
  private retryStates: Map<string, RetryState>;
  private config: RetryConfig;
  
  async scheduleRetry(taskId: string, error: Error): Promise<void>
  async executeRetry(taskId: string): Promise<boolean>
  async cancelRetry(taskId: string): Promise<void>
  
  private async simpleRetry(taskId: string): Promise<boolean>
  private async intelligentRetry(taskId: string): Promise<boolean>
  
  getRetryState(taskId: string): RetryState
  clearRetryState(taskId: string): void
}
```

#### `services/TaskRunner.ts`
```typescript
export class TaskRunner {
  private config: TaskRunnerConfig;
  private activeRuns: Map<string, AbortController>;
  
  async runTask(task: ResearchTask): Promise<TaskResult>
  async cancelRun(taskId: string): Promise<void>
  
  private async executeSearchTask(task: SearchTask): Promise<TaskResult>
  private async executeThinkingTask(task: ThinkingTask): Promise<TaskResult>
  
  isRunning(taskId: string): boolean
  getActiveRuns(): string[]
}
```

#### `services/StreamProcessor.ts`
```typescript
export class StreamProcessor {
  private processors: Map<string, IStreamHandler>;
  
  async processStream(stream: ReadableStream, type: StreamType): Promise<ProcessResult>
  async processThinkingStream(stream: ReadableStream): Promise<ThinkingResult>
  async processSearchStream(stream: ReadableStream): Promise<SearchResult>
  
  registerProcessor(type: StreamType, handler: IStreamHandler): void
  unregisterProcessor(type: StreamType): void
}
```

### 5. 兼容层设计 (`legacy/`)

#### `legacy/useDeepResearchAdapter.ts`
```typescript
export class UseDeepResearchAdapter {
  private engine: ResearchEngine;
  private session: ResearchSession | null = null;
  
  constructor(engine: ResearchEngine) {
    this.engine = engine;
  }
  
  // 完全兼容原有API
  async runSearchTask(tasks: SearchTask[]): Promise<void> {
    return this.engine.runSearchTask(tasks);
  }
  
  async runDeeperResearch(taskId: string): Promise<void> {
    return this.engine.runDeeperResearch(taskId);
  }
  
  async runWiderResearch(): Promise<void> {
    return this.engine.runWiderResearch();
  }
  
  // 其他所有原有方法...
  async askQuestions(): Promise<void>
  async writeReportPlan(): Promise<string>
  async writeFinalReport(): Promise<string>
  async cancelTask(taskId: string): Promise<void>
  async rerunTask(taskId: string): Promise<void>
  async regenerateAndRerunTask(taskId: string): Promise<void>
  async regenerateSummary(taskId: string): Promise<void>
  // ...等等
}
```

## 🚀 迁移执行计划

### Phase 0: 准备阶段 (1-2天)
**目标**: 建立基础设施和类型定义

**具体任务**:
1. 创建新的文件夹结构
2. 定义所有TypeScript类型
3. 建立构建和测试配置
4. 创建基础的抽象类和接口

**输出物**:
- 完整的types/目录
- 基础的抽象类 (BaseStrategy等)
- 测试框架设置

**验收标准**:
- 所有类型定义编译通过
- 基础测试框架运行正常
- 文件结构符合设计

### Phase 1: 核心引擎开发 (3-4天)
**目标**: 实现核心引擎框架

**具体任务**:
1. 实现 ResearchEngine 基础框架
2. 实现 TaskScheduler 任务调度
3. 实现 StateManager 状态管理
4. 实现 EventBus 事件系统

**输出物**:
- 完整的core/目录
- 核心引擎可以初始化和基本运行
- 事件系统工作正常

**验收标准**:
- 引擎可以成功初始化
- 任务调度器可以管理任务队列
- 状态管理器可以正确维护状态
- 事件系统可以正常发布/订阅

### Phase 2: 搜索策略迁移 (2-3天)
**目标**: 迁移 runSearchTask 逻辑

**具体任务**:
1. 实现 SearchStrategy 类
2. 迁移搜索任务执行逻辑
3. 迁移错误处理和重试机制
4. 实现并行执行管理

**输出物**:
- SearchStrategy 完整实现
- 搜索相关服务 (TaskRunner的搜索部分)
- RetryManager 基础实现

**验收标准**:
- 搜索策略可以执行基本搜索任务
- 错误处理机制正常工作
- 并行执行控制正确

### Phase 3: 深度研究策略迁移 (4-5天)
**目标**: 迁移 runDeeperResearch 逻辑

**具体任务**:
1. 实现 DeeperStrategy 类
2. 迁移三阶段思考流程
3. 实现 ThinkingProcessor 服务
4. 迁移任务生成逻辑

**输出物**:
- DeeperStrategy 完整实现
- ThinkingProcessor 服务
- 任务生成相关工具

**验收标准**:
- 深度研究策略可以正常执行
- 三阶段思考流程正确实现
- 任务生成机制工作正常

### Phase 4: 扩展策略迁移 (1-2天)
**目标**: 迁移 runWiderResearch 逻辑

**具体任务**:
1. 实现 WiderStrategy 类
2. 迁移扩展研究逻辑
3. 完善建议处理机制

**输出物**:
- WiderStrategy 完整实现
- 相关工具函数

**验收标准**:
- 扩展研究策略正常工作
- 建议处理机制正确

### Phase 5: 兼容层实现 (2-3天)
**目标**: 实现完整的向后兼容

**具体任务**:
1. 实现 UseDeepResearchAdapter
2. 创建兼容性包装器
3. 迁移所有原有方法
4. 确保API完全兼容

**输出物**:
- 完整的兼容层
- 适配器实现
- API兼容性验证

**验收标准**:
- 所有原有API调用正常工作
- 现有组件无需修改即可使用
- 功能完全等价

### Phase 6: 服务完善 (2-3天)
**目标**: 完善所有支持服务

**具体任务**:
1. 完善 RetryManager 实现
2. 实现 StreamProcessor 完整功能
3. 实现 ValidationService
4. 优化性能和错误处理

**输出物**:
- 完整的services/目录
- 所有支持服务实现

**验收标准**:
- 重试机制完全正常
- 流式处理工作正确
- 验证服务功能完备

### Phase 7: 集成测试 (2-3天)
**目标**: 全面测试和验证

**具体任务**:
1. 端到端测试
2. 性能测试
3. 兼容性测试
4. 错误场景测试

**输出物**:
- 完整的测试套件
- 性能基准测试
- 兼容性验证报告

**验收标准**:
- 所有现有功能正常工作
- 性能不低于原实现
- 错误处理机制健壮

### Phase 8: 文档和清理 (1-2天)
**目标**: 完善文档和代码清理

**具体任务**:
1. 编写API文档
2. 创建使用指南
3. 代码审查和优化
4. 性能调优

**输出物**:
- 完整的API文档
- 开发者指南
- 最终的代码实现

**验收标准**:
- 文档完整准确
- 代码质量达标
- 准备好生产部署

## 📦 工作包拆分

### 工作包 1: 类型系统设计 (可独立执行)
**负责人**: AI助手A  
**时间**: 1天  
**输入**: 当前代码分析  
**输出**: 完整的types/目录  
**验证**: TypeScript编译通过

### 工作包 2: 核心引擎框架 (可独立执行)
**负责人**: AI助手B  
**时间**: 2天  
**输入**: 类型定义  
**输出**: core/目录基础实现  
**验证**: 单元测试通过

### 工作包 3: 搜索策略实现 (可独立执行)
**负责人**: AI助手C  
**时间**: 2天  
**输入**: 核心框架 + runSearchTask分析  
**输出**: SearchStrategy实现  
**验证**: 搜索功能测试通过

### 工作包 4: 深度策略实现 (可独立执行)
**负责人**: AI助手D  
**时间**: 3天  
**输入**: 核心框架 + runDeeperResearch分析  
**输出**: DeeperStrategy实现  
**验证**: 深度研究功能测试通过

### 工作包 5: 扩展策略实现 (可独立执行)
**负责人**: AI助手E  
**时间**: 1天  
**输入**: 核心框架 + runWiderResearch分析  
**输出**: WiderStrategy实现  
**验证**: 扩展研究功能测试通过

### 工作包 6: 服务模块实现 (可独立执行)
**负责人**: AI助手F  
**时间**: 2天  
**输入**: 核心框架 + 服务需求分析  
**输出**: services/目录实现  
**验证**: 服务功能测试通过

### 工作包 7: 兼容层实现 (依赖所有策略)
**负责人**: AI助手G  
**时间**: 2天  
**输入**: 所有策略实现  
**输出**: 兼容层实现  
**验证**: 原有API兼容性测试通过

### 工作包 8: 集成验证 (依赖所有模块)
**负责人**: 主控AI (我)  
**时间**: 2天  
**输入**: 所有模块实现  
**输出**: 集成测试报告  
**验证**: 端到端功能验证

## 🎯 关键成功因素

1. **严格的接口定义**: 每个模块都有明确的输入输出
2. **全面的测试策略**: 每个工作包都有独立的验证标准
3. **渐进式集成**: 分阶段验证，降低风险
4. **文档驱动**: 详细文档指导实施
5. **兼容性优先**: 确保现有功能不受影响

## 🔄 下一步行动

1. **审核本设计文档**: 确认架构设计合理
2. **拆分工作包**: 为每个AI助手准备详细的工作指令
3. **准备输入材料**: 为每个工作包准备必要的代码分析和需求文档
4. **建立协调机制**: 确保各个工作包之间的协调和集成

这个设计文档为整个重构工程提供了完整的蓝图，可以让多个AI助手并行工作，大大提高效率。