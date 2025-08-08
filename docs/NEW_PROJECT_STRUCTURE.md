# 🏗️ Research Navigator 新项目结构设计

> **文档版本**: v1.0  
> **创建日期**: 2025-01-30  
> **状态**: ✅ 结构重构设计完成

## 📋 概述

基于**核心实体层次模型**和**Next.js 15 App Router**架构，采用**领域驱动设计(DDD)**思想，设计了一个专业、可维护、符合最佳实践的新项目目录结构。

---

## 🎯 设计原则

### 1. **领域驱动设计 (Domain-Driven Design)**
- 按核心实体组织代码，每个领域高度内聚
- 清晰的实体、服务、仓储分层
- 领域间通过定义明确的接口交互

### 2. **Next.js 15 最佳实践**
- App Router 架构，完整支持服务端组件
- API 路由按功能模块分组
- 页面组件与业务逻辑分离

### 3. **响应式状态管理**
- 状态存储按领域分离，避免巨型 Store
- 每个 Store 专注于特定领域的状态镜像
- UI 组件纯粹响应状态变化

### 4. **清晰的层次分离**
- **领域层**: 核心业务逻辑，框架无关
- **应用层**: Next.js 路由和页面
- **基础设施层**: 外部依赖和工具
- **展示层**: 纯 UI 组件

---

## 核心流程
 阶段一：文献获取与管理 (Resource Acquisition & Management)
- 目标: 建立一个结构化、无重复的本地知识库。
- 流程:
  A. 数据注入 (Ingestion): 用户通过多种渠道（如PDF上传、Zotero同步、URL抓取）提交文献资源。
  B. 异步处理 (Processing): 后端服务接收提交，通过**SSE（服务器发送事件）**实时将处理状态（如“解析中”、“提取元数据”）推送给前端。
  C. 智能入库 (Intelligent Storage): 处理完成后，MatchingEngine进行智能查重与数据合并，CitationLinker自动链接引文关系，最后由LibraryService存入本地数据库（IndexedDB）。
- 产出: 一个高质量、关系化的本地文献库。
  
阶段二：Tree 驱动的研究探索
- 目标: 基于用户给定的研究主题，在文献库的基础上进行深度探索，构建一个知识探索树。
- 流程: 这是项目的核心——**MCTS（蒙特卡洛树搜索）**循环。
  A. 定位 (Select): 从现有的研究路径中，选择一个最有潜力的节点进行探索。
  B. 扩展 (Expand): 对选定节点进行“头脑风暴”，这是一个包含三个子步骤的微流程：
      - 思考 (Think): LLM生成新的、有深度的研究方向。
    - 表述 (Formulate): LLM将新方向清晰地表述为具体问题或主题。
    - 引用 (Cite): 从本地知识库中检索并关联最相关的文献作为支撑。
  C. 验证与评估 (Validate & Evaluate): 评估新扩展节点的有效性和价值，并计算“奖励分数”。
  D. 更新 (Update/Backpropagate): 用“奖励分数”更新从当前节点到根节点的整条路径，使系统“学会”哪些方向更有价值。
- 产出: 一个层次分明、逻辑严谨的研究主题树 (Topic Tree)。
  
阶段三：成果综合与呈现 (Synthesis & Presentation)
- 目标: 将探索过程和结果以人类可理解的方式呈现出来。
- 流程:
  A. 报告生成 (Report Generation): 系统遍历并汇总最终的研究主题树，生成一份结构化的深度研究报告。
  B. 可视化 (Visualization):
      - 将研究主题树以可交互的树状图形式展示。
    - 将文献间的引用关系渲染成一个全局引文网络图 (Citation Graph)。
- 产出: 一份深度研究报告、一个可交互的探索路径图和一个全局知识图谱。

## 核心实体
 实体层级 0: The Application (应用顶层)
 这是整个系统的根容器，负责管理全局唯一的资源和所有研究工作区。

 实体层级 1: 全局单例实体 (Global Singletons)
 这些实体在整个应用生命周期中只存在一份，被所有工作区共享。

