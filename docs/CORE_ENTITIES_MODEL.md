# 🧩 Research Navigator 核心实体层次模型

> **文档版本**: v1.0  
> **创建日期**: 2025-01-30  
> **状态**: ✅ 概念重构完成

## 📋 概述

本文档定义了Research Navigator项目的核心实体模型，通过概念重构建立了清晰的**层次关系**和**职责划分**。这个模型将指导后续的代码重构和架构优化。

---

## 🎯 核心流程 (The Main Pipeline)

Research Navigator的核心工作流分为三个独立阶段，形成完整的研究闭环：

### 阶段一：文献获取与管理 (Resource Acquisition & Management)
- **目标**: 建立结构化、无重复的本地知识库
- **流程**:
  1. **数据注入**: 多渠道文献提交（PDF上传、Zotero同步、URL抓取）
  2. **异步处理**: SSE实时状态推送（解析中、提取元数据等）
  3. **智能入库**: `MatchingEngine`查重 → `CitationLinker`关系链接 → `LibraryService`存储
- **产出**: 高质量、关系化的本地文献库

### 阶段二：AI驱动的研究探索 (AI-Powered Research & Discovery)
- **目标**: 基于研究主题，构建知识探索树
- **流程**: **MCTS循环**
  1. **定位**: 选择最有潜力的研究节点
  2. **扩展**: 三步微流程
     - **思考**: LLM生成新研究方向
     - **表述**: LLM清晰表述为具体问题
     - **引用**: 从知识库检索相关文献
  3. **验证**: 评估新节点有效性和价值
  4. **更新**: 用奖励分数更新整条路径
- **产出**: 层次分明的**研究主题树**

### 阶段三：成果综合与呈现 (Synthesis & Presentation)
- **目标**: 人类可理解的成果呈现
- **流程**:
  1. **报告生成**: 汇总研究主题树生成深度报告
  2. **可视化**: 研究路径图 + 全局引文网络图
- **产出**: 深度研究报告 + 可交互图谱

---

## 🏗️ 核心实体层次模型 (Hierarchical Entity Model)

### 层级 0: The Application (应用顶层)
整个系统的根容器，管理全局资源和所有研究工作区。

### 层级 1: 全局单例实体 (Global Singletons)
在应用生命周期中只存在一份，被所有工作区共享：

#### 📚 文献知识库 (Global Literature Knowledge Base)
- **职责**: 所有文献数据的"唯一事实来源"
- **功能**: 全局持久化存储、智能查重、引文链接
- **包含**: `LibraryService`, `MatchingEngine`, `CitationLinker`, `ZoteroProvider`

#### 📂 本地资料管理器 (Local Asset Manager)
- **职责**: 管理用户上传的非标准化本地文件
- **功能**: 文件存储、索引、检索（PDF、TXT、DOCX等）

#### ⚙️ 全局设置 (Global Settings)
- **职责**: 应用级配置管理
- **包含**: API Keys、主题、默认语言、后端服务地址

#### 🖥️ 视图/页面管理器 (View/Page Manager)
- **职责**: 顶层页面切换控制
- **功能**: 文献库管理页面 ↔ 研究工作区页面导航

### 层级 2: 👑 工作区/会话管理器 (Workspace/Session Manager)
- **职责**: 顶层协调者，管理多个独立研究任务
- **功能**: 创建、加载、保存、切换研究会话，确保相互隔离
- **持有**: `ResearchSession` 对象列表

### 层级 3: 🔬 单个研究会话 (A Single Research Session)
每个会话代表一次完整的端到端研究任务：

#### 🌳 研究树 (The Research Tree)
- **性质**: **被动数据结构**（非活动服务）
- **职责**: 以节点/边形式记录研究探索路径和结论
- **提供**: `addNode`, `findNode`, `updateEdge` 等原子操作

#### ⚙️ MCTS 算法引擎 (MCTS Algorithm Engine)
- **性质**: **纯算法处理器**
- **职责**: 接收研究树实例，运行MCTS循环并修改树
- **包含**: `SGMCTSController` + 原子模块(`Thinker`, `Citer`, `Formulator`等)

