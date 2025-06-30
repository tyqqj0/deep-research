"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight, Search, Brain, ClipboardList, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import dynamic from "next/dynamic";

const MagicDownView = dynamic(() => import("./View"));

interface ThreePhaseThinkingViewProps {
  reflection?: string;
  strategicThinking?: string;
  reasoning?: string;
  completionStatus?: 'RESEARCH_COMPLETE' | 'RESEARCH_PARTIAL' | 'RESEARCH_INSUFFICIENT';
  researchGaps?: string;
}

function getStatusIcon(status?: string) {
  switch (status) {
    case 'RESEARCH_COMPLETE':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'RESEARCH_PARTIAL':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case 'RESEARCH_INSUFFICIENT':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Search className="h-4 w-4 text-blue-500" />;
  }
}

function getStatusText(status?: string) {
  switch (status) {
    case 'RESEARCH_COMPLETE':
      return '研究目标已达成';
    case 'RESEARCH_PARTIAL':
      return '研究部分完成';
    case 'RESEARCH_INSUFFICIENT':
      return '研究尚不充分';
    default:
      return '评估中...';
  }
}

function ThreePhaseThinkingView({
  reflection,
  strategicThinking,
  reasoning,
  completionStatus,
  researchGaps
}: ThreePhaseThinkingViewProps) {
  const { t } = useTranslation();
  const [expandedPhases, setExpandedPhases] = useState<{
    reflection: boolean;
    thinking: boolean;
    planning: boolean;
  }>({
    reflection: true,
    thinking: false,
    planning: false
  });

  const togglePhase = (phase: 'reflection' | 'thinking' | 'planning') => {
    setExpandedPhases(prev => ({
      ...prev,
      [phase]: !prev[phase]
    }));
  };

  return (
    <div className="space-y-3">
      {/* 反思评估阶段 */}
      <div className="border rounded-lg">
        <div 
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
          onClick={() => togglePhase('reflection')}
        >
          <div className="flex items-center space-x-2">
            {expandedPhases.reflection ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Search className="h-4 w-4 text-blue-500" />
            <span className="font-medium">🔍 {t("research.thinking.reflection")}</span>
            {completionStatus && (
              <div className="flex items-center space-x-1 ml-2">
                {getStatusIcon(completionStatus)}
                <span className="text-sm text-muted-foreground">{getStatusText(completionStatus)}</span>
              </div>
            )}
          </div>
        </div>
        {expandedPhases.reflection && (
          <div className="px-3 pb-3 border-t bg-blue-50/30 dark:bg-blue-950/20">
            {reflection ? (
              <div className="space-y-2">
                <MagicDownView>{reflection}</MagicDownView>
                {researchGaps && (
                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded border-l-4 border-yellow-400">
                    <div className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                      待深入研究的方向：
                    </div>
                    <MagicDownView>{researchGaps}</MagicDownView>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm py-2">
                {t("research.thinking.reflectionInProgress")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 深度思考阶段 */}
      <div className="border rounded-lg">
        <div 
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
          onClick={() => togglePhase('thinking')}
        >
          <div className="flex items-center space-x-2">
            {expandedPhases.thinking ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Brain className="h-4 w-4 text-purple-500" />
            <span className="font-medium">🧠 {t("research.thinking.strategicThinking")}</span>
          </div>
        </div>
        {expandedPhases.thinking && (
          <div className="px-3 pb-3 border-t bg-purple-50/30 dark:bg-purple-950/20">
            {strategicThinking ? (
              <MagicDownView>{strategicThinking}</MagicDownView>
            ) : (
              <div className="text-muted-foreground text-sm py-2">
                {t("research.thinking.strategicThinkingInProgress")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 任务规划阶段 */}
      <div className="border rounded-lg">
        <div 
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
          onClick={() => togglePhase('planning')}
        >
          <div className="flex items-center space-x-2">
            {expandedPhases.planning ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <ClipboardList className="h-4 w-4 text-green-500" />
            <span className="font-medium">📋 {t("research.thinking.taskPlanning")}</span>
          </div>
        </div>
        {expandedPhases.planning && (
          <div className="px-3 pb-3 border-t bg-green-50/30 dark:bg-green-950/20">
            {reasoning ? (
              <MagicDownView>{reasoning}</MagicDownView>
            ) : (
              <div className="text-muted-foreground text-sm py-2">
                {t("research.thinking.taskPlanningInProgress")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ThreePhaseThinkingView;