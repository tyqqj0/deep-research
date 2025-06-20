"use client";
import {
  useLayoutEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { usePWAInstall } from "react-use-pwa-install";
import { RefreshCw, CircleHelp, MonitorDown } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Password } from "@/components/Internal/PasswordInput";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectLabel,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useModel from "@/hooks/useModelList";
import { useSettingStore } from "@/store/setting";
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
import locales from "@/constants/locales";
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
import { researchStore } from "@/utils/storage";
import { cn } from "@/utils/style";
import { capitalize } from "radash";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type SettingProps = {
  open: boolean;
  onClose: () => void;
};

const BUILD_MODE = process.env.NEXT_PUBLIC_BUILD_MODE;
const VERSION = process.env.NEXT_PUBLIC_VERSION;
const DISABLED_AI_PROVIDER = process.env.NEXT_PUBLIC_DISABLED_AI_PROVIDER || "";
const DISABLED_SEARCH_PROVIDER =
  process.env.NEXT_PUBLIC_DISABLED_SEARCH_PROVIDER || "";
const MODEL_LIST = process.env.NEXT_PUBLIC_MODEL_LIST || "";
const PREDEFINED_DOMAINS = {
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
};

const domainLimitSchema = z.object({
  predefined: z.array(z.string()),
  custom: z.array(z.string()),
});

const formSchema = z.object({
  provider: z.string(),
  mode: z.string().optional(),
  apiKey: z.string().optional(),
  apiProxy: z.string().optional(),
  thinkingModel: z.string().optional(),
  networkingModel: z.string().optional(),
  openRouterApiKey: z.string().optional(),
  openRouterApiProxy: z.string().optional(),
  openRouterThinkingModel: z.string().optional(),
  openRouterNetworkingModel: z.string().optional(),
  openAIApiKey: z.string().optional(),
  openAIApiProxy: z.string().optional(),
  openAIThinkingModel: z.string().optional(),
  openAINetworkingModel: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  anthropicApiProxy: z.string().optional(),
  anthropicThinkingModel: z.string().optional(),
  anthropicNetworkingModel: z.string().optional(),
  deepseekApiKey: z.string().optional(),
  deepseekApiProxy: z.string().optional(),
  deepseekThinkingModel: z.string().optional(),
  deepseekNetworkingModel: z.string().optional(),
  xAIApiKey: z.string().optional(),
  xAIApiProxy: z.string().optional(),
  xAIThinkingModel: z.string().optional(),
  xAINetworkingModel: z.string().optional(),
  mistralApiKey: z.string().optional(),
  mistralApiProxy: z.string().optional(),
  mistralThinkingModel: z.string().optional(),
  mistralNetworkingModel: z.string().optional(),
  azureApiKey: z.string().optional(),
  azureResourceName: z.string().optional(),
  azureApiVersion: z.string().optional(),
  azureThinkingModel: z.string().optional(),
  azureNetworkingModel: z.string().optional(),
  openAICompatibleApiKey: z.string().optional(),
  openAICompatibleApiProxy: z.string().optional(),
  openAICompatibleThinkingModel: z.string().optional(),
  openAICompatibleNetworkingModel: z.string().optional(),
  pollinationsApiProxy: z.string().optional(),
  pollinationsThinkingModel: z.string().optional(),
  pollinationsNetworkingModel: z.string().optional(),
  ollamaApiProxy: z.string().optional(),
  ollamaThinkingModel: z.string().optional(),
  ollamaNetworkingModel: z.string().optional(),
  accessPassword: z.string().optional(),
  enableSearch: z.string(),
  searchProvider: z.string().optional(),
  tavilyApiKey: z.string().optional(),
  tavilyApiProxy: z.string().optional(),
  tavilyScope: z.string().optional(),
  firecrawlApiKey: z.string().optional(),
  firecrawlApiProxy: z.string().optional(),
  exaApiKey: z.string().optional(),
  exaApiProxy: z.string().optional(),
  exaScope: z.string().optional(),
  bochaApiKey: z.string().optional(),
  bochaApiProxy: z.string().optional(),
  searxngApiProxy: z.string().optional(),
  searxngScope: z.string().optional(),
  parallelSearch: z.number().min(1).max(5),
  searchMaxResult: z.number().min(1).max(10),
  language: z.string().optional(),
  theme: z.string().optional(),
  debug: z.string().optional(),
  references: z.string().optional(),
  citationImage: z.string().optional(),
  searchDomainStrategy: z.object({
    tavily: z.object({
      domains: domainLimitSchema,
    }),
  }),
});

function convertModelName(name: string) {
  return name
    .replaceAll("/", "-")
    .split("-")
    .map((word) => capitalize(word))
    .join(" ");
}

let preLoading = false;

