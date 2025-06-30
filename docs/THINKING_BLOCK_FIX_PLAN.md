# Thinking Block 修复计划

## 修复策略概述

采用渐进式、可验证的修复方法，确保每个步骤都可以独立验证和回滚。

## 阶段1: 问题诊断和验证 ✅
**目标**: 确认问题的真实性和根本原因
**已完成**:
- [x] 创建诊断工具 (`debug-thinking-block.ts`)
- [x] 添加开发环境调试信息
- [x] 制定验证场景文档

**验证方法**:
```bash
# 启动开发环境，观察console输出
pnpm dev
# 查看浏览器控制台的 [THINKING_BLOCK_DEBUG] 输出
```

## 阶段2: 最小化修复
**目标**: 只修复核心问题，不改变整体架构
**计划修改**:

### 2.1 修复isThinkingDeeper逻辑 (高优先级)
```typescript
// 当前问题代码
const isThinkingDeeper = useMemo(() => {
  return isThinking && !tasks.some(t => t.type === 'thinking' && t.depth > 0);
}, [isThinking, tasks]);

// 建议修复
const isThinkingDeeper = useMemo(() => {
  return researchStatus === "deeper-research";
}, [researchStatus]);
```

**验证**: 深度研究时UI显示应该正确

### 2.2 添加ThinkingTask状态字段 (中优先级)
```typescript
// 在types.d.ts中修改
interface ThinkingTask {
  id: string;
  type: "thinking";
  depth: number;
  title: string;
  reasoning: string;
  state?: "processing" | "completed"; // 新增
}
```

**验证**: thinking block应该能显示处理状态

### 2.3 实现thinking过程实时更新 (中优先级)
在`runDeeperResearch`中添加实时更新逻辑

**验证**: 应该能看到AI思考的实时过程

## 阶段3: UI交互完善
**目标**: 让thinking block与search block功能对等

### 3.1 添加thinking block的操作按钮
- 删除按钮
- 重新生成按钮 
- 编辑按钮

### 3.2 实现中断机制
- 为thinking过程添加取消功能
- 状态清理逻辑

## 阶段4: 测试和优化
**目标**: 确保修复没有引入新问题

### 4.1 单元测试
### 4.2 集成测试  
### 4.3 性能优化

## 回滚策略

每个阶段都创建独立的commit，可以精确回滚：

```bash
# 查看修改历史
git log --oneline

# 回滚到特定commit
git reset --hard <commit-hash>

# 或者回滚特定文件
git checkout <commit-hash> -- <file-path>
```

## 风险评估

### 低风险修改
- ✅ 添加诊断工具 (不影响生产逻辑)
- ⚠️ 修复isThinkingDeeper逻辑 (影响UI显示)

### 中风险修改  
- ⚠️ 修改ThinkingTask接口 (可能影响现有数据)
- ⚠️ 修改runDeeperResearch流程 (核心业务逻辑)

### 高风险修改
- 🔴 重构状态管理架构 (暂不考虑)

## 验证清单

每个阶段完成后必须验证：

- [ ] 现有功能正常工作
- [ ] 新功能按预期工作  
- [ ] 没有console错误
- [ ] 没有TypeScript错误
- [ ] 没有明显的性能问题
- [ ] 状态管理一致性良好

## 下一步行动

1. **立即执行**: 运行诊断工具，收集实际问题数据
2. **今天完成**: 阶段2.1的最小化修复
3. **明天计划**: 根据诊断结果决定是否继续后续阶段