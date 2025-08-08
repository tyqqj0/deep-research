"use client";
import { useLayoutEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { useSettingStore } from "@/store/setting";
import i18n, { detectLanguage } from "@/utils/i18n";

function I18Provider({ children }: { children: React.ReactNode }) {
  const { language } = useSettingStore();

  useLayoutEffect(() => {
    const settingStore = useSettingStore.getState();
    if (language === "") {
      const browserLang = detectLanguage();
      settingStore.update({ language: browserLang });
      i18n.changeLanguage(browserLang);
    } else {
      i18n.changeLanguage(language);
    }
    document.documentElement.setAttribute("lang", language);
    document.title = i18n.t("title");
  }, [language]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

export default I18Provider;
