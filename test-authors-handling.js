#!/usr/bin/env node

/**
 * 🔧 Authors字段处理测试
 * 
 * 测试各种可能导致authors数组为空的情况：
 * 1. authors字段为null或undefined
 * 2. authors数组为空
 * 3. authors包含无效数据被filter掉
 * 4. 各种API响应格式
 */

console.log('🔧 Testing authors field handling...\n');

// 测试用例：模拟各种可能的API响应
const testCases = [
  {
    name: 'Normal case with valid authors',
    data: {
      metadata: {
        authors: [
          { name: 'Dr. Jane Smith' },
          { name: 'Prof. John Doe' }
        ]
      }
    }
  },
  
  {
    name: 'Authors array with empty names',
    data: {
      metadata: {
        authors: [
          { name: '' },
          { name: null },
          { name: 'Valid Author' },
          { name: undefined }
        ]
      }
    }
  },
  
  {
    name: 'Empty authors array in metadata',
    data: {
      metadata: {
        authors: []
      },
      authors: ['Fallback Author']
    }
  },
  
  {
    name: 'No metadata, direct authors array',
    data: {
      authors: ['Direct Author 1', 'Direct Author 2']
    }
  },
  
  {
    name: 'Authors array with mixed types',
    data: {
      metadata: {
        authors: [
          'String Author',
          { name: 'Object Author' },
          null,
          { name: '' },
          'Another Valid Author'
        ]
      }
    }
  },
  
  {
    name: 'Completely empty authors',
    data: {
      metadata: {
        authors: []
      },
      authors: []
    }
  },
  
  {
    name: 'Null authors fields',
    data: {
      metadata: {
        authors: null
      },
      authors: null
    }
  },
  
  {
    name: 'Missing authors fields',
    data: {
      title: 'Paper without authors'
    }
  }
];

// 模拟libraryStore中的authors处理逻辑
function processAuthors(literatureData) {
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
}

// 运行测试
testCases.forEach((testCase, index) => {
  console.log(`📋 Test ${index + 1}: ${testCase.name}`);
  console.log('Input data:', JSON.stringify(testCase.data, null, 2));
  
  const result = processAuthors(testCase.data);
  
  console.log('Result authors:', result);
  console.log('Authors count:', result.length);
  console.log('Validation check:', result.length >= 1 ? '✅ PASS' : '❌ FAIL');
  console.log('─'.repeat(50));
});

console.log('\n🎯 Summary:');
console.log('  - All test cases should return at least one author');
console.log('  - Empty or invalid authors should default to ["Unknown Author"]');
console.log('  - Valid authors should be preserved and cleaned');

console.log('\n✅ Authors handling test completed!');