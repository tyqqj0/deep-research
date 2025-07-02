# 🔧 Deep Research 重构调试修复清单

## 📋 问题概述
WP1-WP4基本完成，但发现4个关键问题需要修复才能投入使用。

## 🚨 需要修复的问题

### 🔧 修复1: SearchStrategy添加setRetryManager方法

**问题位置**: `src/utils/deep-research/strategies/SearchStrategy.ts`
**错误**: ResearchEngine.ts:48 调用 `this.searchStrategy.setRetryManager(this.retryManager)` 但方法不存在

**修复要求**:
```typescript
// 在SearchStrategy类中添加：
private retryManager?: RetryManager;

setRetryManager(retryManager: RetryManager): void {
  this.retryManager = retryManager;
}

// 并在execute方法中使用this.retryManager而不是直接调用autoRetryTask
```

**提示词**:
```
修复SearchStrategy.ts中缺少的setRetryManager方法。

问题：ResearchEngine.ts:48调用了不存在的setRetryManager方法

任务：
1. 在SearchStrategy类中添加private retryManager属性
2. 添加setRetryManager(retryManager: RetryManager)方法
3. 修改execute方法中的重试调用，使用this.retryManager.scheduleRetry
4. 确保向后兼容，不破坏现有逻辑

文件：src/utils/deep-research/strategies/SearchStrategy.ts
```

### 🔧 修复2: useDeepResearchAdapter React Hook问题

**问题位置**: `src/utils/deep-research/legacy/useDeepResearchAdapter.ts`  
**错误**: 在非React组件函数中使用useState/useEffect (第15-27行)

**修复要求**:
重构为以下两种方案之一：
1. **方案A**: 改为真正的React Hook
2. **方案B**: 移除React依赖，使用Zustand直接订阅

**提示词**:
```
修复useDeepResearchAdapter.ts中不当使用React Hooks的问题。

问题：在createDeepResearchAdapter函数中使用useState/useEffect，但这不是React组件

任务：
1. 重构createDeepResearchAdapter为真正的custom hook
2. 或者移除React依赖，直接使用useTaskStore.getState()获取状态
3. 确保状态同步功能正常工作
4. 保持API兼容性

推荐方案B：移除useState/useEffect，直接从store获取状态

文件：src/utils/deep-research/legacy/useDeepResearchAdapter.ts
```

### 🔧 修复3: DeeperStrategy依赖注入问题

**问题位置**: `src/utils/deep-research/strategies/DeeperStrategy.ts`
**错误**: 第27行使用declare声明而非真实依赖注入

**修复要求**:
```typescript
// 移除declare声明
// declare function runSearchTask(tasks: SearchTask[]): Promise<void>;

// 改为构造函数注入
export interface DeeperStrategyDependencies {
  runSearchTask: (tasks: SearchTask[]) => Promise<void>;
}

export class DeeperStrategy {
  constructor(private dependencies: DeeperStrategyDependencies) {}
  
  // 在第219行使用: await this.dependencies.runSearchTask(addedTasks);
}
```

**提示词**:
```
修复DeeperStrategy.ts中的依赖声明问题。

问题：第27行使用declare function而非真实依赖注入

任务：
1. 移除declare function runSearchTask声明
2. 创建DeeperStrategyDependencies接口
3. 修改构造函数接受dependencies参数
4. 更新第219行调用为this.dependencies.runSearchTask
5. 更新ResearchEngine.ts中DeeperStrategy的实例化

文件：src/utils/deep-research/strategies/DeeperStrategy.ts
同时需要更新：src/utils/deep-research/core/ResearchEngine.ts
```

### 🔧 修复4: ResearchEngine循环依赖问题

**问题位置**: `src/utils/deep-research/core/ResearchEngine.ts`
**风险**: 构造函数中的方法绑定可能导致循环依赖 (第38-40行)

**修复要求**:
```typescript
// 重构依赖注入顺序，避免在构造函数中绑定未完全初始化的方法
constructor() {
  // 先创建基础策略实例
  this.searchStrategy = new SearchStrategy();
  this.deeperStrategy = new DeeperStrategy({
    runSearchTask: (tasks: SearchTask[]) => this.runSearchTask(tasks)
  });
  
  // 最后创建RetryManager，避免循环依赖
  const retryDependencies: RetryManagerDependencies = {
    handleError: handleError,
    runSearchTask: (tasks: SearchTask[], skipAutoRetry?: boolean) => 
      this.runSearchTask(tasks, skipAutoRetry),
    regenerateAndRerunTask: (taskId: string) => 
      this.regenerateAndRerunTask(taskId),
    isUserIntervened: () => this.isUserIntervened()
  };
  
  this.retryManager = new RetryManager(retryDependencies);
  this.searchStrategy.setRetryManager(this.retryManager);
}
```

**提示词**:
```
修复ResearchEngine.ts中的循环依赖问题。

问题：构造函数中的方法绑定顺序可能导致初始化问题

任务：
1. 重构构造函数，先创建基础实例
2. 为DeeperStrategy提供依赖注入
3. 最后创建RetryManager，避免循环依赖
4. 确保所有依赖正确注入
5. 测试初始化顺序

文件：src/utils/deep-research/core/ResearchEngine.ts
需要配合修复3一起完成
```

## 🎯 修复优先级

1. **优先级1**: 修复1 + 修复4 (SearchStrategy + ResearchEngine)
2. **优先级2**: 修复3 (DeeperStrategy依赖注入)  
3. **优先级3**: 修复2 (useDeepResearchAdapter React问题)

## ✅ 验证标准

修复完成后需要验证：
1. TypeScript编译通过 (`npx tsc --noEmit`)
2. ESLint检查通过 (`pnpm lint`)
3. 所有模块正确实例化
4. 依赖注入链条完整
5. 无循环依赖问题

## 📝 修复记录

- [ ] 修复1: SearchStrategy.setRetryManager
- [ ] 修复2: useDeepResearchAdapter React Hooks
- [ ] 修复3: DeeperStrategy依赖注入
- [ ] 修复4: ResearchEngine循环依赖
- [ ] 最终验证: TypeScript + ESLint通过