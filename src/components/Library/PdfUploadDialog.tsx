"use client";

import { useState, useRef } from "react";
import { Upload, File, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { libraryWorkflowService } from "@/libs/library/LibraryWorkflowService";
import { useLibraryStore } from "@/store/libraryStore";
import { toast } from "sonner";

interface PdfUploadDialogProps {
  open: boolean;
  onClose: () => void;
  itemId?: string; // If provided, upload for specific item; otherwise bulk upload
  onUploadSuccess?: () => void;
}

export function PdfUploadDialog({
  open,
  onClose,
  itemId,
  onUploadSuccess
}: PdfUploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { initialize } = useLibraryStore();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');

    if (pdfFiles.length !== files.length) {
      setError("Only PDF files are allowed");
      return;
    }

    if (itemId && pdfFiles.length > 1) {
      setError("Only one PDF file can be uploaded for a specific item");
      return;
    }

    setSelectedFiles(pdfFiles);
    setError(null);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const files = Array.from(event.dataTransfer.files);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');

    if (pdfFiles.length !== files.length) {
      setError("Only PDF files are allowed");
      return;
    }

    if (itemId && pdfFiles.length > 1) {
      setError("Only one PDF file can be uploaded for a specific item");
      return;
    }

    setSelectedFiles(pdfFiles);
    setError(null);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select at least one PDF file");
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      if (itemId) {
        // Upload for specific item
        await libraryWorkflowService.uploadPdfForExistingItem(itemId, selectedFiles[0]);
        toast.success("PDF uploaded and saved to library! Automatic processing will begin shortly.");
      } else {
        // Bulk upload - create new items
        const totalFiles = selectedFiles.length;
        for (let i = 0; i < totalFiles; i++) {
          const file = selectedFiles[i];
          await libraryWorkflowService.createFromPdfUpload(file);
          setUploadProgress(((i + 1) / totalFiles) * 100);
        }
        toast.success(`${totalFiles} PDF${totalFiles > 1 ? 's' : ''} uploaded and saved to library! Automatic processing will begin shortly.`);
      }

      // Refresh the library store
      await initialize();

      // Call success callback
      onUploadSuccess?.();

      // Close dialog and reset state
      onClose();
      setSelectedFiles([]);
      setUploadProgress(0);

    } catch (error) {
      console.error('Error uploading PDF:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload PDF');
      toast.error("Failed to upload PDF");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      onClose();
      setSelectedFiles([]);
      setError(null);
      setUploadProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {itemId ? 'Upload PDF' : 'Import PDF Files'}
          </DialogTitle>
          <DialogDescription>
            {itemId
              ? 'Upload a PDF file for this literature item'
              : 'Select one or more PDF files to import as new literature items'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload Area */}
          <div
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p className="font-medium">Click to select PDF files</p>
              <p>or drag and drop them here</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple={!itemId}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Selected Files:</h4>
              <div className="space-y-1">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <div className="flex items-center gap-2">
                      <File className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </div>
                    {!isUploading && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || isUploading}
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}