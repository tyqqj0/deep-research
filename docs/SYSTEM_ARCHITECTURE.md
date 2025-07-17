# 文献管理系统详细架构 (v2.0)

## 🔧 完整系统架构图

> **版本: v2.0** | **最后更新**: 2024-07-12
>
> **核心变化**:
> - 引入了 `GlobalCitationGraph` 作为核心UI功能。
> - 添加了 `LibraryWorkflowService` 来编排复杂任务。
> - Zotero前端实现已远超初期设计。

```mermaid
graph TB
    subgraph "Browser Environment"
        subgraph "UI Layer - React Components"
            A1[LibraryPage<br/>📄 主页面容器]
            A2[LiteratureList<br/>📋 文献列表]
            A3[Add/Edit Forms<br/>➕ 编辑表单]
            A4[GlobalCitationGraph<br/>🌐 全局知识图谱]
            A5[ZoteroImportSection<br/>🔄 Zotero导入面板]
            A6[PdfUploadDialog<br/>📤 PDF上传对话框]
        end
        
        subgraph "State Management - Zustand"
            B1[useLibraryStore<br/>🗂️ 文献状态中心]
        end
        
        subgraph "Service Layer - Business Logic"
            C1[LibraryWorkflowService<br/>🚀 工作流服务]
            C2[LibraryService<br/>📚 文献基础服务]
            C3[ZoteroService<br/>🔗 Zotero集成]
            C4[MineruService<br/>🔬 PDF解析服务]
        end
        
        subgraph "Data Layer - Persistence"
            D1[Dexie Database<br/>🗃️ 数据库抽象]
            D2[Zod Schemas<br/>✅ 数据验证]
            D3[IndexedDB<br/>💾 浏览器存储]
        end
    end
    
    subgraph "External Services"
        E1[Zotero API<br/>🌐 外部文献服务]
        E2[Mineru API<br/>🤖 AI PDF 解析服务]
        E3[File System<br/>📁 文件系统]
    end
    
    %% UI Layer connections
    A1 --> A2 & A3 & A4 & A5 & A6
    A1 --> B1
    A4 -- direct call --> C2
    A5 -- user action --> B1
    
    %% State Management connections
    B1 --> C1 & C2 & C3
    
    %% Service Layer connections
    C1 --> C2 & C4
    C2 --> D1
    C3 --> D1
    C3 --> E1
    C4 --> E2
    
    %% Data Layer connections
    D1 --> D3
    D2 --> D1
    
    %% External connections
    C2 --> E3
    
    %% Styling
    classDef ui fill:#e1f5fe,stroke:#0277bd,stroke-width:2px
    classDef state fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef service fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px
    classDef data fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef external fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    
    class A1,A2,A3,A4,A5,A6 ui
    class B1 state
    class C1,C2,C3,C4 service
    class D1,D2,D3 data
    class E1,E2,E3 external
```

## 🛠️ 核心功能模块分析

### 引文网络图模块 (Citation Graph)

> 这是一个技术实现非常复杂和完善的核心功能，使用了 `React Flow` 库并集成了自定义物理引擎。

```mermaid
graph TD
    subgraph "Citation Graph Module (React Flow)"
        CG1[GlobalCitationGraph<br/>📊 图谱容器] --> CG2{useNodesState, useEdgesState<br/>🖼️ 管理节点/边}
        CG1 --> CG3[fetchDataAndLayout<br/>🔄 数据获取与布局]
        CG3 -->|items, citations| S1[LibraryService<br/>📚 文献服务]
        
        CG2 --> CG4[AdaptiveNode<br/>🎭 自适应节点]
        CG4 --> CG5[ViewportMonitor<br/>🔍 监听缩放]
        CG5 -- "zoom < threshold" --> CG6[Simplified View<br/>⚪️ 简化视图]
        CG5 -- "zoom >= threshold" --> CG7[Detailed View<br/>🃏 详细视图]
        
        CG1 --> CG8[CitationGraphPhysics<br/>⚙️ 物理引擎]
        CG8 -- "onTick()" --> CG2
        
        CG1 --> CG9[User Interactions<br/>🖱️ 用户交互]
        CG9 -- "onConnect()" --> B1[useLibraryStore<br/>(createManualCitationLink)]
        CG9 -- "onEdgeContextMenu()" --> S1
    end
```

### Zotero集成模块 (Frontend)

> 前端Zotero集成已具备完整的登录、同步和多文献库管理功能。

```mermaid
graph TD
    subgraph "Zotero Integration (Frontend)"
        Z1[User Clicks Sync<br/>🖱️ 用户点击同步] --> Z2[ZoteroLogin Modal<br/>🔑 登录模态框]
        Z2 -- "API Key" --> Z3[useLibraryStore<br/>(configureZotero)]
        Z3 --> S1[ZoteroService<br/>🔗 服务层]
        S1 --> E1[Zotero API]
        S1 --> Z4[Cache UserInfo<br/>缓存用户信息]
        Z2 -- "onLoginSuccess()" --> P1[LibraryPage<br/>📄 主页面]

        P1 --> Z5[ZoteroImportSection<br/>🔄 导入面板]
        Z5 -- "Sync Items" --> Z6[useLibraryStore<br/>(syncWithZotero)]
        Z6 --> S1
        S1 -- "fetches items" --> E1
        S1 -- "compares & adds" --> DB[LibraryService<br/>📚 本地数据库]
        DB -- "liveQuery" --> Z7[UI Refresh<br/>🟢 UI自动刷新]
    end
```

