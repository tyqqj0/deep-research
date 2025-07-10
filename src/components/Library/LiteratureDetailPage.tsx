"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LibraryItem } from "@/libs/db";
import { libraryService } from "@/libs/db/LibraryService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditLiteratureForm } from "./EditLiteratureForm";
import { CitationManager } from "./CitationManager";
import { 
  ArrowLeft, 
  Edit3, 
  BookOpen, 
  Users, 
  Calendar, 
  ExternalLink,
  FileText,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { SOURCE_METADATA } from "@/libs/db/constants";

interface LiteratureDetailPageProps {
  itemId: string;
}

export function LiteratureDetailPage({ itemId }: LiteratureDetailPageProps) {
  const router = useRouter();
  const [item, setItem] = useState<LibraryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);

  useEffect(() => {
    loadItem();
  }, [itemId]);

  const loadItem = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const loadedItem = await libraryService.getLibraryItemById(itemId);
      if (!loadedItem) {
        setError('Literature item not found');
        return;
      }
      
      setItem(loadedItem);
    } catch (err) {
      console.error('Error loading item:', err);
      setError('Failed to load literature item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigateToItem = (targetItemId: string) => {
    if (targetItemId === itemId) {
      // Already viewing this item
      return;
    }
    
    // Navigate to the target item
    router.push(`/library/${targetItemId}`);
  };

  const handleBack = () => {
    router.back();
  };

  const handleEditSuccess = () => {
    setShowEditForm(false);
    loadItem(); // Reload the item data
    toast.success('Literature item updated successfully');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            onClick={handleBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">
                {error || 'Literature item not found'}
              </h3>
              <p className="text-muted-foreground mb-4">
                The literature item you're looking for doesn't exist or has been deleted.
              </p>
              <Button onClick={handleBack}>
                Return to Library
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sourceMetadata = SOURCE_METADATA[item.source || 'manual'];

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={handleBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`${sourceMetadata?.color || 'bg-gray-100 text-gray-800'}`}
            >
              {sourceMetadata?.icon} {sourceMetadata?.name}
            </Badge>
            
            {item.zoteroKey && (
              <Badge variant="outline" className="bg-orange-100 text-orange-800">
                Zotero
              </Badge>
            )}
          </div>
        </div>

        <Button
          onClick={() => setShowEditForm(true)}
          className="flex items-center gap-2"
        >
          <Edit3 className="h-4 w-4" />
          Edit
        </Button>
      </div>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {item.title}
        </h1>
        
        <div className="flex items-center gap-4 text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{item.authors.join(', ')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{item.year}</span>
          </div>
          {item.publication && (
            <div className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              <span>{item.publication}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Metadata */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Literature Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Abstract */}
              {item.abstract && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Abstract</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.abstract}
                  </p>
                </div>
              )}

              {/* Summary */}
              {item.summary && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Summary</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.summary}
                  </p>
                </div>
              )}

              {/* URLs and DOI */}
              <div className="space-y-2">
                {item.doi && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">DOI:</span>
                    <a
                      href={`https://doi.org/${item.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {item.doi}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                
                {item.url && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">URL:</span>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      View Source
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t text-sm">
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <p className="font-medium">{new Date(item.createdAt).toLocaleDateString()}</p>
                </div>
                {item.updatedAt && (
                  <div>
                    <span className="text-muted-foreground">Updated:</span>
                    <p className="font-medium">{new Date(item.updatedAt).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Citation Management */}
        <div className="space-y-6">
          <CitationManager 
            item={item} 
            onNavigateToItem={handleNavigateToItem}
          />
        </div>
      </div>

      {/* Edit Form Modal */}
      {showEditForm && (
        <EditLiteratureForm
          open={showEditForm}
          onClose={() => setShowEditForm(false)}
          item={item}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}