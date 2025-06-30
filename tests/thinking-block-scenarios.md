# Thinking Block 问题验证场景

## 测试场景 1: 基础深度搜索流程
**目标**: 验证正常的深度搜索流程是否工作
**步骤**:
1. 启动应用并完成初始搜索
2. 点击"深度研究"按钮
3. 观察thinking block是否出现
4. 观察thinking过程是否实时显示
5. 观察search tasks是否正确生成和执行

**期望结果**:
- thinking block应该实时显示AI思考过程
- thinking完成后应该生成对应的search tasks
- 整个过程应该可以被中断

## 测试场景 2: isThinkingDeeper 逻辑验证
**目标**: 验证UI状态显示是否正确
**步骤**:
1. 检查researchStatus和isThinking状态
2. 验证isThinkingDeeper的计算逻辑
3. 对比实际UI显示与状态值

**期望结果**:
- 当深度研究进行时，应该显示"Deeper Research in Progress"
- 状态值应该与UI显示一致

## 测试场景 3: 状态恢复和持久化
**目标**: 验证页面刷新后状态是否正确恢复
**步骤**:
1. 启动深度研究
2. 在thinking过程中刷新页面
3. 观察状态是否正确恢复

**期望结果**:
- thinking tasks应该正确恢复
- 不应该有状态不一致

## 测试场景 4: 错误处理
**目标**: 验证异常情况的处理
**步骤**:
1. 模拟AI请求失败
2. 模拟网络中断
3. 观察错误状态处理

**期望结果**:
- 应该有合适的错误提示
- 状态应该正确重置
- 不应该留下僵尸状态

## 自动化验证点

### 状态一致性检查
```typescript
function validateThinkingBlockConsistency(state) {
  const checks = [];
  
  // 检查1: thinking tasks必须有对应的depth
  const orphanedThinking = state.thinkingTasks.filter(t => 
    !state.searchTasks.some(s => s.depth === t.depth)
  );
  checks.push({
    name: 'no-orphaned-thinking',
    passed: orphanedThinking.length === 0,
    details: orphanedThinking
  });
  
  // 检查2: 深度研究状态一致性
  checks.push({
    name: 'research-status-consistency',
    passed: !(state.researchStatus === 'deeper-research' && !state.isThinking),
    details: { researchStatus: state.researchStatus, isThinking: state.isThinking }
  });
  
  return checks;
}
```

### 性能检查
- thinking block渲染性能
- 大量tasks时的UI响应性
- 内存泄漏检查

### UI交互检查
- thinking block展开/折叠
- 实时内容更新
- 中断功能
- 编辑功能