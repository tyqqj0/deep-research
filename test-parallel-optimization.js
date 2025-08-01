#!/usr/bin/env node

/**
 * 🚀 并行化优化测试
 * 
 * 测试新的 p-limit 并行处理逻辑：
 * 1. 验证真正的并行处理（非批次串行）
 * 2. 测试并发控制是否正常工作
 * 3. 确认性能提升效果
 */

console.log('🚀 Testing parallel optimization with p-limit...\n');

// 模拟 p-limit 的行为
const { default: pLimit } = require('p-limit');

// 模拟文献数据
const mockLiteratureData = Array.from({ length: 15 }, (_, i) => ({
  title: `Test Paper ${i + 1}`,
  authors: ['Test Author'],
  year: 2025,
  url: `https://example.com/paper-${i + 1}.pdf`,
  source: 'import'
}));

// 模拟 masterAddLiterature 方法（带随机延迟）
async function mockMasterAddLiterature(itemData) {
  const delay = Math.random() * 2000 + 500; // 0.5-2.5秒随机延迟
  const startTime = Date.now();
  
  console.log(`📤 [${new Date().toISOString().slice(11, 23)}] Starting: ${itemData.title}`);
  
  await new Promise(resolve => setTimeout(resolve, delay));
  
  const endTime = Date.now();
  console.log(`✅ [${new Date().toISOString().slice(11, 23)}] Completed: ${itemData.title} (${endTime - startTime}ms)`);
  
  return {
    success: true,
    title: itemData.title,
    processingTime: endTime - startTime
  };
}

// 测试旧的批次串行方法
async function testBatchSerial(itemsData) {
  console.log('🔄 Testing OLD batch serial method...');
  const startTime = Date.now();
  
  const CONCURRENT_LIMIT = 5;
  const batches = [];
  
  // 分批处理
  for (let i = 0; i < itemsData.length; i += CONCURRENT_LIMIT) {
    const batch = itemsData.slice(i, i + CONCURRENT_LIMIT);
    batches.push(batch);
  }
  
  const results = [];
  
  // 批次间串行，批次内并行
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} items)`);
    
    const batchPromises = batch.map(itemData => mockMasterAddLiterature(itemData));
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach(result => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    });
    
    console.log(`✅ Batch ${batchIndex + 1} completed\n`);
  }
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  console.log(`🎯 OLD method completed in: ${totalTime}ms\n`);
  return { results, totalTime };
}

// 测试新的 p-limit 并行方法
async function testPLimitParallel(itemsData) {
  console.log('🚀 Testing NEW p-limit parallel method...');
  const startTime = Date.now();
  
  const CONCURRENT_LIMIT = 5;
  const limit = pLimit(CONCURRENT_LIMIT);
  
  // 使用 p-limit 实现真正的并行处理
  const allPromises = itemsData.map((itemData, index) => 
    limit(async () => {
      return await mockMasterAddLiterature(itemData);
    })
  );
  
  // 等待所有任务完成（真正并行，无批次等待）
  const allResults = await Promise.allSettled(allPromises);
  
  const results = [];
  allResults.forEach(result => {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    }
  });
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  console.log(`🎯 NEW method completed in: ${totalTime}ms\n`);
  return { results, totalTime };
}

// 运行对比测试
async function runComparison() {
  console.log(`📊 Testing with ${mockLiteratureData.length} literature items...\n`);
  
  // 测试旧方法
  const oldResult = await testBatchSerial([...mockLiteratureData]);
  
  console.log('─'.repeat(60));
  
  // 测试新方法
  const newResult = await testPLimitParallel([...mockLiteratureData]);
  
  console.log('─'.repeat(60));
  
  // 性能对比
  const improvement = ((oldResult.totalTime - newResult.totalTime) / oldResult.totalTime * 100).toFixed(1);
  
  console.log('📈 PERFORMANCE COMPARISON:');
  console.log(`   Old batch serial method: ${oldResult.totalTime}ms`);
  console.log(`   New p-limit parallel method: ${newResult.totalTime}ms`);
  console.log(`   Performance improvement: ${improvement}% faster`);
  console.log(`   Success rate: ${newResult.results.length}/${mockLiteratureData.length} items`);
  
  if (improvement > 0) {
    console.log('\n✅ Optimization successful! 🚀');
  } else {
    console.log('\n⚠️ No significant improvement detected');
  }
}

// 运行测试
runComparison().catch(console.error);
