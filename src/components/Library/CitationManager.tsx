"use client";

import { db, LibraryItem } from "@/libs/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { PdfUploadDialog } from "./PdfUploadDialog";
import {
  BookOpen,
  Users,
  Calendar,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  FileText,
  Upload,
  Library,
  Link2,
  BookDown,
  Plus,
  Unlink,
  Zap,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useState } from "react";
import { useCitations } from "@/hooks/useCitations";
import { toast } from "sonner";

interface CitationManagerProps {
  item: LibraryItem;
  onNavigateToItem: (itemId: string) => void;
}

interface CitationListProps {
  title: string;
  icon: React.ReactNode;
  items: LibraryItem[];
  onNavigateToItem: (itemId: string) => void;
  emptyMessage: string;
  onUnlink?: (targetId: string) => void;
}

interface UnlinkedReferencesProps {
  references: any[];
  onLink: (referenceData: any) => void;
  onAddToLibrary: (referenceData: any) => void;
}

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
  iconColor: string;
}

function StatsCard({ title, value, icon, gradient, iconColor }: StatsCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute inset-0 ${gradient} opacity-10`} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
        <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-full ${iconColor} bg-opacity-20`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
          {value}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {value === 0 ? 'None found' : value === 1 ? '1 item' : `${value} items`}
        </p>
      </CardContent>
    </Card>
  );
}