- 📚 文献知识库 (Global Literature Knowledge Base)
  - 职责: 作为所有文献数据的“唯一事实来源 (Single Source of Truth)”。负责全局的文献持久化存储（IndexedDB）、智能查重 (MatchingEngine)、引文链接 (CitationLinker)。
  - 包含: LibraryService, MatchingEngine, ZoteroProvider.
- 📂 本地资料管理器 (Local Asset Manager) - 【新增实体】
  - 职责: 管理用户上传的、非标准化的本地文件（如PDF、TXT、DOCX）。提供文件的存储、索引和检索功能。这是对您提出的“本地资料管理”概念的正式化。
- ⚙️ 全局设置 (Global Settings)
  - 职责: 管理应用级的配置，如API Keys、主题（深/浅色模式）、默认语言、后端服务地址等。这些设置对所有研究会话都生效。
- 🖥️ 视图/页面管理器 (View/Page Manager)
  - 职责: 控制顶层页面的切换，例如在“文献库管理页面”和“研究工作区页面”之间导航。
    
实体层级 2: 👑 工作区/会话管理器 (Workspace/Session Manager)
  顶层协调者，也是交互的核心。
- 职责: 管理一个或多个独立的研究任务（会话）列表。负责创建、加载、保存和切换不同的研究会话，确保它们之间相互隔离。
- 持有: 一个 ResearchSession 对象的列表。
  
实体层级 3: 🔬 单个研究会话 (A Single Research Session)
  每个会话代表一次完整的、端到端的研究任务。它是动态创建和销毁的。
- 职责: 封装一次研究所需的所有组件和状态。
- 持有:
  - 🌳 研究树 (The Research Tree)
    - 核心数据结构: 它本身不是一个活动的服务，而是一个被动的数据结构。负责以节点和边的形式，精确记录研究探索的路径和结论。提供如 addNode, findNode, updateEdge 等原子操作方法。
  - ⚙️ MCTS 算法引擎 (MCTS Algorithm Engine)
    - 算法处理器: 纯粹的算法执行者。它接收一个研究树实例作为操作对象，通过其内部的SGMCTSController和一系列原子模块（Thinker, Citer等）来运行MCTS循环，并直接修改传入的研究树。
  - 📄 会话文献上下文 (Session Literature Context)
    - 运行时数据视图: 这是解答您关于“文献”困惑的关键。它不是文献的拷贝，而是当前研究会e话引用的一个文献子集。它包含：
      1. 从全局文献知识库中挑选出的、与本主题相关的文献引用。
    2. 在MCTS Citer 步骤中新发现、但尚未存入全局库的临时文献。
    - 这完美地区分了全局持久化的知识库和会话临时的研究桌面。
  - 会话配置 (Session-Specific Config)
    - 职责: 保存本次研究特有的设置，例如本次任务使用的具体“思考模型”或“任务模型”。

---

## 🏗️ 新项目目录结构

