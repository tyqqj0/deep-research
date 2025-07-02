# 工作包1: 搜索策略重构

## 📋 任务概述
将 `useDeepResearch.ts` 中的 `runSearchTask` 函数(317行)重构为独立的搜索策略模块。

## 🎯 目标
创建 `src/utils/deep-research/strategies/SearchStrategy.ts`

## 🔍 必须参考的现有代码
**主要文件**: `src/hooks/useDeepResearch.ts` 第197-514行
- `runSearchTask` 函数完整逻辑
- `startExecution` 内部函数  
- 并行执行逻辑 (`Plimit`)
- 错误处理和重试调用
- 状态更新机制

## 📐 具体实现要求

### 创建文件: `SearchStrategy.ts`
```typescript
export class SearchStrategy {
  // 保持完全相同的API签名
  async execute(queries: SearchTask[], skipAutoRetry: boolean = false): Promise<void>
  
  // 私有方法 (从runSearchTask提取)
  private async startExecution(item: SearchTask): Promise<void>
  private async handleSearchError(error: Error, task: SearchTask): Promise<void>
  private async executeWithProvider(task: SearchTask): Promise<void>
}
```

### 关键提取点
1. **并行执行控制**: `Plimit(parallelSearch)` 逻辑
2. **搜索模式处理**: `immediate/delayed/manual` 模式  
3. **错误处理策略**: `ignore/auto/manual` 错误处理
4. **状态更新**: `updateTask` 调用时机
5. **重试触发**: `autoRetryTask` 调用逻辑

## ⚠️ 严格约束
- **只能修改/创建**: `src/utils/deep-research/strategies/SearchStrategy.ts`
- **绝对禁止修改**: 
  - `src/hooks/useDeepResearch.ts` (暂时保留)
  - 任何组件文件
  - store文件
  - 其他工具文件

## ✅ 验收标准
1. SearchStrategy.ts 创建成功
2. 包含完整的搜索执行逻辑
3. 保持原有的错误处理机制
4. TypeScript编译通过
5. 不影响现有代码运行

## 📝 工作进度追踪

### 状态: ✅ 已完成
**负责AI**: 主控AI (开始演示)
**开始时间**: 2025-01-27

### 完成情况汇报
**完成时间**: 2025-07-01
**AI反馈**: 
```
[AI在此处填写完成情况]
- 已创建文件: `src/utils/deep-research/strategies/SearchStrategy.ts`
- 提取的核心逻辑:
  - `runSearchTask` 的完整逻辑已迁移到 `SearchStrategy.execute`
  - 内部函数 `startExecution` 已被重构为私有方法 `startExecution`, `executeWithProvider`, 和 `handleSearchError`
  - 保留了并行执行 (`Plimit`)、搜索模式 (`immediate/delayed/manual`) 和错误处理 (`ignore/auto/manual`) 的逻辑
- 遇到的问题: 原始函数依赖于许多外部导入和 Zustand store (`useSettingStore`, `useTaskStore`)。为了满足“不修改任何现有文件”的约束，我在新文件中直接导入了这些依赖项。这在实际项��中可能需要进一步重构以实现更好的依赖注入，但对于当前任务是必要的。
- 需要确认的点: 无。
```

**审查结果**: ✅ 通过 
```
经过详细审查，SearchStrategy.ts 已成功完成所有要求：

✅ **导入路径正确**: 所有导入与 useDeepResearch.ts 保持一致
✅ **完整逻辑迁移**: runSearchTask 的完整 317 行逻辑已准确迁移
✅ **流式处理**: ThinkTagStreamProcessor 和 for await...of 循环完整实现
✅ **并行控制**: Plimit(parallelSearch) 逻辑完整保留
✅ **错误处理**: 完整的 autoRetryTask 调用和重试状态管理
✅ **搜索模式**: immediate/delayed/manual 三种模式完整支持
✅ **状态管理**: updateTask 调用时机与原函数完全一致
✅ **TypeScript**: 编译通过，类型安全

新的 SearchStrategy.ts (274行) 是 runSearchTask 函数的精确重构版本，
已做好进入下一阶段的准备。可以开始 WP2 工作。
```

## ⏱️ 预估时间
2天