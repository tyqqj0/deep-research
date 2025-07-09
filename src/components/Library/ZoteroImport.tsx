"use client";

import { useState } from "react";
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
  ExternalLink
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
import { toast } from "sonner";
import { zoteroService } from "@/libs/zotero";
import { useLibraryStore } from "@/store/libraryStore";
import type { ZoteroConfig, ZoteroSyncResult } from "@/libs/zotero/types";

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
  const [activeTab, setActiveTab] = useState("config");
  const [isConnected, setIsConnected] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ZoteroSyncResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  
  const { libraryItems, addLibraryItem, updateLibraryItem } = useLibraryStore();

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

  const handleClose = () => {
    reset();
    setActiveTab("config");
    setIsConnected(false);
    setImportResult(null);
    setImportProgress(0);
    onClose();
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
      const success = await zoteroService.testConnection();
      
      if (success) {
        setIsConnected(true);
        setActiveTab("import");
        toast.success("Zotero connection successful!");
      } else {
        toast.error("Failed to connect to Zotero. Please check your API key.");
      }
    } catch (error) {
      toast.error("Connection test failed. Please check your configuration.");
      console.error("Zotero connection test error:", error);
    } finally {
      setIsTesting(false);
    }
  };

  const startImport = async () => {
    if (!isConnected) {
      toast.error("Please connect to Zotero first");
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    
    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      const result = await zoteroService.syncItems(libraryItems);
      
      clearInterval(progressInterval);
      setImportProgress(100);
      setImportResult(result);

      if (result.success) {
        // Process the sync result
        if (result.itemsAdded > 0) {
          toast.success(`Successfully imported ${result.itemsAdded} new items from Zotero!`);
        }
        if (result.itemsUpdated > 0) {
          toast.success(`Updated ${result.itemsUpdated} existing items from Zotero!`);
        }
        if (result.itemsSkipped > 0) {
          toast.info(`Skipped ${result.itemsSkipped} items (already up to date)`);
        }
        
        setActiveTab("result");
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

  const getConnectionStatus = () => {
    if (isConnected) {
      return (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm">Connected to Zotero</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <XCircle className="h-4 w-4" />
        <span className="text-sm">Not connected</span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Import from Zotero
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="config">
              <Settings className="h-4 w-4 mr-2" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="import" disabled={!isConnected}>
              <Download className="h-4 w-4 mr-2" />
              Import
            </TabsTrigger>
            <TabsTrigger value="result" disabled={!importResult}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Zotero API Configuration</CardTitle>
                <CardDescription>
                  Connect to your Zotero library to import your literature collection.
                </CardDescription>
                {getConnectionStatus()}
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(testConnection)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">API Key *</Label>
                    <Input
                      id="apiKey"
                      {...register("apiKey")}
                      placeholder="Enter your Zotero API key"
                      type="password"
                      className={errors.apiKey ? "border-red-500" : ""}
                    />
                    {errors.apiKey && (
                      <p className="text-sm text-red-500">{errors.apiKey.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Get your API key from{" "}
                      <a 
                        href="https://www.zotero.org/settings/keys" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        Zotero Settings
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="userId">User ID</Label>
                      <Input
                        id="userId"
                        {...register("userId")}
                        placeholder="Your Zotero user ID (optional)"
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave empty to use current user
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="groupId">Group ID</Label>
                      <Input
                        id="groupId"
                        {...register("groupId")}
                        placeholder="Group ID (optional)"
                      />
                      <p className="text-xs text-muted-foreground">
                        Import from a specific group
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
                        Testing Connection...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Test Connection
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Privacy Notice:</strong> Your API key is stored locally and never sent to our servers. 
                All communication is direct between your browser and Zotero's API.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Import Literature</CardTitle>
                <CardDescription>
                  Import your Zotero library items into Deep Research.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">Ready to import</p>
                    <p className="text-sm text-muted-foreground">
                      This will sync your Zotero library with Deep Research
                    </p>
                  </div>
                  <Badge variant="outline" className="text-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                </div>

                {isImporting && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Importing items...</span>
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
                        Importing...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Start Import
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Import Process:</strong> We'll check for duplicates based on title matching. 
                    Existing items will be updated if they have newer modification dates in Zotero.
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

                  <div className="flex gap-2">
                    <Button onClick={handleClose} className="flex-1">
                      Close
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setActiveTab("import")}
                      disabled={!isConnected}
                    >
                      Import Again
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