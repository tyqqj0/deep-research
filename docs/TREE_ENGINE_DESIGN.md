# 🌳 树构建引擎架构设计

## 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│                    UI Layer (View)                         │
│  TreeVisualization.tsx  │  MCTSControlPanel.tsx            │
│  完全"无脑"，根据状态渲染                                        │
└─────────────────────────────────────────────────────────────┘
                            ↕️ 状态订阅
┌─────────────────────────────────────────────────────────────┐
│              State Management Layer                         │
│  TreeBuilderStore.ts  │  TreeService.ts  │  useTreeBuilder  │
│  唯一数据源，调用算法，驱动UI更新                                  │
└─────────────────────────────────────────────────────────────┘
                            ↕️ 算法调用
┌─────────────────────────────────────────────────────────────┐
│                Algorithm Engine Layer                       │
│  SGMCTSController.ts  │  AlgorithmFactory.ts               │
│  无状态算法执行，通过状态层汇报结果                                │
└─────────────────────────────────────────────────────────────┘
```

## 目录结构

### 现有结构
```
src/libs/mcts/
├── SGMCTSController.ts         # 主控制器
├── algorithms/
│   ├── interfaces.ts           # 算法接口定义
│   ├── AlgorithmFactory.ts     # 算法工厂
│   └── DefaultAlgorithms.ts    # 默认实现
```

### 重构后结构
```
src/libs/mcts/
├── SGMCTSController.ts         # 主控制器
├── algorithms/
│   ├── interfaces.ts           # 核心接口
│   ├── AlgorithmFactory.ts     # 工厂管理
│   ├── DefaultAlgorithms.ts    # 默认实现
│   └── modules/                # 🆕 细粒度模块
│       ├── Locator.ts          # 1. 定位模块
│       ├── Expander.ts         # 2. 扩展模块
│       │   ├── Thinker.ts      #    2.1 思考子模块 (LLM)
│       │   ├── Formulator.ts   #    2.2 表述子模块 (LLM)
│       │   └── Citer.ts        #    2.3 引用子模块 (LLM/NLI)
│       ├── Validator.ts        # 3. 验证模块
│       └── RewardCalculator.ts # 4. 奖励计算模块
```

## 单步MCTS流程

```typescript
// 1. 定位节点
const selectedNode = await locator.selectBestNode(candidates);

// 2. 扩展
const expansionResult = await expander.expand(selectedNode, {
  // 2.1 思考
  directions: await thinker.generateDirections(selectedNode),
  // 2.2 表述  
  descriptions: await formulator.summarize(directions),
  // 2.3 引用
  citations: await citer.findRelevant(descriptions),
  // 2.4 验证
  validation: await validator.validate(expansionResult)
});

// 3. 奖励计算
const reward = await rewardCalculator.calculate(expansionResult);

// 4. 更新参数
await updateTreeStatistics(selectedNode, reward);
```

## 关键接口

```typescript
// 核心模块接口
interface Locator {
  selectBestNode(candidates: MCTSNode[]): Promise<MCTSNode>;
}

interface Thinker {
  generateDirections(node: MCTSNode): Promise<ResearchDirection[]>;
}

interface Formulator {
  summarize(directions: ResearchDirection[]): Promise<string[]>;
}

interface Citer {
  findRelevant(queries: string[]): Promise<LibraryItem[]>;
}

interface Validator {
  validate(expansion: ExpansionResult): Promise<ValidationResult>;
}

interface RewardCalculator {
  calculate(result: IterationResult): Promise<number>;
}
```

## 数据流

```
TreeBuilderStore → SGMCTSController → ModuleChain → TreeBuilderStore → UI
     ⬇️                ⬇️                ⬇️                ⬇️           ⬇️
  [调用算法]        [执行MCTS]      [TVC流程]        [状态更新]    [UI刷新]
```

## 可插拔性

```typescript
// 算法可运行时替换
const factory = new AlgorithmFactory();
factory.register('thinker', 'gpt4', GPT4Thinker);
factory.register('thinker', 'claude', ClaudeThinker);
factory.register('citer', 'llm', LLMCiter);
factory.register('citer', 'nli', NLICiter);

// 配置驱动切换
const config = {
  thinker: 'gpt4',
  citer: 'nli',  // 从LLM升级到NLI模型
  formulator: 'claude'
};
```

## 实时UI反馈

```typescript
// 每个算法步骤更新状态
await treeBuilderStore.updateBuildingStatus('正在思考扩展方向...');
await treeBuilderStore.updateBuildingStatus('正在生成文献引用...');
await treeBuilderStore.updateBuildingStatus('正在验证扩展有效性...');

// UI自动响应状态变化
const buildingStatus = useTreeBuilderStore(state => state.buildingStatus);
const currentIteration = useTreeBuilderStore(state => state.currentIteration);
```

## 实现优先级

1. **Phase 1**: 提取现有`NodeExpander`为独立的TVC模块链
2. **Phase 2**: 实现`Thinker`→`Formulator`→`Citer`流程  
3. **Phase 3**: 添加`Validator`验证层
4. **Phase 4**: 优化实时状态更新和UI反馈