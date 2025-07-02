# 工作包3: 重试管理服务

## 📋 任务概述
将 `useDeepResearch.ts` 中分散的重试逻辑提取为独立的重试管理服务。

## 🎯 目标
创建 `src/utils/deep-research/services/RetryManager.ts`

## 🔍 必须参考的现有代码
**主要文件**: `src/hooks/useDeepResearch.ts` 
- 第51-59行: `TaskRetryState` 接口和 `taskRetryStates` Map
- 第1542-1747行: 完整的重试管理逻辑
  - `getRetryState`, `updateRetryState`, `clearRetryState`
  - `autoRetryTask` 主控制器  
  - `retryTaskQuery` 简单重试
  - `regenerateTaskQuery` 智能重试
- 第420行和437行: 重试触发调用点

## 📐 具体实现要求

### 创建文件: `RetryManager.ts`
```typescript
export class RetryManager {
  private retryStates: Map<string, TaskRetryState>
  
  // 主要方法 (从useDeepResearch提取)
  async scheduleRetry(taskId: string, error: Error): Promise<void>
  async executeRetry(taskId: string): Promise<boolean>
  async cancelRetry(taskId: string): Promise<void>
  
  // 状态管理 (从useDeepResearch提取)
  getRetryState(taskId: string): TaskRetryState
  updateRetryState(taskId: string, updates: Partial<TaskRetryState>): void
  clearRetryState(taskId: string): void
  clearAllRetryStates(): void
  
  // 重试策略 (从useDeepResearch提取)
  private async simpleRetry(taskId: string): Promise<boolean>
  private async intelligentRetry(taskId: string): Promise<boolean>
  private async autoRetryTask(taskId: string, error: Error): Promise<void>
}
```

### 关键提取点
1. **重试状态管理**: `TaskRetryState` 和 `Map<string, TaskRetryState>`
2. **三次重试策略**: 2次简单重试 + 1次智能重试
3. **错误处理集成**: 与`searchErrorHandling`设置的配合
4. **用户介入检测**: `isUserIntervened()` 逻辑
5. **静默模式**: `silent: boolean` 参数处理
6. **最终失败处理**: 所有重试失败后的错误展示

## ⚠️ 严格约束
- **只能修改/创建**: `src/utils/deep-research/services/RetryManager.ts`
- **绝对禁止修改**: 
  - `src/hooks/useDeepResearch.ts` (暂时保留)
  - 任何组件文件
  - store文件
  - 其他策略文件

## ✅ 验收标准
1. RetryManager.ts 创建成功
2. 包含完整的重试状态管理
3. 实现三层重试策略
4. 保持错误处理的用户体验
5. TypeScript编译通过
6. 重试逻辑与原有行为一致

## 📝 工作进度追踪

### 状态: ✅ 已完成
**负责AI**: Claude Code (重新完成)
**依赖**: 可与WP1/WP2并行进行

### 完成情况汇报
**完成时间**: 2025-07-02
**AI反馈**: 
```
- 已创建文件: src/utils/deep-research/services/RetryManager.ts
- 完整迁移: 成功将 useDeepResearch.ts 中第1542-1747行的重试逻辑完整迁移
- 依赖注入: 通过构造函数注入依赖项（handleError, runSearchTask 等），实现了解耦
- 状态管理: 实现了独立的 TaskRetryState 接口和 Map 用于状态管理
- 核心逻辑: autoRetryTask 主控制器及三次重试策略（2次简单+1次智能）已完整实现
- 错误处理: 完整保留了原有的用户体验和错误展示逻辑
- 类型安全: 完整的 TypeScript 类型定义和接口设计
- 额外功能: 增加了 getRetryStats() 方法用于调试和监控
```

**审查结果**: ✅ 通过
```
- 文件已成功创建于: src/utils/deep-research/services/RetryManager.ts
- 代码审查:
  - 逻辑与源文件一致。
  - 依赖关系通过构造函数注入���设计良好。
  - 包含了所有必需的功能，没有使用占位符。
- 验证: 文件在文件系统中真实存在，TypeScript 编译通过。

任务已按要求完成。
```

## ⏱️ 预估时间
2天