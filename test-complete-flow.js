#!/usr/bin/env node

/**
 * 🔧 完整流程Authors验证测试
 * 
 * 模拟完整的数据流：
 * API Response → LibraryStore conversion → LibraryService processing → Zod validation
 */

console.log('🔧 Testing complete data flow for authors validation...\n');

// 模拟可能出现问题的API响应
const problematicApiResponse = {
  id: "lit_test_001",
  title: "Test Paper",
  // 故意让这些字段可能导致空authors
  metadata: {
    title: "Test Paper Enhanced",
    authors: [
      { name: "" },  // 空名字
      { name: null }, // null名字
      { },           // 空对象
    ],
    year: 2024,
    abstract: null
  },
  authors: [], // 备用authors也是空的
  
  identifiers: {
    doi: "10.1000/test.001"
  },
  
  content: {
    has_grobid_fulltext: false,
    pdf_url: "https://example.com/test.pdf"
  },
  
  references: []
};

console.log('📥 Problematic API Response:');
console.log(JSON.stringify(problematicApiResponse, null, 2));

console.log('\n🔄 Step 1: LibraryStore Data Conversion');
console.log('─'.repeat(50));

// 模拟libraryStore.ts中的转换逻辑
const submissionId = 'test_submission_456';
const literatureData = problematicApiResponse;

const libraryItemData = {
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

// 🔒 最终防御性检查（模拟libraryStore中的检查）
if (!libraryItemData.authors || libraryItemData.authors.length === 0) {
  console.warn('⚠️ [LibraryStore] Authors array is empty, applying fallback');
  libraryItemData.authors = ['Unknown Author'];
}

console.log('✅ LibraryStore conversion result:');
console.log('  - Authors:', libraryItemData.authors);
console.log('  - Authors count:', libraryItemData.authors.length);

console.log('\n🔄 Step 2: LibraryService Processing');
console.log('─'.repeat(50));

// 模拟LibraryService.addOrUpdateLiteratureWithDuplicateCheck中的处理
const safeData = { ...libraryItemData };
if (!safeData.authors || safeData.authors.length === 0) {
  console.warn('⚠️ [LibraryService] Authors array is empty in addOrUpdateLiteratureWithDuplicateCheck, applying fallback');
  safeData.authors = ['Unknown Author'];
}

console.log('✅ LibraryService safe data:');
console.log('  - Authors:', safeData.authors);
console.log('  - Authors count:', safeData.authors.length);

console.log('\n🔄 Step 3: Final Item Creation');
console.log('─'.repeat(50));

// 模拟最终的LibraryItem创建
const finalItem = {
  id: 'generated-uuid-123',
  ...safeData,
  createdAt: new Date(),
  updatedAt: new Date()
};

console.log('✅ Final LibraryItem:');
console.log('  - ID:', finalItem.id);
console.log('  - Title:', finalItem.title);
console.log('  - Authors:', finalItem.authors);
console.log('  - Authors count:', finalItem.authors.length);
console.log('  - Year:', finalItem.year);
console.log('  - Has createdAt:', !!finalItem.createdAt);

console.log('\n🔍 Step 4: Zod Validation Simulation');
console.log('─'.repeat(50));

// 简单模拟Zod验证的关键检查点
const validationChecks = {
  hasTitle: !!finalItem.title && finalItem.title.length > 0,
  hasAuthors: Array.isArray(finalItem.authors) && finalItem.authors.length > 0,
  authorsNotEmpty: finalItem.authors.every(author => author && author.length > 0),
  hasValidYear: typeof finalItem.year === 'number' && finalItem.year >= 1000,
  hasId: !!finalItem.id,
  hasCreatedAt: finalItem.createdAt instanceof Date,
  hasBackendTask: !!finalItem.backendTask && typeof finalItem.backendTask === 'object'
};

const allValidationsPassed = Object.values(validationChecks).every(check => check);

console.log('Validation checks:');
Object.entries(validationChecks).forEach(([key, passed]) => {
  console.log(`  - ${key}: ${passed ? '✅' : '❌'}`);
});

console.log('\n📊 Final Result:');
console.log('─'.repeat(50));
if (allValidationsPassed) {
  console.log('✅ ALL VALIDATIONS PASSED!');
  console.log('🎯 The complete flow successfully handles empty authors');
  console.log('🛡️ Multiple safety nets prevent validation errors');
} else {
  console.log('❌ VALIDATION FAILED!');
  console.log('🔍 Check the failed validation points above');
}

console.log('\n✅ Complete flow test completed!');