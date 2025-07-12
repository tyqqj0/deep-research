"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Cloud,
  Download,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  User,
  Folder,
  Users,
  LogOut
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { zoteroService } from "@/libs/zotero";
import { useLibraryStore } from "@/store/libraryStore";
import type { ZoteroConfig, ZoteroSyncResult, ZoteroUserInfo, ZoteroCollection, ZoteroGroup } from "@/libs/zotero/types";
import { useTranslation } from "react-i18next";

interface ZoteroImportProps {
  open: boolean;
  onClose: () => void;
}

const configSchema = z.object({
  apiKey: z.string().min(1, "API Key is required"),
  userId: z.string().optional(),
  groupId: z.string().optional(),
});

type ConfigFormData = z.infer<typeof configSchema>;

export function ZoteroImport({ open, onClose }: ZoteroImportProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("config");
  const [isConnected, setIsConnected] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ZoteroSyncResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [userInfo, setUserInfo] = useState<ZoteroUserInfo | null>(null);
  const [collections, setCollections] = useState<ZoteroCollection[]>([]);
  const [groups, setGroups] = useState<ZoteroGroup[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);

  const { items: libraryItems, addLibraryItem, updateLibraryItem } = useLibraryStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset
  } = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      apiKey: "",
      userId: "",
      groupId: "",
    },
  });

  const watchedValues = watch();

  // Load stored config when dialog opens
  useEffect(() => {
    if (open) {
      const storedConfig = zoteroService.getStoredConfig();
      if (storedConfig) {
        setValue("apiKey", storedConfig.apiKey);
        setValue("userId", storedConfig.userId || "");
        setValue("groupId", storedConfig.groupId || "");

        // Auto-test connection if we have stored config
        testStoredConnection(storedConfig);
      }
    }
  }, [open, setValue]);

  const testStoredConnection = async (config: ZoteroConfig) => {
    setIsTesting(true);

    try {
      zoteroService.setConfig(config);
      const testResult = await zoteroService.testConnection();

      if (testResult.success) {
        setIsConnected(true);

        // Get user info and collections
        const userInfo = await zoteroService.getUserInfo();
        if (!userInfo.error) {
          setUserInfo(userInfo);
        }

        loadCollectionsAndGroups();

        // If we have stored config, go directly to import tab
        setActiveTab("import");
        toast.success(t('library.zoteroImportEnhanced.autoConnectedToZotero'));
      }
    } catch (error) {
      console.error("Auto-connection test failed:", error);
    } finally {
      setIsTesting(false);
    }
  };

  const loadCollectionsAndGroups = async () => {
    setIsLoadingCollections(true);
    try {
      const [collectionsResult, groupsResult] = await Promise.allSettled([
        zoteroService.fetchCollections(),
        zoteroService.fetchGroups()
      ]);

      if (collectionsResult.status === 'fulfilled') {
        setCollections(collectionsResult.value);
      }

      if (groupsResult.status === 'fulfilled') {
        setGroups(groupsResult.value);
      }
    } catch (error) {
      console.error('Failed to load collections/groups:', error);
    } finally {
      setIsLoadingCollections(false);
    }
  };

  const handleClose = () => {
    reset();
    setActiveTab("config");
    setIsConnected(false);
    setImportResult(null);
    setImportProgress(0);
    setUserInfo(null);
    setCollections([]);
    setGroups([]);
    setSelectedCollection("");
    setSelectedGroup("");
    onClose();
  };

  const handleDisconnect = () => {
    zoteroService.clearStorage();
    setIsConnected(false);
    setUserInfo(null);
    setCollections([]);
    setGroups([]);
    setSelectedCollection("");
    setSelectedGroup("");
    reset();
    setActiveTab("config");
    toast.info(t('library.zoteroImportEnhanced.disconnectedFromZotero'));
  };

  const testConnection = async (data: ConfigFormData) => {
    setIsTesting(true);

    try {
      const config: ZoteroConfig = {
        apiKey: data.apiKey,
        userId: data.userId || undefined,
        groupId: data.groupId || undefined,
      };

      zoteroService.setConfig(config);
      const result = await zoteroService.testConnection();

      if (result.success) {
        setIsConnected(true);

        // Get user info and collections
        const userInfo = await zoteroService.getUserInfo();
        if (!userInfo.error) {
          setUserInfo(userInfo);
        }

        loadCollectionsAndGroups();

        setActiveTab("import");
        toast.success(t('library.zoteroImportEnhanced.zoteroConnectionSuccessful'));
      } else {
        toast.error(t('library.zoteroImportEnhanced.failedToConnectToZotero'));
      }
    } catch (error) {
      toast.error(t('library.zoteroImportEnhanced.connectionTestFailed'));
      console.error("Zotero connection test error:", error);
    } finally {
      setIsTesting(false);
    }
  };

  const startImport = async () => {
    if (!isConnected) {
      toast.error(t('library.zoteroImportEnhanced.pleaseConnectToZoteroFirst'));
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

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
          toast.success(t('library.zoteroImportEnhanced.successfullyImportedNewItemsFromZotero', { count: result.itemsAdded }));
        }
        if (result.itemsUpdated > 0) {
          toast.success(t('library.zoteroImportEnhanced.updatedExistingItemsFromZotero', { count: result.itemsUpdated }));
        }
        if (result.itemsSkipped > 0) {
          toast.info(t('library.zoteroImportEnhanced.skippedItemsAlreadyUpToDate', { count: result.itemsSkipped }));
        }

        setActiveTab("result");
      } else {
        toast.error(t('library.zoteroImportEnhanced.importFailed'));
      }
    } catch (error) {
      toast.error(t('library.zoteroImportEnhanced.importFailed'));
      console.error("Zotero import error:", error);
    } finally {
      setIsImporting(false);
    }
  };

  const getConnectionStatus = () => {
    if (isConnected) {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">{t('library.zoteroImportEnhanced.connectedToZotero')}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              className="h-8 px-2"
            >
              <LogOut className="h-3 w-3 mr-1" />
              {t('library.zoteroImportEnhanced.disconnect')}
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <XCircle className="h-4 w-4" />
        <span className="text-sm">{t('library.zoteroImportEnhanced.notConnected')}</span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            {t('library.zoteroImportEnhanced.importFromZotero')}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="config">
              <Settings className="h-4 w-4 mr-2" />
              {t('library.zoteroImportEnhanced.configuration')}
            </TabsTrigger>
            <TabsTrigger value="import" disabled={!isConnected}>
              <Download className="h-4 w-4 mr-2" />
              {t('library.zoteroImportEnhanced.import')}
            </TabsTrigger>
            <TabsTrigger value="result" disabled={!importResult}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {t('library.zoteroImportEnhanced.results')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('library.zoteroImportEnhanced.zoteroApiConfiguration')}</CardTitle>
                <CardDescription>
                  {t('library.zoteroImportEnhanced.connectToZoteroLibrary')}
                </CardDescription>
                {getConnectionStatus()}
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(testConnection)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">{t('library.zoteroImportEnhanced.apiKey')}</Label>
                    <Input
                      id="apiKey"
                      {...register("apiKey")}
                      placeholder={t('library.zoteroImportEnhanced.enterApiKey')}
                      type="password"
                      className={errors.apiKey ? "border-red-500" : ""}
                    />
                    {errors.apiKey && (
                      <p className="text-sm text-red-500">{errors.apiKey.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t('library.zoteroImportEnhanced.getApiKeyFrom')}
                      <a
                        href="https://www.zotero.org/settings/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        {t('library.zoteroImportEnhanced.zoteroSettings')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="userId">{t('library.zoteroImportEnhanced.userId')}</Label>
                      <Input
                        id="userId"
                        {...register("userId")}
                        placeholder="Your Zotero user ID (optional)"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('library.zoteroImportEnhanced.leaveEmptyToUseCurrentUser')}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="groupId">{t('library.zoteroImportEnhanced.groupId')}</Label>
                      <Input
                        id="groupId"
                        {...register("groupId")}
                        placeholder={t('library.zoteroImportEnhanced.groupIdPlaceholder')}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('library.zoteroImportEnhanced.importFromSpecificGroup')}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isTesting || !watchedValues.apiKey}
                    className="w-full"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('library.zoteroImportEnhanced.testingConnection')}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {t('library.zoteroImportEnhanced.testConnection')}
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{t('library.zoteroImportEnhanced.privacyNotice')}:</strong> {t('library.zoteroImportEnhanced.privacyNoticeDescription')}
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('library.zoteroImportEnhanced.importLiterature')}</CardTitle>
                <CardDescription>
                  {t('library.zoteroImportEnhanced.importZoteroLibraryItems')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{t('library.zoteroImportEnhanced.readyToImport')}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('library.zoteroImportEnhanced.thisWillSyncZoteroLibraryWithDeepResearch')}
                    </p>
                    {userInfo && (
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {userInfo.username || userInfo.displayName || `User ${userInfo.userID}`}
                        </div>
                        {collections.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Folder className="h-3 w-3" />
                            {collections.length} collections
                          </div>
                        )}
                        {groups.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {groups.length} groups
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="text-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {t('library.zoteroImportEnhanced.connected')}
                  </Badge>
                </div>

                {/* Collection Selection */}
                {collections.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t('library.zoteroImportEnhanced.selectCollection')}</Label>
                    <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('library.zoteroImportEnhanced.importFromAllCollections')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">{t('library.zoteroImportEnhanced.allCollections')}</SelectItem>
                        <Separator />
                        {collections.map((collection) => (
                          <SelectItem key={collection.key} value={collection.key}>
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <Folder className="h-3 w-3" />
                                {collection.name}
                              </div>
                              {collection.itemsCount && (
                                <Badge variant="secondary" className="text-xs">
                                  {collection.itemsCount}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t('library.zoteroImportEnhanced.chooseSpecificCollectionToImportOnlyThoseItems')}
                    </p>
                  </div>
                )}

                {/* Group Selection */}
                {groups.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t('library.zoteroImportEnhanced.availableGroups')}</Label>
                    <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                      {groups.map((group) => (
                        <div key={group.id} className="flex items-center justify-between p-2 bg-muted rounded">
                          <div className="flex items-center gap-2">
                            <Users className="h-3 w-3" />
                            <span className="text-sm">{group.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {group.type}
                            </Badge>
                            {selectedGroup === group.id && (
                              <Badge variant="default" className="text-xs">
                                {t('library.zoteroImportEnhanced.selected')}
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant={selectedGroup === group.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setValue("groupId", group.id);
                              setSelectedGroup(group.id);
                              toast.info(`Selected group: ${group.name}`);
                            }}
                          >
                            {selectedGroup === group.id ? t('library.zoteroImportEnhanced.selected') : t('library.zoteroImportEnhanced.select')}
                          </Button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('library.zoteroImportEnhanced.selectGroupToImportFromThatGroupsLibrary')}
                    </p>
                  </div>
                )}

                {isLoadingCollections && (
                  <div className="flex items-center justify-center p-4 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('library.zoteroImportEnhanced.loadingCollectionsAndGroups')}
                  </div>
                )}

                {/* Debug info */}
                {!isLoadingCollections && collections.length === 0 && groups.length === 0 && isConnected && (
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      {t('library.zoteroImportEnhanced.noCollectionsOrGroupsFound')}
                    </p>
                  </div>
                )}

                {isImporting && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{t('library.zoteroImportEnhanced.importingItems')}</span>
                      <span>{importProgress}%</span>
                    </div>
                    <Progress value={importProgress} className="w-full" />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={startImport}
                    disabled={isImporting || !isConnected}
                    className="flex-1"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('library.zoteroImportEnhanced.importing')}
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        {t('library.zoteroImportEnhanced.startImport')}
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleClose}>
                    {t('library.zoteroImportEnhanced.cancel')}
                  </Button>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{t('library.zoteroImportEnhanced.importProcess')}:</strong> {t('library.zoteroImportEnhanced.importProcessDescription')}
                    {selectedCollection && selectedCollection !== "__all__" && (
                      <div className="mt-2 text-sm">
                        <strong>Selected Collection:</strong> {collections.find(c => c.key === selectedCollection)?.name}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="result" className="space-y-4">
            {importResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {importResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    {t('library.zoteroImportEnhanced.importResults')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {importResult.itemsAdded}
                      </div>
                      <div className="text-sm text-muted-foreground">{t('library.zoteroImportEnhanced.itemsAdded')}</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {importResult.itemsUpdated}
                      </div>
                      <div className="text-sm text-muted-foreground">{t('library.zoteroImportEnhanced.itemsUpdated')}</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-600">
                        {importResult.itemsSkipped}
                      </div>
                      <div className="text-sm text-muted-foreground">{t('library.zoteroImportEnhanced.itemsSkipped')}</div>
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>{t('library.zoteroImportEnhanced.errorsEncountered')}:</strong>
                        <ul className="mt-2 space-y-1">
                          {importResult.errors.map((error, index) => (
                            <li key={index} className="text-sm">• {error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={handleClose} className="flex-1">
                      {t('library.zoteroImportEnhanced.close')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab("import")}
                      disabled={!isConnected}
                    >
                      {t('library.zoteroImportEnhanced.importAgain')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}