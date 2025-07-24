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
import { useLibraryStore } from "@/store/libraryStore";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

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
  onLink: (referenceData: any, referenceIndex: number) => void;
  onAddToLibrary: (referenceData: any, referenceIndex: number) => void;
  addingToLibrary: Set<number>;
}

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
  iconColor: string;
}
function StatsCard({ title, value, icon, gradient, iconColor }: StatsCardProps) {
  const { t } = useTranslation();
  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute inset-0 ${gradient} opacity-10`} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 relative z-10">
        <CardTitle className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {title}
        </CardTitle>
        <div className={`p-1 rounded-full ${iconColor} bg-opacity-20`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent className="relative z-10 pt-0 pb-2">
        <div className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
          {value}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {value === 0 ? t('library.citationManager.noneFound') : value === 1 ? t('library.citationManager.oneItem') : `${value} ${t('library.citationManager.items')}`}
        </p>
      </CardContent>
    </Card>
  );
}

function UnlinkedReferences({ references, onLink, onAddToLibrary, addingToLibrary }: UnlinkedReferencesProps) {
  const { t } = useTranslation();
  if (references.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            {t('library.citationManager.unlinkedReferences')}
            <Badge variant="outline" className="ml-auto text-xs">0</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-6">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm">{t('library.citationManager.allReferencesAreLinked')}</p>
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
          {t('library.citationManager.unlinkedReferences')}
          <Badge variant="outline" className="ml-auto text-xs">
            {references.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[45vh] min-h-[100px] max-h-[250px]">
          <div className="space-y-3">
            {references.map((ref, index) => (
              <div key={index} className="border rounded-lg p-3 bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                    {ref.title || t('library.citationManager.unknownTitle')}
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAddToLibrary(ref, index)}
                      className=" h-7 w-34 text-xs ml-auto"
                      disabled={addingToLibrary.has(index)}
                    >
                      {addingToLibrary.has(index) ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          {t('library.citationManager.adding')}
                        </>
                      ) : (
                        <>
                          <Plus className="h-3 w-3 mr-1" />
                          {t('library.citationManager.addToLibrary')}
                        </>
                      )}
                    </Button>
                  </div>

                  {ref.publication && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <BookOpen className="h-3 w-3" />
                      <span className="truncate">{ref.publication}</span>
                    </div>
                  )}


                  {/* <div className="flex gap-2 pt-2"> */}
                  {/* <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onLink(ref, index)}
                      className="flex-1 h-7 text-xs"
                      disabled={addingToLibrary.has(index)}
                    >
                      <Search className="h-3 w-3 mr-1" />
                      搜索并链接
                    </Button> */}

                  {/* </div> */}
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
  const { t } = useTranslation();
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
        toast.success(t('library.citationManager.unlinkSuccess'));
      } catch (error) {
        toast.error(t('library.citationManager.unlinkFailed'));
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
          <ScrollArea className="h-[40vh] min-h-[100px] max-h-[250px]">
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
                            {t('library.citationManager.linked')}
                          </Badge>
                          {onUnlink && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnlink(citedItem.id)}
                              className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                              title={t('library.citationManager.unlink')}
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

// 🔍 从引文数据中提取用于创建新文献的信息
function extractLiteratureDataFromReference(referenceData: any): {
  title: string;
  authors: string[];
  year: number;
  doi?: string;
  url?: string;
  publication?: string;
  abstract?: string;
} {
  // 处理嵌套结构的引文数据
  let extractedData: any = {};

  if (referenceData.parsed && typeof referenceData.parsed === 'object') {
    // 使用 parsed 中的结构化数据
    extractedData = {
      title: referenceData.parsed.title || referenceData.raw_text || '未知标题',
      authors: referenceData.parsed.authors?.map((author: any) =>
        typeof author === 'string' ? author : (author.name || author.author || String(author))
      ) || ['Unknown Author'],
      year: referenceData.parsed.year ||
        (referenceData.parsed.publicationDate ? new Date(referenceData.parsed.publicationDate).getFullYear() : new Date().getFullYear()),
      doi: referenceData.parsed.doi || referenceData.parsed.externalIds?.DOI,
      url: referenceData.parsed.url,
      publication: referenceData.parsed.venue || referenceData.parsed.journal,
      abstract: referenceData.parsed.abstract
    };
  } else {
    // 使用扁平结构或已处理的数据
    extractedData = {
      title: referenceData.title || referenceData.raw_text || '未知标题',
      authors: referenceData.authors || ['Unknown Author'],
      year: referenceData.year || new Date().getFullYear(),
      doi: referenceData.doi,
      url: referenceData.url,
      publication: referenceData.publication || referenceData.journal,
      abstract: referenceData.abstract
    };
  }

  // 确保数据类型正确
  return {
    title: String(extractedData.title),
    authors: Array.isArray(extractedData.authors) ? extractedData.authors : [String(extractedData.authors)],
    year: Number(extractedData.year) || new Date().getFullYear(),
    doi: extractedData.doi || undefined,
    url: extractedData.url || undefined,
    publication: extractedData.publication || undefined,
    abstract: extractedData.abstract || undefined
  };
}

export function CitationManager({ item, onNavigateToItem }: CitationManagerProps) {
  const { t } = useTranslation();
  const [showPdfUpload, setShowPdfUpload] = useState(false);
  const [isAutoLinking, setIsAutoLinking] = useState(false);
  const [addingToLibrary, setAddingToLibrary] = useState<Set<number>>(new Set()); // 跟踪正在添加的引文

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

  // 使用 LibraryStore 来添加新文献
  const { masterAddLiterature } = useLibraryStore();

  // 自动链接功能
  const handleAutoLink = async () => {
    setIsAutoLinking(true);
    try {
      const result = await autoLinkCitations(item.id);
      toast.success(t('library.citationManager.autoLinkCompleted', { count: result.linkedCount, unlinkedCount: result.unlinkedCount }));
    } catch (error) {
      toast.error(t('library.citationManager.autoLinkFailed'));
    } finally {
      setIsAutoLinking(false);
    }
  };

  // 取消链接
  const handleUnlink = async (targetId: string) => {
    await unlinkCitation(item.id, targetId);
  };

  // 处理手动链接
  const handleLinkReference = async (referenceData: any, referenceIndex: number) => {
    // TODO: 实现搜索对话框，让用户选择要链接的文献
    toast.info(t('library.citationManager.searchFeatureComingSoon'));
  };

  // 处理添加到文献库 - 使用新的统一工作流
  const handleAddToLibrary = async (referenceData: any, referenceIndex: number) => {
    try {
      // 提取引文数据
      const literatureData = extractLiteratureDataFromReference(referenceData);

      console.log('🔍 [DEBUG] Extracted literature data for adding:', literatureData);

      // 检查是否有足够的信息进行解析
      if (!literatureData.doi && !literatureData.url && literatureData.title === '未知标题') {
        toast.error(t('library.citationManager.referenceInformationIsInsufficient'));
        return;
      }

      // 标记该引文正在添加中
      setAddingToLibrary(prev => new Set(prev).add(referenceIndex));

      // 🚀 使用新的统一主函数，带有完整的生命周期回调和精确的链接策略
      const result = await masterAddLiterature({
        title: literatureData.title,
        authors: literatureData.authors,
        year: literatureData.year,
        doi: literatureData.doi,
        url: literatureData.url,
        publication: literatureData.publication,
        abstract: literatureData.abstract,
        source: 'import' // 标记为从引文导入
      }, {
        onProgress: (stage, progress) => {
          console.log(`📈 [AddToLibrary] ${stage} (${progress}%)`);
          // 可以在这里更新UI进度条
        },
        onTaskCreated: (taskId, itemId) => {
          console.log(`🚀 [AddToLibrary] Task created: ${taskId} for item: ${itemId}`);
          toast.success(t('library.citationManager.literatureParsingCompleted', { title: literatureData.title }));
        },
        onComplete: (itemId, resultType) => {
          console.log(`✅ [AddToLibrary] Complete: ${itemId} (${resultType})`);

          if (resultType === 'duplicate') {
            toast.success(t('library.citationManager.literatureParsingCompleted', { title: literatureData.title }));
          } else {
            toast.success(t('library.citationManager.literatureParsingCompleted', { title: literatureData.title }));
          }

          // 刷新引文数据，以便重新检查链接状态
          setTimeout(() => {
            refresh();
          }, 1000);
        },
        onError: (error) => {
          console.error('🔴 [AddToLibrary] Error:', error);
          toast.error(t('library.citationManager.addLiteratureFailed', { message: error.message }));
        },
        // 🎯 精确的链接策略：从当前文献指向新添加的文献
        linkingStrategy: {
          mode: 'source-to-target',
          sourceItemId: item.id // 当前正在查看的文献ID
        }
      });

      // 处理立即返回的结果（主要是本地条目或重复检测）
      if (result.success) {
        if (result.processingMode === 'local') {
          toast.success(t('library.citationManager.literatureParsingCompleted', { title: literatureData.title }));
          setTimeout(() => {
            refresh();
          }, 1000);
        }
        // 后端处理模式的反馈已在 onTaskCreated 回调中处理
      } else if (result.duplicate && result.duplicate.length > 0) {
        toast.success(t('library.citationManager.literatureParsingCompleted', { title: literatureData.title }));
        setTimeout(() => {
          refresh();
        }, 1000);
      } else {
        throw new Error(result.error || t('library.citationManager.addLiteratureFailed'));
      }

    } catch (error) {
      console.error('Error adding reference to library:', error);
      toast.error(t('library.citationManager.addLiteratureFailed', { message: error instanceof Error ? error.message : t('library.citationManager.unknownError') }));
    } finally {
      // 移除加载状态
      setAddingToLibrary(prev => {
        const newSet = new Set(prev);
        newSet.delete(referenceIndex);
        return newSet;
      });
    }
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
          {t('library.citationManager.loadCitationDataFailed', { error: error })}
        </AlertDescription>
      </Alert>
    );
  }

  // 计算总引文数量
  const totalReferences = item.parsedContent?.extractedReferences?.length || 0;

  return (
    <div className="space-y-4">
      {/* Stats Cards and Auto Link Panel */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={t('library.citationManager.totalReferences')}
          value={totalReferences}
          icon={<BookDown className="h-5 w-5 text-blue-600" />}
          gradient="bg-gradient-to-br from-blue-400 to-blue-600"
          iconColor="bg-blue-100 dark:bg-blue-900"
        />
        <StatsCard
          title={t('library.citationManager.linked')}
          value={references.length}
          icon={<Link2 className="h-5 w-5 text-green-600" />}
          gradient="bg-gradient-to-br from-green-400 to-green-600"
          iconColor="bg-green-100 dark:bg-green-900"
        />
        <StatsCard
          title={t('library.citationManager.citedBy')}
          value={citedBy.length}
          icon={<Library className="h-5 w-5 text-purple-600" />}
          gradient="bg-gradient-to-br from-purple-400 to-purple-600"
          iconColor="bg-purple-100 dark:bg-purple-900"
        />

        {/* 自动链接控制面板 */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-yellow-600 opacity-10" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 relative z-10">
            <CardTitle className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {t('library.citationManager.autoLinkCitations')}
            </CardTitle>
            <div className="p-1 rounded-full bg-yellow-100 dark:bg-yellow-900 bg-opacity-20">
              <Zap className="h-4 w-4 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10 pt-0 pb-2">
            <div className="space-y-2">
              <div className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                {unlinkedReferences.length > 0 ? `${unlinkedReferences.length} ${t('library.citationManager.unlinked')}` : t('library.citationManager.allLinked')}
              </div>
              <Button
                onClick={handleAutoLink}
                disabled={isAutoLinking || totalReferences === 0}
                size="sm"
                className="w-full h-7 text-xs"
              >
                {isAutoLinking ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    {t('library.citationManager.linking')}
                  </>
                ) : (
                  <>
                    <Zap className="h-3 w-3 mr-1" />
                    {t('library.citationManager.autoLink')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 引文列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CitationList
          title={t('library.citationManager.citedLiterature')}
          icon={<ArrowRight className="h-4 w-4 text-green-500" />}
          items={references}
          onNavigateToItem={onNavigateToItem}
          emptyMessage={t('library.citationManager.noCitedLiteratureFound')}
          onUnlink={handleUnlink}
        />
        <CitationList
          title={t('library.citationManager.citedBy')}
          icon={<ArrowLeft className="h-4 w-4 text-blue-500" />}
          items={citedBy}
          onNavigateToItem={onNavigateToItem}
          emptyMessage={t('library.citationManager.noCitedLiteratureFound')}
        />
      </div>

      {/* 未链接的引文 */}
      <UnlinkedReferences
        references={unlinkedReferences}
        onLink={handleLinkReference}
        onAddToLibrary={handleAddToLibrary}
        addingToLibrary={addingToLibrary}
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