/**
 * 🎯 Research Services - 研究服务模块
 * 
 * 主要功能：
 * - 智能文献发现和自动入库
 * - 基于现有搜索架构的完美复用
 * - 简化的API接口便于调用
 * - 🆕 MCTS文献搜索管理 (支持2.1播种和2.2扩展)
 */

// 🚀 新增：MCTS文献搜索管理器
export { 
  LiteratureSearchManager, 
  literatureSearchManager,
  SEARCH_CONFIGS 
} from './LiteratureSearchManager';

// 🚀 新增：搜索管理类型
export type { 
  SearchConfig, 
  SearchSession, 
  SearchUnit 
} from './LiteratureSearchManager';

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
export const MCTS_USAGE_EXAMPLES = {
  // 2.1 预搜索数据库（播种模式）
  SEEDING_EXAMPLE: `
    import { literatureSearchManager, SEARCH_CONFIGS } from '@/libs/research';
    
    const sessionId = await literatureSearchManager.startSearch({
      ...SEARCH_CONFIGS.INITIAL_SEEDING,
      topic: '深度学习在自然语言处理中的应用'
    });
  `,
  
  // 2.2 边搜边建（扩展模式）
  EXPANDING_EXAMPLE: `
    const sessionId = await literatureSearchManager.startSearch({
      ...SEARCH_CONFIGS.CONTINUOUS_EXPANSION,
      topic: '深度学习',
      queries: ['transformer', 'attention mechanism']
    });
    
    // 动态扩展
    await literatureSearchManager.expandSearch(sessionId, ['bert model']);
  `,
  
  // React Hook使用
  HOOK_EXAMPLE: `
    import useLiteratureSearchManager from '@/hooks/useLiteratureSearchManager';
    
    const { startSeedingSearch, currentSession } = useLiteratureSearchManager();
    await startSeedingSearch('研究话题');
  `
};