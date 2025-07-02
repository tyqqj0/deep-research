"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

// Hooks
import { useSettingForm } from "./hooks/useSettingForm";
import { useProviderConfig } from "./hooks/useProviderConfig";

// Tab Components
import { AIProviderTab, SearchTab, AdvancedTab, AboutTab } from "./tabs";

export interface SettingProps {
  open: boolean;
  onClose: () => void;
}

export function Setting({ open, onClose }: SettingProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("ai");

  // 表单管理
  const {
    form,
    handleSubmit,
    handleClose,
    handleReset,
    handleAddCustomDomain,
    handleRemoveCustomDomain,
    handleModeChange,
  } = useSettingForm({ open, onClose });

  // Provider配置管理
  const providerConfig = useProviderConfig();

  // 处理对话框关闭
  const onDialogClose = (open: boolean) => {
    handleClose(open);
    // 重置activeTab到默认状态
    if (!open) {
      setActiveTab("ai");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onDialogClose}>
      <DialogContent className="w-full max-w-4xl h-[90vh] max-h-[800px] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("setting.title")}</DialogTitle>
          <DialogDescription>{t("setting.description")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="ai">{t("setting.tabs.ai")}</TabsTrigger>
                <TabsTrigger value="search">{t("setting.tabs.search")}</TabsTrigger>
                <TabsTrigger value="advanced">{t("setting.tabs.advanced")}</TabsTrigger>
                <TabsTrigger value="about">{t("setting.tabs.about")}</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto">
                <TabsContent value="ai" className="mt-0 h-full">
                  <AIProviderTab
                    form={form}
                    providerConfig={providerConfig}
                    onModeChange={handleModeChange}
                  />
                </TabsContent>

                <TabsContent value="search" className="mt-0 h-full">
                  <SearchTab
                    form={form}
                    onAddCustomDomain={handleAddCustomDomain}
                    onRemoveCustomDomain={handleRemoveCustomDomain}
                  />
                </TabsContent>

                <TabsContent value="advanced" className="mt-0 h-full">
                  <AdvancedTab form={form} />
                </TabsContent>

                <TabsContent value="about" className="mt-0 h-full">
                  <AboutTab />
                </TabsContent>
              </div>
            </Tabs>
          </form>
        </Form>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={handleReset}>
            {t("setting.actions.reset")}
          </Button>
          <Button type="submit" onClick={form.handleSubmit(handleSubmit)}>
            {t("setting.actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default Setting;