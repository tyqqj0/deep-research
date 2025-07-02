import { useState } from "react";
import { CircleHelp } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Password } from "@/components/Internal/PasswordInput";
import { DomainLimitConfig } from "../components/DomainLimitConfig";
import { SliderField } from "../components/SliderField";
import { useSettingForm } from "../hooks/useSettingForm";
import { useProviderConfig } from "../hooks/useProviderConfig";
import { HelpTipProps } from "../types";
import {
  TAVILY_BASE_URL,
  FIRECRAWL_BASE_URL,
  EXA_BASE_URL,
  BOCHA_BASE_URL,
  SEARXNG_BASE_URL,
} from "@/constants/urls";
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

interface SearchTabProps {
  form: ReturnType<typeof useSettingForm>["form"];
  handleAddCustomDomain: (domain: string) => void;
  handleRemoveCustomDomain: (index: number) => void;
}

export function SearchTab({
  form,
  handleAddCustomDomain,
  handleRemoveCustomDomain,
}: SearchTabProps) {
  const { t } = useTranslation();
  const {
    searchProvider,
    handleSearchProviderChange,
    availableSearchProviders,
  } = useProviderConfig();

  const [customDomainInput, setCustomDomainInput] = useState<string>("");

  const handleAddCustomDomainInternal = () => {
    if (customDomainInput.trim()) {
      handleAddCustomDomain(customDomainInput.trim());
      setCustomDomainInput("");
    }
  };

  const handleRemoveCustomDomainInternal = (domain: string) => {
    const currentDomains = form.getValues("searchDomainStrategy.tavily.domains.custom") || [];
    const index = currentDomains.indexOf(domain);
    if (index !== -1) {
      handleRemoveCustomDomain(index);
    }
  };

  return (
    <div className="space-y-6 min-h-[250px]">
      {/* 基本搜索设置 */}
      <div className="space-y-4">
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
                    handleSearchProviderChange(value, form.setValue);
                  }}
                >
                  <SelectTrigger className="form-field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="model">
                      {t("setting.modelBuiltin")}
                    </SelectItem>
                    {availableSearchProviders.map((provider) => (
                      <SelectItem key={provider} value={provider}>
                        {provider === "bocha" ? t("setting.bocha") : provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          )}
        />

        {/* 搜索Provider配置区域 */}
        <div className={form.getValues("mode") === "proxy" ? "hidden" : ""}>
          {/* Tavily Provider */}
          <div className={cn("space-y-4", {
            hidden: searchProvider !== "tavily",
          })}>
            <FormField
              control={form.control}
              name="tavilyApiKey"
              render={({ field }) => (
                <FormItem className="from-item">
                  <FormLabel className="from-label">
                    {t("setting.apiKeyLabel")}
                    <span className="ml-1 text-red-500 max-sm:hidden">*</span>
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

            {/* 域名限制配置 */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="domain-settings">
                <AccordionTrigger>{t("setting.domainLimit.title")}</AccordionTrigger>
                <AccordionContent>
                  <DomainLimitConfig
                    form={form}
                    customDomainInput={customDomainInput}
                    setCustomDomainInput={setCustomDomainInput}
                    handleAddCustomDomain={handleAddCustomDomainInternal}
                    handleRemoveCustomDomain={handleRemoveCustomDomainInternal}
                  />
                </AccordionContent>
              </AccordionItem>

              {/* 任务等待时间设置 */}
              <AccordionItem value="task-settings">
                <AccordionTrigger>{t("setting.enableTaskWaitingTime")}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 rounded-md border p-4">
                    <FormField
                      control={form.control}
                      name="enableTaskWaitingTime"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              {t("setting.enableTaskWaitingTime")}
                            </FormLabel>
                          </div>
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="taskWaitingTime"
                      render={({ field }) => (
                        <FormItem>
                          <Label>
                            {t("setting.taskWaitingTime")}
                          </Label>
                          <div className="flex items-center">
                            <Slider
                              className="w-10/12"
                              disabled={!form.watch("enableTaskWaitingTime")}
                              value={[field.value ?? 0]}
                              onValueChange={(value) => field.onChange(value[0])}
                              min={0}
                              max={120}
                              step={1}
                            />
                            <Input
                              className="ml-4 w-2/12"
                              type="number"
                              disabled={!form.watch("enableTaskWaitingTime")}
                              value={field.value ?? 0}
                              onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                            />
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Firecrawl Provider */}
          <div className={cn("space-y-4", {
            hidden: searchProvider !== "firecrawl",
          })}>
            <FormField
              control={form.control}
              name="firecrawlApiKey"
              render={({ field }) => (
                <FormItem className="from-item">
                  <FormLabel className="from-label">
                    {t("setting.apiKeyLabel")}
                    <span className="ml-1 text-red-500 max-sm:hidden">*</span>
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

          {/* Exa Provider */}
          <div className={cn("space-y-4", {
            hidden: searchProvider !== "exa",
          })}>
            <FormField
              control={form.control}
              name="exaApiKey"
              render={({ field }) => (
                <FormItem className="from-item">
                  <FormLabel className="from-label">
                    {t("setting.apiKeyLabel")}
                    <span className="ml-1 text-red-500 max-sm:hidden">*</span>
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

          {/* Bocha Provider */}
          <div className={cn("space-y-4", {
            hidden: searchProvider !== "bocha",
          })}>
            <FormField
              control={form.control}
              name="bochaApiKey"
              render={({ field }) => (
                <FormItem className="from-item">
                  <FormLabel className="from-label">
                    {t("setting.apiKeyLabel")}
                    <span className="ml-1 text-red-500 max-sm:hidden">*</span>
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

          {/* SearXNG Provider */}
          <div className={cn("space-y-4", {
            hidden: searchProvider !== "searxng",
          })}>
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
      </div>

      {/* 搜索参数设置 */}
      <div className="space-y-4">
        <SliderField
          form={form}
          name="parallelSearch"
          label={t("setting.parallelSearch")}
          tip={t("setting.parallelSearchTip")}
          min={1}
          max={5}
          step={1}
          disabled={form.getValues("enableSearch") === "0"}
        />

        <SliderField
          form={form}
          name="searchMaxResult"
          label={t("setting.searchResults")}
          tip={t("setting.searchResultsTip")}
          min={1}
          max={10}
          step={1}
          disabled={form.getValues("enableSearch") === "0"}
        />

        {/* 高级搜索设置 */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="advancedSearch">
            <AccordionTrigger>{t("setting.advancedSearch.title")}</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 rounded-md border p-4">
                <FormField
                  control={form.control}
                  name="searchExecutionMode"
                  render={({ field }) => (
                    <FormItem className="from-item">
                      <FormLabel className="from-label">
                        {t("setting.searchExecutionModeLabel", "搜索执行模式")}
                      </FormLabel>
                      <FormControl className="form-field">
                        <Select
                          value={field.value || "manual"}
                          onValueChange={(value: "immediate" | "delayed" | "manual") =>
                            field.onChange(value)
                          }
                          disabled={form.getValues("enableSearch") === "0"}
                        >
                          <SelectTrigger className="form-field">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="immediate">
                              {t("setting.searchExecutionModeImmediate", "立即执行")}
                            </SelectItem>
                            <SelectItem value="delayed">
                              {t("setting.searchExecutionModeDelayed", "延迟执行")}
                            </SelectItem>
                            <SelectItem value="manual">
                              {t("setting.searchExecutionModeManual", "手动执行")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="searchErrorHandling"
                  render={({ field }) => (
                    <FormItem className="from-item">
                      <FormLabel className="from-label">
                        <HelpTip tip={t("setting.searchErrorHandlingTip")}>
                          {t("setting.searchErrorHandling")}
                        </HelpTip>
                      </FormLabel>
                      <FormControl className="form-field">
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={form.getValues("enableSearch") === "0"}
                        >
                          <SelectTrigger className="form-field">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">
                              {t("setting.searchErrorManual")}
                            </SelectItem>
                            <SelectItem value="auto">
                              {t("setting.searchErrorAuto")}
                            </SelectItem>
                            <SelectItem value="ignore">
                              {t("setting.searchErrorIgnore")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <SliderField
                  form={form}
                  name="maxResearchDepth"
                  label={t("setting.maxResearchDepth")}
                  tip={t("setting.maxResearchDepthTip")}
                  min={1}
                  max={10}
                  step={1}
                  defaultValue={3}
                  disabled={form.getValues("enableSearch") === "0"}
                />

                <SliderField
                  form={form}
                  name="deepSearchMaxTasks"
                  label={t("setting.deepSearchMaxTasks")}
                  tip={t("setting.deepSearchMaxTasksTip")}
                  min={1}
                  max={10}
                  step={1}
                  defaultValue={3}
                  disabled={form.getValues("enableSearch") === "0"}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}