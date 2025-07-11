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
import type { ZoteroSyncResult, ZoteroUserInfo, ZoteroCollection, ZoteroGroup } from "@/libs/zotero/types";

interface ZoteroImportSectionProps {
  isConnected: boolean;
  userInfo: ZoteroUserInfo | null;
  collections: ZoteroCollection[];
  groups: ZoteroGroup[];
  onLoginClick: () => void;
}

export function ZoteroImportSection({
  isConnected,
  userInfo,
  collections,
  groups,
  onLoginClick
}: ZoteroImportSectionProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ZoteroSyncResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [selectedCollection, setSelectedCollection] = useState<string>("__all__");
  const [selectedGroup, setSelectedGroup] = useState<string>("");

  const { items: libraryItems, addLibraryItem, updateLibraryItem } = useLibraryStore();

  const startImport = async () => {
    if (!isConnected) {
      toast.error("Please connect to Zotero first");
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

      // Add new items to the library
      if (result.newItems) {
        for (const item of result.newItems) {
          const { id, createdAt, updatedAt, ...itemData } = item;
          await addLibraryItem(itemData);
        }
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
          toast.success(`Successfully imported ${result.itemsAdded} new items from Zotero!`);
        }
        if (result.itemsUpdated > 0) {
          toast.success(`Updated ${result.itemsUpdated} existing items from Zotero!`);
        }
        if (result.itemsSkipped > 0) {
          toast.info(`Skipped ${result.itemsSkipped} items (already up to date)`);
        }
      } else {
        toast.error("Import failed. Please check the error details.");
      }
    } catch (error) {
      toast.error("Import failed. Please try again.");
      console.error("Zotero import error:", error);
    } finally {
      setIsImporting(false);
    }
  };

  const refreshCollections = async () => {
    if (!isConnected) {
      toast.error("Please connect to Zotero first");
      return;
    }

    try {
      toast.info("Refreshing collections and groups...");
      const [collectionsResult, groupsResult] = await Promise.allSettled([
        zoteroService.fetchCollections(),
        zoteroService.fetchGroups()
      ]);

      if (collectionsResult.status === 'fulfilled' || groupsResult.status === 'fulfilled') {
        toast.success("Collections and groups refreshed!");
        // Force a re-render by updating the parent component
        // window.location.reload();
        const { initialize: reinitialize } = useLibraryStore.getState();
        await reinitialize();
      }
    } catch (error) {
      toast.error("Failed to refresh collections and groups");
      console.error("Refresh error:", error);
    }
  };

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Zotero Integration
          </CardTitle>
          <CardDescription>
            Connect to your Zotero library to import and sync literature
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
              <XCircle className="h-5 w-5" />
              <span>Not connected to Zotero</span>
            </div>
            <Button onClick={onLoginClick}>
              Connect to Zotero
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
            Connected to Zotero
          </CardTitle>
          <CardDescription>
            Ready to import literature from your Zotero library
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
                {collections.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <span>{collections.length} collections</span>
                  </div>
                )}
                {groups.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{groups.length} groups</span>
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
                Manage Connection
              </Button>
              <Button
                variant="outline"
                onClick={refreshCollections}
                size="sm"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
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
            Import Literature
          </CardTitle>
          <CardDescription>
            Select collections and import items from your Zotero library
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Collection Selection */}
          {collections.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Collection</Label>
              <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a collection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All collections</SelectItem>
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
                💡 Choose a specific collection to import only those items
              </p>
            </div>
          )}

          {/* Group Selection */}
          {groups.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Available Groups</Label>
              <div className="grid grid-cols-1 gap-2">
                {groups.map((group) => (
                  <div key={group.id} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div className="flex items-center gap-2">
                      <Users className="h-3 w-3" />
                      <span className="text-sm">{group.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {group.type}
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedGroup(group.id);
                        toast.info(`Selected group: ${group.name}`);
                      }}
                    >
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import Progress */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Importing items...</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="w-full" />
            </div>
          )}

          {/* Import Button */}
          <Button
            onClick={startImport}
            disabled={isImporting}
            className="w-full"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Start Import
              </>
            )}
          </Button>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Import Process:</strong> We'll check for duplicates based on title matching.
              Existing items will be updated if they have newer modification dates in Zotero.
              {selectedCollection && selectedCollection !== "__all__" && (
                <div className="mt-2 text-sm">
                  <strong>Selected Collection:</strong> {collections.find(c => c.key === selectedCollection)?.name}
                </div>
              )}
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
              Import Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {importResult.itemsAdded}
                </div>
                <div className="text-sm text-muted-foreground">Items Added</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {importResult.itemsUpdated}
                </div>
                <div className="text-sm text-muted-foreground">Items Updated</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">
                  {importResult.itemsSkipped}
                </div>
                <div className="text-sm text-muted-foreground">Items Skipped</div>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Errors encountered:</strong>
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
              Clear Results
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}