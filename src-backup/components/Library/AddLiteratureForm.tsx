"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLibraryStore } from "@/store/libraryStore";
import { LITERATURE_SOURCES, SOURCE_METADATA } from "@/libs/db/constants";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface AddLiteratureFormProps {
  open: boolean;
  onClose: () => void;
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
  topics: z.array(z.string()).optional(), // 🏷️ 添加topics字段
});

type FormData = z.infer<typeof formSchema>;

export function AddLiteratureForm({ open, onClose }: AddLiteratureFormProps) {
  const { t } = useTranslation();
  const [authorInput, setAuthorInput] = useState("");
  const [topicsInput, setTopicsInput] = useState(""); // 🏷️ topics输入状态
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addLibraryItem, availableTopics, loadAvailableTopics } = useLibraryStore();

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
      doi: "",
      url: "",
      topics: [], // 🏷️ 默认为空数组
    },
  });

  const watchedAuthors = watch("authors");
  const watchedSource = watch("source");
  const watchedTopics = watch("topics"); // 🏷️ 监听topics变化

  const handleClose = () => {
    reset();
    setAuthorInput("");
    setTopicsInput(""); // 🏷️ 重置topics输入
    onClose();
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

  // 🏷️ Topics管理函数
  const addTopic = () => {
    if (topicsInput.trim()) {
      const currentTopics = watchedTopics || [];
      if (!currentTopics.includes(topicsInput.trim())) {
        const newTopics = [...currentTopics, topicsInput.trim()];
        setValue("topics", newTopics);
        setTopicsInput("");
        // 更新可用topics列表
        loadAvailableTopics().catch(console.error);
      }
    }
  };

  const removeTopic = (index: number) => {
    const currentTopics = watchedTopics || [];
    const newTopics = currentTopics.filter((_, i) => i !== index);
    setValue("topics", newTopics);
  };

  const addExistingTopic = (topic: string) => {
    const currentTopics = watchedTopics || [];
    if (!currentTopics.includes(topic)) {
      const newTopics = [...currentTopics, topic];
      setValue("topics", newTopics);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);
      
      const result = await addLibraryItem({
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
        topics: data.topics || undefined, // 🏷️ 包含topics数据
      });

      if (result && result.success) {
        toast.success(t('library.addLiteratureForm.literatureAddedSuccess'));
        handleClose();
      } else if (result && result.duplicate) {
        // Handle duplicate case
        toast.warning(t('library.addLiteratureForm.literatureAlreadyExists', { title: data.title }));
        // Form stays open for user to modify or cancel
      } else {
        toast.error(t('library.addLiteratureForm.literatureAddedError'));
      }
    } catch (error) {
      toast.error(t('library.addLiteratureForm.literatureAddedError'));
      console.error("Error adding literature:", error);
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

  // 🏷️ Topics输入按键处理
  const handleTopicsKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTopic();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('library.addLiteratureForm.addNewLiterature')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('library.addLiteratureForm.title')}</Label>
            <Input
              id="title"
              {...register("title")}
              placeholder={t('library.addLiteratureForm.enterTitle')}
              className={errors.title ? "border-red-500" : ""}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title.message}</p>
            )}
          </div>

          {/* Authors */}
          <div className="space-y-2">
            <Label>{t('library.addLiteratureForm.authors')}</Label>
            <div className="flex gap-2">
              <Input
                value={authorInput}
                onChange={(e) => setAuthorInput(e.target.value)}
                onKeyPress={handleAuthorKeyPress}
                placeholder={t('library.addLiteratureForm.enterAuthorName')}
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
              <Label htmlFor="year">{t('library.addLiteratureForm.year')}</Label>
              <Input
                id="year"
                type="number"
                {...register("year", { valueAsNumber: true })}
                placeholder={t('library.addLiteratureForm.enterYear')}
                className={errors.year ? "border-red-500" : ""}
              />
              {errors.year && (
                <p className="text-sm text-red-500">{errors.year.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('library.addLiteratureForm.source')}</Label>
              <Select
                value={watchedSource}
                onValueChange={(value) => setValue("source", value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('library.addLiteratureForm.selectSource')} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LITERATURE_SOURCES).map(([key, value]) => (
                    <SelectItem key={key} value={value}>
                      <div className="flex items-center gap-2">
                        <span>{t(SOURCE_METADATA[value]?.icon)}</span>
                        {t(SOURCE_METADATA[value]?.name)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Publication */}
          <div className="space-y-2">
            <Label htmlFor="publication">{t('library.addLiteratureForm.publication')}</Label>
            <Input
              id="publication"
              {...register("publication")}
              placeholder={t('library.addLiteratureForm.enterPublication')}
            />
          </div>

          {/* DOI and URL */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="doi">{t('library.addLiteratureForm.doi')}</Label>
              <Input
                id="doi"
                {...register("doi")}
                placeholder={t('library.addLiteratureForm.enterDoi')}
                className={errors.doi ? "border-red-500" : ""}
              />
              {errors.doi && (
                <p className="text-sm text-red-500">{errors.doi.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">{t('library.addLiteratureForm.url')}</Label>
              <Input
                id="url"
                type="url"
                {...register("url")}
                placeholder={t('library.addLiteratureForm.enterUrl')}
                className={errors.url ? "border-red-500" : ""}
              />
              {errors.url && (
                <p className="text-sm text-red-500">{errors.url.message}</p>
              )}
            </div>
          </div>

          {/* 🏷️ Topics */}
          <div className="space-y-2">
            <Label>🏷️ 话题标签</Label>
            <div className="flex gap-2">
              <Input
                value={topicsInput}
                onChange={(e) => setTopicsInput(e.target.value)}
                onKeyPress={handleTopicsKeyPress}
                placeholder="输入话题标签（按Enter添加）"
                className="flex-1"
              />
              <Button 
                type="button" 
                onClick={addTopic}
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Topics Tags */}
            <div className="space-y-2">
              {/* 当前选择的topics */}
              {watchedTopics && watchedTopics.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {watchedTopics.map((topic, index) => (
                    <Badge
                      key={index}
                      variant="default"
                      className="flex items-center gap-1 pr-1"
                    >
                      {topic}
                      <button
                        type="button"
                        onClick={() => removeTopic(index)}
                        className="ml-1 hover:bg-red-500 hover:text-white rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              
              {/* 研究话题建议 */}
              {availableTopics.filter(session => !watchedTopics?.includes(session.id)).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-blue-600 font-medium">🎯 相关研究话题（点击添加）：</p>
                  <div className="flex flex-wrap gap-1">
                    {availableTopics.filter(session => !watchedTopics?.includes(session.id)).slice(0, 10).map(session => (
                      <Badge
                        key={session.id}
                        variant="default"
                        className="cursor-pointer hover:opacity-80 text-xs bg-blue-100 text-blue-800 hover:bg-blue-200"
                        onClick={() => addExistingTopic(session.id)}
                      >
                        🎯 {session.displayName.length > 25 ? session.displayName.substring(0, 25) + "..." : session.displayName}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Abstract */}
          <div className="space-y-2">
            <Label htmlFor="abstract">{t('library.addLiteratureForm.abstract')}</Label>
            <Textarea
              id="abstract"
              {...register("abstract")}
              placeholder={t('library.addLiteratureForm.enterAbstract')}
              rows={4}
            />
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <Label htmlFor="summary">{t('library.addLiteratureForm.summary')}</Label>
            <Textarea
              id="summary"
              {...register("summary")}
              placeholder={t('library.addLiteratureForm.enterSummary')}
              rows={3}
            />
          </div>

          {/* Zotero Key (only show if source is zotero) */}
          {watchedSource === 'zotero' && (
            <div className="space-y-2">
              <Label htmlFor="zoteroKey">{t('library.addLiteratureForm.zoteroKey')}</Label>
              <Input
                id="zoteroKey"
                {...register("zoteroKey")}
                placeholder={t('library.addLiteratureForm.enterZoteroKey')}
                readOnly
              />
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              {t('library.addLiteratureForm.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? t('library.addLiteratureForm.adding') : t('library.addLiteratureForm.addLiterature')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}