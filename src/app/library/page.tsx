"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Plus, Search, Filter, Download, Upload, RefreshCw, ArrowLeft } from "lucide-react";
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
import { toast } from "sonner";
import type { ZoteroUserInfo, ZoteroCollection, ZoteroGroup, ZoteroLibrary } from "@/libs/zotero/types";
import { zoteroService } from "@/libs/zotero";
import type { LibraryItem } from "@/libs/db";

export default function LibraryPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  const [showZoteroLogin, setShowZoteroLogin] = useState(false);
  const [showPdfUpload, setShowPdfUpload] = useState(false);
  const [zoteroUserInfo, setZoteroUserInfo] = useState<ZoteroUserInfo | null>(null);
  const [zoteroCollections, setZoteroCollections] = useState<ZoteroCollection[]>([]);
  const [zoteroGroups, setZoteroGroups] = useState<ZoteroGroup[]>([]);
  const [zoteroLibraries, setZoteroLibraries] = useState<ZoteroLibrary[]>([]);
  const [currentZoteroLibrary, setCurrentZoteroLibrary] = useState<ZoteroLibrary | null>(null);
  const [isZoteroConnected, setIsZoteroConnected] = useState(false);
  
  const {
    items,
    isLoading,
    error,
    sourceFilter,
    searchTerm,
    initialize,
    setSourceFilter,
    setSearchTerm,
    getFilteredItems,
    deleteLibraryItems,
    clearError,
    isZoteroConfigured,
    zoteroSyncResult
  } = useLibraryStore();

  // Use useMemo to ensure filteredItems updates when items change
  const filteredItems = useMemo(() => getFilteredItems(), [items, sourceFilter, searchTerm, getFilteredItems]);

  useEffect(() => {
    const initializeAsync = async () => {
      try {
        await initialize();
        
        // Check if Zotero is already configured
        const storedConfig = zoteroService.getStoredConfig();
        if (storedConfig) {
          setIsZoteroConnected(true);
          // Try to get cached user info
          const cachedUserInfo = zoteroService.getCachedUserInfo();
          if (cachedUserInfo) {
            setZoteroUserInfo(cachedUserInfo);
          }
          const cachedCollections = zoteroService.getCachedCollections();
          const cachedGroups = zoteroService.getCachedGroups();
          const cachedLibraries = zoteroService.getCachedLibraries();
          const currentLibrary = zoteroService.getCurrentLibrary();
          setZoteroCollections(cachedCollections);
          setZoteroGroups(cachedGroups);
          setZoteroLibraries(cachedLibraries);
          setCurrentZoteroLibrary(currentLibrary);
        }
      } catch (error) {
        console.error('Library initialization failed:', error);
      }
    };
    initializeAsync();
  }, []);

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

  const handleZoteroLibraryChange = async (libraryId: string) => {
    try {
      const collections = await zoteroService.switchLibrary(libraryId);
      setZoteroCollections(collections);
      setCurrentZoteroLibrary(zoteroService.getCurrentLibrary());
    } catch (error) {
      toast.error('Failed to switch library');
      console.error('Library switch error:', error);
    }
  };

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
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Literature Library
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Manage your research literature collection
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {alert('TODO: Export functionality' /* TODO: Export functionality */)}}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPdfUpload(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import PDFs
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowZoteroLogin(true)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Zotero Sync
          </Button>
          <Button
            onClick={() => setShowAddForm(true)}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Literature
          </Button>
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
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
            <p className="text-xs text-muted-foreground">
              {filteredItems.length} filtered
            </p>
          </CardContent>
        </Card>
        
        {Object.entries(sourceStats).map(([source, count]) => (
          <Card key={source}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <span>{SOURCE_METADATA[source as keyof typeof SOURCE_METADATA]?.icon}</span>
                {SOURCE_METADATA[source as keyof typeof SOURCE_METADATA]?.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search literature..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sourceFilter} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {Object.entries(LITERATURE_SOURCES).map(([key, value]) => (
              <SelectItem key={key} value={value}>
                <div className="flex items-center gap-2">
                  <span>{SOURCE_METADATA[value]?.icon}</span>
                  {SOURCE_METADATA[value]?.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list">Literature List</TabsTrigger>
          <TabsTrigger value="trees">Literature Trees</TabsTrigger>
          <TabsTrigger value="sync">Zotero Sync</TabsTrigger>
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
                toast.success("Literature item deleted successfully!");
              } catch (error) {
                toast.error("Failed to delete literature item");
              }
            }}
            onBulkDelete={handleBulkDelete}
            onSelectForTree={(item) => {
              // TODO: Implement tree selection
              toast.info(`Add "${item.title}" to tree functionality coming soon!`);
            }}
            onItemClick={(item) => {
              handleEditLiterature(item);
            }}
          />
        </TabsContent>
        
        <TabsContent value="trees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Literature Trees</CardTitle>
              <CardDescription>
                Manage your MCTS literature exploration trees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-8">
                Tree management functionality coming soon...
              </p>
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
          onLoginSuccess={async (userInfo, collections, groups) => {
            setZoteroUserInfo(userInfo);
            setZoteroCollections(collections);
            setZoteroGroups(groups);
            setIsZoteroConnected(true);
            
            // Get libraries after successful login
            try {
              const libraries = await zoteroService.getAvailableLibraries();
              setZoteroLibraries(libraries);
              setCurrentZoteroLibrary(zoteroService.getCurrentLibrary());
            } catch (error) {
              console.error('Failed to get libraries:', error);
            }
          }}
        />
      )}

      {/* PDF Upload Dialog */}
      {showPdfUpload && (
        <PdfUploadDialog
          open={showPdfUpload}
          onClose={() => setShowPdfUpload(false)}
          onUploadSuccess={() => {
            toast.success("PDFs uploaded successfully!");
            setShowPdfUpload(false);
          }}
        />
      )}
    </div>
  );
}