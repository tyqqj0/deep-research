"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Plus, Save, Trash2, FileText, Link, Eye, ChevronDown, ChevronRight, BookOpen, Edit } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLibraryStore } from "@/store/libraryStore";
import { LITERATURE_SOURCES, SOURCE_METADATA } from "@/libs/db/constants";
import { Checkbox } from "@/components/ui/checkbox";
import { LibraryItem } from "@/libs/db";
import { CitationManager } from "./CitationManager";
import { EditReferenceForm } from "./EditReferenceForm";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface EditLiteratureFormProps {
  open: boolean;
  onClose: () => void;
  item: LibraryItem | null;
  onSuccess?: () => void;
}

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  authors: z.array(z.string()).min(1, "At least one author is required"),
  year: z.number().min(1000).max(new Date().getFullYear() + 10),
  source: z.enum(['manual', 'search', 'import', 'knowledge', 'zotero'] as const).optional(),
  publication: z.string().optional(),
  abstract: z.string().optional(),
  summary: z.string().optional(),
  zoteroKey: z.string().optional(),
  doi: z.string().optional(),
  url: z.string().url().optional().or(z.literal("")),
});

type FormData = z.infer<typeof formSchema>;

interface ReferenceItemProps {
  reference: any;
  index: number;
  onEdit: (index: number, reference: any) => void;
}

// 优化的authors字段格式化函数
const formatAuthors = (authors: any): string => {
  if (!authors) return '';

  // 如果已经是字符串，直接返回
  if (typeof authors === 'string') {
    return authors.trim();
  }

  // 如果是数组，处理数组中的每个元素
  if (Array.isArray(authors)) {
    return authors
      .map((author: any) => {
        if (typeof author === 'string') {
          return author.trim();
        } else if (typeof author === 'object' && author !== null) {
          // 处理对象形式的作者信息，尝试多个可能的字段
          return author.name || author.raw || author.fullName || author.firstName + ' ' + author.lastName || String(author);
        }
        return String(author);
      })
      .filter(author => author && author.length > 0)
      .join(', ');
  }

  // 如果是对象，尝试提取作者信息
  if (typeof authors === 'object' && authors !== null) {
    return authors.name || authors.raw || authors.fullName || String(authors);
  }

  // 兜底：转换为字符串
  return String(authors);
};

const ReferenceItem = ({ reference, index, onEdit }: ReferenceItemProps) => {
  if (typeof reference === 'string') {
    return (
      <div className="text-sm p-2 bg-white dark:bg-gray-700 rounded border group relative">
        <div className="pr-8">
          {reference}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onEdit(index, reference)}
        >
          <Edit className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // A more structured display for reference objects
  const { title, authors, year, journal, doi } = reference;

  return (
    <div className="text-sm p-2 bg-white dark:bg-gray-700 rounded border group relative">
      <div className="pr-8">
        <p className="font-semibold">{index + 1}. {title}</p>
        {authors && (
          <p className="text-xs text-gray-600 dark:text-gray-300">
            Authors: {formatAuthors(authors)}
          </p>
        )}
        {year && <p className="text-xs text-gray-600 dark:text-gray-300">Year: {year}</p>}
        {journal && <p className="text-xs text-gray-600 dark:text-gray-300">Journal: {journal}</p>}
        {doi && <p className="text-xs text-gray-600 dark:text-gray-300">DOI: {doi}</p>}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onEdit(index, reference)}
      >
        <Edit className="h-3 w-3" />
      </Button>
    </div>
  );
};


