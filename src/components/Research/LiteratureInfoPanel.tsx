"use client";

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  BookOpen, 
  ExternalLink, 
  Calendar, 
  User, 
  ArrowRight,
  Plus,
  FileText
} from 'lucide-react';
import { LibraryItem } from '@/libs/db';
import { SOURCE_METADATA } from '@/libs/db/constants';

// 🎯 极简版文献信息展示面板 - 为MCTS工作流设计

interface LiteratureInfoPanelProps {
  sessionLiterature: LibraryItem[];
  topic: string;
  onViewLibrary: () => void;
  className?: string;
}

interface LiteratureCardMiniProps {
  item: LibraryItem;
  onSelect?: () => void;
}

// 极简文献卡片
function LiteratureCardMini({ item, onSelect }: LiteratureCardMiniProps) {
  const sourceMetadata = SOURCE_METADATA[item.source || 'manual'];
  
  const formatAuthors = (authors: string[]) => {
    if (authors.length === 0) return '未知作者';
    if (authors.length === 1) return authors[0];
    if (authors.length === 2) return authors.join(', ');
    return `${authors[0]}等`;
  };

  const truncateTitle = (title: string, maxLength: number = 50) => {
    return title.length <= maxLength ? title : title.substring(0, maxLength) + '...';
  };

  return (
    <div 
      className="p-3 border rounded-lg hover:shadow-sm transition-all cursor-pointer bg-white dark:bg-gray-800"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium leading-tight text-gray-900 dark:text-gray-100 mb-1">
            {truncateTitle(item.title)}
          </h4>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{formatAuthors(item.authors)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{item.year}</span>
            </div>
          </div>
        </div>
        <Badge 
          variant="outline" 
          className={`text-xs px-1 ${sourceMetadata?.color || 'bg-gray-100 text-gray-800'}`}
          title={sourceMetadata?.name}
        >
          {sourceMetadata?.icon}
        </Badge>
      </div>
    </div>
  );
}

export default function LiteratureInfoPanel({
  sessionLiterature,
  topic,
  onViewLibrary,
  className = ''
}: LiteratureInfoPanelProps) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);

  // 显示逻辑：默认显示前6个，点击显示全部
  const displayItems = showAll ? sessionLiterature : sessionLiterature.slice(0, 6);
  const hasMore = sessionLiterature.length > 6;

  // 统计信息
  const stats = {
    total: sessionLiterature.length,
    bySource: sessionLiterature.reduce((acc, item) => {
      const source = item.source || 'manual';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    recentlyAdded: sessionLiterature.filter(
      item => new Date().getTime() - new Date(item.createdAt).getTime() < 24 * 60 * 60 * 1000
    ).length
  };

  return (
    <Card className={`h-full ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-600" />
              会话文献库
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              话题: {topic}
            </p>
          </div>
          <Button
            onClick={onViewLibrary}
            variant="outline"
            size="sm"
            className="shrink-0"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            完整库
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 统计概览 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
            <div className="text-lg font-semibold text-blue-600">{stats.total}</div>
            <div className="text-xs text-gray-500">总文献</div>
          </div>
          <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
            <div className="text-lg font-semibold text-green-600">{stats.recentlyAdded}</div>
            <div className="text-xs text-gray-500">今日新增</div>
          </div>
          <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
            <div className="text-lg font-semibold text-purple-600">
              {Object.keys(stats.bySource).length}
            </div>
            <div className="text-xs text-gray-500">来源类型</div>
          </div>
        </div>

        <Separator />

        {/* 文献列表 */}
        <div className="space-y-3">
          {sessionLiterature.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">还没有文献</p>
              <p className="text-xs">开始搜索以添加文献到此会话</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">最新文献</h4>
                {hasMore && (
                  <Button
                    onClick={() => setShowAll(!showAll)}
                    variant="ghost"
                    size="sm"
                    className="h-auto p-1 text-xs"
                  >
                    {showAll ? '收起' : `查看全部 ${sessionLiterature.length}`}
                  </Button>
                )}
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {displayItems.map((item) => (
                  <LiteratureCardMini
                    key={item.id}
                    item={item}
                    onSelect={() => {
                      console.log('Selected literature:', item.title);
                      // 这里可以触发查看详情或其他操作
                    }}
                  />
                ))}
              </div>

              {!showAll && hasMore && (
                <div className="text-center pt-2">
                  <Button
                    onClick={() => setShowAll(true)}
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    还有 {sessionLiterature.length - 6} 篇文献
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 来源分布（当有文献时） */}
        {sessionLiterature.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium">来源分布</h4>
              <div className="flex flex-wrap gap-1">
                {Object.entries(stats.bySource).map(([source, count]) => {
                  const metadata = SOURCE_METADATA[source as keyof typeof SOURCE_METADATA];
                  return (
                    <Badge
                      key={source}
                      variant="outline"
                      className={`text-xs ${metadata?.color || 'bg-gray-100 text-gray-800'}`}
                    >
                      {metadata?.icon} {count}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}