import { useCallback, useMemo, useState } from "react";
import { useSettingStore } from "@/store/setting";
import useModelList from "@/hooks/useModelList";
import {
  filterThinkingModelList,
  filterNetworkingModelList,
  filterOpenRouterModelList,
  filterDeepSeekModelList,
  filterOpenAIModelList,
  filterMistralModelList,
  filterPollinationsModelList,
  getCustomModelList,
} from "@/utils/model";
import { capitalize } from "radash";
import {
  AI_PROVIDERS,
  SEARCH_PROVIDERS,
  DISABLED_AI_PROVIDER,
  DISABLED_SEARCH_PROVIDER,
  MODEL_LIST,
  type AIProvider,
  type SearchProvider,
} from "../types";

export interface UseProviderConfigReturn {
  // Provider相关状态
  provider: string;
  searchProvider: string;
  
  // 模型列表
  modelList: string[];
  thinkingModelList: [string[], string[]];
  networkingModelList: [string[], string[]];
  isRefreshing: boolean;
  
  // Provider切换处理
  handleProviderChange: (provider: string, setValue: (name: any, value: any) => void) => Promise<void>;
  handleSearchProviderChange: (searchProvider: string, setValue: (name: any, value: any) => void) => void;
  
  // 模型列表刷新
  fetchModelList: () => Promise<void>;
  
  // 工具函数
  isDisabledAIProvider: (provider: AIProvider) => boolean;
  isDisabledSearchProvider: (provider: SearchProvider) => boolean;
  isDisabledAIModel: (model: string) => boolean;
  convertModelName: (name: string) => string;
  
  // 可用的Provider列表
  availableAIProviders: AIProvider[];
  availableSearchProviders: SearchProvider[];
}

export function useProviderConfig(): UseProviderConfigReturn {
  const { provider, searchProvider } = useSettingStore();
  const { modelList, refresh } = useModelList();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 计算思考模型列表
  const thinkingModelList = useMemo((): [string[], string[]] => {
    const { provider } = useSettingStore.getState();
    if (provider === "google") {
      return filterThinkingModelList(modelList) as [string[], string[]];
    } else if (provider === "openrouter") {
      return filterOpenRouterModelList(modelList) as [string[], string[]];
    } else if (provider === "deepseek") {
      return filterDeepSeekModelList(modelList) as [string[], string[]];
    } else if (provider === "mistral") {
      return filterMistralModelList(modelList) as [string[], string[]];
    } else if (provider === "pollinations") {
      return filterPollinationsModelList(modelList) as [string[], string[]];
    }
    return [[], modelList];
  }, [modelList]);

  // 计算网络模型列表
  const networkingModelList = useMemo((): [string[], string[]] => {
    const { provider } = useSettingStore.getState();
    if (provider === "google") {
      return filterNetworkingModelList(modelList) as [string[], string[]];
    } else if (provider === "openrouter") {
      return filterOpenRouterModelList(modelList) as [string[], string[]];
    } else if (provider === "openai") {
      return filterOpenAIModelList(modelList) as [string[], string[]];
    } else if (provider === "mistral") {
      return filterMistralModelList(modelList) as [string[], string[]];
    } else if (provider === "pollinations") {
      return filterPollinationsModelList(modelList) as [string[], string[]];
    }
    return [[], modelList];
  }, [modelList]);

  // Provider切换处理
  const handleProviderChange = useCallback(async (provider: string, setValue: (name: any, value: any) => void) => {
    await refresh(provider);
    setValue("provider", provider);
  }, [refresh]);

  // 搜索Provider切换处理
  const handleSearchProviderChange = useCallback((searchProvider: string, setValue: (name: any, value: any) => void) => {
    setValue("searchProvider", searchProvider);
  }, []);

  // 模型列表刷新
  const fetchModelList = useCallback(async () => {
    const { provider } = useSettingStore.getState();
    try {
      setIsRefreshing(true);
      await refresh(provider);
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  // 检查AI Provider是否被禁用
  const isDisabledAIProvider = useCallback((provider: AIProvider) => {
    return DISABLED_AI_PROVIDER.split(",").includes(provider);
  }, []);

  // 检查搜索Provider是否被禁用
  const isDisabledSearchProvider = useCallback((provider: SearchProvider) => {
    return DISABLED_SEARCH_PROVIDER.split(",").includes(provider);
  }, []);

  // 检查AI模型是否被禁用
  const isDisabledAIModel = useCallback((model: string) => {
    if (!MODEL_LIST) return false;
    const { disabledModelList } = getCustomModelList(MODEL_LIST.split(","));
    return disabledModelList.includes(model);
  }, []);

  // 转换模型名称显示格式
  const convertModelName = useCallback((name: string) => {
    return name
      .split(/[-_/]/)
      .map((word) => capitalize(word))
      .join(" ");
  }, []);

  // 计算可用的AI Provider列表
  const availableAIProviders = useMemo(() => {
    return AI_PROVIDERS.filter(provider => !isDisabledAIProvider(provider));
  }, [isDisabledAIProvider]);

  // 计算可用的搜索Provider列表
  const availableSearchProviders = useMemo(() => {
    return SEARCH_PROVIDERS.filter(provider => !isDisabledSearchProvider(provider));
  }, [isDisabledSearchProvider]);

  return {
    provider,
    searchProvider,
    modelList,
    thinkingModelList,
    networkingModelList,
    isRefreshing,
    handleProviderChange,
    handleSearchProviderChange,
    fetchModelList,
    isDisabledAIProvider,
    isDisabledSearchProvider,
    isDisabledAIModel,
    convertModelName,
    availableAIProviders,
    availableSearchProviders,
  };
}