#### 📄 会话文献上下文 (Session Literature Context)
- **性质**: **运行时数据视图**
- **职责**: 当前研究会话引用的文献子集
- **包含**:
  - 从全局知识库挑选的相关文献引用
  - MCTS `Citer`新发现但尚未存入全局库的临时文献

#### ⚙️ 会话配置 (Session-Specific Config)
- **职责**: 会话专属设置
- **包含**: 本次任务的具体模型配置等

---

## 🔍 关键概念解析

### "文献"的双重角色

通过库存-流量模型彻底区分：

1. **全局文献知识库** = **私人图书馆**
   - **特性**: 持久化、全局唯一、结构化
   - **管理**: 通过`文献管理页面`进行编目和查重
   - **作用**: 所有研究项目的坚实知识基础

2. **会话文献上下文** = **研究书桌**
   - **特性**: 临时、会话专属、动态变化
   - **内容**: 
     - 从图书馆精选的相关文献
     - 刚发现但未整理的新资料
   - **展示**: 在MCTS工作流中动态呈现

---

## 📊 实体关系图

```mermaid
graph TD
    subgraph "层级 0: Deep Research App"
        direction LR
        subgraph "层级 1: 全局单例 (Global Singletons)"
            direction TB
            GlobalKB[📚 全局文献知识库]
            AssetManager[📂 本地资料管理器]
            GlobalSettings[⚙️ 全局设置]
            PageManager[🖥️ 页面管理器]
        end

        subgraph "层级 2: 工作区管理"
            direction TB
            WorkspaceManager[👑 工作区/会话管理器]
        end

        WorkspaceManager -- "管理多个" --> SessionA
    end

    subgraph "层级 3: 研究会话A (Research Session)"
        direction TB
        SessionA --> ResearchTree[🌳 研究树 (数据结构)]
        SessionA --> MCTS_Engine[⚙️ MCTS引擎 (处理器)]
        SessionA --> SessionContext[📄 会话文献上下文 (运行时视图)]

        MCTS_Engine -- "修改 (Modifies)" --> ResearchTree
        MCTS_Engine -- "使用/引用 (Uses/Cites)" --> SessionContext
        SessionContext -- "引用 (References)" --> GlobalKB
    end
    
    subgraph "状态管理与UI (State & UI)"
        direction RL
        UI[🖼️ 视图与展示层]
        StateManager[📡 状态管理中心]
        
        UI -- "订阅 (Subscribes to)" --> StateManager
        StateManager -- "镜像 (Mirrors State from)" --> WorkspaceManager
        StateManager -- "镜像 (Mirrors State from)" --> ResearchTree
        StateManager -- "镜像 (Mirrors State from)" --> GlobalKB
    end

    classDef global fill:#e1f5fe,stroke:#0288d1,stroke-width:2px;
    classDef workspace fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px;
    classDef session fill:#e8f5e9,stroke:#388e3c,stroke-width:2px;
    classDef stateui fill:#fff3e0,stroke:#f57c00,stroke-width:2px;
    
    class GlobalKB,AssetManager,GlobalSettings,PageManager global;
    class WorkspaceManager workspace;
    class ResearchTree,MCTS_Engine,SessionContext session;
    class UI,StateManager stateui
```

---

## 🎯 架构优势

1. **高内聚低耦合**: 每个实体职责单一，边界清晰
2. **层次分明**: 从全局到会话的自然分层
3. **概念清晰**: 解决了"文献"等概念的多重角色困惑
4. **扩展友好**: 支持多会话、可插拔算法模块
5. **状态分离**: UI纯粹响应式，业务逻辑独立

---

## 📈 下一步行动

基于此概念模型，后续将进行：
1. ✅ **概念重构** - 本文档
2. 🔄 **结构重构** - 设计新的项目目录结构
3. 🛠️ **代码重构** - 逐步迁移现有代码到新架构

---

> 📅 **文档版本**: v1.0  
> 🔄 **最后更新**: 2025-01-30  
> 👥 **维护者**: Deep Research Team  
> 📋 **状态**: ✅ 概念重构完成，进入结构重构阶段