### 文献管理模块
```mermaid
graph TD
    subgraph "Literature Management"
        L1[Add/Edit Literature<br/>➕ 编辑文献] --> L2[Validate Data<br/>✅ Zod验证]
        L2 --> L3[LibraryWorkflowService<br/>🚀 工作流处理]
        L3 --> L4[Store in DB<br/>💾 数据库存储]
        L4 -- "liveQuery" --> L5[Update UI<br/>🔄 UI自动更新]
        
        L8[Delete Literature<br/>🗑️ 删除文献] --> L9[Confirm Action<br/>⚠️ 确认操作]
        L9 --> L10[Remove from DB<br/>❌ 从数据库移除]
        L10 -- "liveQuery" --> L5
    end
```

## 📋 功能分层详细说明

### UI Layer (展示层)
| 组件                | 功能                | 状态         | 文件路径                                         |
| ------------------- | ------------------- | ------------ | ------------------------------------------------ |
| LibraryPage         | 主页面容器          | 🟡 **待重构** | `src/app/library/page.tsx`                       |
| LiteratureList      | 文献列表展示        | ✅ 完成       | `src/components/Library/LiteratureList.tsx`      |
| Add/Edit Forms      | 添加/编辑表单       | ✅ 完成       | `src/components/Library/*Form.tsx`               |
| GlobalCitationGraph | 全局引文网络图      | ✅ 完成       | `src/components/Library/CitationGraph.tsx`       |
| ZoteroImportSection | Zotero导入/同步面板 | ✅ 完成       | `src/components/Library/ZoteroImportSection.tsx` |
| ZoteroLogin         | Zotero登录模态框    | ✅ 完成       | `src/components/Library/ZoteroLogin.tsx`         |
| PdfUploadDialog     | PDF上传对话框       | ✅ 完成       | `src/components/Library/PdfUploadDialog.tsx`     |

### State Management Layer (状态管理层)
| 模块            | 功能             | 状态   | 文件路径                    |
| --------------- | ---------------- | ------ | --------------------------- |
| useLibraryStore | 文献状态管理中心 | ✅ 完成 | `src/store/libraryStore.ts` |

### Service Layer (服务层)
| 服务                   | 功能             | 状态   | 文件路径                                     |
| ---------------------- | ---------------- | ------ | -------------------------------------------- |
| LibraryWorkflowService | 复杂工作流编排   | ✅ 完成 | `src/libs/library/LibraryWorkflowService.ts` |
| LibraryService         | 核心文献数据服务 | ✅ 完成 | `src/libs/db/LibraryService.ts`              |
| ZoteroService          | Zotero集成服务   | ✅ 完成 | `src/libs/zotero/ZoteroService.ts`           |
| MineruService          | AI解析服务       | ✅ 完成 | `src/libs/parsing/MineruService.ts`          |
| ParsingService         | 解析数据映射     | ✅ 完成 | `src/libs/parsing/ParsingService.ts`         |

### Data Layer (数据层)
| 组件           | 功能                   | 状态   | 文件路径                |
| -------------- | ---------------------- | ------ | ----------------------- |
| Dexie Database | 数据库抽象 (IndexedDB) | ✅ 完成 | `src/libs/db/index.ts`  |
| Zod Schemas    | 数据模型与验证         | ✅ 完成 | `src/libs/db/schema.ts` |

## 🚀 架构优化与待办事项

### 🎯 架构优化规划 (高优先级)
- **[ ] 重构 `LibraryPage.tsx` 组件**:
    - **目标**: 将其从一个臃肿的“上帝组件”转变为一个纯粹的UI布局容器。
    - **步骤1**: 创建 `useZotero.ts` 自定义Hook，将所有Zotero相关的状态逻辑 (`useState`, `useEffect`) 从 `LibraryPage` 移入该Hook。
    - **步骤2**: 在 `LibraryPage` 中使用 `const { ... } = useZotero()` 来获取数据和方法，简化组件内部实现。
- **[ ] 完善 `useLibraryStore`**:
    - **目标**: 确保所有对数据库的写操作都通过 `store` 的 `actions` 进行，而不是从UI组件直接调用 `service`。
    - **步骤**: 将 `CitationGraph.tsx` 中直接调用 `libraryService.deleteCitationLink` 的逻辑移入 `useLibraryStore`，创建一个 `deleteCitationLink` 的 `action`。

### ⏳ 功能待办清单
- [ ] **文献去重机制**: 在导入新文献时，提供更智能的重复检测和合并建议。
- [ ] **高级搜索与过滤**: 实现基于作者、年份、标签等多维度的搜索。
- [ ] **文献树 (`TreeController`) UI实现**: 为`MCTS`文献树功能提供前端交互界面。
- [ ] **批量操作**: 完善批量删除、批量添加到文献树等功能。
- [ ] **导出功能**: 实现将文献库或特定文献导出为常见格式（如BibTeX）。
- [ ] **全局设置持久化**: 将 `autoExtractMetadata` 等设置存储到数据库，而非`localStorage`。