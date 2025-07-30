/**
 * 📡 LiteratureSubmissionStatus - SSE文献提交状态组件
 * 
 * 🎯 功能：
 * - 显示当前活跃的文献提交状态
 * - 实时进度更新
 * - 错误状态展示
 * - 成功完成通知
 * 
 * 🎨 UI特性：
 * - 紧凑的进度条显示
 * - 状态图标和颜色编码
 * - 可折叠的详细信息面板
 * - 优雅的动画过渡
 */

"use client";

import { useState } from "react";
import { 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Upload,
  Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLibraryStore } from "@/store/libraryStore";
import { cn } from "@/lib/utils";

// 🎨 状态图标映射
const STATUS_ICONS = {
  submitting: <Upload className="h-4 w-4 animate-pulse" />,
  processing: <Loader2 className="h-4 w-4 animate-spin" />,
  completed: <CheckCircle className="h-4 w-4" />,
  failed: <XCircle className="h-4 w-4" />,
  url_failed: <AlertTriangle className="h-4 w-4" />
};

// 🎨 状态颜色映射
const STATUS_COLORS = {
  submitting: "bg-blue-100 text-blue-800 border-blue-200",
  processing: "bg-yellow-100 text-yellow-800 border-yellow-200", 
  completed: "bg-green-100 text-green-800 border-green-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  url_failed: "bg-orange-100 text-orange-800 border-orange-200"
};

// 🎨 状态标签映射
const STATUS_LABELS = {
  submitting: "正在提交",
  processing: "处理中",
  completed: "已完成",
  failed: "失败",
  url_failed: "URL错误"
};

export function LiteratureSubmissionStatus() {
  const [isExpanded, setIsExpanded] = useState(true);
  const activeSubmissions = useLibraryStore(state => state.activeSubmissions);
  
  // 📊 获取提交状态统计
  const submissions = Array.from(activeSubmissions.values());
  const totalCount = submissions.length;
  
  if (totalCount === 0) {
    return null; // 没有活跃提交时不显示组件
  }
  
  const processingCount = submissions.filter(s => s.status === 'processing').length;
  const submittingCount = submissions.filter(s => s.status === 'submitting').length;
  const failedCount = submissions.filter(s => s.status === 'failed' || s.status === 'url_failed').length;
  const completedCount = submissions.filter(s => s.status === 'completed').length;

  // 📊 计算总体进度
  const totalProgress = totalCount > 0 
    ? submissions.reduce((sum, s) => sum + s.progress, 0) / totalCount 
    : 0;

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-l-blue-500">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                文献提交进度
                <Badge variant="secondary" className="ml-2">
                  {totalCount}
                </Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CollapsibleTrigger>
          
          {/* 📊 总体进度条 */}
          <div className="space-y-2">
            <Progress value={totalProgress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>总进度 {Math.round(totalProgress)}%</span>
              <div className="flex items-center gap-3">
                {submittingCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Upload className="h-3 w-3" />
                    {submittingCount}
                  </span>
                )}
                {processingCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {processingCount}
                  </span>
                )}
                {completedCount > 0 && (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    {completedCount}
                  </span>
                )}
                {failedCount > 0 && (
                  <span className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-600" />
                    {failedCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/60 border border-gray-200/50"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* 📍 状态图标 */}
                    <div className="flex-shrink-0">
                      {STATUS_ICONS[submission.status]}
                    </div>
                    
                    {/* 📝 文献信息 */}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate" title={submission.title}>
                        {submission.title}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {submission.stage}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* 📊 进度显示 */}
                    {(submission.status === 'processing' || submission.status === 'submitting') && (
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={submission.progress} 
                          className="h-2 w-16" 
                        />
                        <span className="text-xs text-muted-foreground min-w-[2rem]">
                          {Math.round(submission.progress)}%
                        </span>
                      </div>
                    )}
                    
                    {/* 🏷️ 状态标签 */}
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs",
                        STATUS_COLORS[submission.status]
                      )}
                    >
                      {STATUS_LABELS[submission.status]}
                    </Badge>
                    
                    {/* ⏰ 耗时显示 */}
                    <div className="text-xs text-muted-foreground min-w-[3rem] text-right">
                      {Math.round((Date.now() - submission.startTime.getTime()) / 1000)}s
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default LiteratureSubmissionStatus;