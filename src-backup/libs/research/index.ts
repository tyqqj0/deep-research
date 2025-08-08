/**
 * 🎯 Research Services - 研究服务模块
 * 
 * 主要功能：
 * - 智能文献发现和自动入库
 * - 基于现有搜索架构的完美复用
 * - 简化的API接口便于调用
 */

// 核心服务
export { 
  LiteratureDiscoveryService,
  literatureDiscoveryService 
} from './LiteratureDiscoveryService';

// 便捷函数
export { 
  discoverAndAddLiterature,
  batchDiscoverAndAddLiterature 
} from './LiteratureDiscoveryService';

// 类型定义
export type {
  LiteratureCandidate,
  DiscoveryResult,
  BatchQuery,
  BatchDiscoveryResult
} from './types';

// 🚀 使用示例和文档
export const SIMPLE_USAGE_EXAMPLES = {
  // 简单文献发现
  DISCOVERY_EXAMPLE: `
    import { discoverAndAddLiterature } from '@/libs/research';
    
    const addedIds = await discoverAndAddLiterature('深度学习', '机器学习');
  `,
  
  // 批量发现
  BATCH_EXAMPLE: `
    import { batchDiscoverAndAddLiterature } from '@/libs/research';
    
    const results = await batchDiscoverAndAddLiterature([
      { query: 'transformer', topic: '自然语言处理' },
      { query: 'attention mechanism', topic: '自然语言处理' }
    ]);
  `
};