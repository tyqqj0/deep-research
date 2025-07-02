# 🏗️ Deep Research 国际化架构重构计划

## 🚨 当前问题分析

### 混乱的国际化实现
发现4种不同的国际化调用方式：
1. **RetryManager.ts**: `useTranslation()` from react-i18next (❌ Hook错误)
2. **ResearchEngine.ts**: `t()` from i18next (⚠️ 直接依赖)
3. **DeeperStrategy.ts**: `i18n.t()` from utils/i18n (⚠️ 混用)
4. **SearchStrategy.ts**: `t()` from i18next (⚠️ 直接依赖)

### 架构违规
- Utils层直接依赖UI层的翻译机制
- 违反分层架构原则
- 测试困难，耦合度高

## 🎯 目标架构：错误码模式

### 设计原则
```
React组件层     ← 负责翻译显示
    ↑ 错误码
业务逻辑层     ← 只返回错误码/消息键
    ↑ 纯数据
数据层        ← 无UI概念
```

### 核心设计
1. **Utils层**: 返回错误码枚举或消息键
2. **React层**: 接收错误码，负责翻译和显示
3. **完全解耦**: Utils层无任何UI依赖

## 📋 重构工作包

### WP-I18N-1: 创建错误码系统
**目标**: 建立统一的错误码枚举和消息键系统

**创建文件**: `src/utils/deep-research/types/ErrorCodes.ts`
```typescript
export enum ResearchErrorCode {
  SEARCH_FAILED = 'SEARCH_FAILED',
  RETRY_EXHAUSTED = 'RETRY_EXHAUSTED', 
  TASK_GENERATION_FAILED = 'TASK_GENERATION_FAILED',
  AI_FAILED_TO_GENERATE_PLAN = 'AI_FAILED_TO_GENERATE_PLAN'
}

export interface ResearchError {
  code: ResearchErrorCode;
  messageKey: string;
  params?: Record<string, any>;
  originalError?: Error;
}
```

### WP-I18N-2: 重构RetryManager
**目标**: 移除React Hook，使用错误码模式

**修改**: `src/utils/deep-research/services/RetryManager.ts`
- 移除 `useTranslation` 导入
- `handleFinalFailure` 返回错误对象而非直接更新UI
- 通过依赖注入传递错误处理回调

### WP-I18N-3: 重构SearchStrategy  
**目标**: 移除i18next直接依赖

**修改**: `src/utils/deep-research/strategies/SearchStrategy.ts`
- 移除 `import { t } from "i18next"`
- 错误处理返回错误码
- 通过依赖注入处理UI更新

### WP-I18N-4: 重构DeeperStrategy
**目标**: 统一错误处理模式

**修改**: `src/utils/deep-research/strategies/DeeperStrategy.ts`  
- 移除 `i18n.t()` 调用
- 状态更新通过依赖注入
- 返回执行结果而非直接UI操作

### WP-I18N-5: 重构ResearchEngine
**目标**: 作为协调层处理错误码到UI的转换

**修改**: `src/utils/deep-research/core/ResearchEngine.ts`
- 移除直接的toast调用
- 接收子模块的错误码
- 转换为用户友好的UI操作

### WP-I18N-6: 更新适配器层
**目标**: 在适配器层处理错误码翻译

**修改**: `src/utils/deep-research/legacy/useDeepResearchAdapter.ts`
- 接收错误码
- 使用React Hook进行翻译
- 显示翻译后的消息

## 🔧 实现策略

### 阶段1: 错误码基础设施 (优先级: 高)
```
创建错误码枚举 → 定义错误接口 → 建立转换函数
```

### 阶段2: 自底向上重构 (优先级: 高)
```
RetryManager → SearchStrategy → DeeperStrategy → ResearchEngine
```

### 阶段3: 适配器层集成 (优先级: 中)
```
useDeepResearchAdapter → 测试验证 → 文档更新
```

## 📐 设计示例

### Before (现在 - 有问题)
```typescript
// RetryManager.ts
const { t } = useTranslation(); // ❌ Hook错误
const content = `❌ **${t("research.status.searchFailed")}**`;
updateTask(taskId, { learning: content });
```

### After (目标架构)
```typescript
// RetryManager.ts  
return {
  code: ResearchErrorCode.RETRY_EXHAUSTED,
  messageKey: 'research.status.searchFailed',
  params: { taskId, retryCount: 3 }
};

// useDeepResearchAdapter.ts
const error = await engine.runTask();
if (error) {
  const message = t(error.messageKey, error.params);
  updateTask(taskId, { learning: `❌ **${message}**` });
}
```

## ✅ 验收标准

1. **无React Hook错误**: Utils层完全无React依赖
2. **架构清晰**: 分层职责明确
3. **功能一致**: 翻译功能正常工作  
4. **测试友好**: Utils层可独立测试
5. **可维护性**: 错误信息集中管理

## 🎯 预期收益

- ✅ **彻底解决Hook错误**
- ✅ **架构更清晰**: 严格分层
- ✅ **测试更容易**: Utils层纯函数
- ✅ **维护更简单**: 错误信息集中管理
- ✅ **扩展更灵活**: 新增语言支持更容易