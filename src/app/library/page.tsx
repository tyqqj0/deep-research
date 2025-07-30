"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Plus, Search, Filter, Download, Upload, RefreshCw, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useLibraryStore } from "@/store/libraryStore";
import { LITERATURE_SOURCES, SOURCE_METADATA } from "@/libs/db/constants";
import { LiteratureList } from "@/components/Library/LiteratureList";
import { AddLiteratureForm } from "@/components/Library/AddLiteratureForm";
import { EditLiteratureForm } from "@/components/Library/EditLiteratureForm";
import { ZoteroLogin } from "@/components/Library/ZoteroLogin";
import { ZoteroImportSection } from "@/components/Library/ZoteroImportSection";
import { PdfUploadDialog } from "@/components/Library/PdfUploadDialog";
import { LiteratureDiscoveryPanel } from "@/components/Library/LiteratureDiscoveryPanel";
import { toast } from "sonner";
import type { LibraryItem } from "@/libs/db";
import { GlobalCitationGraph } from "@/components/Library/CitationGraph";
import { TreeVisualization } from "@/components/Library/TreeVisualization";
import { useZotero } from "@/hooks/useZotero";


export default function LibraryPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  const [showZoteroLogin, setShowZoteroLogin] = useState(false);
  const [showPdfUpload, setShowPdfUpload] = useState(false);
  const [isGraphExpanded, setIsGraphExpanded] = useState(false); // 添加图谱展开状态

  const {
    userInfo: zoteroUserInfo,
    collections: zoteroCollections,
    groups: zoteroGroups,
    libraries: zoteroLibraries,
    currentLibrary: currentZoteroLibrary,
    isConnected: isZoteroConnected,
    handleLibraryChange: handleZoteroLibraryChange,
    handleLoginSuccess,
  } = useZotero();

  const {
    items,
    isLoading,
    error,
    sourceFilter,
    searchTerm,
    topicFilter,
    availableTopics,
    initialize,
    setSourceFilter,
    setSearchTerm,
    setTopicFilter,
    addTopicToFilter,
    removeTopicFromFilter,
    getFilteredItems,
    deleteLibraryItems,
    clearError,
    isZoteroConfigured,
    zoteroSyncResult
  } = useLibraryStore();

  // Use useMemo to ensure filteredItems updates when items change
  const filteredItems = useMemo(() => getFilteredItems(), [items, sourceFilter, searchTerm, topicFilter, getFilteredItems]);

  useEffect(() => {
    const initializeAsync = async () => {
      try {
        await initialize();
      } catch (error) {
        console.error('Library initialization failed:', error);
      }
    };
    initializeAsync();
  }, [initialize]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const handleFilterChange = (value: string) => {
    setSourceFilter(value as any);
  };

  const sourceStats = useMemo(() => {
    const stats = Object.keys(LITERATURE_SOURCES).reduce((acc, key) => {
      const source = LITERATURE_SOURCES[key as keyof typeof LITERATURE_SOURCES];
      acc[source] = items.filter(item => item.source === source).length;
      return acc;
    }, {} as Record<string, number>);

    return stats;
  }, [items]);

  const handleEditLiterature = (item: LibraryItem) => {
    setEditingItem(item);
    setShowEditForm(true);
  };

  const handleCloseEditForm = () => {
    setShowEditForm(false);
    setEditingItem(null);
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      await deleteLibraryItems(ids);
      toast.success(`Successfully deleted ${ids.length} literature items!`);
    } catch (error) {
      toast.error("Failed to delete literature items");
    }
  };

  const handleNodeClick = (itemId: string) => {
    console.log('[LibraryPage] Node click received for itemId:', itemId);
    const item = items.find(i => i.id === itemId);
    console.log('[LibraryPage] Found item:', item?.title);
    if (item) {
      handleEditLiterature(item);
    } else {
      console.error('[LibraryPage] Item not found for ID:', itemId);
    }
  };

  const handleGraphExpandToggle = (expanded: boolean) => {
    setIsGraphExpanded(expanded);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.back()}
            className="flex items-center gap-2 text-lg px-6 py-3 font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('library.common.back')}
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t('library.common.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              {t('library.common.description')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { alert('TODO: Export functionality' /* TODO: Export functionality */) }}
          >
            <Download className="h-4 w-4 mr-2" />
            {t('library.common.export')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPdfUpload(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            {t('library.common.import')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowZoteroLogin(true)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('library.common.zoteroSync')}
          </Button>
          <Button
            onClick={() => setShowAddForm(true)}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('library.common.addLiterature')}
          </Button>
        </div>
      </div>


      {/* Dashboard: Statistics + Global Knowledge Graph */}
      <div className="mb-8">
        <div className={`grid gap-6 transition-all duration-300 ${isGraphExpanded ? 'grid-cols-1 h-[90vh]' : 'grid-cols-1 lg:grid-cols-12 h-[500px]'}`}>
          {/* Left Column: Statistics Cards - 展开时隐藏 */}
          {!isGraphExpanded && (
            <div className="lg:col-span-4">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">{t('library.common.libraryOverview')}</CardTitle>
                  <CardDescription>{t('library.common.libraryOverviewDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 h-full overflow-y-auto">
                  {/* Total Items Card */}
                  <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('library.common.totalItems')}</p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{items.length}</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          {filteredItems.length} {t('library.common.filtered')}
                        </p>
                      </div>
                      <div className="text-blue-500">
                        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Source Statistics */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('library.common.bySource')}</h4>
                    {Object.entries(sourceStats).map(([source, count]) => (
                      <div key={source} className="flex items-center justify-between p-3 rounded-md bg-gray-50 dark:bg-gray-800">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{t(SOURCE_METADATA[source as keyof typeof SOURCE_METADATA]?.icon)}</span>
                          <span className="text-sm font-medium">{t(SOURCE_METADATA[source as keyof typeof SOURCE_METADATA]?.name)}</span>
                        </div>
                        <Badge variant="secondary" className="font-semibold">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Right Column: Global Citation Graph - 展开时占满整个宽度 */}
          <div className={`h-full transition-all duration-300 ${isGraphExpanded ? 'col-span-1' : 'lg:col-span-8'}`}>
            <GlobalCitationGraph
              onNodeClick={handleNodeClick}
              className="h-full"
              onExpandToggle={handleGraphExpandToggle}
            />
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="mt-2"
              >
                {t('library.common.dismiss')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter Bar - 展开时隐藏 */}
      {!isGraphExpanded && (
        <>
          {/* 隔开 */}
          <div className="h-8"></div>
          <div className="flex flex-col gap-4 mb-6">
            {/* 第一行：搜索框和来源过滤器 */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t('library.common.searchLiterature')}
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={sourceFilter} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t('library.common.filterBySource')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('library.common.allSources')}</SelectItem>
                  {Object.entries(LITERATURE_SOURCES).map(([key, value]) => (
                    <SelectItem key={key} value={value}>
                      <div className="flex items-center gap-2">
                        <span>{t(SOURCE_METADATA[value]?.icon)}</span>
                        {t(SOURCE_METADATA[value]?.name)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 第二行：话题过滤器 - 现在总是显示 */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <Filter className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  🏷️ 按话题过滤
                </span>
              </div>
              <div className="flex-1">
                <Select
                  value={topicFilter.length > 0 ? "custom" : "all"}
                  onValueChange={(value) => {
                    if (value === "all") {
                      setTopicFilter([]);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择要过滤的话题...">
                      {topicFilter.length === 0
                        ? "显示所有话题"
                        : `已选择 ${topicFilter.length} 个话题`
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">显示所有话题</SelectItem>
                    {availableTopics.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs font-medium text-blue-600 border-b bg-blue-50">
                          🎯 研究话题（点击切换）
                        </div>
                        {availableTopics.map(topic => (
                          <div
                            key={topic}
                            className="flex items-center gap-2 px-2 py-2 hover:bg-blue-50 cursor-pointer"
                            onClick={(e) => {
                              e.preventDefault();
                              if (topicFilter.includes(topic)) {
                                removeTopicFromFilter(topic);
                              } else {
                                addTopicToFilter(topic);
                              }
                            }}
                          >
                            <div className="flex items-center space-x-2 flex-1">
                              <input
                                type="checkbox"
                                checked={topicFilter.includes(topic)}
                                onChange={() => { }}
                                className="w-4 h-4 text-blue-600"
                              />
                              <span className="text-sm font-medium text-blue-800">
                                🎯 {topic.length > 35 ? topic.substring(0, 35) + "..." : topic}
                              </span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    {availableTopics.length === 0 && (
                      <div className="px-2 py-2 text-xs text-gray-500">
                        暂无可用话题，请先为文献添加话题标签
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {topicFilter.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTopicFilter([])}
                  className="flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  清除
                </Button>
              )}
            </div>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="list">{t('library.common.literatureList')}</TabsTrigger>
              <TabsTrigger value="discovery">文献发现</TabsTrigger>
              <TabsTrigger value="trees">{t('library.common.literatureTrees')}</TabsTrigger>
              <TabsTrigger value="sync">{t('library.common.zoteroSync')}</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="space-y-4">
              <LiteratureList
                items={filteredItems}
                isLoading={isLoading}
                onEdit={handleEditLiterature}
                onDelete={async (id) => {
                  try {
                    const { deleteLibraryItem } = useLibraryStore.getState();
                    await deleteLibraryItem(id);
                    toast.success(t('library.common.literatureItemDeletedSuccess'));
                  } catch (error) {
                    toast.error(t('library.common.literatureItemDeletedError'));
                  }
                }}
                onBulkDelete={handleBulkDelete}
                onSelectForTree={(item) => {
                  // TODO: Implement tree selection
                  toast.info(t('library.common.addLiteratureToTreeComingSoon', { title: item.title }));
                }}
                onItemClick={(item) => {
                  handleEditLiterature(item);
                }}
              />
            </TabsContent>

            <TabsContent value="discovery" className="space-y-4">
              <div className="max-w-2xl mx-auto">
                <LiteratureDiscoveryPanel
                  onDiscoveryComplete={(results) => {
                    // 刷新文献列表以显示新添加的文献
                    initialize();
                    toast.success(`文献发现完成！新增 ${results.addedItems.length} 篇文献`);
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="trees" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('library.common.literatureTrees')}</CardTitle>
                  <CardDescription>
                    {t('library.common.literatureTreesDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TreeVisualization
                    mode="edit"
                    height="700px"
                    showControls={true}
                    showMiniMap={true}
                    showTreeSelector={true}
                    showNodeStats={true}
                    enablePhysics={true}
                    onNodeSelect={(node) => {
                      console.log('Selected node:', node);
                    }}
                    onTreeChange={(treeId) => {
                      console.log('Tree changed:', treeId);
                    }}
                    onNodeAdd={(parentId, itemId) => {
                      console.log('Node added:', parentId, itemId);
                    }}
                    onNodeDelete={(nodeId) => {
                      console.log('Node deleted:', nodeId);
                    }}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sync" className="space-y-4">
              <ZoteroImportSection
                isConnected={isZoteroConnected}
                userInfo={zoteroUserInfo}
                collections={zoteroCollections}
                groups={zoteroGroups}
                libraries={zoteroLibraries}
                currentLibrary={currentZoteroLibrary}
                onLoginClick={() => setShowZoteroLogin(true)}
                onLibraryChange={handleZoteroLibraryChange}
              />
            </TabsContent>
          </Tabs>

          {/* Add Literature Form Modal */}
          {showAddForm && (
            <AddLiteratureForm
              open={showAddForm}
              onClose={() => setShowAddForm(false)}
            />
          )}

          {/* Edit Literature Form Modal */}
          {showEditForm && (
            <EditLiteratureForm
              open={showEditForm}
              onClose={handleCloseEditForm}
              item={editingItem}
            />
          )}

          {/* Zotero Login Modal */}
          {showZoteroLogin && (
            <ZoteroLogin
              open={showZoteroLogin}
              onClose={() => setShowZoteroLogin(false)}
              onLoginSuccess={handleLoginSuccess}
            />
          )}

          {/* PDF Upload Dialog */}
          {showPdfUpload && (
            <PdfUploadDialog
              open={showPdfUpload}
              onClose={() => setShowPdfUpload(false)}
              onUploadSuccess={() => {
                toast.success(t('library.common.pdfUploadSuccess'));
                setShowPdfUpload(false);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}