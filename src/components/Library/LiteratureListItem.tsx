"use client";

import { useState } from "react";
import { LibraryItem } from "@/libs/db";
import { SOURCE_METADATA } from "@/libs/db/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ParsingStatusIndicator } from "./ParsingStatusIndicator";
import { PdfUploadDialog } from "./PdfUploadDialog";
import {
  MoreHorizontal,
  Edit2,
  Trash2,
  Eye,
  Plus,
  ExternalLink,
  Calendar,
  User,
  BookOpen,
  FileText
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface LiteratureListItemProps {
  item: LibraryItem;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSelectForTree: () => void;
  onItemClick?: () => void;
  viewMode: 'list' | 'grid';
}

export function LiteratureListItem({
  item,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onSelectForTree,
  onItemClick,
  viewMode
}: LiteratureListItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAbstract, setShowAbstract] = useState(false);
  const [showPdfUpload, setShowPdfUpload] = useState(false);

  const sourceMetadata = SOURCE_METADATA[item.source || 'manual'];

  const handleDelete = () => {
    setShowDeleteDialog(false);
    onDelete();
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString();
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <>
      <Card className={`transition-all duration-200 hover:shadow-md ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelect}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <CardTitle 
                  className="text-base font-semibold leading-tight cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={onItemClick}
                >
                  {item.title}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>
                      {viewMode === 'grid' && item.authors.length > 1
                        ? `${item.authors[0]}...`
                        : item.authors.join(', ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{item.year}</span>
                  </div>
                </div>
                {/* Parsing Status */}
                {item.parsingStatus && (
                  <div className="mt-2">
                    <ParsingStatusIndicator 
                      status={item.parsingStatus}
                      onUploadPdf={() => setShowPdfUpload(true)}
                      showUploadButton={item.parsingStatus === 'AWAITING_MANUAL_UPLOAD'}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Source Badge */}
              <Badge
                variant="outline"
                className={`text-xs ${sourceMetadata?.color || 'bg-gray-100 text-gray-800'} px-2`}
                title={sourceMetadata?.name}
              >
                {sourceMetadata?.icon} {viewMode === 'list' && sourceMetadata?.name}
              </Badge>

              {/* Actions Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onSelectForTree}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add to Tree
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Publication Info */}
            {item.publication && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <BookOpen className="h-3 w-3" />
                <span>{item.publication}</span>
              </div>
            )}

            {/* Abstract */}
            {item.abstract && (
              <Collapsible open={showAbstract} onOpenChange={setShowAbstract}>
                <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium hover:underline">
                  <FileText className="h-3 w-3" />
                  Abstract
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                    {item.abstract}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Summary */}
            {item.summary && (
              <div className="text-sm text-muted-foreground">
                <strong>Summary:</strong> {truncateText(item.summary, 150)}
              </div>
            )}

            {/* Footer Info */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Added: {formatDate(item.createdAt)}</span>
                {item.updatedAt && item.updatedAt.getTime() !== item.createdAt.getTime() && (
                  <span>• Updated: {formatDate(item.updatedAt)}</span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {item.zoteroKey && (
                  <Badge variant="outline" className="text-xs">
                    Zotero
                  </Badge>
                )}

                {/* Quick Actions */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={onEdit}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={onSelectForTree}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{item.title}" from your library. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PDF Upload Dialog */}
      {showPdfUpload && (
        <PdfUploadDialog
          open={showPdfUpload}
          onClose={() => setShowPdfUpload(false)}
          itemId={item.id}
          onUploadSuccess={() => {
            setShowPdfUpload(false);
          }}
        />
      )}
    </>
  );
}