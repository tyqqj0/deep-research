"use client";

import { LibraryItem } from "@/libs/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ParsingStatusIndicator } from "./ParsingStatusIndicator";
import { PdfUploadDialog } from "./PdfUploadDialog";
import { 
  BookOpen, 
  Users, 
  Calendar, 
  ExternalLink, 
  ArrowRight, 
  ArrowLeft,
  FileText,
  Upload
} from "lucide-react";
import { useState } from "react";
import { useCitations, useIsInLibrary } from "@/hooks/useCitations";

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
}

function CitationList({ title, icon, items, onNavigateToItem, emptyMessage }: CitationListProps) {
  const [showPdfUpload, setShowPdfUpload] = useState(false);
  const [uploadItemId, setUploadItemId] = useState<string | null>(null);

  const handleUploadPdf = (itemId: string) => {
    setUploadItemId(itemId);
    setShowPdfUpload(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            {icon}
            {title}
            <Badge variant="outline" className="ml-auto">
              {items.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {items.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{emptyMessage}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((citedItem) => (
                  <CitationItem
                    key={citedItem.id}
                    item={citedItem}
                    onNavigateToItem={onNavigateToItem}
                    onUploadPdf={() => handleUploadPdf(citedItem.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* PDF Upload Dialog */}
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

interface CitationItemProps {
  item: LibraryItem;
  onNavigateToItem: (itemId: string) => void;
  onUploadPdf: () => void;
}

function CitationItem({ item, onNavigateToItem, onUploadPdf }: CitationItemProps) {
  const isInLibrary = useIsInLibrary(item.id);

  return (
    <div className="border rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <div className="space-y-2">
        {/* Title and Status */}
        <div className="flex items-start justify-between gap-2">
          <h4 
            className={`font-medium text-sm leading-tight ${
              isInLibrary 
                ? 'text-blue-600 cursor-pointer hover:underline' 
                : 'text-gray-900 dark:text-gray-100'
            }`}
            onClick={() => isInLibrary && onNavigateToItem(item.id)}
          >
            {item.title}
          </h4>
          {isInLibrary ? (
            <Badge variant="default" className="text-xs bg-green-100 text-green-800">
              In Library
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              External
            </Badge>
          )}
        </div>

        {/* Authors and Year */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{item.authors.slice(0, 2).join(', ')}{item.authors.length > 2 ? '...' : ''}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{item.year}</span>
          </div>
        </div>

        {/* Publication */}
        {item.publication && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <BookOpen className="h-3 w-3" />
            <span className="truncate">{item.publication}</span>
          </div>
        )}

        {/* Status and Actions for Library Items */}
        {isInLibrary && (
          <div className="flex items-center justify-between">
            <ParsingStatusIndicator 
              status={item.parsingStatus || 'IDLE'}
              onUploadPdf={onUploadPdf}
              showUploadButton={item.parsingStatus === 'AWAITING_MANUAL_UPLOAD'}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateToItem(item.id)}
              className="h-6 px-2 text-xs"
            >
              View Details
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CitationManager({ item, onNavigateToItem }: CitationManagerProps) {
  const [showPdfUpload, setShowPdfUpload] = useState(false);
  const { references, citedBy, isLoading } = useCitations(item.id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 bg-gray-200 rounded animate-pulse" />
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Item Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Processing Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-sm mb-2">{item.title}</h4>
              <ParsingStatusIndicator 
                status={item.parsingStatus || 'IDLE'}
                onUploadPdf={() => setShowPdfUpload(true)}
                showUploadButton={item.parsingStatus === 'AWAITING_MANUAL_UPLOAD'}
                className="justify-start"
              />
            </div>
            
            {/* Basic metadata */}
            <div className="grid grid-cols-2 gap-4 pt-3 border-t text-sm">
              <div>
                <span className="text-muted-foreground">Authors:</span>
                <p className="font-medium">{item.authors.join(', ')}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Year:</span>
                <p className="font-medium">{item.year}</p>
              </div>
              {item.publication && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Publication:</span>
                  <p className="font-medium">{item.publication}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Citation Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CitationList
          title="References"
          icon={<ArrowRight className="h-5 w-5" />}
          items={references}
          onNavigateToItem={onNavigateToItem}
          emptyMessage="No references found for this item"
        />
        
        <CitationList
          title="Cited By"
          icon={<ArrowLeft className="h-5 w-5" />}
          items={citedBy}
          onNavigateToItem={onNavigateToItem}
          emptyMessage="This item is not cited by any other items"
        />
      </div>

      {/* PDF Upload Dialog for Main Item */}
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