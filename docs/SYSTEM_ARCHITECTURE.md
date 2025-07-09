# 文献管理系统详细架构

## 🔧 完整系统架构图

```mermaid
graph TB
    subgraph "Browser Environment"
        subgraph "UI Layer - React Components"
            A1[LibraryPage<br/>📄 主页面]
            A2[LiteratureList<br/>📋 文献列表]
            A3[AddLiteratureForm<br/>➕ 添加表单]
            A4[LiteratureListItem<br/>📑 文献项]
            A5[ZoteroSyncPanel<br/>🔄 同步面板]
        end
        
        subgraph "State Management - Zustand"
            B1[useLibraryStore<br/>🗂️ 文献状态]
            B2[TreeController<br/>🌳 MCTS控制器]
        end
        
        subgraph "Service Layer - Business Logic"
            C1[LibraryService<br/>📚 文献服务]
            C2[ZoteroService<br/>🔗 Zotero集成]
            C3[UUID Utils<br/>🔑 ID生成]
        end
        
        subgraph "Data Layer - Persistence"
            D1[Dexie Database<br/>🗃️ 数据库抽象]
            D2[Zod Schemas<br/>✅ 数据验证]
            D3[IndexedDB<br/>💾 浏览器存储]
        end
    end
    
    subgraph "External Services"
        E1[Zotero API<br/>🌐 外部服务]
        E2[File System<br/>📁 文件导入]
    end
    
    %% UI Layer connections
    A1 --> B1
    A2 --> B1
    A3 --> B1
    A4 --> B1
    A5 --> B1
    A5 --> C2
    
    %% State Management connections
    B1 --> C1
    B1 --> C2
    B2 --> C1
    B1 --> C3
    
    %% Service Layer connections
    C1 --> D1
    C2 --> D1
    C1 --> D2
    C2 --> D2
    C1 --> C3
    C2 --> C3
    
    %% Data Layer connections
    D1 --> D3
    D2 --> D1
    
    %% External connections
    C2 --> E1
    C1 --> E2
    
    %% Styling
    classDef ui fill:#e1f5fe,stroke:#0277bd,stroke-width:2px
    classDef state fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef service fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px
    classDef data fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef external fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    
    class A1,A2,A3,A4,A5 ui
    class B1,B2 state
    class C1,C2,C3 service
    class D1,D2,D3 data
    class E1,E2 external
```

## 🔄 数据流向详细分析

### 完整CRUD操作流程

```mermaid
graph LR
    subgraph "Create Flow"
        C1[UI Form] --> C2[Validate Input]
        C2 --> C3[Generate UUID]
        C3 --> C4[Store State]
        C4 --> C5[Service Layer]
        C5 --> C6[Zod Validation]
        C6 --> C7[Database Insert]
        C7 --> C8[Update UI]
    end
    
    subgraph "Read Flow"
        R1[UI Mount] --> R2[Store Initialize]
        R2 --> R3[Service Query]
        R3 --> R4[Database Query]
        R4 --> R5[Return Data]
        R5 --> R6[Update State]
        R6 --> R7[Render UI]
    end
    
    subgraph "Update Flow"
        U1[UI Edit] --> U2[Validate Changes]
        U2 --> U3[Store Update]
        U3 --> U4[Service Update]
        U4 --> U5[Database Update]
        U5 --> U6[Refresh State]
        U6 --> U7[Re-render]
    end
    
    subgraph "Delete Flow"
        D1[UI Delete] --> D2[Confirm Dialog]
        D2 --> D3[Store Delete]
        D3 --> D4[Service Delete]
        D4 --> D5[Database Delete]
        D5 --> D6[Remove from State]
        D6 --> D7[Update UI]
    end
```

## 🛠️ 核心功能模块

