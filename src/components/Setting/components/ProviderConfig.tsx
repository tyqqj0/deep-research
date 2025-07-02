import React from "react";
import { useTranslation } from "react-i18next";
import { FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Password } from "@/components/Internal/PasswordInput";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  PROVIDER_FIELD_MAPPING, 
  SEARCH_PROVIDER_FIELD_MAPPING,
  type AIProvider, 
  type SearchProvider
} from "../types";
import {
  GEMINI_BASE_URL,
  OPENROUTER_BASE_URL,
  OPENAI_BASE_URL,
  ANTHROPIC_BASE_URL,
  DEEPSEEK_BASE_URL,
  XAI_BASE_URL,
  MISTRAL_BASE_URL,
  POLLINATIONS_BASE_URL,
  OLLAMA_BASE_URL,
  TAVILY_BASE_URL,
  FIRECRAWL_BASE_URL,
  EXA_BASE_URL,
  BOCHA_BASE_URL,
  SEARXNG_BASE_URL,
} from "@/constants/urls";

interface ProviderConfigProps {
  provider: AIProvider | SearchProvider;
  type: 'ai' | 'search';
  form: any; // react-hook-form instance
  modelLists?: {
    thinkingModels: [string[], string[]];
    networkingModels: [string[], string[]];
  };
  isRefreshing?: boolean;
  onRefreshModels?: () => void;
  convertModelName?: (name: string) => string;
  isDisabledModel?: (model: string) => boolean;
}

const getDefaultApiUrl = (provider: string): string => {
  const urlMap: Record<string, string> = {
    google: GEMINI_BASE_URL,
    openrouter: OPENROUTER_BASE_URL,
    openai: OPENAI_BASE_URL,
    anthropic: ANTHROPIC_BASE_URL,
    deepseek: DEEPSEEK_BASE_URL,
    xai: XAI_BASE_URL,
    mistral: MISTRAL_BASE_URL,
    pollinations: POLLINATIONS_BASE_URL,
    ollama: OLLAMA_BASE_URL,
    tavily: TAVILY_BASE_URL,
    firecrawl: FIRECRAWL_BASE_URL,
    exa: EXA_BASE_URL,
    bocha: BOCHA_BASE_URL,
    searxng: SEARXNG_BASE_URL,
  };
  return urlMap[provider] || "";
};