```
src/
├── 📱 app/                                    # Next.js 15 App Router (路由层)
│   ├── api/                                  # API路由 (后端接口)
│   │   ├── ai/                              # AI Provider 路由
│   │   ├── literature/                      # 文献相关API
│   │   │   ├── stream/route.ts             # SSE文献处理流
│   │   │   └── [id]/route.ts               # 单个文献操作
│   │   ├── workspace/                      # 工作区API
│   │   │   ├── [id]/route.ts              # 工作区CRUD
│   │   │   └── [id]/mcts/route.ts         # MCTS算法执行
│   │   ├── assets/                         # 本地资料API
│   │   ├── search/                         # 搜索引擎集成
│   │   └── settings/                       # 全局设置API
│   ├── library/                            # 📚 文献库管理页面
│   │   └── page.tsx
│   ├── workspace/                          # 👑 研究工作区页面
│   │   ├── page.tsx                       # 工作区列表页
│   │   └── [id]/page.tsx                  # 单个工作区页面
│   ├── assets/                            # 📂 本地资料管理页面
│   │   └── page.tsx
│   ├── settings/                          # ⚙️ 全局设置页面
│   │   └── page.tsx
│   └── layout.tsx                         # 全局布局
│
├── 🧩 domains/                              # 核心领域层 (按实体组织)
│   ├── literature/                         # 📚 文献知识库领域
│   │   ├── entities/                      # 实体定义
│   │   │   ├── Literature.ts              # 文献实体
│   │   │   └── Citation.ts               # 引用实体
│   │   ├── services/                      # 领域服务
│   │   │   ├── LibraryService.ts          # 文献库服务
│   │   │   ├── MatchingEngine.ts          # 智能查重引擎
│   │   │   └── CitationLinker.ts          # 引用链接器
│   │   ├── repositories/                  # 数据访问层
│   │   │   └── LiteratureRepository.ts
│   │   ├── providers/                     # 外部数据提供者
│   │   │   ├── ZoteroProvider.ts
│   │   │   ├── ArxivProvider.ts
│   │   │   └── UnpaywallProvider.ts
│   │   └── index.ts                       # 领域导出
│   │
│   ├── workspace/                         # 👑 工作区/会话领域
│   │   ├── entities/                      # 实体定义
│   │   │   ├── Workspace.ts               # 工作区实体
│   │   │   └── Session.ts                 # 研究会话实体
│   │   ├── services/                      # 领域服务
│   │   │   ├── WorkspaceManager.ts        # 工作区管理器
│   │   │   └── SessionManager.ts          # 会话管理器
│   │   └── index.ts
│   │
│   ├── tree/                              # 🌳 研究树领域
│   │   ├── entities/                      # 实体定义
│   │   │   ├── ResearchTree.ts            # 研究树数据结构
│   │   │   ├── TreeNode.ts                # 树节点
│   │   │   └── TreeEdge.ts                # 树边
│   │   ├── services/                      # 领域服务
│   │   │   ├── TreeService.ts             # 树操作服务
│   │   │   └── TreeVisualizationService.ts # 树可视化服务
│   │   └── index.ts
│   │
│   ├── mcts/                              # ⚙️ MCTS算法引擎领域
│   │   ├── controller/                    # 控制器
│   │   │   └── SGMCTSController.ts        # 主控制器
│   │   ├── algorithms/                    # 算法模块
│   │   │   ├── factory/
│   │   │   │   └── AlgorithmFactory.ts    # 算法工厂
│   │   │   ├── modules/                   # 原子模块
│   │   │   │   ├── Thinker.ts            # 思考者
│   │   │   │   ├── Formulator.ts         # 表述者
│   │   │   │   ├── Citer.ts              # 引用者
│   │   │   │   ├── Locator.ts            # 定位器
│   │   │   │   ├── Validator.ts          # 验证器
│   │   │   │   └── RewardCalculator.ts   # 奖励计算器
│   │   │   └── interfaces.ts             # 算法接口
│   │   └── index.ts
│   │
│   ├── assets/                            # 📂 本地资料领域
│   │   ├── entities/                      # 实体定义
│   │   │   └── LocalAsset.ts              # 本地资料实体
│   │   ├── services/                      # 领域服务
│   │   │   ├── AssetManager.ts            # 资料管理器
│   │   │   └── FileProcessor.ts           # 文件处理器
│   │   └── index.ts
│   │
│   └── settings/                          # ⚙️ 全局设置领域
│       ├── entities/                      # 实体定义
│       │   └── GlobalSettings.ts          # 全局设置实体
│       ├── services/                      # 领域服务
│       │   └── SettingsManager.ts         # 设置管理器
│       └── index.ts
│
├── 🖥️ components/                           # UI组件层 (按页面/功能组织)
│   ├── pages/                             # 页面级组件
│   │   ├── Library/                       # 文献库页面组件
│   │   │   ├── LiteratureList.tsx         # 文献列表
│   │   │   ├── GlobalCitationGraph.tsx    # 全局引文图
│   │   │   ├── LiteratureUpload.tsx       # 文献上传
│   │   │   └── ZoteroIntegration.tsx      # Zotero集成
│   │   ├── Workspace/                     # 工作区页面组件
│   │   │   ├── WorkspaceList.tsx          # 工作区列表
│   │   │   ├── SessionView.tsx            # 研究会话视图
│   │   │   ├── MCTSControlPanel.tsx       # MCTS控制面板
│   │   │   ├── TreeVisualization.tsx      # 树可视化
│   │   │   └── LiteratureContext.tsx      # 会话文献上下文
│   │   ├── Assets/                        # 本地资料页面组件
│   │   │   ├── AssetList.tsx              # 资料列表
│   │   │   └── FileUpload.tsx             # 文件上传
│   │   └── Settings/                      # 设置页面组件
│   │       ├── AIProviderSettings.tsx     # AI提供者设置
│   │       ├── SearchSettings.tsx         # 搜索设置
│   │       └── GeneralSettings.tsx        # 通用设置
│   ├── shared/                            # 通用共享组件
│   │   ├── Layout/                        # 布局组件
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   ├── Forms/                         # 表单组件
│   │   ├── Visualizations/                # 可视化组件
│   │   │   ├── NetworkGraph.tsx           # 网络图
│   │   │   └── TreeGraph.tsx              # 树形图
│   │   └── Status/                        # 状态显示组件
│   │       ├── SSEStatus.tsx              # SSE状态
│   │       └── ProcessingStatus.tsx       # 处理状态
│   └── ui/                                # shadcn/ui 基础组件
│       └── (保持现有结构)
│
├── 📡 store/                               # 状态管理层 (响应式数据源)
│   ├── workspace/                         # 工作区状态
│   │   ├── workspaceStore.ts              # 工作区存储
│   │   └── sessionStore.ts                # 会话存储
│   ├── literature/                        # 文献状态
│   │   └── libraryStore.ts                # 文献库存储
│   ├── tree/                              # 树状态
│   │   └── treeStore.ts                   # 树状态存储
│   ├── assets/                            # 资料状态
│   │   └── assetStore.ts                  # 资料存储
│   ├── settings/                          # 设置状态
│   │   └── settingsStore.ts               # 设置存储
│   └── global.ts                          # 全局状态
│
├── 🔗 infrastructure/                      # 基础设施层
│   ├── database/                          # 数据库适配
│   │   ├── dexie/                         # Dexie配置
│   │   │   ├── schema.ts                  # 数据库结构
│   │   │   └── connection.ts              # 连接配置
│   │   └── repositories/                  # 仓储实现
│   ├── external/                          # 外部服务适配
│   │   ├── ai/                            # AI服务适配器
│   │   ├── search/                        # 搜索服务适配器
│   │   └── storage/                       # 存储服务适配器
│   └── utils/                             # 基础工具
│       ├── validation.ts                  # 数据验证
│       ├── encryption.ts                  # 加密工具
│       └── logger.ts                      # 日志工具
│
├── 🎣 hooks/                              # React Hooks (跨组件复用逻辑)
│   ├── workspace/                         # 工作区相关hooks
│   │   ├── useWorkspace.ts                # 工作区管理
│   │   └── useSession.ts                  # 会话管理
│   ├── literature/                        # 文献相关hooks
│   │   ├── useLiterature.ts               # 文献操作
│   │   └── useZotero.ts                   # Zotero集成
│   ├── mcts/                              # MCTS相关hooks
│   │   ├── useMCTS.ts                     # MCTS执行
│   │   └── useTreeBuilder.ts              # 树构建
│   └── common/                            # 通用hooks
│       ├── useLocalStorage.ts             # 本地存储
│       └── useSSE.ts                      # SSE连接
│
├── 🌐 locales/                            # 国际化 (保持现有)
├── ⚙️ config/                             # 配置文件  
│   ├── ai-providers.ts                    # AI提供者配置
│   ├── search-engines.ts                  # 搜索引擎配置
│   └── database.ts                        # 数据库配置
├── 🛠️ utils/                              # 工具函数 (保持现有但优化)
└── 📝 types/                              # 类型定义
    ├── entities/                          # 实体类型
    ├── api/                               # API类型
    └── common.ts                          # 通用类型
```