function UnlinkedReferences({ references, onLink, onAddToLibrary }: UnlinkedReferencesProps) {
  if (references.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            未链接的引文
            <Badge variant="outline" className="ml-auto text-xs">0</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-6">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm">所有引文都已链接</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-orange-500" />
          未链接的引文
          <Badge variant="outline" className="ml-auto text-xs">
            {references.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-3">
            {references.map((ref, index) => (
              <div key={index} className="border rounded-lg p-3 bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                    {ref.title || '未知标题'}
                  </h4>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {ref.authors && (
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span>{Array.isArray(ref.authors) ? ref.authors.slice(0, 2).join(', ') : ref.authors}</span>
                      </div>
                    )}
                    {ref.year && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{ref.year}</span>
                      </div>
                    )}
                  </div>

                  {ref.publication && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <BookOpen className="h-3 w-3" />
                      <span className="truncate">{ref.publication}</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onLink(ref)}
                      className="flex-1 h-7 text-xs"
                    >
                      <Search className="h-3 w-3 mr-1" />
                      搜索并链接
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAddToLibrary(ref)}
                      className="flex-1 h-7 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      添加到文献库
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function CitationList({ title, icon, items, onNavigateToItem, emptyMessage, onUnlink }: CitationListProps) {
  const [showPdfUpload, setShowPdfUpload] = useState(false);
  const [uploadItemId, setUploadItemId] = useState<string | null>(null);

  const handleUploadPdf = (itemId: string) => {
    setUploadItemId(itemId);
    setShowPdfUpload(true);
  };

  const handleUnlink = async (targetId: string) => {
    if (onUnlink) {
      try {
        await onUnlink(targetId);
        toast.success('已取消链接');
      } catch (error) {
        toast.error('取消链接失败');
      }
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            {icon}
            {title}
            <Badge variant="outline" className="ml-auto text-xs">
              {items.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[250px]">
            {items.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{emptyMessage}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((citedItem) => (
                  <div key={citedItem.id} className="border rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          className="font-medium text-sm leading-tight text-blue-600 cursor-pointer hover:underline"
                          onClick={() => onNavigateToItem(citedItem.id)}
                        >
                          {citedItem.title}
                        </h4>
                        <div className="flex gap-1">
                          <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                            已链接
                          </Badge>
                          {onUnlink && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnlink(citedItem.id)}
                              className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                              title="取消链接"
                            >
                              <Unlink className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{citedItem.authors.slice(0, 2).join(', ')}{citedItem.authors.length > 2 ? '...' : ''}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{citedItem.year}</span>
                        </div>
                      </div>

                      {citedItem.publication && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <BookOpen className="h-3 w-3" />
                          <span className="truncate">{citedItem.publication}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {showPdfUpload && uploadItemId && (
        <PdfUploadDialog
          open={showPdfUpload}
          onClose={() => {
            setShowPdfUpload(false);
            setUploadItemId(null);
          }}
          itemId={uploadItemId}
          onUploadSuccess={() => {
            setShowPdfUpload(false);
            setUploadItemId(null);
          }}
        />
      )}
    </>
  );
}

export function CitationManager({ item, onNavigateToItem }: CitationManagerProps) {
  const [showPdfUpload, setShowPdfUpload] = useState(false);
  const [isAutoLinking, setIsAutoLinking] = useState(false);

  // 使用新的 useCitations Hook
  const {
    references,
    citedBy,
    unlinkedReferences,
    isLoading,
    error,
    refresh,
    unlinkCitation,
    autoLinkCitations
  } = useCitations(item.id);

  // 自动链接功能
  const handleAutoLink = async () => {
    setIsAutoLinking(true);
    try {
      const result = await autoLinkCitations(item.id);
      toast.success(`自动链接完成！已链接 ${result.linkedCount} 个引文，剩余 ${result.unlinkedCount} 个未链接`);
    } catch (error) {
      toast.error('自动链接失败');
    } finally {
      setIsAutoLinking(false);
    }
  };

  // 取消链接
  const handleUnlink = async (targetId: string) => {
    await unlinkCitation(item.id, targetId);
  };

  // 处理手动链接
  const handleLinkReference = async (referenceData: any) => {
    // TODO: 实现搜索对话框，让用户选择要链接的文献
    toast.info('搜索功能即将推出');
  };

  // 处理添加到文献库
  const handleAddToLibrary = async (referenceData: any) => {
    // TODO: 实现预填充的添加文献表单
    toast.info('添加功能即将推出');
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-12 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          载入引文数据失败：{error}
        </AlertDescription>
      </Alert>
    );
  }

  // 计算总引文数量
  const totalReferences = item.parsedContent?.extractedReferences?.length || 0;

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="总引文数"
          value={totalReferences}
          icon={<BookDown className="h-5 w-5 text-blue-600" />}
          gradient="bg-gradient-to-br from-blue-400 to-blue-600"
          iconColor="bg-blue-100 dark:bg-blue-900"
        />
        <StatsCard
          title="已链接"
          value={references.length}
          icon={<Link2 className="h-5 w-5 text-green-600" />}
          gradient="bg-gradient-to-br from-green-400 to-green-600"
          iconColor="bg-green-100 dark:bg-green-900"
        />
        <StatsCard
          title="被引用"
          value={citedBy.length}
          icon={<Library className="h-5 w-5 text-purple-600" />}
          gradient="bg-gradient-to-br from-purple-400 to-purple-600"
          iconColor="bg-purple-100 dark:bg-purple-900"
        />
      </div>

      {/* 自动链接控制面板 */}
      {totalReferences > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              自动化引文链接
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  智能匹配引文到您的文献库中的现有条目
                </p>
                {unlinkedReferences.length > 0 && (
                  <p className="text-xs text-orange-600 mt-1">
                    还有 {unlinkedReferences.length} 个引文未链接
                  </p>
                )}
              </div>
              <Button
                onClick={handleAutoLink}
                disabled={isAutoLinking || totalReferences === 0}
                className="ml-4"
              >
                {isAutoLinking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    链接中...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    自动链接
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 引文列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CitationList
          title="引用文献"
          icon={<ArrowRight className="h-4 w-4 text-green-500" />}
          items={references}
          onNavigateToItem={onNavigateToItem}
          emptyMessage="没有找到引用的文献"
          onUnlink={handleUnlink}
        />
        <CitationList
          title="被引用"
          icon={<ArrowLeft className="h-4 w-4 text-blue-500" />}
          items={citedBy}
          onNavigateToItem={onNavigateToItem}
          emptyMessage="暂无文献引用此条目"
        />
      </div>

      {/* 未链接的引文 */}
      <UnlinkedReferences
        references={unlinkedReferences}
        onLink={handleLinkReference}
        onAddToLibrary={handleAddToLibrary}
      />

      {/* PDF Upload Dialog */}
      {showPdfUpload && (
        <PdfUploadDialog
          open={showPdfUpload}
          onClose={() => setShowPdfUpload(false)}
          itemId={item.id}
          onUploadSuccess={() => setShowPdfUpload(false)}
        />
      )}
    </div>
  );
}