export const ProviderConfig: React.FC<ProviderConfigProps> = ({
  provider,
  type,
  form,
  modelLists,
  isRefreshing = false,
  onRefreshModels,
  convertModelName,
  isDisabledModel,
}) => {
  const { t } = useTranslation();

  const fieldMapping = type === 'ai' 
    ? PROVIDER_FIELD_MAPPING[provider as AIProvider]
    : SEARCH_PROVIDER_FIELD_MAPPING[provider as SearchProvider];

  if (!fieldMapping) return null;

  const renderApiKeyField = () => {
    if (!('apiKey' in fieldMapping) || !fieldMapping.apiKey) return null;

    return (
      <FormField
        control={form.control}
        name={fieldMapping.apiKey}
        render={({ field }) => (
          <FormItem className="from-item">
            <FormLabel className="from-label">
              {t("setting.apiKeyLabel")}
              <span className="ml-1 text-red-500 max-sm:hidden">*</span>
            </FormLabel>
            <FormControl className="form-field">
              <Password
                type="text"
                placeholder={t("setting.apiKeyPlaceholder")}
                {...field}
                onBlur={() => form.setValue(fieldMapping.apiKey, form.getValues(fieldMapping.apiKey))}
              />
            </FormControl>
          </FormItem>
        )}
      />
    );
  };

  const renderApiProxyField = () => {
    if (!('apiProxy' in fieldMapping) || !fieldMapping.apiProxy) return null;

    return (
      <FormField
        control={form.control}
        name={fieldMapping.apiProxy}
        render={({ field }) => (
          <FormItem className="from-item">
            <FormLabel className="from-label">
              {t("setting.apiUrlLabel")}
            </FormLabel>
            <FormControl className="form-field">
              <Input
                placeholder={getDefaultApiUrl(provider)}
                {...field}
                onBlur={() => form.setValue(fieldMapping.apiProxy, form.getValues(fieldMapping.apiProxy))}
              />
            </FormControl>
          </FormItem>
        )}
      />
    );
  };

  const renderAzureSpecificFields = () => {
    if (provider !== 'azure') return null;

    return (
      <>
        <FormField
          control={form.control}
          name="azureResourceName"
          render={({ field }) => (
            <FormItem className="from-item">
              <FormLabel className="from-label">
                {t("setting.azureResourceName")}
                <span className="ml-1 text-red-500 max-sm:hidden">*</span>
              </FormLabel>
              <FormControl className="form-field">
                <Input
                  placeholder={t("setting.azureResourceNamePlaceholder")}
                  {...field}
                  onBlur={() => form.setValue("azureResourceName", form.getValues("azureResourceName"))}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="azureApiVersion"
          render={({ field }) => (
            <FormItem className="from-item">
              <FormLabel className="from-label">
                {t("setting.azureApiVersion")}
              </FormLabel>
              <FormControl className="form-field">
                <Input
                  placeholder="2024-02-15-preview"
                  {...field}
                  onBlur={() => form.setValue("azureApiVersion", form.getValues("azureApiVersion"))}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </>
    );
  };

  const renderModelSelect = (
    fieldName: string | undefined,
    label: string,
    models: [string[], string[]],
    placeholder: string
  ) => {
    if (!fieldName || !modelLists) return null;

    return (
      <FormField
        control={form.control}
        name={fieldName}
        render={({ field }) => (
          <FormItem className="from-item">
            <FormLabel className="from-label flex items-center gap-2">
              {label}
              {onRefreshModels && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onRefreshModels}
                  disabled={isRefreshing}
                  className="h-auto p-1"
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </FormLabel>
            <FormControl className="form-field">
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>{t("setting.recommendedModels")}</SelectLabel>
                    {models[0].map((model) => (
                      <SelectItem
                        key={model}
                        value={model}
                        disabled={isDisabledModel?.(model)}
                      >
                        {convertModelName?.(model) || model}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  {models[1].length > 0 && (
                    <SelectGroup>
                      <SelectLabel>{t("setting.allModels")}</SelectLabel>
                      {models[1].map((model) => (
                        <SelectItem
                          key={model}
                          value={model}
                          disabled={isDisabledModel?.(model)}
                        >
                          {convertModelName?.(model) || model}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </FormControl>
          </FormItem>
        )}
      />
    );
  };

  const renderScopeField = () => {
    if (!('scope' in fieldMapping) || !fieldMapping.scope) return null;

    let scopeOptions: { value: string; label: string }[] = [];
    
    if (provider === 'tavily') {
      scopeOptions = [
        { value: "search", label: t("setting.scopeSearch") },
        { value: "news", label: t("setting.scopeNews") },
      ];
    } else if (provider === 'exa') {
      scopeOptions = [
        { value: "search", label: t("setting.scopeSearch") },
        { value: "news", label: t("setting.scopeNews") },
      ];
    } else if (provider === 'searxng') {
      scopeOptions = [
        { value: "all", label: t("setting.scopeAll") },
        { value: "general", label: t("setting.scopeGeneral") },
        { value: "images", label: t("setting.scopeImages") },
        { value: "videos", label: t("setting.scopeVideos") },
        { value: "news", label: t("setting.scopeNews") },
        { value: "map", label: t("setting.scopeMap") },
        { value: "music", label: t("setting.scopeMusic") },
        { value: "it", label: t("setting.scopeIT") },
        { value: "science", label: t("setting.scopeScience") },
        { value: "social media", label: t("setting.scopeSocialMedia") },
      ];
    }

    if (scopeOptions.length === 0) return null;

    return (
      <FormField
        control={form.control}
        name={fieldMapping.scope}
        render={({ field }) => (
          <FormItem className="from-item">
            <FormLabel className="from-label">
              {t("setting.searchScope")}
            </FormLabel>
            <FormControl className="form-field">
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("setting.selectScope")} />
                </SelectTrigger>
                <SelectContent>
                  {scopeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
          </FormItem>
        )}
      />
    );
  };

  return (
    <div className="space-y-4">
      {renderApiKeyField()}
      {renderApiProxyField()}
      {renderAzureSpecificFields()}
      {renderScopeField()}
      
      {/* AI Provider特有的模型选择 */}
      {type === 'ai' && modelLists && (
        <>
          {renderModelSelect(
            'thinkingModel' in fieldMapping ? fieldMapping.thinkingModel : undefined,
            t("setting.thinkingModelLabel"),
            modelLists.thinkingModels,
            t("setting.thinkingModelPlaceholder")
          )}
          {renderModelSelect(
            'networkingModel' in fieldMapping ? fieldMapping.networkingModel : undefined,
            t("setting.networkingModelLabel"),
            modelLists.networkingModels,
            t("setting.networkingModelPlaceholder")
          )}
        </>
      )}
    </div>
  );
};

export default ProviderConfig;