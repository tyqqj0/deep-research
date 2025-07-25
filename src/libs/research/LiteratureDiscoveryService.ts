/**
 * 🎯 LiteratureDiscoveryService - 智能文献发现服务
 * 
 * 核心功能：一键搜索→解析→智能入库
 * 设计理念：简化、实用、易调用
 * 
 * 主要接口：
 * - discoverAndAddLiterature(query, topic) → string[]
 * 
 * 技术特点：
 * - 95%复用现有搜索基础设施
 * - 智能去重和topic管理
 * - 占位符解析（后续AI增强）
 * - 完整的错误处理和日志
 */

import { nanoid } from 'nanoid';
import { LibraryItem } from '../db';

// 简化导入：直接使用类型定义而不依赖复杂的路径
interface SearchTask {
  id: string;
  state: "unprocessed" | "processing" | "completed" | "failed" | "waiting" | "cancelled";
  query: string;
  title: string;
  researchGoal: string;
  learning: string;
  sources: Source[];
  images: ImageSource[];
  depth: number;
  timerId?: NodeJS.Timeout;
}

interface Source {
  title?: string;
  content?: string;
  url: string;
  images?: ImageSource[];
}

interface ImageSource {
  url: string;
  description?: string;
}

// 文献候选者接口
interface LiteratureCandidate {
  title: string;
  url: string;
  doi?: string;
  authors: string[];
  year: number;
  abstract?: string;
  content?: string;
}

// 发现结果接口
interface DiscoveryResult {
  addedIds: string[];
  totalCandidates: number;
  processedCount: number;
  errors: string[];
}