---

## 🗂️ 层次详细说明

### 层级 1: 📱 App Router (应用入口层)
- **职责**: Next.js 15 路由管理，页面渲染，API 端点
- **特点**: 
  - 遵循 App Router 约定
  - API 路由按领域分组
  - 页面组件仅负责布局和数据获取

### 层级 2: 🧩 Domains (核心领域层)
- **职责**: 纯业务逻辑，框架无关
- **组织原则**:
  - 按核心实体划分领域
  - 每个领域内部高度内聚
  - 领域间通过接口交互

#### 领域内部结构：
```
domain/
├── entities/        # 领域实体 (数据结构 + 业务规则)
├── services/        # 领域服务 (复杂业务逻辑)
├── repositories/    # 数据访问接口 (抽象)
├── providers/       # 外部数据源适配器
└── index.ts         # 领域公开接口
```

### 层级 3: 🖥️ Components (UI展示层)
- **职责**: 纯UI渲染，响应状态变化
- **组织原则**:
  - 按页面功能分组
  - 共享组件提取到 `shared/`
  - 使用 shadcn/ui 作为基础组件库

### 层级 4: 📡 Store (状态管理层)
- **职责**: 响应式状态管理，UI数据源
- **特点**:
  - 按领域分离状态
  - 镜像领域层状态变化
  - 为UI提供响应式数据流

