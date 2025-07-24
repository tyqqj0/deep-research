# Deep Research - MCTS驱动的动态研究工作流 (v2.0)

> **文档状态**: 设计与规划 | **最后更新**: 2025-01-04

## 1. 核心理念与高级工作流

我们旨在将现有的线性研究流程，升级为一个以 **“研究项目”** 为核心、由 **MCTS (蒙特卡洛树搜索)** 算法驱动的 **动态、可迭代、自组织的知识探索过程**。

### 1.1 核心转变
- **从“任务”到“项目”**: 每个研究都是一个可持久化、可追溯的独立项目。
- **从“列表”到“树”**: 研究成果以结构化的知识树形式呈现，展示知识的脉络。
- **从“被动”到“协同”**: 用户可以随时干预、指导和修正AI的研究路径。

### 1.2 高级工作流 (High-Level Workflow)

```mermaid
graph TD
    A[Phase 1: 确定研究方向] --> B[Phase 2: MCTS驱动的树构建];
    B --> C[Phase 3: 生成总结报告];

    subgraph A
        A1[1.1 输入初始题目] --> A2{1.2 与LLM多轮对话<br/>明确细节};
        A2 --> A3[1.3 确定最终研究方向与范围];
    end

    subgraph B
        B1[2.1 预构建<br/>(Seeding the Tree)] --> B2[2.2 边搜边扩展<br/>(Iterative Growth)];
    end

    subgraph C
        C1[3.1 基于知识树结构<br/>生成结构化报告];
    end
```

## 2. 数据层增强方案 (Data Layer)

**策略**: 在现有 `Dexie` 数据库和 `Zustand` 状态管理上进行**增量扩展**。

### 2.1 `TaskStore` -> `ProjectStore` (概念升级)
`TaskStore` 将继续作为核心状态管理器，但其内部数据结构将升级以承载完整的“研究项目”概念。

```typescript
// src/store/task.ts (增强)
export interface TaskStore {
  // --- 现有字段 ---
  id: string; // 将作为 Project ID
  question: string; // 初始题目
  // ... tasks, finalReport 等

  // --- 🆕 新增项目管理字段 ---
  finalDirection?: string;      // 最终确定的研究方向
  dialogueHistory?: Message[];  // 与LLM的对话历史
  associatedTreeId?: string;    // 关联的知识树ID
  projectStatus?: 'DIRECTION_FINDING' | 'TREE_BUILDING' | 'SYNTHESIZING' | 'COMPLETED';
}
```

### 2.2 `LibraryItem` 增加话题标签 (Topic Tagging)
为了更好地管理和关联文献，我们将为文献增加`topics`字段。

```typescript
// src/libs/db/schema.ts (增强)
export const LibraryItemSchema = z.object({
  // ... 现有字段
  topics: z.array(z.string()).optional(), // 🆕 话题/关键词标签
});

// Dexie 数据库版本升级
// 'library' 表的索引增加 *topics
// this.version(7).stores({ library: '..., *topics' });
```

### 2.3 `MCTSNode` 丰富元数据
节点不再仅仅是MCTS算法的一个单元，而是知识的载体。

```typescript
// src/libs/db/schema.ts (增强)
export const MCTSNodeSchema = z.object({
  // ... 现有字段 (id, parentId, visits, wins)
  libraryItemId: z.string().uuid(), // 关联的核心文献ID
  
  // --- 🆕 新增知识管理字段 ---
  topic: z.string().optional(),                 // 该节点代表的研究子方向
  summary: z.string().optional(),               // LLM对该节点内容的摘要
  linkedLiteratureIds: z.array(z.string()).optional(), // 关联的辅助文献ID列表
  status: z.enum(['STALE', 'EXPANDABLE', 'SEARCH_REQUIRED', 'COMPLETED']).optional(),
});
```

---

## 3. 模块化业务逻辑 (Business Logic)

我们将 **Phase 2: 树构建** 过程中的核心业务逻辑，拆分为可重用、可组合的模块。

### 3.1 树构建逻辑模块图

```mermaid
graph TD
    subgraph "TreeBuilder (主控制器)"
        direction LR
        A[Start] --> B{预构建?};
        B -- 是 --> C[InitialSeedingTask];
        B -- 否 --> D[MctsCycle];
        C --> D;
        D -- 需要搜索 --> E[SearchAndExpandTask];
        E --> D;
        D -- 扩展完成 --> F[End];
    end

    subgraph "主要逻辑模块"
      M1[InitialSeedingTask<br/>- 运行文献搜索<br/>- 调用RootNodeSelector]
      M2[RootNodeSelector<br/>- LLM分析, 确定根节点]
      M3[MctsCycle<br/>- 选择(Select)<br/>- 扩展(Expand)<br/>- 奖励(Reward)<br/>- 更新(Backpropagate)]
      M4[SearchAndExpandTask<br/>- 触发Web/DB搜索<br/>- 更新文献库]
    end

    C --> M1 & M2;
    D --> M3;
    E --> M4;
```

