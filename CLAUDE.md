# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在处理此代码库时提供指导。

## 语言
使用中文来回答问题

## 开发命令

**包管理器**: 此项目使用 `pnpm` 作为主要包管理器。

```bash
# 安装依赖
pnpm install

# 开发服务器（使用 Turbopack）
pnpm dev

# 生产环境构建
pnpm build

# 构建独立版本
pnpm build:standalone

# 构建静态导出
pnpm build:export

# 启动生产服务器
pnpm start

# 代码检查
pnpm lint
```

## 环境设置

将 `env.tpl` 复制到 `.env.local`（开发环境）或 `.env`（生产环境）：
```bash
cp env.tpl .env.local
```

## 架构概述

**Deep Research** 是一个 Next.js 15 应用程序，使用各种 AI 模型和搜索引擎生成全面的研究报告。

### 核心架构

**前端技术栈:**
- Next.js 15 与 App Router
- React 19 与 TypeScript
- Tailwind CSS + shadcn/ui 组件
- Zustand 状态管理
- 使用 Serwist 的 PWA 支持

**AI 集成:**
- 通过 AI SDK 支持多提供商 AI（OpenAI、Anthropic、Google 等）
- 双模型架构："思考"模型用于规划，"任务"模型用于执行
- 多个搜索提供商（Tavily、Firecrawl、Exa、SearXNG 等）

**关键目录:**

- `src/app/api/` - 按提供商组织的 API 路由（ai/、search/、mcp/、sse/）
- `src/utils/deep-research/` - 核心研究逻辑和编排
- `src/components/Research/` - 研究 UI 组件
- `src/store/` - Zustand 状态管理
- `src/libs/mcp-server/` - 模型上下文协议服务器实现

### 研究流程

1. **规划阶段**: 用户查询 → AI 生成研究计划 → 创建搜索查询
2. **搜索阶段**: 使用各种提供商并行执行搜索任务
3. **综合阶段**: AI 将搜索结果组合成全面报告
4. **输出**: 带有引用、图像和知识图谱的 Markdown 报告

### API 架构

**服务器发送事件 (SSE)**: 实时流式研究进度
- 端点: `/api/sse` (POST) 和 `/api/sse/live` (GET)
- 流式传输进度更新、推理和最终结果

**模型上下文协议 (MCP)**: 与其他 AI 服务集成
- StreamableHTTP: `/api/mcp`
- SSE 传输: `/api/mcp/sse`

### 关键类

**DeepResearch** (`src/utils/deep-research/index.ts`): 主要编排类
- 管理 AI 提供商连接
- 协调搜索任务
- 处理流式输出和进度事件

### 提供商系统

**AI 提供商**: 通过 `src/utils/deep-research/provider.ts` 中的工厂模式抽象
**搜索提供商**: `src/utils/deep-research/search.ts` 中的统一接口

### 状态管理

通过 Zustand 存储管理全局状态：
- `global.ts` - 应用程序设置和 UI 状态
- `history.ts` - 研究历史
- `knowledge.ts` - 本地知识库
- `task.ts` - 研究任务管理

### 特殊功能

**知识库**: 文件上传和处理（PDF、Office、文本文件）
**工件**: 可编辑的研究内容，支持 WYSIWYM 和 Markdown 模式
**多语言**: 使用 react-i18next 的 i18n 支持
**本地存储**: 基于浏览器的数据持久化，保护隐私

## 测试和质量

提交前运行代码检查：
```bash
pnpm lint
```

项目使用 ESLint 和 Next.js 配置。package.json 中没有定义测试命令。

## 部署

应用程序支持多个部署目标：
- **Vercel**: 直接部署
- **Cloudflare Pages**: 参见 `docs/How-to-deploy-to-Cloudflare-Pages.md`
- **Docker**: 可用作 `xiangfa/deep-research`
- **静态导出**: 使用 `pnpm build:export` 构建

## 环境变量

参考 `env.tpl` 获取完整的环境变量文档。关键变量：
- AI 提供商 API 密钥（Google、OpenAI、Anthropic 等）
- 搜索提供商 API 密钥（Tavily、Firecrawl 等）
- `ACCESS_PASSWORD` 用于服务器保护
- `NEXT_PUBLIC_MODEL_LIST` 用于自定义模型配置

## 开发说明

