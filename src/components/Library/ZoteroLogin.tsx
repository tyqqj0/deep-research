"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Cloud, 
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { zoteroService } from "@/libs/zotero";
import type { ZoteroConfig, ZoteroUserInfo, ZoteroCollection, ZoteroGroup } from "@/libs/zotero/types";

interface ZoteroLoginProps {
  open: boolean;
  onClose: () => void;
  onLoginSuccess?: (userInfo: ZoteroUserInfo, collections: ZoteroCollection[], groups: ZoteroGroup[]) => void;
}

const configSchema = z.object({
  apiKey: z.string().min(1, "API Key is required"),
  userId: z.string().optional(),
  groupId: z.string().optional(),
});

type ConfigFormData = z.infer<typeof configSchema>;

export function ZoteroLogin({ open, onClose, onLoginSuccess }: ZoteroLoginProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [userInfo, setUserInfo] = useState<ZoteroUserInfo | null>(null);
  const [collections, setCollections] = useState<ZoteroCollection[]>([]);
  const [groups, setGroups] = useState<ZoteroGroup[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);

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

  // Load stored config on mount
  useEffect(() => {
    const storedConfig = zoteroService.getStoredConfig();
    if (storedConfig) {
      setValue("apiKey", storedConfig.apiKey);
      setValue("userId", storedConfig.userId || "");
      setValue("groupId", storedConfig.groupId || "");
      
      // Auto-test connection if we have stored config
      testStoredConnection(storedConfig);
    }
  }, [setValue]);

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
        
        const { collections: fetchedCollections, groups: fetchedGroups } = await loadCollectionsAndGroups();
        
        // Notify parent component of successful login
        if (onLoginSuccess) {
          onLoginSuccess(userInfo, fetchedCollections, fetchedGroups);
        }
        
        toast.success("Auto-connected to Zotero!");
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
      
      const collections = collectionsResult.status === 'fulfilled' ? collectionsResult.value : [];
      const groups = groupsResult.status === 'fulfilled' ? groupsResult.value : [];
      
      setCollections(collections);
      setGroups(groups);
      
      return { collections, groups };
    } catch (error) {
      console.error('Failed to load collections/groups:', error);
      return { collections: [], groups: [] };
    } finally {
      setIsLoadingCollections(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const handleDisconnect = () => {
    zoteroService.clearStorage();
    setIsConnected(false);
    setUserInfo(null);
    setCollections([]);
    setGroups([]);
    reset();
    toast.info("Disconnected from Zotero");
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
        
        const { collections: fetchedCollections, groups: fetchedGroups } = await loadCollectionsAndGroups();
        
        // Notify parent component of successful login
        if (onLoginSuccess) {
          onLoginSuccess(userInfo, fetchedCollections, fetchedGroups);
        }
        
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

  const getConnectionStatus = () => {
    if (isConnected) {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Connected to Zotero</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              className="h-8 px-2"
            >
              <LogOut className="h-3 w-3 mr-1" />
              Disconnect
            </Button>
          </div>
          {userInfo && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Connect to Zotero
          </DialogTitle>
        </DialogHeader>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Zotero API Configuration</CardTitle>
            <CardDescription>
              Connect to your Zotero library to access your literature collection.
            </CardDescription>
            {getConnectionStatus()}
          </CardHeader>
          <CardContent>
            {!isConnected ? (
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
                      Connect to Zotero
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                {isLoadingCollections && (
                  <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading collections and groups...
                  </div>
                )}
                <div className="flex gap-2">
                  <Button onClick={handleClose} className="flex-1">
                    Done
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Privacy Notice:</strong> Your API key is stored locally and never sent to our servers. 
            All communication is direct between your browser and Zotero's API.
          </AlertDescription>
        </Alert>
      </DialogContent>
    </Dialog>
  );
}