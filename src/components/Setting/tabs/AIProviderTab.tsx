import { useState } from "react";
import { RefreshCw, CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Password } from "@/components/Internal/PasswordInput";
import { ProviderConfig } from "../components/ProviderConfig";
import { useSettingForm } from "../hooks/useSettingForm";
import { useProviderConfig } from "../hooks/useProviderConfig";
import { HelpTipProps, BUILD_MODE } from "../types";
import { cn } from "@/utils/style";

function HelpTip({ children, tip }: HelpTipProps) {
  const [open, setOpen] = useState<boolean>(false);
  const handleOpen = () => {
    setOpen(true);
    setTimeout(() => {
      setOpen(false);
    }, 2000);
  };

  return (
    <div className="flex items-center">
      <span className="flex-1">{children}</span>
      <TooltipProvider delayDuration={100}>
        <Tooltip open={open} onOpenChange={(opened) => setOpen(opened)}>
          <TooltipTrigger asChild>
            <CircleHelp
              className="cursor-help w-4 h-4 ml-1 opacity-50 max-sm:ml-0"
              onClick={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                handleOpen();
              }}
            />
          </TooltipTrigger>
          <TooltipContent className="max-w-52">
            <p>{tip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

interface AIProviderTabProps {
  form: ReturnType<typeof useSettingForm>["form"];
  handleModeChange: (mode: string) => void;
}

export function AIProviderTab({ form, handleModeChange }: AIProviderTabProps) {
  const { t } = useTranslation();
  const {
    provider,
    thinkingModelList,
    networkingModelList,
    isRefreshing,
    handleProviderChange,
    fetchModelList,
    isDisabledAIProvider,
    isDisabledAIModel,
    convertModelName,
    availableAIProviders,
  } = useProviderConfig();

  return (
    <div className="space-y-4 min-h-[250px]">
      {/* 模式选择 */}
      <div className={BUILD_MODE === "export" ? "hidden" : ""}>
        <FormField
          control={form.control}
          name="mode"
          render={({ field }) => (
            <FormItem className="from-item">
              <FormLabel className="from-label">
                <HelpTip tip={t("setting.modeTip")}>
                  {t("setting.mode")}
                </HelpTip>
              </FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    handleModeChange(value);
                  }}
                >
                  <SelectTrigger className="form-field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-sm:max-h-48">
                    <SelectItem value="local">
                      {t("setting.local")}
                    </SelectItem>
                    <SelectItem value="proxy">
                      {t("setting.proxy")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      {/* Provider选择 */}
      <FormField
        control={form.control}
        name="provider"
        render={({ field }) => (
          <FormItem className="from-item">
            <FormLabel className="from-label">
              <HelpTip tip={t("setting.providerTip")}>
                {t("setting.provider")}
              </HelpTip>
            </FormLabel>
            <FormControl>
              <Select
                value={field.value}
                onValueChange={(value) =>
                  handleProviderChange(value, form.setValue)
                }
              >
                <SelectTrigger className="form-field">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-sm:max-h-48">
                  {availableAIProviders.map((provider) => (
                    <SelectItem
                      key={provider}
                      value={provider}
                      disabled={isDisabledAIProvider(provider)}
                    >
                      {t(`setting.providers.${provider}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
          </FormItem>
        )}
      />

      {/* Access Password */}
      <div className={cn({
        hidden: form.getValues("mode") !== "proxy" || BUILD_MODE === "export",
      })}>
        <FormField
          control={form.control}
          name="accessPassword"
          render={({ field }) => (
            <FormItem className="from-item">
              <FormLabel className="from-label">
                <HelpTip tip={t("setting.accessPasswordTip")}>
                  {t("setting.accessPassword")}
                </HelpTip>
              </FormLabel>
              <FormControl className="form-field">
                <Password
                  placeholder={t("setting.accessPasswordPlaceholder")}
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      {/* 各种Provider的配置 */}
      <div className={cn({
        hidden: form.getValues("mode") !== "local",
      })}>
        <div className="space-y-6">
          {/* Google Provider */}
          <ProviderConfig
            provider="google"
            currentProvider={provider}
            form={form}
            baseUrl="https://generativelanguage.googleapis.com"
            hasThinkingModel={true}
            hasNetworkingModel={true}
          />

          {/* OpenRouter Provider */}
          <ProviderConfig
            provider="openrouter"
            currentProvider={provider}
            form={form}
            baseUrl="https://openrouter.ai/api/v1"
            hasThinkingModel={true}
            hasNetworkingModel={true}
          />

          {/* OpenAI Provider */}
          <ProviderConfig
            provider="openai"
            currentProvider={provider}
            form={form}
            baseUrl="https://api.openai.com/v1"
            hasThinkingModel={true}
            hasNetworkingModel={true}
          />

          {/* Anthropic Provider */}
          <ProviderConfig
            provider="anthropic"
            currentProvider={provider}
            form={form}
            baseUrl="https://api.anthropic.com"
            hasThinkingModel={true}
            hasNetworkingModel={true}
          />

          {/* DeepSeek Provider */}
          <ProviderConfig
            provider="deepseek"
            currentProvider={provider}
            form={form}
            baseUrl="https://api.deepseek.com/v1"
            hasThinkingModel={true}
            hasNetworkingModel={true}
          />

          {/* xAI Provider */}
          <ProviderConfig
            provider="xai"
            currentProvider={provider}
            form={form}
            baseUrl="https://api.x.ai/v1"
            hasThinkingModel={true}
            hasNetworkingModel={true}
          />

          {/* Mistral Provider */}
          <ProviderConfig
            provider="mistral"
            currentProvider={provider}
            form={form}
            baseUrl="https://api.mistral.ai/v1"
            hasThinkingModel={true}
            hasNetworkingModel={true}
          />

          {/* Azure Provider - 特殊处理 */}
          <div className={cn("space-y-4", {
            hidden: provider !== "azure",
          })}>
            <div className="text-sm font-medium text-muted-foreground border-b pb-2">
              {t("setting.providers.azure")} 配置
            </div>
            <FormField
              control={form.control}
              name="azureApiKey"
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
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="azureResourceName"
              render={({ field }) => (
                <FormItem className="from-item">
                  <FormLabel className="from-label">
                    {t("setting.resourceNameLabel")}
                    <span className="ml-1 text-red-500 max-sm:hidden">*</span>
                  </FormLabel>
                  <FormControl className="form-field">
                    <Input
                      placeholder={t("setting.resourceNamePlaceholder")}
                      {...field}
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
                    {t("setting.apiVersionLabel")}
                  </FormLabel>
                  <FormControl className="form-field">
                    <Input
                      placeholder={t("setting.apiVersionPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {/* OpenAI Compatible Provider */}
          <ProviderConfig
            provider="openaicompatible"
            currentProvider={provider}
            form={form}
            baseUrl={t("setting.apiUrlPlaceholder")}
            hasThinkingModel={true}
            hasNetworkingModel={true}
          />

          {/* Pollinations Provider - 无API Key */}
          <div className={cn("space-y-4", {
            hidden: provider !== "pollinations",
          })}>
            <div className="text-sm font-medium text-muted-foreground border-b pb-2">
              {t("setting.providers.pollinations")} 配置
            </div>
            <FormField
              control={form.control}
              name="pollinationsApiProxy"
              render={({ field }) => (
                <FormItem className="from-item">
                  <FormLabel className="from-label">
                    {t("setting.apiUrlLabel")}
                  </FormLabel>
                  <FormControl className="form-field">
                    <Input
                      placeholder="https://text.pollinations.ai"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {/* Ollama Provider - 无API Key */}
          <div className={cn("space-y-4", {
            hidden: provider !== "ollama",
          })}>
            <div className="text-sm font-medium text-muted-foreground border-b pb-2">
              {t("setting.providers.ollama")} 配置
            </div>
            <FormField
              control={form.control}
              name="ollamaApiProxy"
              render={({ field }) => (
                <FormItem className="from-item">
                  <FormLabel className="from-label">
                    {t("setting.apiUrlLabel")}
                  </FormLabel>
                  <FormControl className="form-field">
                    <Input
                      placeholder="http://localhost:11434"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {/* 模型选择区域 */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{t("setting.modelSelection")}</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={fetchModelList}
                disabled={isRefreshing}
                className="h-8 w-8 p-0"
              >
                <RefreshCw
                  className={cn("h-4 w-4", {
                    "animate-spin": isRefreshing,
                  })}
                />
              </Button>
            </div>

            {/* 思考模型选择 */}
            <FormField
              control={form.control}
              name={`${provider}ThinkingModel` as any}
              render={({ field }) => (
                <FormItem className="from-item">
                  <FormLabel className="from-label">
                    <HelpTip tip={t("setting.thinkingModelTip")}>
                      {t("setting.thinkingModel")}
                    </HelpTip>
                  </FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="form-field">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-sm:max-h-48">
                        {thinkingModelList[0]?.map((model: string) => (
                          <SelectItem
                            key={model}
                            value={model}
                            disabled={isDisabledAIModel(model)}
                          >
                            {convertModelName(model)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />

            {/* 网络模型选择 */}
            <FormField
              control={form.control}
              name={`${provider}NetworkingModel` as any}
              render={({ field }) => (
                <FormItem className="from-item">
                  <FormLabel className="from-label">
                    <HelpTip tip={t("setting.networkingModelTip")}>
                      {t("setting.networkingModel")}
                    </HelpTip>
                  </FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="form-field">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-sm:max-h-48">
                        {networkingModelList[0]?.map((model: string) => (
                          <SelectItem
                            key={model}
                            value={model}
                            disabled={isDisabledAIModel(model)}
                          >
                            {convertModelName(model)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}