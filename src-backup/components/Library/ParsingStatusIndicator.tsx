"use client";

import {
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  Upload,
  AlertTriangle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { TaskDisplayState } from "@/libs/task/TaskStateManager";

// 🎯 重构后的纯UI组件Props - 接收计算好的显示状态
interface ParsingStatusIndicatorProps {
  displayState: TaskDisplayState; // 计算好的标准化显示状态
  onUploadPdf?: () => void;
  showUploadButton?: boolean;
  className?: string;
  viewMode?: 'list' | 'grid';
}

// 🎨 状态到图标的映射
const STATUS_ICONS: Record<TaskDisplayState['status'], React.ReactNode> = {
  idle: <Clock className="h-3 w-3" />,
  pending: <Clock className="h-3 w-3" />,
  processing: <Loader2 className="h-3 w-3 animate-spin" />,
  completed: <CheckCircle className="h-3 w-3" />,
  failed: <XCircle className="h-3 w-3" />,
  url_failed: <AlertTriangle className="h-3 w-3" />
};

export function ParsingStatusIndicator({
  displayState,
  onUploadPdf,
  showUploadButton = true,
  className,
  viewMode = 'grid'
}: ParsingStatusIndicatorProps) {
  // 🎯 纯UI逻辑：基于接收的显示状态渲染组件
  const icon = STATUS_ICONS[displayState.status];
  const shouldShowUpload = displayState.showUploadButton && showUploadButton && onUploadPdf;
  const shouldShowProgress = displayState.status === 'processing' || displayState.status === 'pending';
  const progressValue = displayState.progress;

  return (
    <TooltipProvider>
      <div className={cn("flex items-center", viewMode === 'list' ? "gap-2" : "gap-1", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={displayState.variant}
              className={cn(
                "flex items-center text-xs font-medium",
                // 根据视图模式调整间距和大小
                viewMode === 'list' ? "gap-1.5 px-2 py-1" : "gap-1 px-1.5 py-0.5",
                // 🎯 直接使用计算好的颜色
                displayState.color
              )}
            >
              {icon}
              {/* 仅在列表模式下显示标签名称 */}
              {viewMode === 'list' && (
                <span className="max-w-32 truncate" title={displayState.label}>
                  {displayState.label}
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
            <p className="text-sm">{displayState.description}</p>
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

// 🎯 组件重构完成 - 现在是纯UI组件，接收计算好的TaskDisplayState