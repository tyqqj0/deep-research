# 工作包2: 深度研究策略重构

## 📋 任务概述
将 `useDeepResearch.ts` 中的 `runDeeperResearch` 函数(468行)重构为独立的深度研究策略模块。

## 🎯 目标
创建 `src/utils/deep-research/strategies/DeeperStrategy.ts`

## 🔍 必须参考的现有代码
**主要文件**: `src/hooks/useDeepResearch.ts` 第699-1167行
- `runDeeperResearch` 函数完整逻辑
- 三阶段AI流程: 反思评估 → 战略思考 → 任务生成
- `reflectCurrentResearchPrompt` 调用逻辑
- `planNextDeepStepPrompt` 调用逻辑  
- `generateTasksFromPlanPrompt` 调用逻辑
- 流式处理和实时更新机制

## 📐 具体实现要求

### 创建文件: `DeeperStrategy.ts`
```typescript
export class DeeperStrategy {
  // 保持完全相同的API签名
  async execute(taskId: string): Promise<void>
  
  // 私有方法 (从runDeeperResearch提取)
  private async reflectCurrentResearch(context: any): Promise<string>
  private async planNextStep(reflectionContent: string): Promise<string>
  private async generateTasks(planningContent: string): Promise<SearchTask[]>
  private async waitForDepthCompletion(depth: number): Promise<void>
}
```

### 关键提取点
1. **三阶段流程**: 反思 → 思考 → 生成的完整流程
2. **ThinkingTask管理**: 创建、更新、完成thinking task
3. **深度控制**: `maxDepth` 检查和 `currentMaxDepth` 管理
4. **流式更新**: 实时更新thinking task的各个阶段
5. **任务生成**: 从AI规划转换为SearchTask的逻辑
6. **状态同步**: `setResearchStatus` 和相关状态管理

## ⚠️ 严格约束
- **只能修改/创建**: `src/utils/deep-research/strategies/DeeperStrategy.ts`
- **绝对禁止修改**: 
  - `src/hooks/useDeepResearch.ts` (暂时保留)
  - prompts相关文件
  - 任何组件文件
  - store文件

## ✅ 验收标准
1. DeeperStrategy.ts 创建成功
2. 包含完整的三阶段思考逻辑
3. 保持ThinkingTask的创建和管理机制
4. 流式处理逻辑正确提取
5. TypeScript编译通过

## 📝 工作进度追踪

### 状态: ✅ 已完成
**负责AI**: Gemini
**依赖**: WP1完成后开始

### 完成情况汇报
**完成时间**: 2025-07-01
**AI反馈**: 
```
- 已创建文件: src/utils/deep-research/strategies/DeeperStrategy.ts
- 三阶段流程实现: 成功将反思、规划、任务生成三阶段逻辑完整重构到 DeeperStrategy 类中。
- ThinkingTask管理: ThinkingTask 的创建、流式更新和完成状态管理已全部移入新模块，并保持与原逻辑一致。
- 遇到的复杂点: 确保所有依赖（如 store, i18n, prompts）在新文件中正确导入和使用。
- 需要确认的逻辑: `runSearchTask` 函数的依赖已通过 `declare` 声明，将在最终集成阶段解决。
```

**审查结果**: ✅ 通过
```
审查通过��文件已创建，逻辑已完整迁移。
```