export function EditLiteratureForm({ open, onClose, item, onSuccess }: EditLiteratureFormProps) {
  const [authorInput, setAuthorInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("metadata");
  const [isTextExpanded, setIsTextExpanded] = useState(true);

  // 引文编辑状态
  const [editingReference, setEditingReference] = useState<{ index: number; reference: any } | null>(null);
  const [isAddingReference, setIsAddingReference] = useState(false);

  const { updateLibraryItem, updateExtractedReference, addExtractedReference, autoExtractMetadata, setAutoExtractMetadata } = useLibraryStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      authors: [],
      year: new Date().getFullYear(),
      source: "manual",
      publication: "",
      abstract: "",
      summary: "",
      zoteroKey: "",
    },
  });

  const watchedAuthors = watch("authors");
  const watchedSource = watch("source");

  // Reset form when item changes
  useEffect(() => {
    if (item && open) {
      reset({
        title: item.title,
        authors: item.authors,
        year: item.year,
        source: item.source || "manual",
        publication: item.publication || "",
        abstract: item.abstract || "",
        summary: item.summary || "",
        zoteroKey: item.zoteroKey || "",
        doi: item.doi || "",
        url: item.url || "",
      });
    }
  }, [item, open, reset]);

  const handleClose = () => {
    reset();
    setAuthorInput("");
    setActiveTab("metadata");
    onClose();
  };

  const handleNavigateToItem = (targetItemId: string) => {
    // Close current dialog and open the target item's edit dialog
    // This will be handled by the parent component
    onClose();
    // You might want to emit an event or use a callback for navigation
    // For now, we'll just close this dialog
  };

  // 处理引文编辑
  const handleEditReference = (index: number, reference: any) => {
    setEditingReference({ index, reference });
  };

  const handleSaveReference = async (referenceIndex: number, updatedReference: any) => {
    if (!item) return;

    try {
      await updateExtractedReference(item.id, referenceIndex, updatedReference);
      setEditingReference(null);

      // 可选：重新运行自动链接
      toast.success("引文已更新，可以重新运行自动链接");
    } catch (error) {
      console.error("Error updating reference:", error);
      throw error;
    }
  };

  const handleCloseEditReference = () => {
    setEditingReference(null);
  };

  // 处理添加新引文
  const handleAddReference = () => {
    setIsAddingReference(true);
  };

  const handleSaveNewReference = async (referenceIndex: number, newReference: any) => {
    if (!item) return;

    try {
      await addExtractedReference(item.id, newReference);
      setIsAddingReference(false);

      toast.success("新引文已添加");
    } catch (error) {
      console.error("Error adding reference:", error);
      throw error;
    }
  };

  const handleCloseAddReference = () => {
    setIsAddingReference(false);
  };

  const addAuthor = () => {
    if (authorInput.trim()) {
      const newAuthors = [...watchedAuthors, authorInput.trim()];
      setValue("authors", newAuthors);
      setAuthorInput("");
    }
  };

  const removeAuthor = (index: number) => {
    const newAuthors = watchedAuthors.filter((_, i) => i !== index);
    setValue("authors", newAuthors);
  };

  const onSubmit = async (data: FormData) => {
    if (!item) return;

    try {
      setIsSubmitting(true);

      await updateLibraryItem(item.id, {
        title: data.title,
        authors: data.authors,
        year: data.year,
        source: data.source,
        publication: data.publication || undefined,
        abstract: data.abstract || undefined,
        summary: data.summary || undefined,
        zoteroKey: data.zoteroKey || undefined,
        doi: data.doi || undefined,
        url: data.url || undefined,
      });

      toast.success("Literature updated successfully!");
      onSuccess?.();
      handleClose();
    } catch (error) {
      toast.error("Failed to update literature. Please try again.");
      console.error("Error updating literature:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuthorKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAuthor();
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {item.title}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="metadata" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Metadata & Details
            </TabsTrigger>
            <TabsTrigger value="citations" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Citation Management
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Parsed Content
            </TabsTrigger>
          </TabsList>

          {/* Metadata Tab */}
          <TabsContent value="metadata" className="flex-1 overflow-y-auto mt-4 max-h-[70vh]">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  {...register("title")}
                  placeholder="Enter literature title"
                  className={errors.title ? "border-red-500" : ""}
                />
                {errors.title && (
                  <p className="text-sm text-red-500">{errors.title.message}</p>
                )}
              </div>

              {/* Authors */}
              <div className="space-y-2">
                <Label>Authors *</Label>
                <div className="flex gap-2">
                  <Input
                    value={authorInput}
                    onChange={(e) => setAuthorInput(e.target.value)}
                    onKeyPress={handleAuthorKeyPress}
                    placeholder="Enter author name"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={addAuthor}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Author Tags */}
                <div className="flex flex-wrap gap-2">
                  {watchedAuthors.map((author, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      {author}
                      <button
                        type="button"
                        onClick={() => removeAuthor(index)}
                        className="ml-1 hover:bg-red-500 hover:text-white rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>

                {errors.authors && (
                  <p className="text-sm text-red-500">{errors.authors.message}</p>
                )}
              </div>

              {/* Year and Source */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="year">Year *</Label>
                  <Input
                    id="year"
                    type="number"
                    {...register("year", { valueAsNumber: true })}
                    placeholder="2024"
                    className={errors.year ? "border-red-500" : ""}
                  />
                  {errors.year && (
                    <p className="text-sm text-red-500">{errors.year.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select
                    value={watchedSource}
                    onValueChange={(value) => setValue("source", value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LITERATURE_SOURCES).map(([key, value]) => (
                        <SelectItem key={key} value={value}>
                          <div className="flex items-center gap-2">
                            <span>{SOURCE_METADATA[value]?.icon}</span>
                            {SOURCE_METADATA[value]?.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Publication */}
              <div className="space-y-2">
                <Label htmlFor="publication">Publication</Label>
                <Input
                  id="publication"
                  {...register("publication")}
                  placeholder="Journal, Conference, etc."
                />
              </div>

              {/* DOI and URL */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="doi">DOI</Label>
                  <Input
                    id="doi"
                    {...register("doi")}
                    placeholder="10.1000/123456"
                    className={errors.doi ? "border-red-500" : ""}
                  />
                  {errors.doi && (
                    <p className="text-sm text-red-500">{errors.doi.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    type="url"
                    {...register("url")}
                    placeholder="https://example.com/paper.pdf"
                    className={errors.url ? "border-red-500" : ""}
                  />
                  {errors.url && (
                    <p className="text-sm text-red-500">{errors.url.message}</p>
                  )}
                </div>
              </div>

              {/* Abstract */}
              <div className="space-y-2">
                <Label htmlFor="abstract">Abstract</Label>
                <Textarea
                  id="abstract"
                  {...register("abstract")}
                  placeholder="Enter abstract"
                  rows={4}
                />
              </div>

              {/* Summary */}
              <div className="space-y-2">
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  id="summary"
                  {...register("summary")}
                  placeholder="Enter your summary or notes"
                  rows={3}
                />
              </div>

              {/* Zotero Key (only show if source is zotero) */}
              {watchedSource === 'zotero' && (
                <div className="space-y-2">
                  <Label htmlFor="zoteroKey">Zotero Key</Label>
                  <Input
                    id="zoteroKey"
                    {...register("zoteroKey")}
                    placeholder="Zotero item key"
                    readOnly
                  />
                </div>
              )}

              {/* Auto-Extract Metadata Setting - TODO: Move to global settings */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="auto-extract"
                    checked={autoExtractMetadata}
                    onCheckedChange={setAutoExtractMetadata}
                  />
                  <div>
                    <Label htmlFor="auto-extract" className="text-sm font-medium cursor-pointer">
                      Auto-Extract Metadata
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Automatically update title, authors, year, and abstract from parsed PDF content
                    </p>
                  </div>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  TODO: This setting will be moved to global settings panel
                </p>
              </div>

              {/* Metadata Display */}
              <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <strong>Created:</strong> {new Date(item.createdAt).toLocaleString()}
                  </div>
                  <div>
                    <strong>Last Modified:</strong> {new Date(item.updatedAt || item.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="mt-2">
                  <strong>ID:</strong> {item.id}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmitting ? (
                    <>
                      <Save className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Citations Tab */}
          <TabsContent value="citations" className="flex-1 overflow-hidden mt-4 max-h-[70vh]">
            <div className="h-full space-y-4">
              {/* 引文管理面板 */}
              <CitationManager
                item={item}
                onNavigateToItem={handleNavigateToItem}
              />
            </div>
          </TabsContent>

          {/* Parsed Content Tab */}
          <TabsContent value="content" className="flex-1 overflow-y-auto mt-4 max-h-[70vh]">
            <div className="h-full space-y-4">
              {item.parsedContent ? (
                <div className="space-y-6">
                  {/* 解析状态和时间 */}
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                      <Eye className="h-4 w-4" />
                      <span className="font-medium">Content Successfully Parsed</span>
                    </div>
                    <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                      Parsed on: {new Date(item.parsedContent.parsedAt || '').toLocaleString()}
                    </p>
                  </div>

                  {/* 提取的文本内容 */}
                  {item.parsedContent.extractedText && (
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <div className="flex justify-between items-center cursor-pointer">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Extracted Text Content
                          </h3>
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="bg-gray-50 dark:bg-gray-800 border rounded-lg p-4 max-h-96 overflow-y-auto mt-2">
                          <pre className="whitespace-pre-wrap text-sm font-mono">
                            {item.parsedContent.extractedText}
                          </pre>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* 提取的元数据 */}
                  {item.parsedContent.extractedMetadata && Object.keys(item.parsedContent.extractedMetadata).length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Extracted Metadata</h3>
                      <div className="bg-gray-50 dark:bg-gray-800 border rounded-lg p-4">1
                        <pre className="text-sm overflow-x-auto">
                          {JSON.stringify(item.parsedContent.extractedMetadata, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* 提取的引用 */}
                  {/* 引文部分 - 始终显示，即使没有引文也可以添加新的 */}
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <div className="flex justify-between items-center cursor-pointer">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <BookOpen className="h-5 w-5" />
                          Extracted References ({item.parsedContent?.extractedReferences?.length || 0})
                        </h3>
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="bg-gray-50 dark:bg-gray-800 border rounded-lg p-4 max-h-64 overflow-y-auto mt-2">
                        {/* 添加新引文按钮 */}
                        <div className="mb-4">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAddReference}
                            className="flex items-center gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            添加新引文
                          </Button>
                        </div>

                        {/* 引文列表 */}
                        <div className="space-y-2">
                          {item.parsedContent?.extractedReferences?.length > 0 ? (
                            item.parsedContent.extractedReferences.map((ref: any, index: number) => (
                              <ReferenceItem
                                key={index}
                                reference={ref}
                                index={index}
                                onEdit={handleEditReference}
                              />
                            ))
                          ) : (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">暂无引文信息</p>
                              <p className="text-xs mt-1">点击上方按钮添加新引文</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* 下载完整结果 */}
                  {item.parsedContent.fullZipUrl && (
                    <div className="pt-4 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => window.open(item.parsedContent?.fullZipUrl, '_blank')}
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Download Full Results (ZIP)
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Eye className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    No Parsed Content Available
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    This document hasn't been processed yet or processing failed.
                  </p>
                  {(item.parsingStatus === 'AWAITING_MANUAL_UPLOAD' || item.parsingStatus === 'FAILED') && (
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      Upload a PDF file to start content extraction.
                    </p>
                  )}
                  {(item.parsingStatus === 'PENDING_MINERU_SUBMISSION' || item.parsingStatus === 'PARSING_IN_MINERU') && (
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      Processing in progress... Content will appear here when ready.
                    </p>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* 引文编辑对话框 */}
      {editingReference && (
        <EditReferenceForm
          open={!!editingReference}
          onClose={handleCloseEditReference}
          reference={editingReference.reference}
          referenceIndex={editingReference.index}
          onSave={handleSaveReference}
        />
      )}

      {/* 添加新引文对话框 */}
      {isAddingReference && (
        <EditReferenceForm
          open={isAddingReference}
          onClose={handleCloseAddReference}
          reference={{}} // 空的引文对象
          referenceIndex={-1} // 表示这是新增
          onSave={handleSaveNewReference}
        />
      )}
    </Dialog>
  );
}