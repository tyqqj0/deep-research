"use client";

import {
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  Upload
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { BackendTask } from "@/libs/db/schema";

// 🚀 新的组件Props - 基于BackendTask结构
interface ParsingStatusIndicatorProps {
  backendTask?: BackendTask; // 新的统一数据源
  onUploadPdf?: () => void;
  showUploadButton?: boolean;
  className?: string;
  viewMode?: 'list' | 'grid';
}

// 🚀 新的状态配置系统 - 基于execution_status
interface StatusConfig {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  showUpload: boolean;
  animated?: boolean;
}

type ExecutionStatus = 'completed' | 'processing' | 'pending' | 'failed';

const statusConfigs: Record<ExecutionStatus, StatusConfig> = {
  'pending': {
    icon: <Clock className="h-3 w-3" />,
    label: 'Pending',
    description: 'Task is waiting to be processed',
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    variant: 'outline',
    showUpload: false
  },
  'processing': {
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    label: 'Processing',
    description: 'Task is being processed by the backend',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    variant: 'outline',
    showUpload: false,
    animated: true
  },
  'completed': {
    icon: <CheckCircle className="h-3 w-3" />,
    label: 'Completed',
    description: 'Task has been completed successfully',
    color: 'bg-green-100 text-green-800 border-green-300',
    variant: 'outline',
    showUpload: false
  },
  'failed': {
    icon: <XCircle className="h-3 w-3" />,
    label: 'Failed',
    description: 'Task processing failed',
    color: 'bg-red-100 text-red-800 border-red-300',
    variant: 'destructive',
    showUpload: false
  }
};

// 🚀 获取默认状态配置 (当没有backendTask时使用)
const getDefaultConfig = (): StatusConfig => ({
  icon: <Clock className="h-3 w-3" />,
  label: 'No Task',
  description: 'No processing task assigned',
  color: 'bg-gray-50 text-gray-600 border-gray-200',
  variant: 'outline',
  showUpload: false
});

export function ParsingStatusIndicator({
  backendTask,
  onUploadPdf,
  showUploadButton = true,
  className,
  viewMode = 'grid'
}: ParsingStatusIndicatorProps) {
  // 🚀 基于backendTask获取状态配置
  const hasBackendTask = Boolean(backendTask);
  const executionStatus = backendTask?.execution_status || 'pending';
  const config = hasBackendTask ? statusConfigs[executionStatus] : getDefaultConfig();

  const shouldShowUpload = config.showUpload && showUploadButton && onUploadPdf;

  // 🚀 获取显示信息
  const currentStage = backendTask?.current_stage || config.label;
  const overallProgress = backendTask?.overall_progress || 0;
  const shouldShowProgress = hasBackendTask && (executionStatus === 'processing' || executionStatus === 'pending');

  // 🚀 获取显示标签和描述
  const displayLabel = hasBackendTask ? currentStage : config.label;
  const displayDescription = hasBackendTask
    ? `${currentStage} (${Math.round(overallProgress)}% complete)`
    : config.description;

  // 🚀 获取进度值
  const progressValue = overallProgress;

  return (
    <TooltipProvider>
      <div className={cn("flex items-center", viewMode === 'list' ? "gap-2" : "gap-1", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={config.variant}
              className={cn(
                "flex items-center text-xs font-medium",
                // 根据视图模式调整间距和大小
                viewMode === 'list' ? "gap-1.5 px-2 py-1" : "gap-1 px-1.5 py-0.5",
                // 🚀 后端任务时使用不同的颜色
                hasBackendTask ? "bg-indigo-100 text-indigo-800 border-indigo-300" : config.color
              )}
            >
              {config.icon}
              {/* 仅在列表模式下显示标签名称 */}
              {viewMode === 'list' && (
                <span className="max-w-32 truncate" title={displayLabel}>
                  {displayLabel}
                </span>
              )}
              {shouldShowProgress && (
                <span className="ml-1 text-xs opacity-80">
                  {`${Math.round(progressValue)}%`}
                </span>
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">{displayDescription}</p>
            {shouldShowProgress && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Progress:</span>
                  <span>
                    {`${Math.round(progressValue)}%`}
                  </span>
                </div>
                <Progress
                  value={progressValue}
                  className="h-2 w-32"
                />
                {/* 🚀 显示后端任务ID */}
                {hasBackendTask && backendTask?.task_id && (
                  <div className="text-xs text-muted-foreground">
                    Task: {backendTask.task_id.substring(0, 8)}...
                  </div>
                )}
              </div>
            )}
          </TooltipContent>
        </Tooltip>

        {shouldShowProgress && (
          <div className="flex items-center gap-2">
            <Progress
              value={progressValue}
              className="h-2 w-16"
            />
            <span className="text-xs text-muted-foreground">
              {Math.round(progressValue)}%
            </span>
          </div>
        )}

        {shouldShowUpload && (
          <Button
            variant="outline"
            size="sm"
            onClick={onUploadPdf}
            className="h-7 px-2 text-xs"
          >
            <Upload className="h-3 w-3 mr-1" />
            Upload PDF
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
}

// 🚀 组件重构完成 - 现在使用BackendTask作为唯一数据源