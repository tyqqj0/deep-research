import { z } from "zod";

// ========================================
// 环境变量和构建相关常量
// ========================================

export const BUILD_MODE = process.env.NEXT_PUBLIC_BUILD_MODE;
export const VERSION = process.env.NEXT_PUBLIC_VERSION;
export const DISABLED_AI_PROVIDER = process.env.NEXT_PUBLIC_DISABLED_AI_PROVIDER || "";
export const DISABLED_SEARCH_PROVIDER = process.env.NEXT_PUBLIC_DISABLED_SEARCH_PROVIDER || "";
export const MODEL_LIST = process.env.NEXT_PUBLIC_MODEL_LIST || "";

// ========================================
// Provider相关常量映射
// ========================================

export const AI_PROVIDERS = [
  "google",
  "openrouter", 
  "openai",
  "anthropic",
  "deepseek",
  "xai",
  "mistral",
  "azure",
  "openaicompatible",
  "pollinations",
  "ollama"
] as const;

export const SEARCH_PROVIDERS = [
  "tavily",
  "firecrawl", 
  "exa",
  "bocha",
  "searxng"
] as const;

// ========================================
// 预定义域名配置
// ========================================

export const PREDEFINED_DOMAINS = {
  academic: [
    "scholar.google.com",
    "arxiv.org",
    "nature.com",
    "openaccess.thecvf.com", // CVPR, ICCV
    "neurips.cc", // NeurIPS
    "icml.cc", // ICML
    "jmlr.org", // JMLR
    "ieee.org",
    "acm.org",
    "pubmed.ncbi.nlm.nih.gov",
    "sci-hub.se",
  ],
  // search_engine: ["google.com", "bing.com", "baidu.com"],
  community: ["zhihu.com", "weibo.com", "stackoverflow.com"],
} as const;

// ========================================
// Zod Schema 定义
// ========================================

export const domainLimitSchema = z.object({
  predefined: z.array(z.string()),
  custom: z.array(z.string()),
});

export const formSchema = z.object({
  // 基础设置
  provider: z.string(),
  mode: z.string().optional(),
  accessPassword: z.string().optional(),
  
  // Google Provider
  apiKey: z.string().optional(),
  apiProxy: z.string().optional(),
  thinkingModel: z.string().optional(),
  networkingModel: z.string().optional(),
  
  // OpenRouter Provider
  openRouterApiKey: z.string().optional(),
  openRouterApiProxy: z.string().optional(),
  openRouterThinkingModel: z.string().optional(),
  openRouterNetworkingModel: z.string().optional(),
  
  // OpenAI Provider
  openAIApiKey: z.string().optional(),
  openAIApiProxy: z.string().optional(),
  openAIThinkingModel: z.string().optional(),
  openAINetworkingModel: z.string().optional(),
  
  // Anthropic Provider
  anthropicApiKey: z.string().optional(),
  anthropicApiProxy: z.string().optional(),
  anthropicThinkingModel: z.string().optional(),
  anthropicNetworkingModel: z.string().optional(),
  
  // DeepSeek Provider
  deepseekApiKey: z.string().optional(),
  deepseekApiProxy: z.string().optional(),
  deepseekThinkingModel: z.string().optional(),
  deepseekNetworkingModel: z.string().optional(),
  
  // xAI Provider
  xAIApiKey: z.string().optional(),
  xAIApiProxy: z.string().optional(),
  xAIThinkingModel: z.string().optional(),
  xAINetworkingModel: z.string().optional(),
  
  // Mistral Provider
  mistralApiKey: z.string().optional(),
  mistralApiProxy: z.string().optional(),
  mistralThinkingModel: z.string().optional(),
  mistralNetworkingModel: z.string().optional(),
  
  // Azure Provider
  azureApiKey: z.string().optional(),
  azureResourceName: z.string().optional(),
  azureApiVersion: z.string().optional(),
  azureThinkingModel: z.string().optional(),
  azureNetworkingModel: z.string().optional(),
  
  // OpenAI Compatible Provider
  openAICompatibleApiKey: z.string().optional(),
  openAICompatibleApiProxy: z.string().optional(),
  openAICompatibleThinkingModel: z.string().optional(),
  openAICompatibleNetworkingModel: z.string().optional(),
  
  // Pollinations Provider
  pollinationsApiProxy: z.string().optional(),
  pollinationsThinkingModel: z.string().optional(),
  pollinationsNetworkingModel: z.string().optional(),
  
  // Ollama Provider
  ollamaApiProxy: z.string().optional(),
  ollamaThinkingModel: z.string().optional(),
  ollamaNetworkingModel: z.string().optional(),
  
  // 搜索设置
  enableSearch: z.string(),
  searchProvider: z.string().optional(),
  
  // Tavily Search Provider
  tavilyApiKey: z.string().optional(),
  tavilyApiProxy: z.string().optional(),
  tavilyScope: z.string().optional(),
  
  // Firecrawl Search Provider
  firecrawlApiKey: z.string().optional(),
  firecrawlApiProxy: z.string().optional(),
  
  // Exa Search Provider
  exaApiKey: z.string().optional(),
  exaApiProxy: z.string().optional(),
  exaScope: z.string().optional(),
  
  // Bocha Search Provider
  bochaApiKey: z.string().optional(),
  bochaApiProxy: z.string().optional(),
  
  // SearXNG Search Provider
  searxngApiProxy: z.string().optional(),
  searxngScope: z.string().optional(),
  
  // 搜索参数设置
  parallelSearch: z.number().min(1).max(5),
  searchMaxResult: z.number().min(1).max(10),
  
  // 域名策略设置
  searchDomainStrategy: z.object({
    tavily: z.object({
      domains: domainLimitSchema,
    }),
  }),
  
  // 通用设置
  language: z.string().optional(),
  theme: z.string().optional(),
  debug: z.string().optional(),
  references: z.string().optional(),
  citationImage: z.string().optional(),
  
  // 高级/实验性设置
  enableTaskWaitingTime: z.boolean().optional(),
  taskWaitingTime: z.number().optional(),
  searchExecutionMode: z.enum(["immediate", "delayed", "manual"]).optional(),
  searchErrorHandling: z.enum(["manual", "auto", "ignore"]).optional(),
  maxResearchDepth: z.number().min(1).max(10).optional(),
  deepSearchMaxTasks: z.number().min(1).max(10).optional(),
});