### 层级 5: 🔗 Infrastructure (基础设施层)
- **职责**: 外部依赖封装，技术实现细节
- **包含**:
  - 数据库适配器
  - 外部服务客户端
  - 通用工具函数

---

## 🔄 迁移映射关系

### 现有 → 新结构映射

| 现有路径 | 新路径 | 说明 |
|---------|--------|------|
| `src/libs/mcts/` | `src/domains/mcts/` | MCTS算法领域化 |
| `src/libs/db/` | `src/domains/literature/services/` | 文献服务领域化 |
| `src/components/Library/` | `src/components/pages/Library/` | 页面组件分组 |
| `src/components/Research/` | `src/components/pages/Workspace/` | 研究→工作区重命名 |
| `src/store/libraryStore.ts` | `src/store/literature/libraryStore.ts` | 状态按领域分组 |
| `src/libs/tree/` | `src/domains/tree/` | 树领域独立 |

### 新增结构

| 新路径 | 职责 | 说明 |
|-------|------|------|
| `src/domains/workspace/` | 工作区/会话管理 | 新增顶层协调者 |
| `src/domains/assets/` | 本地资料管理 | 新增资料管理领域 |
| `src/app/workspace/` | 工作区页面路由 | 新增核心页面 |
| `src/infrastructure/` | 基础设施抽象 | 新增基础设施层 |

---

## 🎯 架构优势

### 1. **高内聚低耦合**
- 每个领域独立，职责单一
- 领域间通过明确接口通信
- 业务逻辑与技术实现分离

### 2. **可测试性**
- 领域层纯函数，易于单元测试
- 依赖注入友好，便于Mock
- 每层都可独立测试

### 3. **可维护性**
- 代码组织清晰，查找定位容易
- 修改影响范围明确
- 支持渐进式重构

### 4. **可扩展性**
- 新功能可以作为新领域添加
- 现有领域可以独立演化
- 支持微服务化拆分

### 5. **开发效率**
- 明确的代码放置规则
- 减少代码重复
- 团队协作边界清晰

---

## 📋 迁移计划

### Phase 1: 基础结构搭建 (1周)
- [ ] 创建新目录结构
- [ ] 建立基础的领域接口
- [ ] 设置新的状态管理架构

### Phase 2: 领域迁移 (2-3周)
- [ ] 迁移 Literature 领域
- [ ] 迁移 MCTS 领域  
- [ ] 迁移 Tree 领域
- [ ] 新建 Workspace 领域

### Phase 3: UI重构 (1-2周)
- [ ] 重组页面组件
- [ ] 更新路由结构
- [ ] 适配新的状态管理

### Phase 4: 集成测试 (1周)
- [ ] 端到端功能测试
- [ ] 性能优化
- [ ] 文档更新

---

## 🚨 注意事项

### 迁移原则
1. **渐进式迁移**: 不破坏现有功能
2. **向后兼容**: 保持现有API接口
3. **逐步替换**: 新老代码并存期间保证稳定
4. **充分测试**: 每个迁移步骤都要测试验证

### 风险控制
- 创建feature branch进行迁移
- 保持现有代码作为fallback
- 关键路径优先级最高
- 及时回归测试

---

> 📅 **文档版本**: v1.0  
> 🔄 **最后更新**: 2025-01-30  
> 👥 **维护者**: Deep Research Team  
> 📋 **状态**: ✅ 结构重构设计完成，准备进入实施阶段