### 文献管理模块
```mermaid
graph TD
    subgraph "Literature Management"
        L1[Add Literature<br/>➕ 添加文献] --> L2[Validate Data<br/>✅ 数据验证]
        L2 --> L3[Generate ID<br/>🔑 生成UUID]
        L3 --> L4[Store in DB<br/>💾 数据库存储]
        
        L5[Edit Literature<br/>✏️ 编辑文献] --> L6[Update Fields<br/>📝 更新字段]
        L6 --> L7[Re-validate<br/>🔄 重新验证]
        L7 --> L4
        
        L8[Delete Literature<br/>🗑️ 删除文献] --> L9[Confirm Action<br/>⚠️ 确认操作]
        L9 --> L10[Remove from DB<br/>❌ 从数据库移除]
        
        L11[Search Literature<br/>🔍 搜索文献] --> L12[Filter Results<br/>📋 过滤结果]
        L12 --> L13[Display Results<br/>📊 显示结果]
    end
```

### Zotero集成模块
```mermaid
graph TD
    subgraph "Zotero Integration"
        Z1[Configure API<br/>🔧 配置API] --> Z2[Test Connection<br/>🔗 测试连接]
        Z2 --> Z3[Fetch Items<br/>📥 获取项目]
        Z3 --> Z4[Convert Format<br/>🔄 格式转换]
        Z4 --> Z5[Check Duplicates<br/>🔍 检查重复]
        Z5 --> Z6[Sync to Local<br/>💾 同步到本地]
        
        Z7[Sync Status<br/>📊 同步状态] --> Z8[Show Progress<br/>⏳ 显示进度]
        Z8 --> Z9[Handle Errors<br/>❌ 处理错误]
    end
```

## 📋 功能分层详细说明

### UI Layer (展示层)
| 组件 | 功能 | 状态 | 文件路径 |
|------|------|------|----------|
| LibraryPage | 主页面容器 | ✅ 完成 | `src/app/library/page.tsx` |
| LiteratureList | 文献列表展示 | ✅ 完成 | `src/components/Library/LiteratureList.tsx` |
| AddLiteratureForm | 添加文献表单 | ✅ 完成 | `src/components/Library/AddLiteratureForm.tsx` |
| LiteratureListItem | 单个文献项 | ✅ 完成 | `src/components/Library/LiteratureListItem.tsx` |
| ZoteroSyncPanel | Zotero同步面板 | ⚠️ 占位符 | `src/app/library/page.tsx` |

### State Management Layer (状态管理层)
| 模块 | 功能 | 状态 | 文件路径 |
|------|------|------|----------|
| useLibraryStore | 文献状态管理 | ✅ 完成 | `src/store/libraryStore.ts` |
| TreeController | MCTS树控制器 | ✅ 完成 | `src/libs/tree/TreeController.ts` |

### Service Layer (服务层)
| 服务 | 功能 | 状态 | 文件路径 |
|------|------|------|----------|
| LibraryService | 文献数据服务 | ✅ 完成 | `src/libs/db/LibraryService.ts` |
| ZoteroService | Zotero集成服务 | ⚠️ 后端完成 | `src/libs/zotero/ZoteroService.ts` |
| UUID Utils | ID生成工具 | ✅ 完成 | `src/libs/utils/uuid.ts` |

### Data Layer (数据层)
| 组件 | 功能 | 状态 | 文件路径 |
|------|------|------|----------|
| Dexie Database | 数据库抽象 | ✅ 完成 | `src/libs/db/index.ts` |
| Zod Schemas | 数据验证 | ✅ 完成 | `src/libs/db/schema.ts` |
| Data Constants | 常量定义 | ✅ 完成 | `src/libs/db/constants.ts` |

## 🎯 待完善功能清单

### 高优先级 (P0)
- [ ] 文献去重机制
- [ ] 翻页功能实现
- [ ] Zotero配置UI

### 中优先级 (P1)
- [ ] 会话绑定完善
- [ ] 批量操作完整实现
- [ ] 性能优化

### 低优先级 (P2)
- [ ] 高级搜索
- [ ] 导出功能
- [ ] 离线同步

---

**架构版本**: v1.0  
**最后更新**: 2024-01-XX  
**维护团队**: Development Team