function HelpTip({ children, tip }: { children: ReactNode; tip: string }) {
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

function Setting({ open, onClose }: SettingProps) {
  const { t } = useTranslation();
  const { mode, provider, searchProvider, update } = useSettingStore();
  const { modelList, refresh } = useModel();
  const pwaInstall = usePWAInstall();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const thinkingModelList = useMemo(() => {
    const { provider } = useSettingStore.getState();
    if (provider === "google") {
      return filterThinkingModelList(modelList);
    } else if (provider === "openrouter") {
      return filterOpenRouterModelList(modelList);
    } else if (provider === "deepseek") {
      return filterDeepSeekModelList(modelList);
    } else if (provider === "mistral") {
      return filterMistralModelList(modelList);
    } else if (provider === "pollinations") {
      return filterPollinationsModelList(modelList);
    }
    return [[], modelList];
  }, [modelList]);
  const networkingModelList = useMemo(() => {
    const { provider } = useSettingStore.getState();
    if (provider === "google") {
      return filterNetworkingModelList(modelList);
    } else if (provider === "openrouter") {
      return filterOpenRouterModelList(modelList);
    } else if (provider === "openai") {
      return filterOpenAIModelList(modelList);
    } else if (provider === "mistral") {
      return filterMistralModelList(modelList);
    } else if (provider === "pollinations") {
      return filterPollinationsModelList(modelList);
    }
    return [[], modelList];
  }, [modelList]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: async () => {
      if (preLoading) return {} as any;
      preLoading = true;
      const values = await useSettingStore.getState();
      preLoading = false;
      // Compatibility for old structure
      if ((values as any).searchDomainStrategy?.tavily?.academicDomains) {
        (values as any).searchDomainStrategy.tavily.domains = (
          values as any
        ).searchDomainStrategy.tavily.academicDomains;
        delete (values as any).searchDomainStrategy.tavily.academicDomains;
      }
      return values;
    },
  });

  const [customDomainInput, setCustomDomainInput] = useState("");

  const isDisabledAIProvider = useCallback(
    (provider: string) => {
      const disabledAIProviders =
        mode === "proxy" && DISABLED_AI_PROVIDER.length > 0
          ? DISABLED_AI_PROVIDER.split(",")
          : [];
      return disabledAIProviders.includes(provider);
    },
    [mode]
  );

  const isDisabledAIModel = useCallback(
    (model: string) => {
      if (mode === "local") return false;
      const { availableModelList, disabledModelList } = getCustomModelList(
        MODEL_LIST.length > 0 ? MODEL_LIST.split(",") : []
      );
      const isAvailableModel = availableModelList.some(
        (availableModel) => availableModel === model
      );
      if (isAvailableModel) return false;
      if (disabledModelList.includes("all")) return true;
      return disabledModelList.some((disabledModel) => disabledModel === model);
    },
    [mode]
  );

  const isDisabledSearchProvider = useCallback(
    (provider: string) => {
      const disabledSearchProviders =
        mode === "proxy" && DISABLED_SEARCH_PROVIDER.length > 0
          ? DISABLED_SEARCH_PROVIDER.split(",")
          : [];
      return disabledSearchProviders.includes(provider);
    },
    [mode]
  );

  const installPWA = async () => {
    if ("serviceWorker" in navigator) {
      await window.serwist?.register();
    }
    if (pwaInstall) await pwaInstall();
  };

  function handleClose(open: boolean) {
    if (!open) {
      form.reset(useSettingStore.getState());
      onClose();
    }
  }

  function handleSubmit(values: z.infer<typeof formSchema>) {
    update(values);
    toast.success(t("setting.saveSuccess"));
    handleClose(false);
  }

  const fetchModelList = useCallback(async () => {
    const { provider } = useSettingStore.getState();
    try {
      setIsRefreshing(true);
      await refresh(provider);
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  function handleModeChange(mode: string) {
    update({ mode });
  }

  async function handleProviderChange(provider: string) {
    await refresh(provider);
    form.setValue("provider", provider);
  }

  async function handleSearchProviderChange(searchProvider: string) {
    form.setValue("searchProvider", searchProvider);
  }

  function handleReset() {
    toast.warning(t("setting.resetSetting"), {
      description: t("setting.resetSettingWarning"),
      duration: 5000,
      action: {
        label: t("setting.confirm"),
        onClick: async () => {
          const { reset } = useSettingStore.getState();
          reset();
          await researchStore.clear();
        },
      },
    });
  }

  function handleAddCustomDomain() {
    if (customDomainInput.trim() === "") return;
    const currentDomains =
      form.getValues("searchDomainStrategy.tavily.domains.custom") || [];
    const newDomains = customDomainInput
      .split(/[\s,]+/)
      .map((d) => d.trim().replace(/https?:\/\//, ""))
      .filter((d) => d && !currentDomains.includes(d));

    if (newDomains.length > 0) {
      form.setValue(
        "searchDomainStrategy.tavily.domains.custom",
        [...currentDomains, ...newDomains]
      );
    }
    setCustomDomainInput("");
  }

  function handleRemoveCustomDomain(domainToRemove: string) {
    const currentDomains =
      form.getValues("searchDomainStrategy.tavily.domains.custom") || [];
    form.setValue(
      "searchDomainStrategy.tavily.domains.custom",
      currentDomains.filter((d) => d !== domainToRemove)
    );
  }

  useLayoutEffect(() => {
    if (open && !preLoading) {
      preLoading = true;
      fetchModelList();
    }
  }, [open, fetchModelList]);

  useLayoutEffect(() => {
    if (open && mode === "") {
      const { apiKey, accessPassword, update } = useSettingStore.getState();
      const requestMode = !apiKey && accessPassword ? "proxy" : "local";
      update({ mode: requestMode });
      form.setValue("mode", requestMode);
    }
  }, [open, mode, form]);

  // async function form.setValue(key: keyof z.infer<typeof formSchema>, value?: string | number) {
  //   form.setValue(key, value as any);
  // }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-lg:max-w-md print:hidden">
        <DialogHeader>
          <DialogTitle>{t("setting.title")}</DialogTitle>
          <DialogDescription>{t("setting.description")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4">
            <Tabs defaultValue="llm">
              <TabsList className="w-full mb-2">
                <TabsTrigger className="flex-1" value="llm">
                  {t("setting.model")}
                </TabsTrigger>
                <TabsTrigger className="flex-1" value="search">
                  {t("setting.search")}
                </TabsTrigger>
                <TabsTrigger className="flex-1" value="general">
                  {t("setting.general")}
                </TabsTrigger>
                <TabsTrigger className="flex-1" value="experimental">
                  {t("setting.experimental")}
                </TabsTrigger>
              </TabsList>
              <TabsContent className="space-y-4  min-h-[250px]" value="llm">
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
                          onValueChange={(value) => {
                            field.onChange(value);
                            handleProviderChange(value);
                          }}
                        >
                          <SelectTrigger className="form-field">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-sm:max-h-72">
                            {!isDisabledAIProvider("google") ? (
                              <SelectItem value="google">
                                Google AI Studio
                              </SelectItem>
                            ) : null}
                            {!isDisabledAIProvider("openai") ? (
                              <SelectItem value="openai">OpenAI</SelectItem>
                            ) : null}
                            {!isDisabledAIProvider("anthropic") ? (
                              <SelectItem value="anthropic">
                                Anthropic
                              </SelectItem>
                            ) : null}
                            {!isDisabledAIProvider("deepseek") ? (
                              <SelectItem value="deepseek">DeepSeek</SelectItem>
                            ) : null}
                            {!isDisabledAIProvider("xai") ? (
                              <SelectItem value="xai">xAI Grok</SelectItem>
                            ) : null}
                            {!isDisabledAIProvider("mistral") ? (
                              <SelectItem value="mistral">Mistral</SelectItem>
                            ) : null}
                            {!isDisabledAIProvider("azure") ? (
                              <SelectItem value="azure">
                                Azure OpenAI
                              </SelectItem>
                            ) : null}
                            {!isDisabledAIProvider("openrouter") ? (
                              <SelectItem value="openrouter">
                                OpenRouter
                              </SelectItem>
                            ) : null}
                            {!isDisabledAIProvider("openaicompatible") ? (
                              <SelectItem value="openaicompatible">
                                {t("setting.openAICompatible")}
                              </SelectItem>
                            ) : null}
                            {!isDisabledAIProvider("pollinations") ? (
                              <SelectItem value="pollinations">
                                Pollinations ({t("setting.free")})
                              </SelectItem>
                            ) : null}
                            {!isDisabledAIProvider("ollama") ? (
                              <SelectItem value="ollama">Ollama</SelectItem>
                            ) : null}
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className={mode === "proxy" ? "hidden" : ""}>
                  <div
                    className={cn("space-y-4", {
                      hidden: provider !== "google",
                    })}
                  >
                    <FormField
                      control={form.control}
                      name="apiKey"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiKeyLabel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </FormLabel>
                          <FormControl className="form-field">
                            <Password
                              type="text"
                              placeholder={t("setting.apiKeyPlaceholder")}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "apiKey",
                                  form.getValues("apiKey")
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="apiProxy"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiUrlLabel")}
                          </FormLabel>
                          <FormControl className="form-field">
                            <Input
                              placeholder={GEMINI_BASE_URL}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "apiProxy",
                                  form.getValues("apiProxy")
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div
                    className={cn("space-y-4", {
                      hidden: provider !== "openrouter",
                    })}
                  >
                    <FormField
                      control={form.control}
                      name="openRouterApiKey"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiKeyLabel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </FormLabel>
                          <FormControl className="form-field">
                            <Password
                              type="text"
                              placeholder={t("setting.apiKeyPlaceholder")}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "openRouterApiKey",
                                  form.getValues("openRouterApiKey")
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="openRouterApiProxy"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiUrlLabel")}
                          </FormLabel>
                          <FormControl className="form-field">
                            <Input
                              placeholder={OPENROUTER_BASE_URL}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "openRouterApiProxy",
                                  form.getValues("openRouterApiProxy")
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div
                    className={cn("space-y-4", {
                      hidden: provider !== "openai",
                    })}
                  >
                    <FormField
                      control={form.control}
                      name="openAIApiKey"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiKeyLabel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </FormLabel>
                          <FormControl className="form-field">
                            <Password
                              type="text"
                              placeholder={t("setting.apiKeyPlaceholder")}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "openAIApiKey",
                                  form.getValues("openAIApiKey")
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="openAIApiProxy"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiUrlLabel")}
                          </FormLabel>
                          <FormControl className="form-field">
                            <Input
                              placeholder={OPENAI_BASE_URL}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "openAIApiProxy",
                                  form.getValues("openAIApiProxy")
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div
                    className={cn("space-y-4", {
                      hidden: provider !== "anthropic",
                    })}
                  >
                    <FormField
                      control={form.control}
                      name="anthropicApiKey"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiKeyLabel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </FormLabel>
                          <FormControl className="form-field">
                            <Password
                              type="text"
                              placeholder={t("setting.apiKeyPlaceholder")}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "anthropicApiKey",
                                  form.getValues("anthropicApiKey")
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="anthropicApiProxy"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiUrlLabel")}
                          </FormLabel>
                          <FormControl className="form-field">
                            <Input
                              placeholder={ANTHROPIC_BASE_URL}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "anthropicApiProxy",
                                  form.getValues("anthropicApiProxy")
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div
                    className={cn("space-y-4", {
                      hidden: provider !== "deepseek",
                    })}
                  >
                    <FormField
                      control={form.control}
                      name="deepseekApiKey"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiKeyLabel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </FormLabel>
                          <FormControl className="form-field">
                            <Password
                              type="text"
                              placeholder={t("setting.apiKeyPlaceholder")}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "deepseekApiKey",
                                  form.getValues("deepseekApiKey")
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="deepseekApiProxy"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiUrlLabel")}
                          </FormLabel>
                          <FormControl className="form-field">
                            <Input
                              placeholder={DEEPSEEK_BASE_URL}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "deepseekApiProxy",
                                  form.getValues("deepseekApiProxy")
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div
                    className={cn("space-y-4", {
                      hidden: provider !== "xai",
                    })}
                  >
                    <FormField
                      control={form.control}
                      name="xAIApiKey"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiKeyLabel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </FormLabel>
                          <FormControl className="form-field">
                            <Password
                              type="text"
                              placeholder={t("setting.apiKeyPlaceholder")}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "xAIApiKey",
                                  form.getValues("xAIApiKey")
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="xAIApiProxy"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiUrlLabel")}
                          </FormLabel>
                          <FormControl className="form-field">
                            <Input
                              placeholder={XAI_BASE_URL}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "xAIApiProxy",
                                  form.getValues("xAIApiProxy")
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div
                    className={cn("space-y-4", {
                      hidden: provider !== "mistral",
                    })}
                  >
                    <FormField
                      control={form.control}
                      name="mistralApiKey"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiKeyLabel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </FormLabel>
                          <FormControl className="form-field">
                            <Password
                              type="text"
                              placeholder={t("setting.apiKeyPlaceholder")}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "mistralApiKey",
                                  form.getValues("mistralApiKey")
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="mistralApiProxy"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiUrlLabel")}
                          </FormLabel>
                          <FormControl className="form-field">
                            <Input
                              placeholder={MISTRAL_BASE_URL}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "mistralApiProxy",
                                  form.getValues("mistralApiProxy")
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div
                    className={cn("space-y-4", {
                      hidden: provider !== "azure",
                    })}
                  >
                    <FormField
                      control={form.control}
                      name="azureApiKey"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiKeyLabel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </FormLabel>
                          <FormControl className="form-field">
                            <Password
                              type="text"
                              placeholder={t("setting.apiKeyPlaceholder")}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "azureApiKey",
                                  form.getValues("azureApiKey")
                                )
                              }
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
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </FormLabel>
                          <FormControl className="form-field">
                            <Input
                              placeholder={t("setting.resourceNamePlaceholder")}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "azureResourceName",
                                  form.getValues("azureResourceName")
                                )
                              }
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
                              onBlur={() =>
                                form.setValue(
                                  "azureApiVersion",
                                  form.getValues("azureApiVersion")
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div
                    className={cn("space-y-4", {
                      hidden: provider !== "openaicompatible",
                    })}
                  >
                    <FormField
                      control={form.control}
                      name="openAICompatibleApiKey"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiKeyLabel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </FormLabel>
                          <FormControl className="form-field">
                            <Password
                              type="text"
                              placeholder={t("setting.apiKeyPlaceholder")}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "openAICompatibleApiKey",
                                  form.getValues("openAICompatibleApiKey")
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="openAICompatibleApiProxy"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiUrlLabel")}
                          </FormLabel>
                          <FormControl className="form-field">
                            <Input
                              placeholder={t("setting.apiUrlPlaceholder")}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "openAICompatibleApiProxy",
                                  form.getValues("openAICompatibleApiProxy")
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div
                    className={cn("space-y-4", {
                      hidden: provider !== "pollinations",
                    })}
                  >
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
                              placeholder={POLLINATIONS_BASE_URL}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "pollinationsApiProxy",
                                  form.getValues("pollinationsApiProxy")
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div
                    className={cn("space-y-4", {
                      hidden: provider !== "ollama",
                    })}
                  >
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
                              placeholder={OLLAMA_BASE_URL}
                              {...field}
                              onBlur={() =>
                                form.setValue(
                                  "ollamaApiProxy",
                                  form.getValues("ollamaApiProxy")
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                <div
                  className={cn("space-y-4", {
                    hidden: mode === "local" || BUILD_MODE === "export",
                  })}
                >
                  <FormField
                    control={form.control}
                    name="accessPassword"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.accessPasswordTip")}>
                            {t("setting.accessPassword")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl className="form-field">
                          <Password
                            type="text"
                            placeholder={t("setting.accessPasswordPlaceholder")}
                            {...field}
                            onBlur={() =>
                              form.setValue(
                                "accessPassword",
                                form.getValues("accessPassword")
                              )
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div
                  className={cn("space-y-4", {
                    hidden: provider !== "google",
                  })}
                >
                  <FormField
                    control={form.control}
                    name="thinkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.thinkingModelTip")}>
                            {t("setting.thinkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full">
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                className={cn({
                                  hidden: modelList.length === 0,
                                })}
                              >
                                <SelectValue
                                  placeholder={t(
                                    "setting.modelListLoadingPlaceholder"
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent className="max-sm:max-h-72">
                                {thinkingModelList[0].length > 0 ? (
                                  <SelectGroup>
                                    <SelectLabel>
                                      {t("setting.recommendedModels")}
                                    </SelectLabel>
                                    {thinkingModelList[0].map((name) => {
                                      return !isDisabledAIModel(name) ? (
                                        <SelectItem key={name} value={name}>
                                          {convertModelName(name)}
                                        </SelectItem>
                                      ) : null;
                                    })}
                                  </SelectGroup>
                                ) : null}
                                <SelectGroup>
                                  <SelectLabel>
                                    {t("setting.basicModels")}
                                  </SelectLabel>
                                  {thinkingModelList[1].map((name) => {
                                    return !isDisabledAIModel(name) ? (
                                      <SelectItem key={name} value={name}>
                                        {convertModelName(name)}
                                      </SelectItem>
                                    ) : null;
                                  })}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <Button
                              className={cn("w-full", {
                                hidden: modelList.length > 0,
                              })}
                              type="button"
                              variant="outline"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              {isRefreshing ? (
                                <>
                                  <RefreshCw className="animate-spin" />{" "}
                                  {t("setting.modelListLoading")}
                                </>
                              ) : (
                                <>
                                  <RefreshCw /> {t("setting.refresh")}
                                </>
                              )}
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="networkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.networkingModelTip")}>
                            {t("setting.networkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full">
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                className={cn({
                                  hidden: modelList.length === 0,
                                })}
                              >
                                <SelectValue
                                  placeholder={t(
                                    "setting.modelListLoadingPlaceholder"
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent className="max-sm:max-h-72">
                                {networkingModelList[0].length > 0 ? (
                                  <SelectGroup>
                                    <SelectLabel>
                                      {t("setting.recommendedModels")}
                                    </SelectLabel>
                                    {networkingModelList[0].map((name) => {
                                      return !isDisabledAIModel(name) ? (
                                        <SelectItem key={name} value={name}>
                                          {convertModelName(name)}
                                        </SelectItem>
                                      ) : null;
                                    })}
                                  </SelectGroup>
                                ) : null}
                                <SelectGroup>
                                  <SelectLabel>
                                    {t("setting.basicModels")}
                                  </SelectLabel>
                                  {networkingModelList[1].map((name) => {
                                    return !isDisabledAIModel(name) ? (
                                      <SelectItem key={name} value={name}>
                                        {convertModelName(name)}
                                      </SelectItem>
                                    ) : null;
                                  })}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <Button
                              className={cn("w-full", {
                                hidden: modelList.length > 0,
                              })}
                              type="button"
                              variant="outline"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              {isRefreshing ? (
                                <>
                                  <RefreshCw className="animate-spin" />{" "}
                                  {t("setting.modelListLoading")}
                                </>
                              ) : (
                                <>
                                  <RefreshCw /> {t("setting.refresh")}
                                </>
                              )}
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div
                  className={cn("space-y-4", {
                    hidden: provider !== "openrouter",
                  })}
                >
                  <FormField
                    control={form.control}
                    name="openRouterThinkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.thinkingModelTip")}>
                            {t("setting.thinkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full">
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                className={cn({
                                  hidden: modelList.length === 0,
                                })}
                              >
                                <SelectValue
                                  placeholder={t(
                                    "setting.modelListLoadingPlaceholder"
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent className="max-sm:max-h-72">
                                {thinkingModelList[0].length > 0 ? (
                                  <SelectGroup>
                                    <SelectLabel>
                                      {t("setting.recommendedModels")}
                                    </SelectLabel>
                                    {thinkingModelList[0].map((name) => {
                                      return !isDisabledAIModel(name) ? (
                                        <SelectItem key={name} value={name}>
                                          {convertModelName(name)}
                                        </SelectItem>
                                      ) : null;
                                    })}
                                  </SelectGroup>
                                ) : null}
                                <SelectGroup>
                                  <SelectLabel>
                                    {t("setting.basicModels")}
                                  </SelectLabel>
                                  {thinkingModelList[1].map((name) => {
                                    return !isDisabledAIModel(name) ? (
                                      <SelectItem key={name} value={name}>
                                        {convertModelName(name)}
                                      </SelectItem>
                                    ) : null;
                                  })}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <Button
                              className={cn("w-full", {
                                hidden: modelList.length > 0,
                              })}
                              type="button"
                              variant="outline"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              {isRefreshing ? (
                                <>
                                  <RefreshCw className="animate-spin" />{" "}
                                  {t("setting.modelListLoading")}
                                </>
                              ) : (
                                <>
                                  <RefreshCw /> {t("setting.refresh")}
                                </>
                              )}
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="openRouterNetworkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.networkingModelTip")}>
                            {t("setting.networkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full">
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                className={cn({
                                  hidden: modelList.length === 0,
                                })}
                              >
                                <SelectValue
                                  placeholder={t(
                                    "setting.modelListLoadingPlaceholder"
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent className="max-sm:max-h-72">
                                {networkingModelList[0].length > 0 ? (
                                  <SelectGroup>
                                    <SelectLabel>
                                      {t("setting.recommendedModels")}
                                    </SelectLabel>
                                    {networkingModelList[0].map((name) => {
                                      return !isDisabledAIModel(name) ? (
                                        <SelectItem key={name} value={name}>
                                          {convertModelName(name)}
                                        </SelectItem>
                                      ) : null;
                                    })}
                                  </SelectGroup>
                                ) : null}
                                <SelectGroup>
                                  <SelectLabel>
                                    {t("setting.basicModels")}
                                  </SelectLabel>
                                  {networkingModelList[1].map((name) => {
                                    return !isDisabledAIModel(name) ? (
                                      <SelectItem key={name} value={name}>
                                        {convertModelName(name)}
                                      </SelectItem>
                                    ) : null;
                                  })}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <Button
                              className={cn("w-full", {
                                hidden: modelList.length > 0,
                              })}
                              type="button"
                              variant="outline"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              {isRefreshing ? (
                                <>
                                  <RefreshCw className="animate-spin" />{" "}
                                  {t("setting.modelListLoading")}
                                </>
                              ) : (
                                <>
                                  <RefreshCw /> {t("setting.refresh")}
                                </>
                              )}
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div
                  className={cn("space-y-4", {
                    hidden: provider !== "openai",
                  })}
                >
                  <FormField
                    control={form.control}
                    name="openAIThinkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.thinkingModelTip")}>
                            {t("setting.thinkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full">
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                className={cn({
                                  hidden: modelList.length === 0,
                                })}
                              >
                                <SelectValue
                                  placeholder={t(
                                    "setting.modelListLoadingPlaceholder"
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent className="max-sm:max-h-72">
                                {thinkingModelList[0].length > 0 ? (
                                  <SelectGroup>
                                    <SelectLabel>
                                      {t("setting.recommendedModels")}
                                    </SelectLabel>
                                    {thinkingModelList[0].map((name) => {
                                      return !isDisabledAIModel(name) ? (
                                        <SelectItem key={name} value={name}>
                                          {convertModelName(name)}
                                        </SelectItem>
                                      ) : null;
                                    })}
                                  </SelectGroup>
                                ) : null}
                                <SelectGroup>
                                  <SelectLabel>
                                    {t("setting.basicModels")}
                                  </SelectLabel>
                                  {thinkingModelList[1].map((name) => {
                                    return !isDisabledAIModel(name) ? (
                                      <SelectItem key={name} value={name}>
                                        {convertModelName(name)}
                                      </SelectItem>
                                    ) : null;
                                  })}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <Button
                              className={cn("w-full", {
                                hidden: modelList.length > 0,
                              })}
                              type="button"
                              variant="outline"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              {isRefreshing ? (
                                <>
                                  <RefreshCw className="animate-spin" />{" "}
                                  {t("setting.modelListLoading")}
                                </>
                              ) : (
                                <>
                                  <RefreshCw /> {t("setting.refresh")}
                                </>
                              )}
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="openAINetworkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.networkingModelTip")}>
                            {t("setting.networkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full">
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                className={cn({
                                  hidden: modelList.length === 0,
                                })}
                              >
                                <SelectValue
                                  placeholder={t(
                                    "setting.modelListLoadingPlaceholder"
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent className="max-sm:max-h-72">
                                {networkingModelList[0].length > 0 ? (
                                  <SelectGroup>
                                    <SelectLabel>
                                      {t("setting.recommendedModels")}
                                    </SelectLabel>
                                    {networkingModelList[0].map((name) => {
                                      return !isDisabledAIModel(name) ? (
                                        <SelectItem key={name} value={name}>
                                          {convertModelName(name)}
                                        </SelectItem>
                                      ) : null;
                                    })}
                                  </SelectGroup>
                                ) : null}
                                <SelectGroup>
                                  <SelectLabel>
                                    {t("setting.basicModels")}
                                  </SelectLabel>
                                  {networkingModelList[1].map((name) => {
                                    return !isDisabledAIModel(name) ? (
                                      <SelectItem key={name} value={name}>
                                        {convertModelName(name)}
                                      </SelectItem>
                                    ) : null;
                                  })}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <Button
                              className={cn("w-full", {
                                hidden: modelList.length > 0,
                              })}
                              type="button"
                              variant="outline"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              {isRefreshing ? (
                                <>
                                  <RefreshCw className="animate-spin" />{" "}
                                  {t("setting.modelListLoading")}
                                </>
                              ) : (
                                <>
                                  <RefreshCw /> {t("setting.refresh")}
                                </>
                              )}
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div
                  className={cn("space-y-4", {
                    hidden: provider !== "anthropic",
                  })}
                >
                  <FormField
                    control={form.control}
                    name="anthropicThinkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.thinkingModelTip")}>
                            {t("setting.thinkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full">
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                className={cn({
                                  hidden: modelList.length === 0,
                                })}
                              >
                                <SelectValue
                                  placeholder={t(
                                    "setting.modelListLoadingPlaceholder"
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent className="max-sm:max-h-72">
                                {modelList.map((name) => {
                                  return !isDisabledAIModel(name) ? (
                                    <SelectItem key={name} value={name}>
                                      {convertModelName(name)}
                                    </SelectItem>
                                  ) : null;
                                })}
                              </SelectContent>
                            </Select>
                            <Button
                              className={cn("w-full", {
                                hidden: modelList.length > 0,
                              })}
                              type="button"
                              variant="outline"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              {isRefreshing ? (
                                <>
                                  <RefreshCw className="animate-spin" />{" "}
                                  {t("setting.modelListLoading")}
                                </>
                              ) : (
                                <>
                                  <RefreshCw /> {t("setting.refresh")}
                                </>
                              )}
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="anthropicNetworkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.networkingModelTip")}>
                            {t("setting.networkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full">
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                className={cn({
                                  hidden: modelList.length === 0,
                                })}
                              >
                                <SelectValue
                                  placeholder={t(
                                    "setting.modelListLoadingPlaceholder"
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent className="max-sm:max-h-72">
                                {modelList.map((name) => {
                                  return !isDisabledAIModel(name) ? (
                                    <SelectItem key={name} value={name}>
                                      {convertModelName(name)}
                                    </SelectItem>
                                  ) : null;
                                })}
                              </SelectContent>
                            </Select>
                            <Button
                              className={cn("w-full", {
                                hidden: modelList.length > 0,
                              })}
                              type="button"
                              variant="outline"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              {isRefreshing ? (
                                <>
                                  <RefreshCw className="animate-spin" />{" "}
                                  {t("setting.modelListLoading")}
                                </>
                              ) : (
                                <>
                                  <RefreshCw /> {t("setting.refresh")}
                                </>
                              )}
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div
                  className={cn("space-y-4", {
                    hidden: provider !== "deepseek",
                  })}
                >
                  <FormField
                    control={form.control}
                    name="deepseekThinkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.thinkingModelTip")}>
                            {t("setting.thinkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full">
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                className={cn({
                                  hidden: modelList.length === 0,
                                })}
                              >
                                <SelectValue
                                  placeholder={t(
                                    "setting.modelListLoadingPlaceholder"
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent className="max-sm:max-h-72">
                                {thinkingModelList[0].length > 0 ? (
                                  <SelectGroup>
                                    <SelectLabel>
                                      {t("setting.recommendedModels")}
                                    </SelectLabel>
                                    {thinkingModelList[0].map((name) => {
                                      return !isDisabledAIModel(name) ? (
                                        <SelectItem key={name} value={name}>
                                          {convertModelName(name)}
                                        </SelectItem>
                                      ) : null;
                                    })}
                                  </SelectGroup>
                                ) : null}
                                <SelectGroup>
                                  <SelectLabel>
                                    {t("setting.basicModels")}
                                  </SelectLabel>
                                  {thinkingModelList[1].map((name) => {
                                    return !isDisabledAIModel(name) ? (
                                      <SelectItem key={name} value={name}>
                                        {convertModelName(name)}
                                      </SelectItem>
                                    ) : null;
                                  })}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <Button
                              className={cn("w-full", {
                                hidden: modelList.length > 0,
                              })}
                              type="button"
                              variant="outline"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              {isRefreshing ? (
                                <>
                                  <RefreshCw className="animate-spin" />{" "}
                                  {t("setting.modelListLoading")}
                                </>
                              ) : (
                                <>
                                  <RefreshCw /> {t("setting.refresh")}
                                </>
                              )}
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="deepseekNetworkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.networkingModelTip")}>
                            {t("setting.networkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full">
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                className={cn({
                                  hidden: modelList.length === 0,
                                })}
                              >
                                <SelectValue
                                  placeholder={t(
                                    "setting.modelListLoadingPlaceholder"
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent className="max-sm:max-h-72">
                                {networkingModelList[0].length > 0 ? (
                                  <SelectGroup>
                                    <SelectLabel>
                                      {t("setting.recommendedModels")}
                                    </SelectLabel>
                                    {networkingModelList[0].map((name) => {
                                      return !isDisabledAIModel(name) ? (
                                        <SelectItem key={name} value={name}>
                                          {convertModelName(name)}
                                        </SelectItem>
                                      ) : null;
                                    })}
                                  </SelectGroup>
                                ) : null}
                                <SelectGroup>
                                  <SelectLabel>
                                    {t("setting.basicModels")}
                                  </SelectLabel>
                                  {networkingModelList[1].map((name) => {
                                    return !isDisabledAIModel(name) ? (
                                      <SelectItem key={name} value={name}>
                                        {convertModelName(name)}
                                      </SelectItem>
                                    ) : null;
                                  })}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <Button
                              className={cn("w-full", {
                                hidden: modelList.length > 0,
                              })}
                              type="button"
                              variant="outline"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              {isRefreshing ? (
                                <>
                                  <RefreshCw className="animate-spin" />{" "}
                                  {t("setting.modelListLoading")}
                                </>
                              ) : (
                                <>
                                  <RefreshCw /> {t("setting.refresh")}
                                </>
                              )}
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div
                  className={cn("space-y-4", {
                    hidden: provider !== "xai",
                  })}
                >
                  <FormField
                    control={form.control}
                    name="xAIThinkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.thinkingModelTip")}>
                            {t("setting.thinkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full">
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                className={cn({
                                  hidden: modelList.length === 0,
                                })}
                              >
                                <SelectValue
                                  placeholder={t(
                                    "setting.modelListLoadingPlaceholder"
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent className="max-sm:max-h-72">
                                {modelList.map((name) => {
                                  return !isDisabledAIModel(name) ? (
                                    <SelectItem key={name} value={name}>
                                      {convertModelName(name)}
                                    </SelectItem>
                                  ) : null;
                                })}
                              </SelectContent>
                            </Select>
                            <Button
                              className={cn("w-full", {
                                hidden: modelList.length > 0,
                              })}
                              type="button"
                              variant="outline"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              {isRefreshing ? (
                                <>
                                  <RefreshCw className="animate-spin" />{" "}
                                  {t("setting.modelListLoading")}
                                </>
                              ) : (
                                <>
                                  <RefreshCw /> {t("setting.refresh")}
                                </>
                              )}
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="xAINetworkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.networkingModelTip")}>
                            {t("setting.networkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full">
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                className={cn({
                                  hidden: modelList.length === 0,
                                })}
                              >
                                <SelectValue
                                  placeholder={t(
                                    "setting.modelListLoadingPlaceholder"
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent className="max-sm:max-h-72">
                                {modelList.map((name) => {
                                  return !isDisabledAIModel(name) ? (
                                    <SelectItem key={name} value={name}>
                                      {convertModelName(name)}
                                    </SelectItem>
                                  ) : null;
                                })}
                              </SelectContent>
                            </Select>
                            <Button
                              className={cn("w-full", {
                                hidden: modelList.length > 0,
                              })}
                              type="button"
                              variant="outline"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              {isRefreshing ? (
                                <>
                                  <RefreshCw className="animate-spin" />{" "}
                                  {t("setting.modelListLoading")}
                                </>
                              ) : (
                                <>
                                  <RefreshCw /> {t("setting.refresh")}
                                </>
                              )}
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div
                  className={cn("space-y-4", {
                    hidden: provider !== "mistral",
                  })}
                >
                  <FormField
                    control={form.control}
                    name="mistralThinkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.thinkingModelTip")}>
                            {t("setting.thinkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full">
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                className={cn({
                                  hidden: modelList.length === 0,
                                })}
                              >
                                <SelectValue
                                  placeholder={t(
                                    "setting.modelListLoadingPlaceholder"
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent className="max-sm:max-h-72">
                                {thinkingModelList[0].length > 0 ? (
                                  <SelectGroup>
                                    <SelectLabel>
                                      {t("setting.recommendedModels")}
                                    </SelectLabel>
                                    {thinkingModelList[0].map((name) => {
                                      return !isDisabledAIModel(name) ? (
                                        <SelectItem key={name} value={name}>
                                          {convertModelName(name)}
                                        </SelectItem>
                                      ) : null;
                                    })}
                                  </SelectGroup>
                                ) : null}
                                <SelectGroup>
                                  <SelectLabel>
                                    {t("setting.basicModels")}
                                  </SelectLabel>
                                  {thinkingModelList[1].map((name) => {
                                    return !isDisabledAIModel(name) ? (
                                      <SelectItem key={name} value={name}>
                                        {convertModelName(name)}
                                      </SelectItem>
                                    ) : null;
                                  })}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <Button
                              className={cn("w-full", {
                                hidden: modelList.length > 0,
                              })}
                              type="button"
                              variant="outline"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              {isRefreshing ? (
                                <>
                                  <RefreshCw className="animate-spin" />{" "}
                                  {t("setting.modelListLoading")}
                                </>
                              ) : (
                                <>
                                  <RefreshCw /> {t("setting.refresh")}
                                </>
                              )}
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mistralNetworkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.networkingModelTip")}>
                            {t("setting.networkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full">
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                className={cn({
                                  hidden: modelList.length === 0,
                                })}
                              >
                                <SelectValue
                                  placeholder={t(
                                    "setting.modelListLoadingPlaceholder"
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent className="max-sm:max-h-72">
                                {networkingModelList[0].length > 0 ? (
                                  <SelectGroup>
                                    <SelectLabel>
                                      {t("setting.recommendedModels")}
                                    </SelectLabel>
                                    {networkingModelList[0].map((name) => {
                                      return !isDisabledAIModel(name) ? (
                                        <SelectItem key={name} value={name}>
                                          {convertModelName(name)}
                                        </SelectItem>
                                      ) : null;
                                    })}
                                  </SelectGroup>
                                ) : null}
                                <SelectGroup>
                                  <SelectLabel>
                                    {t("setting.basicModels")}
                                  </SelectLabel>
                                  {networkingModelList[1].map((name) => {
                                    return !isDisabledAIModel(name) ? (
                                      <SelectItem key={name} value={name}>
                                        {convertModelName(name)}
                                      </SelectItem>
                                    ) : null;
                                  })}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <Button
                              className={cn("w-full", {
                                hidden: modelList.length > 0,
                              })}
                              type="button"
                              variant="outline"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              {isRefreshing ? (
                                <>
                                  <RefreshCw className="animate-spin" />{" "}
                                  {t("setting.modelListLoading")}
                                </>
                              ) : (
                                <>
                                  <RefreshCw /> {t("setting.refresh")}
                                </>
                              )}
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div
                  className={cn("space-y-4", {
                    hidden: provider !== "azure",
                  })}
                >
                  <FormField
                    control={form.control}
                    name="azureThinkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.thinkingModelTip")}>
                            {t("setting.thinkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full">
                            <Input
                              placeholder={t("setting.modelListPlaceholder")}
                              {...field}
                            />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="azureNetworkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.networkingModelTip")}>
                            {t("setting.networkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full">
                            <Input
                              placeholder={t("setting.modelListPlaceholder")}
                              {...field}
                            />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div
                  className={cn("space-y-4", {
                    hidden: provider !== "openaicompatible",
                  })}
                >
                  <FormField
                    control={form.control}
                    name="openAICompatibleThinkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.thinkingModelTip")}>
                            {t("setting.thinkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field flex gap-2">
                            <Input
                              className={cn("flex-1", {
                                hidden: modelList.length > 0,
                              })}
                              placeholder={t("setting.modelListPlaceholder")}
                              {...field}
                            />
                            <div
                              className={cn("flex-1", {
                                hidden: modelList.length === 0,
                              })}
                            >
                              <Select
                                defaultValue={field.value}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t(
                                      "setting.modelListLoadingPlaceholder"
                                    )}
                                  />
                                </SelectTrigger>
                                <SelectContent className="max-sm:max-h-72">
                                  {modelList.map((name) => {
                                    return !isDisabledAIModel(name) ? (
                                      <SelectItem key={name} value={name}>
                                        {convertModelName(name)}
                                      </SelectItem>
                                    ) : null;
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              <RefreshCw
                                className={isRefreshing ? "animate-spin" : ""}
                              />
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="openAICompatibleNetworkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.networkingModelTip")}>
                            {t("setting.networkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full flex gap-2">
                            <Input
                              className={cn("flex-1", {
                                hidden: modelList.length > 0,
                              })}
                              placeholder={t("setting.modelListPlaceholder")}
                              {...field}
                            />
                            <div
                              className={cn("flex-1", {
                                hidden: modelList.length === 0,
                              })}
                            >
                              <Select
                                defaultValue={field.value}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t(
                                      "setting.modelListLoadingPlaceholder"
                                    )}
                                  />
                                </SelectTrigger>
                                <SelectContent className="max-sm:max-h-72">
                                  {modelList.map((name) => {
                                    return !isDisabledAIModel(name) ? (
                                      <SelectItem key={name} value={name}>
                                        {convertModelName(name)}
                                      </SelectItem>
                                    ) : null;
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              <RefreshCw
                                className={isRefreshing ? "animate-spin" : ""}
                              />
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div
                  className={cn("space-y-4", {
                    hidden: provider !== "pollinations",
                  })}
                >
                  <FormField
                    control={form.control}
                    name="pollinationsThinkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.thinkingModelTip")}>
                            {t("setting.thinkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full">
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                className={cn({
                                  hidden: modelList.length === 0,
                                })}
                              >
                                <SelectValue
                                  placeholder={t(
                                    "setting.modelListLoadingPlaceholder"
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent className="max-sm:max-h-72">
                                {thinkingModelList[0].length > 0 ? (
                                  <SelectGroup>
                                    <SelectLabel>
                                      {t("setting.recommendedModels")}
                                    </SelectLabel>
                                    {thinkingModelList[0].map((name) => {
                                      return !isDisabledAIModel(name) ? (
                                        <SelectItem key={name} value={name}>
                                          {convertModelName(name)}
                                        </SelectItem>
                                      ) : null;
                                    })}
                                  </SelectGroup>
                                ) : null}
                                <SelectGroup>
                                  <SelectLabel>
                                    {t("setting.basicModels")}
                                  </SelectLabel>
                                  {thinkingModelList[1].map((name) => {
                                    return !isDisabledAIModel(name) ? (
                                      <SelectItem key={name} value={name}>
                                        {convertModelName(name)}
                                      </SelectItem>
                                    ) : null;
                                  })}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <Button
                              className={cn("w-full", {
                                hidden: modelList.length > 0,
                              })}
                              type="button"
                              variant="outline"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              {isRefreshing ? (
                                <>
                                  <RefreshCw className="animate-spin" />{" "}
                                  {t("setting.modelListLoading")}
                                </>
                              ) : (
                                <>
                                  <RefreshCw /> {t("setting.refresh")}
                                </>
                              )}
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pollinationsNetworkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.networkingModelTip")}>
                            {t("setting.networkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full">
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger
                                className={cn({
                                  hidden: modelList.length === 0,
                                })}
                              >
                                <SelectValue
                                  placeholder={t(
                                    "setting.modelListLoadingPlaceholder"
                                  )}
                                />
                              </SelectTrigger>
                              <SelectContent className="max-sm:max-h-72">
                                {networkingModelList[0].length > 0 ? (
                                  <SelectGroup>
                                    <SelectLabel>
                                      {t("setting.recommendedModels")}
                                    </SelectLabel>
                                    {networkingModelList[0].map((name) => {
                                      return !isDisabledAIModel(name) ? (
                                        <SelectItem key={name} value={name}>
                                          {convertModelName(name)}
                                        </SelectItem>
                                      ) : null;
                                    })}
                                  </SelectGroup>
                                ) : null}
                                <SelectGroup>
                                  <SelectLabel>
                                    {t("setting.basicModels")}
                                  </SelectLabel>
                                  {networkingModelList[1].map((name) => {
                                    return !isDisabledAIModel(name) ? (
                                      <SelectItem key={name} value={name}>
                                        {convertModelName(name)}
                                      </SelectItem>
                                    ) : null;
                                  })}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <Button
                              className={cn("w-full", {
                                hidden: modelList.length > 0,
                              })}
                              type="button"
                              variant="outline"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              {isRefreshing ? (
                                <>
                                  <RefreshCw className="animate-spin" />{" "}
                                  {t("setting.modelListLoading")}
                                </>
                              ) : (
                                <>
                                  <RefreshCw /> {t("setting.refresh")}
                                </>
                              )}
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div
                  className={cn("space-y-4", {
                    hidden: provider !== "ollama",
                  })}
                >
                  <FormField
                    control={form.control}
                    name="ollamaThinkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.thinkingModelTip")}>
                            {t("setting.thinkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field flex gap-2">
                            <Input
                              className={cn("flex-1", {
                                hidden: modelList.length > 0,
                              })}
                              placeholder={t("setting.modelListPlaceholder")}
                              {...field}
                            />
                            <div
                              className={cn("flex-1", {
                                hidden: modelList.length === 0,
                              })}
                            >
                              <Select
                                defaultValue={field.value}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t(
                                      "setting.modelListLoadingPlaceholder"
                                    )}
                                  />
                                </SelectTrigger>
                                <SelectContent className="max-sm:max-h-72">
                                  {modelList.map((name) => {
                                    return !isDisabledAIModel(name) ? (
                                      <SelectItem key={name} value={name}>
                                        {convertModelName(name)}
                                      </SelectItem>
                                    ) : null;
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              <RefreshCw
                                className={isRefreshing ? "animate-spin" : ""}
                              />
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ollamaNetworkingModel"
                    render={({ field }) => (
                      <FormItem className="from-item">
                        <FormLabel className="from-label">
                          <HelpTip tip={t("setting.networkingModelTip")}>
                            {t("setting.networkingModel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </HelpTip>
                        </FormLabel>
                        <FormControl>
                          <div className="form-field w-full flex gap-2">
                            <Input
                              className={cn("flex-1", {
                                hidden: modelList.length > 0,
                              })}
                              placeholder={t("setting.modelListPlaceholder")}
                              {...field}
                            />
                            <div
                              className={cn("flex-1", {
                                hidden: modelList.length === 0,
                              })}
                            >
                              <Select
                                defaultValue={field.value}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t(
                                      "setting.modelListLoadingPlaceholder"
                                    )}
                                  />
                                </SelectTrigger>
                                <SelectContent className="max-sm:max-h-72">
                                  {modelList.map((name) => {
                                    return !isDisabledAIModel(name) ? (
                                      <SelectItem key={name} value={name}>
                                        {convertModelName(name)}
                                      </SelectItem>
                                    ) : null;
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={isRefreshing}
                              onClick={() => fetchModelList()}
                            >
                              <RefreshCw
                                className={isRefreshing ? "animate-spin" : ""}
                              />
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
              <TabsContent className="space-y-4  min-h-[250px]" value="search">
                <FormField
                  control={form.control}
                  name="enableSearch"
                  render={({ field }) => (
                    <FormItem className="from-item">
                      <FormLabel className="from-label">
                        <HelpTip tip={t("setting.webSearchTip")}>
                          {t("setting.webSearch")}
                        </HelpTip>
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="form-field">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">
                              {t("setting.enable")}
                            </SelectItem>
                            <SelectItem value="0">
                              {t("setting.disable")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="searchProvider"
                  render={({ field }) => (
                    <FormItem className="from-item">
                      <FormLabel className="from-label">
                        <HelpTip tip={t("setting.searchProviderTip")}>
                          {t("setting.searchProvider")}
                        </HelpTip>
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          disabled={form.getValues("enableSearch") === "0"}
                          onValueChange={(value) => {
                            field.onChange(value);
                            handleSearchProviderChange(value);
                          }}
                        >
                          <SelectTrigger className="form-field">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="model">
                              {t("setting.modelBuiltin")}
                            </SelectItem>
                            {!isDisabledSearchProvider("tavily") ? (
                              <SelectItem value="tavily">Tavily</SelectItem>
                            ) : null}
                            {!isDisabledSearchProvider("firecrawl") ? (
                              <SelectItem value="firecrawl">
                                Firecrawl
                              </SelectItem>
                            ) : null}
                            {!isDisabledSearchProvider("exa") &&
                            mode === "proxy" ? (
                              <SelectItem value="exa">Exa</SelectItem>
                            ) : null}
                            {!isDisabledSearchProvider("bocha") ? (
                              <SelectItem value="bocha">
                                {t("setting.bocha")}
                              </SelectItem>
                            ) : null}
                            {!isDisabledSearchProvider("searxng") ? (
                              <SelectItem value="searxng">SearXNG</SelectItem>
                            ) : null}
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className={mode === "proxy" ? "hidden" : ""}>
                  <div
                    className={cn("space-y-4", {
                      hidden: searchProvider !== "tavily",
                    })}
                  >
                    <FormField
                      control={form.control}
                      name="tavilyApiKey"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiKeyLabel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </FormLabel>
                          <FormControl className="form-field">
                            <Password
                              type="text"
                              placeholder={t("setting.searchApiKeyPlaceholder")}
                              disabled={form.getValues("enableSearch") === "0"}
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tavilyApiProxy"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiUrlLabel")}
                          </FormLabel>
                          <FormControl className="form-field">
                            <Input
                              placeholder={TAVILY_BASE_URL}
                              disabled={form.getValues("enableSearch") === "0"}
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tavilyScope"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.searchScope")}
                          </FormLabel>
                          <FormControl className="form-field">
                            <Select
                              value={field.value}
                              onValueChange={(value) =>
                                form.setValue("tavilyScope", value)
                              }
                            >
                              <SelectTrigger className="form-field">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="general">
                                  {t("setting.scopeValue.general")}
                                </SelectItem>
                                <SelectItem value="news">
                                  {t("setting.scopeValue.news")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="advanced-settings">
                        <AccordionTrigger>{t("setting.advancedSettings.title")}</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4 rounded-md border p-4">
                            <h4 className="text-sm font-medium">
                              {t("setting.domainLimit.title")}
                            </h4>
                            <Tabs
                              defaultValue={
                                Object.keys(PREDEFINED_DOMAINS).length > 0
                                  ? Object.keys(PREDEFINED_DOMAINS)[0]
                                  : "custom"
                              }
                            >
                              <TabsList className="grid w-full grid-cols-3">
                                {Object.keys(PREDEFINED_DOMAINS).map((group) => (
                                  <TabsTrigger key={group} value={group}>
                                    {t(`setting.domainLimit.groups.${group}`)}
                                  </TabsTrigger>
                                ))}
                                <TabsTrigger value="custom">
                                  {t("setting.domainLimit.custom")}
                                </TabsTrigger>
                              </TabsList>
                              {Object.entries(PREDEFINED_DOMAINS).map(
                                ([group, domains]) => (
                                  <TabsContent
                                    key={group}
                                    value={group}
                                    className="mt-4 max-h-48 overflow-y-auto"
                                  >
                                    <div className="grid grid-cols-1 gap-y-2 md:grid-cols-2 md:gap-x-8">
                                      {domains.map((domain) => (
                                        <FormField
                                          key={domain}
                                          control={form.control}
                                          name="searchDomainStrategy.tavily.domains.predefined"
                                          render={({ field }) => (
                                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                              <FormControl>
                                                <Checkbox
                                                  checked={field.value?.includes(
                                                    domain
                                                  )}
                                                  onCheckedChange={(
                                                    checked: boolean
                                                  ) => {
                                                    return checked
                                                      ? field.onChange([
                                                          ...(field.value || []),
                                                          domain,
                                                        ])
                                                      : field.onChange(
                                                          field.value?.filter(
                                                            (value) =>
                                                              value !== domain
                                                          )
                                                        );
                                                  }}
                                                />
                                              </FormControl>
                                              <FormLabel className="font-normal">
                                                {domain}
                                              </FormLabel>
                                            </FormItem>
                                          )}
                                        />
                                      ))}
                                    </div>
                                  </TabsContent>
                                )
                              )}
                              <TabsContent value="custom" className="mt-4">
                                <FormField
                                  control={form.control}
                                  name="searchDomainStrategy.tavily.domains.custom"
                                  render={({ field }) => (
                                    <FormItem>
                                      <div className="flex gap-2">
                                        <Input
                                          value={customDomainInput}
                                          onChange={(e) =>
                                            setCustomDomainInput(e.target.value)
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              e.preventDefault();
                                              handleAddCustomDomain();
                                            }
                                          }}
                                          placeholder={t(
                                            "setting.domainLimit.customPlaceholder"
                                          )}
                                        />
                                        <Button
                                          type="button"
                                          onClick={handleAddCustomDomain}
                                        >
                                          {t("setting.domainLimit.add")}
                                        </Button>
                                      </div>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {field.value?.map((domain) => (
                                          <div
                                            key={domain}
                                            className="flex items-center gap-1 rounded-full bg-gray-200 px-2 py-1 text-xs dark:bg-gray-700"
                                          >
                                            {domain}
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleRemoveCustomDomain(domain)
                                              }
                                              className="text-red-500 hover:text-red-700"
                                            >
                                              &times;
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </FormItem>
                                  )}
                                />
                              </TabsContent>
                            </Tabs>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                  <div
                    className={cn("space-y-4", {
                      hidden: searchProvider !== "firecrawl",
                    })}
                  >
                    <FormField
                      control={form.control}
                      name="firecrawlApiKey"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiKeyLabel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </FormLabel>
                          <FormControl className="form-field">
                            <Password
                              type="text"
                              placeholder={t("setting.searchApiKeyPlaceholder")}
                              disabled={form.getValues("enableSearch") === "0"}
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="firecrawlApiProxy"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiUrlLabel")}
                          </FormLabel>
                          <FormControl className="form-field">
                            <Input
                              placeholder={FIRECRAWL_BASE_URL}
                              disabled={form.getValues("enableSearch") === "0"}
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div
                    className={cn("space-y-4", {
                      hidden: searchProvider !== "exa",
                    })}
                  >
                    <FormField
                      control={form.control}
                      name="exaApiKey"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiKeyLabel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </FormLabel>
                          <FormControl className="form-field">
                            <Password
                              type="text"
                              placeholder={t("setting.searchApiKeyPlaceholder")}
                              disabled={form.getValues("enableSearch") === "0"}
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="exaApiProxy"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiUrlLabel")}
                          </FormLabel>
                          <FormControl className="form-field">
                            <Input
                              placeholder={EXA_BASE_URL}
                              disabled={form.getValues("enableSearch") === "0"}
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="exaScope"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.searchScope")}
                          </FormLabel>
                          <FormControl className="form-field">
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger className="form-field">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="research paper">
                                  {t("setting.scopeValue.researchPaper")}
                                </SelectItem>
                                <SelectItem value="financial">
                                  {t("setting.scopeValue.financial")}
                                </SelectItem>
                                <SelectItem value="news">
                                  {t("setting.scopeValue.news")}
                                </SelectItem>
                                <SelectItem value="company">
                                  {t("setting.scopeValue.company")}
                                </SelectItem>
                                <SelectItem value="personal site">
                                  {t("setting.scopeValue.personalSite")}
                                </SelectItem>
                                <SelectItem value="github">
                                  {t("setting.scopeValue.github")}
                                </SelectItem>
                                <SelectItem value="linkedin">
                                  {t("setting.scopeValue.linkedin")}
                                </SelectItem>
                                <SelectItem value="pdf">
                                  {t("setting.scopeValue.pdf")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div
                    className={cn("space-y-4", {
                      hidden: searchProvider !== "bocha",
                    })}
                  >
                    <FormField
                      control={form.control}
                      name="bochaApiKey"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiKeyLabel")}
                            <span className="ml-1 text-red-500 max-sm:hidden">
                              *
                            </span>
                          </FormLabel>
                          <FormControl className="form-field">
                            <Password
                              type="text"
                              placeholder={t("setting.searchApiKeyPlaceholder")}
                              disabled={form.getValues("enableSearch") === "0"}
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bochaApiProxy"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiUrlLabel")}
                          </FormLabel>
                          <FormControl className="form-field">
                            <Input
                              placeholder={BOCHA_BASE_URL}
                              disabled={form.getValues("enableSearch") === "0"}
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div
                    className={cn("space-y-4", {
                      hidden: searchProvider !== "searxng",
                    })}
                  >
                    <FormField
                      control={form.control}
                      name="searxngApiProxy"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.apiUrlLabel")}
                          </FormLabel>
                          <FormControl className="form-field">
                            <Input
                              placeholder={SEARXNG_BASE_URL}
                              disabled={form.getValues("enableSearch") === "0"}
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="searxngScope"
                      render={({ field }) => (
                        <FormItem className="from-item">
                          <FormLabel className="from-label">
                            {t("setting.searchScope")}
                          </FormLabel>
                          <FormControl className="form-field">
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger className="form-field">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">
                                  {t("setting.scopeValue.all")}
                                </SelectItem>
                                <SelectItem value="academic">
                                  {t("setting.scopeValue.academic")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="parallelSearch"
                  render={({ field }) => (
                    <FormItem className="from-item">
                      <FormLabel className="from-label">
                        <HelpTip tip={t("setting.parallelSearchTip")}>
                          {t("setting.parallelSearch")}
                        </HelpTip>
                      </FormLabel>
                      <FormControl className="form-field">
                        <div className="flex h-9">
                          <Slider
                            className="flex-1"
                            value={[field.value]}
                            max={5}
                            min={1}
                            step={1}
                            disabled={form.getValues("enableSearch") === "0"}
                            onValueChange={(values) =>
                              field.onChange(values[0])
                            }
                          />
                          <span className="w-[14%] text-center text-sm leading-10">
                            {field.value}
                          </span>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="searchMaxResult"
                  render={({ field }) => (
                    <FormItem className="from-item">
                      <FormLabel className="from-label">
                        <HelpTip tip={t("setting.searchResultsTip")}>
                          {t("setting.searchResults")}
                        </HelpTip>
                      </FormLabel>
                      <FormControl className="form-field">
                        <div className="flex h-9">
                          <Slider
                            className="flex-1"
                            value={[field.value]}
                            max={10}
                            min={1}
                            step={1}
                            disabled={form.getValues("enableSearch") === "0"}
                            onValueChange={(values) =>
                              field.onChange(values[0])
                            }
                          />
                          <span className="w-[14%] text-center text-sm leading-10">
                            {field.value}
                          </span>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>
              <TabsContent className="space-y-4 min-h-[250px]" value="general">
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem className="from-item">
                      <FormLabel className="from-label">
                        <HelpTip tip={t("setting.languageTip")}>
                          {t("setting.language")}
                        </HelpTip>
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={(value) =>
                            form.setValue("language", value)
                          }
                        >
                          <SelectTrigger className="form-field">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(locales).map(([code, name]) => {
                              return (
                                <SelectItem key={code} value={code}>
                                  {name}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="theme"
                  render={({ field }) => (
                    <FormItem className="from-item">
                      <FormLabel className="from-label">{t("theme")}</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={(value) =>
                            form.setValue("theme", value)
                          }
                        >
                          <SelectTrigger className="form-field">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="system">
                              {t("setting.system")}
                            </SelectItem>
                            <SelectItem value="light">
                              {t("setting.light")}
                            </SelectItem>
                            <SelectItem value="dark">
                              {t("setting.dark")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="debug"
                  render={({ field }) => (
                    <FormItem className="from-item">
                      <FormLabel className="from-label">
                        <HelpTip tip={t("setting.debugTip")}>
                          {t("setting.debug")}
                        </HelpTip>
                      </FormLabel>
                      <FormControl>
                        <Select
                          {...field}
                          onValueChange={(value) =>
                            form.setValue("debug", value)
                          }
                        >
                          <SelectTrigger className="form-field">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="enable">
                              {t("setting.enable")}
                            </SelectItem>
                            <SelectItem value="disable">
                              {t("setting.disable")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />
                {pwaInstall ? (
                  <div className="from-item">
                    <Label className="from-label">
                      <HelpTip tip={t("setting.PWATip")}>
                        {t("setting.PWA")}
                      </HelpTip>
                    </Label>
                    <Button
                      className="form-field"
                      type="button"
                      variant="ghost"
                      onClick={() => installPWA()}
                    >
                      <MonitorDown className="mr-1.5 h-4 w-4" />
                      {t("setting.installlPWA")}
                    </Button>
                  </div>
                ) : null}
                <div className="from-item">
                  <Label className="from-label">{t("setting.version")}</Label>
                  <div className="form-field text-center leading-9">
                    {`v${VERSION}`}
                    <small className="ml-1">
                      (
                      <a
                        className="hover:underline hover:underline-offset-4 hover:text-blue-500"
                        href="https://github.com/tyqqj0/deep-research.git"
                        target="_blank"
                      >
                        {t("setting.checkForUpdate")}
                      </a>
                      )
                    </small>
                  </div>
                </div>
                <div className="from-item">
                  <Label className="from-label">
                    {t("setting.resetSetting")}
                  </Label>
                  <Button
                    className="form-field hover:text-red-500"
                    type="button"
                    variant="ghost"
                    onClick={() => handleReset()}
                  >
                    {t("setting.resetAllSettings")}
                  </Button>
                </div>
              </TabsContent>
              <TabsContent
                className="space-y-4 min-h-[250px]"
                value="experimental"
              >
                <FormField
                  control={form.control}
                  name="references"
                  render={({ field }) => (
                    <FormItem className="from-item">
                      <FormLabel className="from-label">
                        <HelpTip tip={t("setting.referencesTip")}>
                          {t("setting.references")}
                        </HelpTip>
                      </FormLabel>
                      <FormControl>
                        <Select
                          {...field}
                          onValueChange={(value) =>
                            form.setValue("references", value)
                          }
                        >
                          <SelectTrigger className="form-field">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="enable">
                              {t("setting.enable")}
                            </SelectItem>
                            <SelectItem value="disable">
                              {t("setting.disable")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="citationImage"
                  render={({ field }) => (
                    <FormItem className="from-item">
                      <FormLabel className="from-label">
                        <HelpTip tip={t("setting.citationImageTip")}>
                          {t("setting.citationImage")}
                        </HelpTip>
                      </FormLabel>
                      <FormControl>
                        <Select
                          {...field}
                          onValueChange={(value) =>
                            form.setValue("citationImage", value)
                          }
                        >
                          <SelectTrigger className="form-field">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="enable">
                              {t("setting.enable")}
                            </SelectItem>
                            <SelectItem value="disable">
                              {t("setting.disable")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>
          </form>
        </Form>
        <DialogFooter className="mt-2 flex-row sm:justify-between sm:space-x-0 gap-3">
          <Button className="flex-1" variant="outline" onClick={onClose}>
            {t("setting.cancel")}
          </Button>
          <Button
            className="flex-1"
            type="submit"
            onClick={form.handleSubmit(handleSubmit)}
          >
            {t("setting.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default Setting;