// ========================================
// TypeScript 类型定义
// ========================================

export type SettingProps = {
  open: boolean;
  onClose: () => void;
};

export type FormSchemaType = z.infer<typeof formSchema>;
export type DomainLimitSchemaType = z.infer<typeof domainLimitSchema>;

export type AIProvider = typeof AI_PROVIDERS[number];
export type SearchProvider = typeof SEARCH_PROVIDERS[number];

export type SearchExecutionMode = "immediate" | "delayed" | "manual";
export type SearchErrorHandling = "manual" | "auto" | "ignore";

// Provider配置接口
export interface ProviderConfig {
  apiKey?: string;
  apiProxy?: string;
  thinkingModel?: string;
  networkingModel?: string;
}

// 特殊Provider配置
export interface AzureProviderConfig extends ProviderConfig {
  resourceName?: string;
  apiVersion?: string;
}

// 搜索Provider配置
export interface SearchProviderConfig {
  apiKey?: string;
  apiProxy?: string;
  scope?: string;
}

// 域名策略配置
export interface DomainStrategy {
  predefined: string[];
  custom: string[];
}

export interface SearchDomainStrategy {
  tavily: {
    domains: DomainStrategy;
  };
}

// ========================================
// Provider字段映射
// ========================================

export const PROVIDER_FIELD_MAPPING = {
  google: {
    apiKey: "apiKey",
    apiProxy: "apiProxy",
    thinkingModel: "thinkingModel",
    networkingModel: "networkingModel",
  },
  openrouter: {
    apiKey: "openRouterApiKey",
    apiProxy: "openRouterApiProxy", 
    thinkingModel: "openRouterThinkingModel",
    networkingModel: "openRouterNetworkingModel",
  },
  openai: {
    apiKey: "openAIApiKey",
    apiProxy: "openAIApiProxy",
    thinkingModel: "openAIThinkingModel", 
    networkingModel: "openAINetworkingModel",
  },
  anthropic: {
    apiKey: "anthropicApiKey",
    apiProxy: "anthropicApiProxy",
    thinkingModel: "anthropicThinkingModel",
    networkingModel: "anthropicNetworkingModel",
  },
  deepseek: {
    apiKey: "deepseekApiKey",
    apiProxy: "deepseekApiProxy",
    thinkingModel: "deepseekThinkingModel",
    networkingModel: "deepseekNetworkingModel", 
  },
  xai: {
    apiKey: "xAIApiKey",
    apiProxy: "xAIApiProxy",
    thinkingModel: "xAIThinkingModel",
    networkingModel: "xAINetworkingModel",
  },
  mistral: {
    apiKey: "mistralApiKey",
    apiProxy: "mistralApiProxy",
    thinkingModel: "mistralThinkingModel",
    networkingModel: "mistralNetworkingModel",
  },
  azure: {
    apiKey: "azureApiKey",
    resourceName: "azureResourceName",
    apiVersion: "azureApiVersion",
    thinkingModel: "azureThinkingModel",
    networkingModel: "azureNetworkingModel",
  },
  openaicompatible: {
    apiKey: "openAICompatibleApiKey",
    apiProxy: "openAICompatibleApiProxy",
    thinkingModel: "openAICompatibleThinkingModel",
    networkingModel: "openAICompatibleNetworkingModel",
  },
  pollinations: {
    apiProxy: "pollinationsApiProxy",
    thinkingModel: "pollinationsThinkingModel",
    networkingModel: "pollinationsNetworkingModel",
  },
  ollama: {
    apiProxy: "ollamaApiProxy",
    thinkingModel: "ollamaThinkingModel",
    networkingModel: "ollamaNetworkingModel",
  },
} as const;

export const SEARCH_PROVIDER_FIELD_MAPPING = {
  tavily: {
    apiKey: "tavilyApiKey",
    apiProxy: "tavilyApiProxy",
    scope: "tavilyScope",
  },
  firecrawl: {
    apiKey: "firecrawlApiKey", 
    apiProxy: "firecrawlApiProxy",
  },
  exa: {
    apiKey: "exaApiKey",
    apiProxy: "exaApiProxy",
    scope: "exaScope",
  },
  bocha: {
    apiKey: "bochaApiKey",
    apiProxy: "bochaApiProxy",
  },
  searxng: {
    apiProxy: "searxngApiProxy",
    scope: "searxngScope",
  },
} as const;

// ========================================
// 工具函数类型
// ========================================

export type ModelFilterFunction = (modelList: any[]) => [any[], any[]];

export interface HelpTipProps {
  children: React.ReactNode;
  tip: string;
}