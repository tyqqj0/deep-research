"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

// 🎯 文献搜索面板 - 临时简化版本

interface LiteratureSearchPanelProps {
  mode?: 'seeding' | 'expanding';
  topic: string;
  onTopicChange?: (topic: string) => void;
  onComplete?: (result: {
    totalAdded: number;
    totalDuplicates: number;
    sessionId: string;
  }) => void;
  className?: string;
}

export default function LiteratureSearchPanel({
  mode = 'seeding',
  topic,
  onTopicChange,
  onComplete,
  className = ''
}: LiteratureSearchPanelProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          文献搜索面板 (已简化)
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline">话题: {topic}</Badge>
          <Badge variant="outline">模式: {mode}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg mb-2">组件已简化</p>
          <p className="text-sm">请使用主Research页面中的MCTS文献工作流功能</p>
          <p className="text-xs mt-2 text-gray-400">
            此组件将在后续版本中重新实现或移除
          </p>
        </div>
      </CardContent>
    </Card>
  );
}