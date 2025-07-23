"use client";

import { useState, useRef } from "react";
import { Upload, File, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiClient } from "@/libs/api"; // 🚀 使用新的API Client
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
        // 🚀 为特定文献上传PDF - 暂时不支持，因为后端还没有该功能
        setError("Uploading PDF for existing items is not yet supported. Please create a new literature item instead.");
        toast.error("Feature not yet available");
        return;
      } else {
        // 🚀 批量上传 - 新的OSS直传流程
        console.log(`📤 Starting OSS direct upload for ${selectedFiles.length} PDF files...`);
        const totalFiles = selectedFiles.length;
        const totalSteps = totalFiles * 3; // 每个文件3个步骤：请求URL + 上传OSS + 提交后端
        let completedSteps = 0;

        for (let i = 0; i < totalFiles; i++) {
          const file = selectedFiles[i];
          const fileName = file.name.replace(/\.pdf$/i, ''); // 移除.pdf后缀作为临时标题

          try {
            console.log(`🔄 [${i + 1}/${totalFiles}] Processing: ${file.name}`);

            // 【步骤1】请求上传许可
            console.log(`📤 [${i + 1}/${totalFiles}] Step 1: Requesting upload permission...`);
            const { uploadUrl, publicUrl } = await apiClient.requestUploadUrl(file.name, file.type);
            
            completedSteps++;
            setUploadProgress((completedSteps / totalSteps) * 100);

            // 【步骤2】直传到OSS
            console.log(`☁️ [${i + 1}/${totalFiles}] Step 2: Uploading to OSS...`);
            await apiClient.uploadFileToOSS(uploadUrl, file);
            
            completedSteps++;
            setUploadProgress((completedSteps / totalSteps) * 100);

            // 【步骤3】提交到后端进行异步处理
            console.log(`📚 [${i + 1}/${totalFiles}] Step 3: Submitting for processing...`);
            
            const taskId = await apiClient.submitLiterature({
              source: {
                title: fileName, // 使用文件名作为临时标题
                authors: ['Unknown Author'], // 临时作者，后端AI会提取真实信息
                url: publicUrl, // OSS上的PDF文件URL
                year: new Date().getFullYear() // 当前年份作为临时年份
              }
            });

            console.log(`✅ [${i + 1}/${totalFiles}] Task submitted successfully, task_id: ${taskId}`);
            
            completedSteps++;
            setUploadProgress((completedSteps / totalSteps) * 100);

          } catch (fileError) {
            console.error(`❌ [${i + 1}/${totalFiles}] Failed to process ${file.name}:`, fileError);
            
            // 单个文件失败不中断整个流程
            toast.error(`Failed to process ${file.name}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
            
            // 跳过剩余步骤，继续下一个文件
            completedSteps += (3 - (completedSteps % 3)); // 补齐当前文件的剩余步骤
            setUploadProgress((completedSteps / totalSteps) * 100);
          }
        }

        const successCount = Math.floor(completedSteps / 3);
        const failedCount = totalFiles - successCount;

        if (successCount > 0) {
          toast.success(`${successCount} PDF${successCount > 1 ? 's' : ''} uploaded successfully! Processing will begin shortly.`);
        }
        
        if (failedCount > 0) {
          toast.warning(`${failedCount} file${failedCount > 1 ? 's' : ''} failed to upload.`);
        }
      }

      // 🔄 刷新文献库状态
      console.log('🔄 Refreshing library state...');
      await initialize();

      // Call success callback
      onUploadSuccess?.();

      // Close dialog and reset state
      onClose();
      setSelectedFiles([]);
      setUploadProgress(0);

    } catch (error) {
      console.error('❌ Error during upload process:', error);
      setError(error instanceof Error ? error.message : 'Upload process failed');
      toast.error("Upload process failed");
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