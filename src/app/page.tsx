"use client";
import dynamic from "next/dynamic";
import { useLayoutEffect, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { useGlobalStore } from "@/store/global";
import { useSettingStore } from "@/store/setting";
import { useTaskStore } from "@/store/task";
import { useLibraryStore } from "@/store/libraryStore";

const Header = dynamic(() => import("@/components/Internal/Header"));
const Setting = dynamic(() => import("@/components/Setting"));
const DirectionFinding = dynamic(() => import("@/components/Research/DirectionFinding"));
const SearchResult = dynamic(
  () => import("@/components/Research/SearchResult")
);
const MCTSLiteratureWorkflow = dynamic(
  () => import("@/components/Research/MCTSLiteratureWorkflow")
);
const FinalReport = dynamic(() => import("@/components/Research/FinalReport"));
const History = dynamic(() => import("@/components/History"));
const Knowledge = dynamic(() => import("@/components/Knowledge"));

function Home() {
  const { t } = useTranslation();
  const {
    openSetting,
    setOpenSetting,
    openHistory,
    setOpenHistory,
    openKnowledge,
    setOpenKnowledge,
  } = useGlobalStore();

  const { theme } = useSettingStore();
  const { setTheme } = useTheme();
  const taskStore = useTaskStore();
  const libraryStore = useLibraryStore();

  // 🎯 判断是否有研究主题（进入MCTS模式）
  const hasResearchTopic = !!(taskStore.question && taskStore.question.trim());

  useLayoutEffect(() => {
    const settingStore = useSettingStore.getState();
    setTheme(settingStore.theme);
  }, [theme, setTheme]);

  // ✅ 库存储已在模块加载时自动初始化，无需重复初始化

  return (
    <div className="max-lg:max-w-screen-md max-w-screen-lg mx-auto px-4">
      <Header />
      <main>
        {/* 第一块：研究方向确定 - 始终显示 */}
        <DirectionFinding />

        {/* 第二块：根据是否有研究主题来决定显示内容 */}
        {hasResearchTopic ? (
          // 🌱 有研究主题时：显示MCTS三面板布局
          <MCTSLiteratureWorkflow
            topic={taskStore.question}
            reportPlan={taskStore.reportPlan}
            onTopicChange={(newTopic) => taskStore.setQuestion(newTopic)}
            className="mt-4"
          />
        ) : (
          // 📚 无研究主题时：显示传统搜索结果
          <SearchResult />
        )}

        {/* 第三块：最终报告 - 始终显示 */}
        <FinalReport />
      </main>
      <footer className="my-4 text-center text-sm text-gray-600 print:hidden">
        <a href="https://auto.lab.westlake.edu.cn/" target="_blank">
          {t("copyright", {
            name: "Autolab",
          })}
        </a>
      </footer>
      <aside className="print:hidden">
        <Setting open={openSetting} onClose={() => setOpenSetting(false)} />
        <History open={openHistory} onClose={() => setOpenHistory(false)} />
        <Knowledge
          open={openKnowledge}
          onClose={() => setOpenKnowledge(false)}
        />
      </aside>
    </div>
  );
}

export default Home;
