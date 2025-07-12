"use client";

import { useState } from "react";
import { 
  Download, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  User,
  Folder,
  Users,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { zoteroService } from "@/libs/zotero";
import { useLibraryStore } from "@/store/libraryStore";
import type { ZoteroSyncResult, ZoteroUserInfo, ZoteroCollection, ZoteroGroup, ZoteroLibrary } from "@/libs/zotero/types";
import { useTranslation } from "react-i18next";

interface ZoteroImportSectionProps {
  isConnected: boolean;
  userInfo: ZoteroUserInfo | null;
  collections: ZoteroCollection[];
  groups: ZoteroGroup[];
  libraries: ZoteroLibrary[];
  currentLibrary: ZoteroLibrary | null;
  onLoginClick: () => void;
  onLibraryChange: (libraryId: string) => void;
}

export function ZoteroImportSection({ 
  isConnected, 
  userInfo, 
  collections, 
  groups, 
  libraries,
  currentLibrary,
  onLoginClick,
  onLibraryChange
}: ZoteroImportSectionProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ZoteroSyncResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [selectedCollection, setSelectedCollection] = useState<string>("__all__");
  
  const { items: libraryItems, addLibraryItems, updateLibraryItem } = useLibraryStore();
  const { t } = useTranslation();
  const startImport = async () => {
    if (!isConnected || !currentLibrary) {
      toast.error(t('library.zoteroImportSection.pleaseConnectToZoteroAndSelectLibraryFirst'));
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportResult(null);
    
    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      const collectionKey = selectedCollection && selectedCollection !== "__all__" ? selectedCollection : undefined;
      const result = await zoteroService.syncItems(libraryItems, collectionKey);
      
      // Add new items to the library in batch
      if (result.newItems && result.newItems.length > 0) {
        const itemsToAdd = result.newItems.map(item => {
          const { id, createdAt, updatedAt, ...itemData } = item;
          return itemData;
        });
        
        console.log(`[ZoteroImport] Batch adding ${itemsToAdd.length} items to UI state`);
        const batchResult = await addLibraryItems(itemsToAdd);
        console.log(`[ZoteroImport] Batch add result:`, batchResult);
      }
      
      // Update existing items
      if (result.updatedItems) {
        for (const item of result.updatedItems) {
          await updateLibraryItem(item.id, item);
        }
      }
      
      clearInterval(progressInterval);
      setImportProgress(100);
      setImportResult(result);

      if (result.success) {
        if (result.itemsAdded > 0) {
          toast.success(t('library.zoteroImportSection.successfullyImportedNewItemsFromZotero', { count: result.itemsAdded }));
        }
        if (result.itemsUpdated > 0) {
          toast.success(t('library.zoteroImportSection.updatedExistingItemsFromZotero', { count: result.itemsUpdated }));
        }
        if (result.itemsSkipped > 0) {
          toast.info(t('library.zoteroImportSection.skippedItemsAlreadyUpToDate', { count: result.itemsSkipped }));
        }
      } else {
        toast.error(t('library.zoteroImportSection.importFailed'));
      }
    } catch (error) {
      toast.error(t('library.zoteroImportSection.importFailed'));
      console.error("Zotero import error:", error);
    } finally {
      setIsImporting(false);
    }
  };

  const refreshCollections = async () => {
    if (!isConnected || !currentLibrary) {
      toast.error(t('library.zoteroImportSection.pleaseConnectToZoteroAndSelectLibraryFirst'));
      return;
    }

    try {
      toast.info(t('library.zoteroImportSection.refreshingCollections'));
      await zoteroService.fetchCollectionsForLibrary(currentLibrary);
      toast.success(t('library.zoteroImportSection.collectionsRefreshed'));
      // Parent component will handle the UI refresh through proper state management
    } catch (error) {
      toast.error(t('library.zoteroImportSection.failedToRefreshCollections'));
      console.error("Refresh error:", error);
    }
  };

  const handleLibraryChange = async (libraryId: string) => {
    try {
      setSelectedCollection("__all__"); // Reset collection selection
      onLibraryChange(libraryId);
      toast.info(t('library.zoteroImportSection.switchingLibraryAndRefreshingCollections'));
    } catch (error) {
      toast.error(t('library.zoteroImportSection.failedToSwitchLibrary'));
      console.error("Library switch error:", error);
    }
  };

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            {t('library.zoteroImportSection.zoteroIntegration')}
          </CardTitle>
          <CardDescription>
            {t('library.zoteroImportSection.connectToZoteroLibrary')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
              <XCircle className="h-5 w-5" />
              <span>{t('library.zoteroImportSection.notConnectedToZotero')}</span>
            </div>
            <Button onClick={onLoginClick}>
              {t('library.zoteroImportSection.connectToZotero')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            {t('library.zoteroImportSection.connectedToZotero')}
          </CardTitle>
          <CardDescription>
            {t('library.zoteroImportSection.readyToImportLiteratureFromZoteroLibrary')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {userInfo && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{userInfo.username || userInfo.displayName || `User ${userInfo.userID}`}</span>
                </div>
                {libraries.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{t('library.zoteroImportSection.librariesAvailable', { count: libraries.length })}</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={onLoginClick}
                size="sm"
              >
                {t('library.zoteroImportSection.manageConnection')}
              </Button>
              <Button 
                variant="outline" 
                onClick={refreshCollections}
                size="sm"
                disabled={!currentLibrary}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                {t('library.zoteroImportSection.refreshCollections')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t('library.zoteroImportSection.importLiterature')}
          </CardTitle>
          <CardDescription>
            {t('library.zoteroImportSection.selectLibrariesAndCollectionsToImportItemsFromZoteroLibrary')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Library Selection */}
          {libraries.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('library.zoteroImportSection.selectLibrary')}</Label>
              <Select 
                value={currentLibrary?.id || ""} 
                onValueChange={handleLibraryChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('library.zoteroImportSection.chooseLibrary')} />
                </SelectTrigger>
                <SelectContent>
                  {libraries.map((library) => (
                    <SelectItem key={library.id} value={library.id}>
                      <div className="flex items-center gap-2">
                        {library.isPersonal ? (
                          <User className="h-3 w-3" />
                        ) : (
                          <Users className="h-3 w-3" />
                        )}
                        <span>{library.name}</span>
                        <Badge variant="outline" className="text-xs ml-2">
                          {library.isPersonal ? t('library.zoteroImportSection.personal') : t('library.zoteroImportSection.group')}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('library.zoteroImportSection.switchBetweenPersonalAndGroupLibraries')}
              </p>
            </div>
          )}

          {/* Collection Selection */}
          {currentLibrary && collections.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('library.zoteroImportSection.selectCollection')}</Label>
              <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                <SelectTrigger>
                  <SelectValue placeholder={t('library.zoteroImportSection.chooseCollection')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('library.zoteroImportSection.allCollections')}</SelectItem>
                  <Separator />
                  {collections.map((collection) => (
                    <SelectItem key={collection.key} value={collection.key}>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <Folder className="h-3 w-3" />
                          {collection.name}
                        </div>
                        {collection.itemsCount && (
                          <Badge variant="secondary" className="text-xs ml-2">
                            {collection.itemsCount}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('library.zoteroImportSection.chooseSpecificCollectionToImportOnlyThoseItems')}
              </p>
            </div>
          )}

          {/* Library Info */}
          {currentLibrary && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                {currentLibrary.isPersonal ? (
                  <User className="h-4 w-4 text-blue-600" />
                ) : (
                  <Users className="h-4 w-4 text-green-600" />
                )}
                <span className="font-medium">{t('library.zoteroImportSection.currentLibrary')}:</span>
                <span>{currentLibrary.name}</span>
                <Badge variant={currentLibrary.isPersonal ? "default" : "secondary"}>
                  {currentLibrary.isPersonal ? t('library.zoteroImportSection.personal') : t('library.zoteroImportSection.group')}
                </Badge>
              </div>
              {collections.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Folder className="h-3 w-3" />
                  <span>{t('library.zoteroImportSection.collectionsAvailable', { count: collections.length })}</span>
                </div>
              )}
            </div>
          )}

          {/* Import Progress */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{t('library.zoteroImportSection.importingItems')}</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="w-full" />
            </div>
          )}

          {/* Import Button */}
          <Button
            onClick={startImport}
            disabled={isImporting || !currentLibrary}
            className="w-full"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('library.zoteroImportSection.importing')}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                {t('library.zoteroImportSection.startImport')}
              </>
            )}
          </Button>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>{t('library.zoteroImportSection.importProcess')}:</strong> {t('library.zoteroImportSection.importProcessDescription')}
              {currentLibrary && (
                <div className="mt-2 text-sm space-y-1">
                  <div><strong>Library:</strong> {currentLibrary.name}</div>
                  {selectedCollection && selectedCollection !== "__all__" && (
                    <div><strong>Collection:</strong> {collections.find(c => c.key === selectedCollection)?.name}</div>
                  )}
                </div>
              )}
              <div className="mt-2 text-xs text-muted-foreground">
                <strong>{t('library.zoteroImportSection.note')}:</strong> {t('library.zoteroImportSection.noteDescription')}
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Import Results */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {importResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              {t('library.zoteroImportSection.importResults')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {importResult.itemsAdded}
                </div>
                <div className="text-sm text-muted-foreground">{t('library.zoteroImportSection.itemsAdded')}</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {importResult.itemsUpdated}
                </div>
                <div className="text-sm text-muted-foreground">{t('library.zoteroImportSection.itemsUpdated')}</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">
                  {importResult.itemsSkipped}
                </div>
                <div className="text-sm text-muted-foreground">{t('library.zoteroImportSection.itemsSkipped')}</div>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{t('library.zoteroImportSection.errorsEncountered')}:</strong>
                  <ul className="mt-2 space-y-1">
                    {importResult.errors.map((error, index) => (
                      <li key={index} className="text-sm">• {error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Button 
              variant="outline" 
              onClick={() => setImportResult(null)}
              className="w-full"
            >
              {t('library.zoteroImportSection.clearResults')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}