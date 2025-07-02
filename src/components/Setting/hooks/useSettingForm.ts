import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useLayoutEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useSettingStore } from "@/store/setting";
import { formSchema, type FormSchemaType } from "../types";

// 防止重复加载的标志
let preLoading = false;

export interface UseSettingFormProps {
  open: boolean;
  onClose: () => void;
}

export interface UseSettingFormReturn {
  form: ReturnType<typeof useForm<FormSchemaType>>;
  handleSubmit: (values: FormSchemaType) => void;
  handleClose: (open: boolean) => void;
  handleReset: () => void;
  handleAddCustomDomain: (domain: string) => void;
  handleRemoveCustomDomain: (index: number) => void;
  handleModeChange: (mode: string) => void;
}

export function useSettingForm({ open, onClose }: UseSettingFormProps): UseSettingFormReturn {
  const { t } = useTranslation();
  const { mode, update } = useSettingStore();

  // 表单初始化
  const form = useForm<FormSchemaType>({
    resolver: zodResolver(formSchema),
    defaultValues: async () => {
      if (preLoading) return {} as any;
      preLoading = true;
      const values = await useSettingStore.getState();
      preLoading = false;
      
      // 兼容性处理：处理旧版本的搜索域名策略
      if ((values as any).searchDomainStrategy?.tavily?.academicDomains) {
        (values as any).searchDomainStrategy.tavily.domains = 
          (values as any).searchDomainStrategy.tavily.academicDomains;
        delete (values as any).searchDomainStrategy.tavily.academicDomains;
      }
      
      return values;
    },
  });

  // 表单关闭处理
  const handleClose = useCallback((open: boolean) => {
    if (!open) {
      form.reset(useSettingStore.getState());
      onClose();
    }
  }, [form, onClose]);

  // 表单提交处理
  const handleSubmit = useCallback((values: FormSchemaType) => {
    update(values);
    toast.success(t("setting.saveSuccess"));
    handleClose(false);
  }, [update, t, handleClose]);

  // 重置设置
  const handleReset = useCallback(() => {
    const confirmed = window.confirm(t("setting.resetConfirm"));
    if (confirmed) {
      update({});
      form.reset({});
      toast.success(t("setting.resetSuccess"));
    }
  }, [update, form, t]);

  // 添加自定义域名
  const handleAddCustomDomain = useCallback((domain: string) => {
    if (!domain.trim()) return;
    
    const currentDomains = form.getValues("searchDomainStrategy.tavily.domains.custom") || [];
    const newDomains = [...currentDomains, domain.trim()];
    
    form.setValue("searchDomainStrategy.tavily.domains.custom", newDomains);
  }, [form]);

  // 移除自定义域名
  const handleRemoveCustomDomain = useCallback((index: number) => {
    const currentDomains = form.getValues("searchDomainStrategy.tavily.domains.custom") || [];
    const newDomains = currentDomains.filter((_, i) => i !== index);
    
    form.setValue("searchDomainStrategy.tavily.domains.custom", newDomains);
  }, [form]);

  // 模式变更处理
  const handleModeChange = useCallback((mode: string) => {
    update({ mode });
  }, [update]);

  // 模式初始化效果
  useLayoutEffect(() => {
    if (open && mode === "") {
      const { apiKey, accessPassword, update } = useSettingStore.getState();
      const requestMode = !apiKey && accessPassword ? "proxy" : "local";
      update({ mode: requestMode });
      form.setValue("mode", requestMode);
    }
  }, [open, mode, form]);

  return {
    form,
    handleSubmit,
    handleClose,
    handleReset,
    handleAddCustomDomain,
    handleRemoveCustomDomain,
    handleModeChange,
  };
}