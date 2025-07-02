"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Settings,
  Play,
  Pause,
  Hand,
  CheckCircle,
  Clock,
  Zap,
} from "lucide-react";
import { Button } from "@/components/Internal/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSettingStore } from "@/store/setting";
import { useTaskStore } from "@/store/task";
import useDeepResearch from "@/hooks/useDeepResearch";
import type { SearchTask } from "@/types";

interface SearchControlSidebarProps {
  className?: string;
}

function SearchControlSidebar({ className = "" }: SearchControlSidebarProps) {
  const { t } = useTranslation();
  const { searchExecutionMode, update: updateSettings } = useSettingStore();
  const { tasks } = useTaskStore();
  const { runSearchTask } = useDeepResearch();
  const [isExecuting, setIsExecuting] = useState(false);

  // Get pending search tasks
  const pendingTasks = tasks.filter(
    (task): task is SearchTask =>
      task.type === "search" && ["unprocessed", "waiting"].includes(task.state)
  );

  const handleModeChange = (mode: "immediate" | "delayed" | "manual") => {
    updateSettings({ searchExecutionMode: mode });
  };

  const handleExecuteAll = async () => {
    console.log('[SearchControl] Executing all tasks:', {
      pendingTasksCount: pendingTasks.length,
      pendingTasks: pendingTasks.map(t => ({ id: t.id, title: t.title, state: t.state })),
      searchExecutionMode
    });
    
    if (pendingTasks.length === 0) {
      console.log('[SearchControl] No pending tasks to execute');
      return;
    }
    
    setIsExecuting(true);
    try {
      console.log('[SearchControl] Calling runSearchTask...');
      // 临时设置为立即执行模式来强制执行任务
      const currentMode = searchExecutionMode;
      updateSettings({ searchExecutionMode: "immediate" });
      await runSearchTask(pendingTasks);
      // 恢复原来的模式
      updateSettings({ searchExecutionMode: currentMode });
      console.log('[SearchControl] runSearchTask completed');
    } catch (error) {
      console.error('[SearchControl] Error executing tasks:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case "immediate":
        return <Zap className="h-4 w-4" />;
      case "delayed":
        return <Clock className="h-4 w-4" />;
      case "manual":
        return <Hand className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case "immediate":
        return t("research.searchControl.immediate", "立即执行");
      case "delayed":
        return t("research.searchControl.delayed", "延迟执行");
      case "manual":
        return t("research.searchControl.manual", "手动执行");
      default:
        return t("research.searchControl.unknown", "未知模式");
    }
  };

  return (
    <div className={`flex flex-col gap-1 border rounded-full py-2 p-1 bg-white dark:bg-slate-800 max-sm:opacity-80 max-sm:hover:opacity-100 print:hidden ${className}`}>
      {/* Search Execution Mode Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="float-menu-button"
            type="button"
            size="icon"
            variant="ghost"
            title={t("research.searchControl.executionMode", "搜索执行模式")}
            side="left"
            sideoffset={8}
          >
            {getModeIcon(searchExecutionMode)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="left" sideOffset={8}>
          <DropdownMenuLabel>
            {t("research.searchControl.selectMode", "选择执行模式")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleModeChange("immediate")}>
            <Zap className="mr-2 h-4 w-4" />
            <div className="flex flex-col">
              <span>{t("research.searchControl.immediate", "立即执行")}</span>
              <span className="text-xs text-muted-foreground">
                {t("research.searchControl.immediateDesc", "搜索任务生成后立即执行")}
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleModeChange("delayed")}>
            <Clock className="mr-2 h-4 w-4" />
            <div className="flex flex-col">
              <span>{t("research.searchControl.delayed", "延迟执行")}</span>
              <span className="text-xs text-muted-foreground">
                {t("research.searchControl.delayedDesc", "搜索任务生成后等待指定时间再执行")}
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleModeChange("manual")}>
            <Hand className="mr-2 h-4 w-4" />
            <div className="flex flex-col">
              <span>{t("research.searchControl.manual", "手动执行")}</span>
              <span className="text-xs text-muted-foreground">
                {t("research.searchControl.manualDesc", "搜索任务生成后需要手动确认执行")}
              </span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Execute All Pending Tasks Button */}
      {pendingTasks.length > 0 ? (
        <Button
          className="float-menu-button"
          type="button"
          size="icon"
          variant="ghost"
          title={t("research.searchControl.executeAll", "执行所有待处理任务") + ` (${pendingTasks.length})`}
          side="left"
          sideoffset={8}
          onClick={handleExecuteAll}
          disabled={isExecuting}
        >
          {isExecuting ? (
            <Pause className="h-4 w-4 animate-pulse" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
      ) : (
        /* Debug info for development - shows when no pending tasks */
        process.env.NODE_ENV === "development" && (
          <Button
            className="float-menu-button opacity-50"
            type="button"
            size="icon"
            variant="ghost"
            title={`调试：无待处理任务。总任务数：${tasks.length}，任务状态：${tasks.map(t => `${t.type}:${t.type === 'search' ? (t as SearchTask).state : 'N/A'}`).join(', ')}`}
            side="left"
            sideoffset={8}
            disabled
          >
            <Play className="h-4 w-4" />
          </Button>
        )
      )}

      {/* Current Mode Status Indicator */}
      <Button
        className="float-menu-button"
        type="button"
        size="icon"
        variant="ghost"
        title={`${t("research.searchControl.currentMode", "当前模式")}: ${getModeLabel(searchExecutionMode)}`}
        side="left"
        sideoffset={8}
        disabled
      >
        <CheckCircle className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default SearchControlSidebar;