export class LiteratureDiscoveryService {
  /**
   * 🎯 主要接口：智能文献发现与自动入库
   * @param query 搜索查询字符串
   * @param topic 文献标签（用于topics字段）
   * @returns 成功入库的文献ID列表
   */
  async discoverAndAddLiterature(query: string, topic: string): Promise<string[]> {
    console.log(`🔍 [LiteratureDiscovery] 开始文献发现: "${query}" (标签: ${topic})`);

    try {
      // Step 1: 创建并执行搜索任务
      const searchTask = this.createSearchTask(query, topic);
      await this.executeSearch(searchTask);

      if (searchTask.sources.length === 0) {
        console.warn(`⚠️ [LiteratureDiscovery] 未找到搜索结果: ${query}`);
        return [];
      }

      console.log(`📚 [LiteratureDiscovery] 找到 ${searchTask.sources.length} 个搜索结果`);

      // Step 2: 解析文献信息（占位符实现）
      const candidates = this.extractLiteratureFromSources(searchTask.sources);
      console.log(`🔍 [LiteratureDiscovery] 解析出 ${candidates.length} 个候选文献`);

      // Step 3: 智能去重并入库
      const result = await this.processAndAddLiterature(candidates, topic);

      console.log(`✅ [LiteratureDiscovery] 完成处理: ${result.processedCount}/${result.totalCandidates} 个候选文献，成功入库 ${result.addedIds.length} 个`);

      if (result.errors.length > 0) {
        console.warn(`⚠️ [LiteratureDiscovery] 处理过程中遇到 ${result.errors.length} 个错误:`, result.errors);
      }

      return result.addedIds;
    } catch (error) {
      console.error(`❌ [LiteratureDiscovery] 文献发现失败:`, error);
      throw new Error(`文献发现失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 🔧 创建搜索任务
   * 直接复用现有的SearchTask结构
   */
  private createSearchTask(query: string, topic: string): SearchTask {
    return {
      id: nanoid(),
      query,
      title: `文献发现: ${query}`,
      researchGoal: topic, // 将topic作为研究目标
      state: "unprocessed",
      learning: "",
      sources: [],
      images: [],
      depth: 0,
    };
  }

  /**
   * 🔧 执行搜索
   * 复用现有搜索逻辑的核心部分，但去掉AI总结
   */
  private async executeSearch(task: SearchTask): Promise<void> {
    try {
      task.state = "processing";

      // 动态导入搜索相关模块，避免静态导入的路径问题
      const { createSearchProvider } = await import('../../utils/deep-research/search');
      const { useSettingStore } = await import('../../store/setting');
      const { multiApiKeyPolling } = await import('../../utils/model');
      const { generateSignature } = await import('../../utils/signature');

      const { 
        enableSearch, 
        searchProvider,
        mode,
        searchMaxResult,
        searchDomainStrategy,
        accessPassword, // 🔑 添加这个用于代理模式认证
        // Tavily
        tavilyApiKey,
        tavilyApiProxy,
        // Firecrawl
        firecrawlApiKey,
        firecrawlApiProxy,
        // Exa
        exaApiKey,
        exaApiProxy,
        exaScope,
        // Bocha
        bochaApiKey,
        bochaApiProxy,
        // Searxng
        searxngApiProxy,
        searxngScope
      } = useSettingStore.getState();

      console.log(`🔧 [DEBUG] 配置信息:`, {
        enableSearch,
        searchProvider,
        mode,
        hasAccessPassword: !!accessPassword,
        hasTavilyApiKey: !!tavilyApiKey,
        tavilyApiKeyLength: tavilyApiKey?.length || 0
      });

      if (!enableSearch) {
        throw new Error('搜索功能未启用，请检查设置');
      }

      if (searchProvider === "model") {
        throw new Error('模型内置搜索暂未在文献发现中实现，请使用外部搜索提供商');
      }

      // 构建搜索选项（复用useWebSearch的逻辑）
      const options: any = {
        provider: searchProvider,
        maxResult: searchMaxResult,
        query: task.query,
      };

      // 完全复制useWebSearch的认证逻辑
      console.log(`🔧 [DEBUG] 模式检查: mode=${mode}, window=${typeof window}`);

      switch (searchProvider) {
        case "tavily":
          if (mode === "local") {
            options.baseURL = tavilyApiProxy;
            options.apiKey = multiApiKeyPolling(tavilyApiKey);
            console.log(`🔧 [DEBUG] Tavily Local模式: baseURL=${options.baseURL}, hasApiKey=${!!options.apiKey}`);
          } else {
            options.baseURL = location.origin + "/api/search/tavily";
            // 🔑 代理模式使用签名认证（完全复制useWebSearch逻辑）
            if (accessPassword) {
              options.apiKey = generateSignature(accessPassword, Date.now());
              console.log(`🔧 [DEBUG] Tavily Proxy模式 (有密码): baseURL=${options.baseURL}, signature生成成功`);
            } else {
              console.warn(`⚠️ [DEBUG] Tavily Proxy模式但没有accessPassword，尝试使用原始API密钥`);
              options.apiKey = multiApiKeyPolling(tavilyApiKey);
            }
          }
          
          // 验证认证信息
          if (!options.apiKey || options.apiKey.trim() === '') {
            if (mode === "local") {
              throw new Error('Tavily API密钥未配置。请在设置中配置Tavily API密钥后重试。');
            } else {
              throw new Error('代理模式认证失败。请检查访问密码或Tavily API密钥配置。');
            }
          }
          
          // 添加tavily的域名策略
          const tavilyStrategy = searchDomainStrategy["tavily"];
          if (tavilyStrategy.domains) {
            options.domains = [
              ...tavilyStrategy.domains.predefined,
              ...tavilyStrategy.domains.custom,
            ];
          }
          break;
        default:
          throw new Error(`不支持的搜索提供商: ${searchProvider}。当前仅支持Tavily进行文献发现。`);
      }

      console.log(`🔍 [LiteratureDiscovery] 搜索配置详情:`, {
        provider: searchProvider,
        mode,
        baseURL: options.baseURL,
        hasApiKey: !!options.apiKey,
        apiKeyType: mode === "local" ? "direct" : "signature",
        queryLength: options.query?.length || 0
      });

      // 使用createSearchProvider进行搜索
      let results;
      try {
        console.log(`🚀 [DEBUG] 开始调用createSearchProvider...`);
        results = await createSearchProvider(options);
        console.log(`✅ [DEBUG] createSearchProvider调用成功:`, {
          sourcesCount: results.sources?.length || 0,
          imagesCount: results.images?.length || 0,
          firstSourceTitle: results.sources?.[0]?.title || 'N/A'
        });
      } catch (error) {
        console.error(`❌ [DEBUG] createSearchProvider调用失败:`, error);
        
        // 详细的HTTP错误分析
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();
          console.error(`🔍 [DEBUG] 错误消息分析: "${error.message}"`);
          
          if (errorMessage.includes('failed to fetch') || errorMessage.includes('network error')) {
            throw new Error(`网络连接失败。请检查网络连接或API配置。\n详细错误: ${error.message}`);
          }
          
          if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
            console.error(`🔑 [DEBUG] 403错误 - 认证信息检查:`, {
              hasApiKey: !!options.apiKey,
              apiKeyLength: options.apiKey?.length || 0,
              mode,
              hasAccessPassword: !!accessPassword,
              baseURL: options.baseURL
            });
            throw new Error(`API访问被拒绝（403 Forbidden）。\n可能原因：\n1. ${searchProvider} API密钥无效或过期\n2. API配额不足\n3. 代理模式认证失败\n\n当前模式: ${mode}\n详细错误: ${error.message}`);
          }
          
          if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
            throw new Error(`API认证失败（401 Unauthorized）。\n请检查${searchProvider}的API密钥是否正确。\n详细错误: ${error.message}`);
          }
          
          if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
            throw new Error(`API调用频率限制（429 Too Many Requests）。\n请稍后重试或检查API配额。\n详细错误: ${error.message}`);
          }
          
          if (errorMessage.includes('500') || errorMessage.includes('internal server error')) {
            throw new Error(`搜索服务内部错误（500）。\n请稍后重试。\n详细错误: ${error.message}`);
          }
          
          // 其他错误保持原样但添加详细信息
          throw new Error(`搜索请求失败: ${error.message}\n\n调试信息:\n- 提供商: ${searchProvider}\n- 模式: ${mode}\n- URL: ${options.baseURL}\n- 有API密钥: ${!!options.apiKey}`);
        }
        throw error;
      }

      task.sources = results.sources || [];
      task.images = results.images || [];

      if (task.sources.length === 0) {
        throw new Error(`搜索提供商 ${searchProvider} 未返回有效结果`);
      }

      console.log(`📊 [LiteratureDiscovery] 搜索完成: 获得 ${task.sources.length} 个结果`);

      task.state = "completed";
    } catch (error) {
      task.state = "failed";
      console.error(`❌ [LiteratureDiscovery] 搜索执行失败:`, error);
      throw error;
    }
  }

  /**
   * 🔧 从搜索结果中提取文献信息
   * 占位符实现：简单的字符串处理和信息提取
   */
  private extractLiteratureFromSources(sources: Source[]): LiteratureCandidate[] {
    console.log(`🔧 [LiteratureDiscovery] 开始解析搜索结果...`);

    const candidates: LiteratureCandidate[] = [];

    for (const source of sources) {
      try {
        const candidate = this.extractSingleLiterature(source);
        if (candidate) {
          candidates.push(candidate);
        }
      } catch (error) {
        console.warn(`⚠️ [LiteratureDiscovery] 解析单个结果失败:`, source.url, error);
      }
    }

    return candidates;
  }

  /**
   * 🔧 解析单个搜索结果
   * 占位符实现：基础的正则表达式和字符串处理
   */
  private extractSingleLiterature(source: Source): LiteratureCandidate | null {
    // 提取标题
    const title = this.extractTitle(source);
    if (!title) {
      console.warn(`⚠️ [LiteratureDiscovery] 无法提取标题，跳过: ${source.url}`);
      return null;
    }

    // 提取DOI
    const doi = this.extractDOI(source);

    // 提取年份
    const year = this.extractYear(source) || new Date().getFullYear();

    // 提取作者（占位符：空数组）
    const authors = this.extractAuthors(source);

    // 提取摘要
    const abstract = this.extractAbstract(source);

    return {
      title,
      url: source.url,
      doi,
      authors,
      year,
      abstract,
      content: source.content
    };
  }

  /**
   * 🔧 提取标题
   */
  private extractTitle(source: Source): string | null {
    // 优先级1: source.title
    if (source.title && source.title.trim()) {
      return source.title.trim();
    }

    // 优先级2: 从content中提取（简单实现）
    if (source.content) {
      // 查找看起来像标题的内容（通常在前面，较短，没有太多标点）
      const lines = source.content.split('\n').filter(line => line.trim());
      for (const line of lines.slice(0, 5)) { // 只检查前5行
        const cleaned = line.trim();
        if (cleaned.length > 10 && cleaned.length < 200 && !cleaned.includes('http')) {
          return cleaned;
        }
      }

      // 回退：使用content的前100个字符
      return source.content.substring(0, 100).trim() + '...';
    }

    // 优先级3: 从URL中提取（最后的回退）
    const urlTitle = this.extractTitleFromURL(source.url);
    return urlTitle;
  }

  /**
   * 🔧 从URL中提取标题
   */
  private extractTitleFromURL(url: string): string {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;

      // 提取文件名部分
      const filename = path.split('/').pop() || '';
      if (filename && filename.includes('.')) {
        return filename.split('.')[0].replace(/[-_]/g, ' ');
      }

      // 回退到域名
      return urlObj.hostname.replace('www.', '');
    } catch {
      return '未知标题';
    }
  }

  /**
   * 🔧 提取DOI
   */
  private extractDOI(source: Source): string | undefined {
    const text = (source.content || '') + ' ' + (source.url || '');

    // DOI正则表达式
    const doiRegex = /10\.\d{4,}\/[^\s<>"{}|\\^`[\]]+/g;
    const matches = text.match(doiRegex);

    if (matches && matches.length > 0) {
      return matches[0];
    }

    return undefined;
  }

  /**
   * 🔧 提取年份
   */
  private extractYear(source: Source): number | undefined {
    const text = (source.content || '') + ' ' + (source.title || '');

    // 年份正则：查找1900-2030之间的四位数
    const yearRegex = /(19|20)\d{2}/g;
    const matches = text.match(yearRegex);

    if (matches && matches.length > 0) {
      // 返回最新的年份
      const years = matches.map(y => parseInt(y)).filter(y => y >= 1900 && y <= 2030);
      return Math.max(...years);
    }

    return undefined;
  }

  /**
   * 🔧 提取作者（占位符实现）
   */
  private extractAuthors(source: Source): string[] {
    // 占位符：返回空数组
    // 后续可以用AI或更复杂的正则来提取作者信息
    return [];
  }

  /**
   * 🔧 提取摘要
   */
  private extractAbstract(source: Source): string | undefined {
    if (!source.content) return undefined;

    // 简单截取前500个字符作为摘要
    const content = source.content.trim();
    if (content.length > 500) {
      return content.substring(0, 500) + '...';
    }

    return content;
  }

  /**
   * 🔧 智能去重并入库
   * 核心逻辑：调用现有服务进行智能匹配
   */
  private async processAndAddLiterature(
    candidates: LiteratureCandidate[],
    topic: string
  ): Promise<DiscoveryResult> {
    const result: DiscoveryResult = {
      addedIds: [],
      totalCandidates: candidates.length,
      processedCount: 0,
      errors: []
    };

    for (const candidate of candidates) {
      try {
        const itemId = await this.processSingleCandidate(candidate, topic);
        if (itemId) {
          result.addedIds.push(itemId);
        }
        result.processedCount++;
      } catch (error) {
        const errorMsg = `处理文献失败 "${candidate.title}": ${error instanceof Error ? error.message : '未知错误'}`;
        result.errors.push(errorMsg);
        console.error(`❌ [LiteratureDiscovery] ${errorMsg}`);
      }
    }

    return result;
  }

  /**
   * 🔧 处理单个候选文献
   */
  private async processSingleCandidate(candidate: LiteratureCandidate, topic: string): Promise<string | null> {
    try {
      // 动态导入库服务，避免静态导入问题
      // const { libraryService } = await import('../db/LibraryService');
      const { matchingEngine } = await import('../db/matching');

      // // Step 1: 使用智能匹配引擎检查是否已存在（包含标题相似性匹配）
      // const existingItem = await matchingEngine.findItemByUrlOrDoi(
      //   candidate.url, 
      //   candidate.doi, 
      //   candidate.title, // 🎯 新增：传递标题用于相似性匹配
      //   candidate.authors, 
      //   candidate.year
      // );

      // if (existingItem) {
      //   // 已存在：添加topic标签
      //   console.log(`📌 [LiteratureDiscovery] 文献已存在，添加标签: ${existingItem.title}`);
      //   const { libraryService } = await import('../db/LibraryService');
      //   await libraryService.addTopicToItem(existingItem.id, topic);
      //   return existingItem.id;
      // }
      // 上述代码已废弃，因为智能匹配引擎会自动处理重复文献

      // Step 2: 不存在，使用masterAddLiterature创建新文献 - 这会触发完整的处理流程！
      console.log(`🚀 [LiteratureDiscovery] 使用masterAddLiterature创建新文献: ${candidate.title}`);
      
      // 动态导入store以使用masterAddLiterature
      const { useLibraryStore } = await import('../../store/libraryStore');
      
      // 准备文献数据，包含topics
      const literatureData = {
        title: candidate.title,
        authors: candidate.authors,
        year: candidate.year,
        url: candidate.url,
        doi: candidate.doi,
        source: 'search' as const, // 标记为搜索来源
        topics: [topic] // 添加话题标签
      };

      console.log(`📋 [LiteratureDiscovery] 准备提交文献数据:`, {
        title: literatureData.title,
        authors: literatureData.authors,
        hasUrl: !!literatureData.url,
        hasDoi: !!literatureData.doi,
        topics: literatureData.topics
      });

      // 使用masterAddLiterature - 这会触发完整的后端处理流程
      const result = await useLibraryStore.getState().masterAddLiterature(literatureData, {
        onProgress: (stage, progress) => {
          console.log(`📈 [LiteratureDiscovery] ${candidate.title} - ${stage}: ${progress}%`);
        },
        onTaskCreated: (taskId, itemId) => {
          console.log(`🎯 [LiteratureDiscovery] 任务已创建: taskId=${taskId}, itemId=${itemId}`);
        },
        onComplete: (itemId, resultType) => {
          console.log(`✅ [LiteratureDiscovery] 文献处理完成: ${itemId} (${resultType})`);
        },
        onError: (error) => {
          console.error(`❌ [LiteratureDiscovery] 文献处理失败:`, error);
        },
        preCheckDuplicate: false
      });

      if (result.success) {
        console.log(`✅ [LiteratureDiscovery] 成功通过masterAddLiterature创建文献: ${result.itemId}`);
        return result.itemId!;
      } else {
        console.error(`❌ [LiteratureDiscovery] masterAddLiterature失败:`, result.error);
        throw new Error(`Failed to create literature: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ [LiteratureDiscovery] 处理候选文献失败:`, error);
      throw error;
    }
  }

  /**
   * 🔧 批量文献发现
   * 支持多个查询的批量处理
   */
  async batchDiscoverAndAddLiterature(
    queries: Array<{ query: string; topic: string }>
  ): Promise<Record<string, string[]>> {
    console.log(`🔍 [LiteratureDiscovery] 开始批量文献发现: ${queries.length} 个查询`);

    const results: Record<string, string[]> = {};

    for (const { query, topic } of queries) {
      try {
        const ids = await this.discoverAndAddLiterature(query, topic);
        results[query] = ids;
      } catch (error) {
        console.error(`❌ [LiteratureDiscovery] 批量处理失败 "${query}":`, error);
        results[query] = [];
      }
    }

    return results;
  }
}

// 导出单例实例
export const literatureDiscoveryService = new LiteratureDiscoveryService();

// 导出便捷函数
export const discoverAndAddLiterature = literatureDiscoveryService.discoverAndAddLiterature.bind(literatureDiscoveryService);
export const batchDiscoverAndAddLiterature = literatureDiscoveryService.batchDiscoverAndAddLiterature.bind(literatureDiscoveryService);