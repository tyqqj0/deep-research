import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useSettingForm } from "../hooks/useSettingForm";
import { HelpTipProps } from "../types";
import locales from "@/constants/locales";

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

interface AdvancedTabProps {
  form: ReturnType<typeof useSettingForm>["form"];
}

export function AdvancedTab({ form }: AdvancedTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 min-h-[250px]">
      <Accordion type="multiple" className="w-full">
        {/* 通用设置 */}
        <AccordionItem value="general-settings">
          <AccordionTrigger>{t("setting.general")}</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 rounded-md border p-4">
              {/* 语言设置 */}
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

              {/* 主题设置 */}
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

              {/* 调试模式 */}
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
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 实验性功能 */}
        <AccordionItem value="experimental-settings">
          <AccordionTrigger>{t("setting.experimental")}</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 rounded-md border p-4">
              {/* 引用显示 */}
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

              {/* 引用图片 */}
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
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}