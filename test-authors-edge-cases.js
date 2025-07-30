#!/usr/bin/env node

/**
 * 🔧 Authors边缘情况测试
 * 
 * 测试可能导致"At least one author is required"错误的边缘情况：
 * 1. API返回的各种异常authors格式
 * 2. 完整的数据转换流程
 * 3. 验证最终数据结构
 */

console.log('🔧 Testing authors edge cases that could cause validation errors...\n');

// 模拟可能导致问题的API响应
const problematicApiResponses = [
  {
    name: 'API returns authors as empty array',
    response: {
      id: "lit_001",
      title: "Test Paper",
      metadata: {
        title: "Test Paper Enhanced",
        authors: [], // 空数组
        year: 2024
      },
      authors: [], // 这里也是空数组
      references: []
    }
  },
  
  {
    name: 'API returns authors with all invalid entries',
    response: {
      id: "lit_002", 
      title: "Test Paper 2",
      metadata: {
        title: "Test Paper 2 Enhanced",
        authors: [
          { name: "" },     // 空字符串
          { name: null },   // null
          { name: undefined }, // undefined
          { },              // 空对象
          null              // null元素
        ],
        year: 2024
      },
      references: []
    }
  },
  
  {
    name: 'API returns no authors field at all',
    response: {
      id: "lit_003",
      title: "Test Paper 3", 
      metadata: {
        title: "Test Paper 3 Enhanced",
        year: 2024
        // 没有authors字段
      },
      references: []
    }
  },
  
  {
    name: 'API returns authors as string instead of array',
    response: {
      id: "lit_004",
      title: "Test Paper 4",
      metadata: {
        title: "Test Paper 4 Enhanced", 
        authors: "Single Author String", // 错误的数据类型
        year: 2024
      },
      references: []
    }
  },
  
  {
    name: 'Mixed valid and invalid authors',
    response: {
      id: "lit_005",
      title: "Test Paper 5",
      metadata: {
        title: "Test Paper 5 Enhanced",
        authors: [
          { name: "Valid Author" },
          { name: "" },
          null,
          { name: "Another Valid Author" },
          { name: null }
        ],
        year: 2024
      },
      references: []
    }
  }
];

// 完整模拟libraryStore中的数据转换逻辑
function simulateDataConversion(literatureData, submissionId = 'test_123') {
  return {
    title: literatureData.metadata?.title || literatureData.title || 'Unknown Title',
    authors: (() => {
      // 🔍 安全处理authors字段，确保至少有一个作者
      let authorsList = [];
      
      // 尝试从 metadata.authors 获取
      if (literatureData.metadata?.authors && Array.isArray(literatureData.metadata.authors)) {
        authorsList = literatureData.metadata.authors
          .map((a) => a?.name || (typeof a === 'string' ? a : null))
          .filter(Boolean);
      }
      
      // 如果 metadata 中没有，尝试从直接字段获取
      if (authorsList.length === 0 && literatureData.authors && Array.isArray(literatureData.authors)) {
        authorsList = literatureData.authors
          .map((a) => typeof a === 'string' ? a : a?.name)
          .filter(Boolean);
      }
      
      // 确保至少有一个作者
      return authorsList.length > 0 ? authorsList : ['Unknown Author'];
    })(),
    year: literatureData.metadata?.year || 
          literatureData.year || 
          new Date().getFullYear(),
    doi: literatureData.identifiers?.doi || literatureData.doi || undefined,
    url: literatureData.content?.pdf_url || literatureData.url || undefined,
    publication: literatureData.metadata?.journal || literatureData.journal || undefined,
    abstract: literatureData.metadata?.abstract || null,
    source: 'import',
    
    parsedContent: {
      extractedText: literatureData.content?.has_grobid_fulltext ? 'Available' : undefined,
      extractedReferences: Array.isArray(literatureData.references) ? literatureData.references : []
    },
    
    backendTask: {
      task_id: submissionId,
      execution_status: 'completed',
      result_type: 'created',
      literature_id: literatureData.id,
      literature_status: null,
      status: 'completed',
      overall_progress: 100,
      current_stage: '已完成',
      resource_url: `/api/literature/${literatureData.id}`,
      error_info: null
    }
  };
}

// 运行测试
problematicApiResponses.forEach((testCase, index) => {
  console.log(`📋 Test ${index + 1}: ${testCase.name}`);
  console.log('─'.repeat(60));
  
  try {
    const convertedData = simulateDataConversion(testCase.response);
    
    console.log('✅ Conversion successful!');
    console.log('Final authors:', convertedData.authors);
    console.log('Authors count:', convertedData.authors.length);
    
    // 验证关键字段
    const validation = {
      hasTitle: !!convertedData.title,
      hasAuthors: convertedData.authors && convertedData.authors.length > 0,
      hasYear: typeof convertedData.year === 'number',
      hasBackendTask: !!convertedData.backendTask,
      allBackendTaskFields: convertedData.backendTask && Object.keys(convertedData.backendTask).length >= 10
    };
    
    const allValid = Object.values(validation).every(v => v);
    
    console.log('Validation checks:', validation);
    console.log('Overall validation:', allValid ? '✅ PASS' : '❌ FAIL');
    
    if (!validation.hasAuthors) {
      console.error('🚨 CRITICAL: Authors validation would fail!');
    }
    
  } catch (error) {
    console.error('❌ Conversion failed:', error.message);
  }
  
  console.log('');
});

console.log('🎯 Key insights:');
console.log('  1. All test cases should produce valid authors arrays');
console.log('  2. Even problematic API data should be safely converted');
console.log('  3. Default "Unknown Author" should handle all edge cases');
console.log('  4. No case should result in empty authors array');

console.log('\n✅ Authors edge cases test completed!');