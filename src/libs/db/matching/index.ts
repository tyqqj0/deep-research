/**
 * 🔍 Matching Module - 智能文献匹配模块
 * 
 * 这个模块包含了从LibraryService中提取的所有智能匹配功能：
 * - SimilarityCalculator: 相似度计算器
 * - ReferenceExtractor: 引文数据提取器  
 * - MatchingEngine: 核心匹配引擎
 * - CitationLinker: 引文链接管理器
 */

// Core engines
export { SimilarityCalculator, similarityCalculator } from './SimilarityCalculator';
export { ReferenceExtractor, referenceExtractor } from './ReferenceExtractor';
export { MatchingEngine, matchingEngine } from './MatchingEngine';
export { CitationLinker, citationLinker } from './CitationLinker';

// Types
export type { 
  ScoreWeights, 
  ExtractedReferenceData 
} from './SimilarityCalculator';

export type { 
  MatchingThresholds 
} from './MatchingEngine';

export type { 
  CitationLinkResult, 
  BidirectionalLinkResult 
} from './CitationLinker';

// Import singletons for convenience exports
import { matchingEngine } from './MatchingEngine';
import { citationLinker } from './CitationLinker';
import { similarityCalculator } from './SimilarityCalculator';
import { referenceExtractor } from './ReferenceExtractor';

// Convenience exports for common operations
export const smartMatching = {
  findMatch: matchingEngine.findMatchingLiterature.bind(matchingEngine),
  linkCitations: citationLinker.linkCitationsForItem.bind(citationLinker),
  createLink: citationLinker.createCitationLink.bind(citationLinker),
  calculateSimilarity: similarityCalculator.calculateStringSimilarity.bind(similarityCalculator),
  extractReference: referenceExtractor.extractReferenceData.bind(referenceExtractor)
};