- 使用严格配置的 TypeScript
- 使用 Tailwind CSS 和 shadcn/ui 组件系统进行样式设计
- 渐进式 Web 应用 (PWA) 功能
- 注重隐私：默认所有数据本地存储
- 支持多密钥 API 密钥（逗号分隔）

## Deep Research 重构计划

### 当前问题分析

`useDeepResearch` hook (1900+ 行) 存在以下问题：
1. **违反单一职责原则**: 承担了太多职责（搜索、重试、状态管理、UI逻辑等）
2. **函数过大**: `runDeeperResearch`(468行)、`runSearchTask`(317行) 等函数过于庞大
3. **状态管理混乱**: 多种状态交织，难以维护
4. **业务逻辑与UI逻辑混合**: 违反分层架构原则
5. **代码重复**: 相似逻辑未抽象复用

### 重构目标

将 `src/hooks/useDeepResearch.ts` 重构为模块化的文件夹结构，实现：
- 职责分离
- 代码复用
- 易于测试
- 更好的维护性

### 新架构设计

```
src/utils/deep-research/
├── core/                     # 核心引擎
│   ├── ResearchEngine.ts     # 主研究引擎
│   ├── TaskScheduler.ts      # 任务调度器  
│   └── StateManager.ts       # 状态管理器
├── strategies/               # 研究策略
│   ├── SearchStrategy.ts     # 搜索策略 (runSearchTask)
│   ├── WiderStrategy.ts      # 扩展研究策略 (runWiderResearch)
│   └── DeeperStrategy.ts     # 深度研究策略 (runDeeperResearch)
├── services/                 # 业务服务
│   ├── RetryManager.ts       # 重试管理
│   ├── TaskRunner.ts         # 任务执行器
│   └── StreamProcessor.ts    # 流式处理
├── types/                    # 类型定义
│   ├── research.ts           # 研究相关类型
│   └── strategy.ts           # 策略相关类型
└── index.ts                  # 统一导出
```

### 重构策略

#### 第一阶段：核心模块拆分
1. **SearchStrategy** (`runSearchTask` 317行)
   - 搜索任务执行逻辑
   - 错误处理和重试
   - 并行执行管理

2. **DeeperStrategy** (`runDeeperResearch` 468行)  
   - 深度研究逻辑
   - 三阶段思考流程
   - 任务生成和调度

3. **WiderStrategy** (`runWiderResearch` 95行)
   - 扩展研究逻辑
   - 建议处理
   - 查询生成

#### 第二阶段：支持服务抽取
1. **RetryManager** - 自动重试逻辑独立管理
2. **TaskRunner** - 统一任务执行接口
3. **StreamProcessor** - 流式处理和状态更新

#### 第三阶段：状态管理优化
1. **StateManager** - 集中状态管理
2. **ResearchEngine** - 高层编排器
3. **TaskScheduler** - 任务调度和生命周期

### 设计模式应用

1. **策略模式**: 不同研究策略（搜索、扩展、深度）
2. **命令模式**: 任务执行和撤销
3. **观察者模式**: 状态变化通知
4. **工厂模式**: 策略和服务实例创建
5. **单例模式**: 重试状态管理

### 依赖关系设计

```
useDeepResearch (Hook)
    ↓
ResearchEngine (Core)
    ↓
TaskScheduler + StateManager
    ↓
Strategies (Search/Wider/Deeper)
    ↓
Services (Retry/Runner/Stream)
```

### 重构实施步骤

1. **Phase 1**: 创建新文件夹结构和基础类型
2. **Phase 2**: 迁移 `runSearchTask` → `SearchStrategy`
3. **Phase 3**: 迁移 `runDeeperResearch` → `DeeperStrategy`  
4. **Phase 4**: 迁移 `runWiderResearch` → `WiderStrategy`
5. **Phase 5**: 抽取重试逻辑 → `RetryManager`
6. **Phase 6**: 创建 `ResearchEngine` 统一入口
7. **Phase 7**: 重构 `useDeepResearch` 为轻量级 hook
8. **Phase 8**: 测试验证和性能优化

### 关键原则

- **向后兼容**: 保持现有 API 不变
- **渐进式重构**: 逐步迁移，避免大爆炸式重构
- **测试驱动**: 每个模块都应可独立测试
- **类型安全**: 强类型约束，减少运行时错误