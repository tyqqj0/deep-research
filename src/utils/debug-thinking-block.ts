// 诊断工具：用于分析thinking block的问题
export function debugThinkingBlockState(
  tasks: any[],
  researchStatus: string,
  isThinking: boolean,
  currentDepth: number
) {
  console.group('[THINKING_BLOCK_DEBUG] Current State Analysis');
  
  // 1. 分析任务结构
  console.log('=== TASK ANALYSIS ===');
  console.log('Total tasks:', tasks.length);
  
  const thinkingTasks = tasks.filter(t => t.type === 'thinking');
  const searchTasks = tasks.filter(t => t.type === 'search');
  
  console.log('Thinking tasks:', thinkingTasks.length);
  console.log('Search tasks:', searchTasks.length);
  
  // 2. 分析深度分布
  console.log('=== DEPTH ANALYSIS ===');
  const depthDistribution = tasks.reduce((acc, task) => {
    const depth = task.depth || 0;
    acc[depth] = (acc[depth] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  console.log('Depth distribution:', depthDistribution);
  console.log('Current depth:', currentDepth);
  
  // 3. 分析状态
  console.log('=== STATE ANALYSIS ===');
  console.log('Research status:', researchStatus);
  console.log('Is thinking:', isThinking);
  
  const searchStates = searchTasks.reduce((acc, task) => {
    acc[task.state] = (acc[task.state] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('Search task states:', searchStates);
  
  // 4. 问题检测
  console.log('=== PROBLEM DETECTION ===');
  
  // 检测是否有orphaned thinking tasks
  const orphanedThinking = thinkingTasks.filter(t => 
    !searchTasks.some(s => s.depth === t.depth)
  );
  if (orphanedThinking.length > 0) {
    console.warn('Found orphaned thinking tasks:', orphanedThinking);
  }
  
  // 检测状态不一致
  if (researchStatus === 'deeper-research' && !isThinking) {
    console.warn('State inconsistency: researchStatus=deeper-research but isThinking=false');
  }
  
  // 检测incomplete depths
  const incompleteDepths = Object.keys(depthDistribution).filter(depth => {
    const tasksAtDepth = tasks.filter(t => (t.depth || 0) == parseInt(depth));
    const thinking = tasksAtDepth.filter(t => t.type === 'thinking');
    const search = tasksAtDepth.filter(t => t.type === 'search');
    return thinking.length > 0 && search.every(s => s.state !== 'completed');
  });
  
  if (incompleteDepths.length > 0) {
    console.warn('Incomplete depths found:', incompleteDepths);
  }
  
  console.groupEnd();
  
  return {
    thinkingTasks,
    searchTasks,
    depthDistribution,
    orphanedThinking,
    incompleteDepths,
    stateConsistent: !(researchStatus === 'deeper-research' && !isThinking)
  };
}