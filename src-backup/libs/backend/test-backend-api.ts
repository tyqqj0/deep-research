/**
 * 🧪 后端API测试文件
 * 
 * 用于测试后端文献解析服务的各种功能：
 * 1. DOI/URL提交测试
 * 2. PDF文件上传测试
 * 3. 任务状态轮询测试
 * 4. 最终数据获取测试
 * 
 * 使用方法：
 * 1. 确保后端服务运行在 http://localhost:8000
 * 2. 在浏览器控制台中运行相应的测试函数
 * 3. 观察状态变化和数据流转
 */

import { backendLiteratureService, syncService } from './index';

// 测试用的DOI和URL
const TEST_CASES = {
  // 测试DOI - 一个经典的机器学习论文
  doi: '10.1038/nature14539',
  
  // 测试URL - arXiv论文
  url: 'https://arxiv.org/abs/1706.03762',
  
  // 测试PDF URL - 直接PDF链接
  pdfUrl: 'https://arxiv.org/pdf/1706.03762.pdf'
};

/**
 * 🧪 测试1: DOI提交和状态轮询
 */
export async function testDoiSubmission() {
  console.log('🧪 [Test 1] Testing DOI submission and polling...');
  
  try {
    // 1. 提交DOI
    console.log(`📤 Submitting DOI: ${TEST_CASES.doi}`);
    const response = await backendLiteratureService.submitLiterature({
      source: { doi: TEST_CASES.doi }
    });
    
    console.log('✅ Task submitted:', response);
    const { taskId } = response;
    
    // 2. 手动轮询几次状态
    console.log('🔄 Starting manual status polling...');
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
      
      const status = await backendLiteratureService.getTaskStatus(taskId);
      console.log(`📊 [Poll ${i + 1}] Status:`, {
        overall_status: status.overall_status,
        metadata: status.components.metadata.status,
        content: status.components.content.status,
        references: status.components.references.status
      });
      
      // 如果完成了，获取最终数据
      if (status.overall_status === 'success' || status.overall_status === 'partial_success') {
        if (status.literature_id) {
          console.log('🎉 Task completed! Fetching final data...');
          const literature = await backendLiteratureService.getLiterature(status.literature_id);
          console.log('📚 Final literature data:', {
            title: literature.metadata.title,
            authors: literature.metadata.authors.map(a => a.name),
            year: literature.metadata.year,
            references_count: literature.references.length
          });
        }
        break;
      }
      
      if (status.overall_status === 'failed') {
        console.error('❌ Task failed:', status.error_info);
        break;
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * 🧪 测试2: URL提交测试
 */
export async function testUrlSubmission() {
  console.log('🧪 [Test 2] Testing URL submission...');
  
  try {
    console.log(`📤 Submitting URL: ${TEST_CASES.url}`);
    const response = await backendLiteratureService.submitLiterature({
      source: { url: TEST_CASES.url }
    });
    
    console.log('✅ URL task submitted:', response);
    return response.taskId;
    
  } catch (error) {
    console.error('❌ URL submission failed:', error);
    throw error;
  }
}

/**
 * 🧪 测试3: 自动状态同步测试
 */
export async function testAutoSync() {
  console.log('🧪 [Test 3] Testing automatic sync service...');
  
  try {
    // 提交一个任务
    const response = await backendLiteratureService.submitLiterature({
      source: { doi: TEST_CASES.doi }
    });
    
    console.log('✅ Task submitted for auto sync:', response);
    
    // 使用SyncService进行自动轮询
    const mockItemId = 'test-item-' + Date.now();
    
    syncService.startPolling(
      response.taskId,
      mockItemId,
      // 进度回调
      (progress) => {
        console.log('📈 Progress update:', {
          taskId: progress.taskId,
          overall_status: progress.overall_status,
          components: {
            metadata: progress.components.metadata.status,
            content: progress.components.content.status,
            references: progress.components.references.status
          }
        });
      },
      // 错误回调
      (error) => {
        console.error('❌ Sync error:', error);
      }
    );
    
    console.log('🔄 Auto sync started. Check console for progress updates...');
    
    // 10分钟后停止轮询（如果还在进行）
    setTimeout(() => {
      syncService.stopPolling(response.taskId);
      console.log('⏹️ Auto sync stopped after 10 minutes');
    }, 600000);
    
  } catch (error) {
    console.error('❌ Auto sync test failed:', error);
  }
}

/**
 * 🧪 测试4: PDF文件上传测试（模拟）
 */
export async function testPdfUpload() {
  console.log('🧪 [Test 4] Testing PDF file upload...');
  
  try {
    // 创建一个模拟的PDF文件
    const mockPdfContent = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2D, // %PDF-
      // ... 这里应该是真实的PDF内容，现在用模拟数据
    ]);
    
    const mockPdfBlob = new Blob([mockPdfContent], { type: 'application/pdf' });
    const mockPdfFile = new File([mockPdfBlob], 'test-paper.pdf', { type: 'application/pdf' });
    
    console.log('📤 Uploading mock PDF file...');
    const response = await backendLiteratureService.submitPdfFile(mockPdfFile, {
      title: 'Test Paper Upload',
      authors: ['Test Author']
    });
    
    console.log('✅ PDF upload task submitted:', response);
    return response.taskId;
    
  } catch (error) {
    console.error('❌ PDF upload test failed:', error);
    console.log('💡 This might be expected if the backend doesn\'t support PDF upload yet');
  }
}

/**
 * 🧪 测试5: 错误处理测试
 */
export async function testErrorHandling() {
  console.log('🧪 [Test 5] Testing error handling...');
  
  try {
    // 测试无效的DOI
    console.log('📤 Testing invalid DOI...');
    await backendLiteratureService.submitLiterature({
      source: { doi: 'invalid-doi-12345' }
    });
    
  } catch (error) {
    console.log('✅ Invalid DOI error handled correctly:', error.message);
  }
  
  try {
    // 测试无效的任务ID
    console.log('📤 Testing invalid task ID...');
    await backendLiteratureService.getTaskStatus('invalid-task-id');
    
  } catch (error) {
    console.log('✅ Invalid task ID error handled correctly:', error.message);
  }
  
  try {
    // 测试无效的文献ID
    console.log('📤 Testing invalid literature ID...');
    await backendLiteratureService.getLiterature('invalid-literature-id');
    
  } catch (error) {
    console.log('✅ Invalid literature ID error handled correctly:', error.message);
  }
}

/**
 * 🧪 运行所有测试
 */
export async function runAllTests() {
  console.log('🚀 Running all backend API tests...');
  console.log('⚠️  Make sure backend server is running at http://localhost:8000');
  
  try {
    await testDoiSubmission();
    await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒
    
    await testUrlSubmission();
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await testPdfUpload();
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await testErrorHandling();
    
    console.log('🎉 All tests completed!');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// 导出测试函数供控制台使用
if (typeof window !== 'undefined') {
  (window as any).backendTests = {
    testDoiSubmission,
    testUrlSubmission,
    testAutoSync,
    testPdfUpload,
    testErrorHandling,
    runAllTests,
    // 也导出服务实例供直接测试
    backendService: backendLiteratureService,
    syncService: syncService
  };
  
  console.log('🧪 Backend tests loaded! Use window.backendTests to run tests:');
  console.log('  - backendTests.testDoiSubmission()');
  console.log('  - backendTests.testUrlSubmission()');
  console.log('  - backendTests.testAutoSync()');
  console.log('  - backendTests.testPdfUpload()');
  console.log('  - backendTests.runAllTests()');
}
