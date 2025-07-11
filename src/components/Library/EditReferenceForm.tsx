"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Save, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// 引文编辑表单的数据结构
const referenceFormSchema = z.object({
    title: z.string().min(1, "标题不能为空"),
    authors: z.array(z.string()).min(1, "至少需要一个作者"),
    year: z.number().int().min(1900).max(new Date().getFullYear() + 10).optional(),
    journal: z.string().optional(),
    doi: z.string().optional(),
    url: z.string().url("请输入有效的URL").optional().or(z.literal(""))
});

type ReferenceFormData = z.infer<typeof referenceFormSchema>;

interface EditReferenceFormProps {
    open: boolean;
    onClose: () => void;
    reference: any;
    referenceIndex: number;
    onSave: (referenceIndex: number, updatedReference: any) => Promise<void>;
}

export function EditReferenceForm({
    open,
    onClose,
    reference,
    referenceIndex,
    onSave
}: EditReferenceFormProps) {
    const [authorInput, setAuthorInput] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch,
        reset,
    } = useForm<ReferenceFormData>({
        resolver: zodResolver(referenceFormSchema),
        defaultValues: {
            title: "",
            authors: [],
            year: undefined,
            journal: "",
            doi: "",
            url: ""
        },
    });

    const watchedAuthors = watch("authors");

    // 当引文数据变化时重置表单
    useEffect(() => {
        if (reference && open) {
            reset({
                title: reference.title || "",
                authors: Array.isArray(reference.authors) ? reference.authors :
                    (typeof reference.authors === 'string' ? [reference.authors] : []),
                year: reference.year || undefined,
                journal: reference.journal || "",
                doi: reference.doi || "",
                url: reference.url || ""
            });
        }
    }, [reference, open, reset]);

    const handleClose = () => {
        reset();
        setAuthorInput("");
        onClose();
    };

    const addAuthor = () => {
        if (authorInput.trim()) {
            const currentAuthors = watchedAuthors || [];
            setValue("authors", [...currentAuthors, authorInput.trim()]);
            setAuthorInput("");
        }
    };

    const removeAuthor = (index: number) => {
        const currentAuthors = watchedAuthors || [];
        setValue("authors", currentAuthors.filter((_, i) => i !== index));
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addAuthor();
        }
    };

    const onSubmit = async (data: ReferenceFormData) => {
        try {
            setIsSubmitting(true);

            // 构建更新后的引文对象
            const updatedReference = {
                ...reference,
                title: data.title,
                authors: data.authors,
                year: data.year,
                journal: data.journal || undefined,
                doi: data.doi || undefined,
                url: data.url || undefined
            };

                  await onSave(referenceIndex, updatedReference);
      
      toast.success(referenceIndex === -1 ? "新引文已添加" : "引文信息已更新");
            handleClose();
        } catch (error) {
            console.error("Error updating reference:", error);
            toast.error("更新引文信息失败");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl">
                        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {referenceIndex === -1 ? '添加新引文' : `编辑引文信息 (#${referenceIndex + 1})`}
          </DialogTitle>
        </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* 标题 */}
                    <div className="space-y-2">
                        <Label htmlFor="title">标题 *</Label>
                        <Input
                            id="title"
                            {...register("title")}
                            placeholder="论文标题"
                            className={errors.title ? "border-red-500" : ""}
                        />
                        {errors.title && (
                            <p className="text-sm text-red-500">{errors.title.message}</p>
                        )}
                    </div>

                    {/* 作者 */}
                    <div className="space-y-2">
                        <Label>作者 *</Label>
                        <div className="flex gap-2">
                            <Input
                                value={authorInput}
                                onChange={(e) => setAuthorInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="输入作者姓名，按回车添加"
                                className="flex-1"
                            />
                            <Button
                                type="button"
                                onClick={addAuthor}
                                disabled={!authorInput.trim()}
                                size="sm"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {watchedAuthors?.map((author, index) => (
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

                    {/* 年份和期刊 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="year">年份</Label>
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
                            <Label htmlFor="journal">期刊/会议</Label>
                            <Input
                                id="journal"
                                {...register("journal")}
                                placeholder="期刊或会议名称"
                            />
                        </div>
                    </div>

                    {/* DOI 和 URL */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="doi">DOI</Label>
                            <Input
                                id="doi"
                                {...register("doi")}
                                placeholder="10.1000/182"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="url">URL</Label>
                            <Input
                                id="url"
                                {...register("url")}
                                placeholder="https://example.com"
                                className={errors.url ? "border-red-500" : ""}
                            />
                            {errors.url && (
                                <p className="text-sm text-red-500">{errors.url.message}</p>
                            )}
                        </div>
                    </div>

                    {/* 原始引文信息（只读） */}
                    {reference && (
                        <div className="space-y-2">
                            <Label>原始引文信息</Label>
                            <div className="bg-gray-50 dark:bg-gray-800 border rounded-lg p-3">
                                <pre className="text-sm whitespace-pre-wrap">
                                    {typeof reference === 'string' ? reference : JSON.stringify(reference, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* 表单操作按钮 */}
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={isSubmitting}
                        >
                            取消
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {isSubmitting ? (
                                <>
                                    <Save className="h-4 w-4 mr-2 animate-spin" />
                                    保存中...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    保存更改
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
} 