/**
 * 🎯 Research Service Types - 研究服务类型定义
 */

// 文献候选者接口
export interface LiteratureCandidate {
  title: string;
  url: string;
  doi?: string;
  authors: string[];
  year: number;
  abstract?: string;
  content?: string;
}

// 文献发现结果接口
export interface DiscoveryResult {
  addedIds: string[];           // 成功入库的文献ID列表
  totalCandidates: number;      // 总候选文献数量
  processedCount: number;       // 已处理的数量
  errors: string[];             // 错误信息列表
}

// 批量查询接口
export interface BatchQuery {
  query: string;
  topic: string;
}

// 批量发现结果接口
export interface BatchDiscoveryResult {
  [query: string]: string[];    // 查询 -> 文献ID列表的映射
}