"use client";

import { useState } from "react";
import { Search, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLiteratureDiscovery } from "@/hooks/useLiteratureDiscovery";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface LiteratureDiscoveryPanelProps {
  onDiscoveryComplete?: (results: any) => void;
}

export function LiteratureDiscoveryPanel({ onDiscoveryComplete }: LiteratureDiscoveryPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  
  const {
    isDiscovering,
    currentQuery,
    results,
    progress,
    discoverLiterature,
    resetState
  } = useLiteratureDiscovery();

  const handleDiscover = async () => {
    if (!query.trim()) {
      toast.error("请输入搜索查询");
      return;
    }

    try {
      const result = await discoverLiterature(query.trim(), topic.trim() || "默认");
      
      if (result.success) {
        toast.success(`成功发现并添加 ${result.addedItems.length} 篇文献`);
        onDiscoveryComplete?.(result);
        setQuery("");
        setTopic("");
      } else {
        toast.error(`文献发现失败: ${result.error}`);
      }
    } catch (error) {
      toast.error("文献发现过程中出现错误");
    }
  };

  const getProgressValue = () => {
    if (!progress) return 0;
    const stageProgress = {
      'searching': 25,
      'parsing': 50,
      'matching': 75,
      'storing': 90,
      'complete': 100
    };
    return stageProgress[progress.stage] || 0;
  };

  const getStatusIcon = () => {
    if (isDiscovering) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (results?.success) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (results && !results.success) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    return <Search className="h-4 w-4" />;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          文献发现引擎
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 输入区域 */}
        <div className="space-y-3">
          <div>
            <Label htmlFor="search-query">搜索查询</Label>
            <Input
              id="search-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="输入关键词、主题或研究问题..."
              disabled={isDiscovering}
              onKeyPress={(e) => e.key === 'Enter' && !isDiscovering && handleDiscover()}
            />
          </div>
          
          <div>
            <Label htmlFor="topic-tag">话题标签</Label>
            <Input
              id="topic-tag"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="为发现的文献添加话题标签（可选）"
              disabled={isDiscovering}
            />
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button 
            onClick={handleDiscover}
            disabled={isDiscovering || !query.trim()}
            className="flex-1"
          >
            {isDiscovering ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                发现中...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                开始发现
              </>
            )}
          </Button>
          
          {(results || isDiscovering) && (
            <Button 
              onClick={resetState}
              variant="outline"
              disabled={isDiscovering}
            >
              重置
            </Button>
          )}
        </div>

        {/* 进度指示器 */}
        {isDiscovering && progress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{progress.message}</span>
              <span>{getProgressValue()}%</span>
            </div>
            <Progress value={getProgressValue()} className="w-full" />
          </div>
        )}

        {/* 结果展示 */}
        {results && (
          <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">发现结果</span>
              <Badge variant={results.success ? "default" : "destructive"}>
                {results.success ? "成功" : "失败"}
              </Badge>
            </div>
            
            {results.success ? (
              <div className="text-sm text-gray-600">
                <p>• 新增文献: {results.addedItems.length} 篇</p>
                <p>• 查询: "{currentQuery}"</p>
                {results.addedItems.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium">添加的文献ID:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {results.addedItems.slice(0, 5).map((id, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {id.slice(0, 8)}...
                        </Badge>
                      ))}
                      {results.addedItems.length > 5 && (
                        <Badge variant="secondary" className="text-xs">
                          +{results.addedItems.length - 5} 更多
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-red-600">{results.error}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}