### 3.2 模块职责

- **`InitialSeedingTask`**: 负责树的冷启动。它执行一次性的文献搜索（基于最终研究方向），并将结果交给`RootNodeSelector`。
- **`RootNodeSelector`**: 一个纯粹的AI分析模块。接收一组文献，通过LLM分析，选出最适合作为知识树根节点的文献。
- **`MctsCycle`**: 核心的MCTS循环控制器。它不直接执行搜索，而是在“扩展”步骤中，通过调用`LLMAnalysisService`来**决策**下一步的行动（是继续利用现有知识扩展，还是触发搜索）。
- **`SearchAndExpandTask`**: 当MCTS循环决策需要搜索时被触发。它负责执行实际的搜索操作，并将新文献添加回`Library`，从而为MCTS提供新的“弹药”。这个过程可以复用现有`SearchResult.tsx`中的交互式搜索逻辑，允许用户干预。

---

## 4. 钩子与服务层设计 (Hooks & Services)

我们将上述逻辑模块映射到具体的代码实现中。

### 4.1 核心钩子 (Hooks)

- **`useResearchProject(projectId)`**: **项目级Hook**。
  - **职责**: 管理整个研究项目的状态和生命周期（从方向确定到最终总结）。
  - **实现**: 在现有`useTaskStore`基础上进行扩展，使其成为事实上的项目管理器。

- **`useTreeBuilder(projectId, treeId)`**: **树构建级Hook**。
  - **职责**: 负责编排和驱动`TreeBuilder`的各个逻辑模块，管理MCTS的循环、中断和恢复。
  - **关键交互**:
    - 调用`InitialSeedingTask`进行预构建。
    - 循环调用`MctsCycle`。
    - 当`MctsCycle`返回“需要搜索”的指令时，触发`SearchAndExpandTask`，并可以暂停MCTS循环，等待搜索结果或用户操作。这个**可中断、可恢复**的循环是实现人机协同的关键。

### 4.2 服务层 (Services)

- **`LiteratureService` (增强)**:
  - `findByTopic(topic: string)`: 新增，根据话题标签高效检索文献。
  - `batchSearchAndAdd(queries: string[])`: 新增，统一处理搜索、去重、入库的流程。

- **`TreeService` (复用)**:
  - 现有对树和节点的CRUD操作非常完善，**直接复用**。

- **`LLMAnalysisService` (新增)**:
  - `determineRootNode(...)`: 实现`RootNodeSelector`模块的逻辑。
  - `evaluateExpansionNeed(...)`: 实现`MctsCycle`中“扩展”步骤的决策逻辑。
  - `evaluateReward(...)`: 实现`MctsCycle`中“奖励”步骤的计算逻辑。

---

## 5. 实施路线图 (Roadmap)

1.  **第一阶段：数据层升级 (1周)**
    - [ ] **Task**: 扩展`TaskStore`, `LibraryItem`, `MCTSNode`的数据模型。
    - [ ] **Task**: 编写并测试`Dexie`数据库的版本升级脚本。
    - [ ] **产出**: 一个支持新业务流程的、健壮的数据底层。

2.  **第二阶段：服务与模块实现 (2周)**
    - [ ] **Task**: 增强`LiteratureService`，实现新接口。
    - [ ] **Task**: 创建`LLMAnalysisService`，封装所有AI分析逻辑。
    - [ ] **Task**: 实现`InitialSeedingTask`和`RootNodeSelector`的核心逻辑。
    - [ ] **产出**: 支撑树构建所需的所有后端和纯逻辑能力。

3.  **第三阶段：核心Hook与流程编排 (2周)**
    - [ ] **Task**: 开发`useTreeBuilder` Hook，实现可中断的MCTS循环与搜索的协同工作流。
    - [ ] **Task**: 升级`useTaskStore`为`useResearchProject`，管理项目生命周期。
    - [ ] **Task**: 增强`Topic.tsx`和对话系统，完成Phase 1。
    - [ ] **产出**: 完整的、可在后台运行的动态研究与树构建引擎。

4.  **第四阶段：UI集成与可视化 (1.5周)**
    - [ ] **Task**: 将`useTreeBuilder`的状态与现有的`TreeVisualization`组件对接。
    - [ ] **Task**: 创建新的UI界面来展示和管理人机协同的搜索与扩展过程。
    - [ ] **Task**: 优化总结报告功能，使其能理解并利用树的结构。
    - [ ] **产出**: 用户可交互、可感知的全新研究体验。 