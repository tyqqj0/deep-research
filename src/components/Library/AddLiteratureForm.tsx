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
});

type FormData = z.infer<typeof formSchema>;

export function AddLiteratureForm({ open, onClose }: AddLiteratureFormProps) {
  const [authorInput, setAuthorInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addLibraryItem } = useLibraryStore();

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

  const handleClose = () => {
    reset();
    setAuthorInput("");
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
      });

      if (result && result.success) {
        toast.success("Literature added successfully!");
        handleClose();
      } else if (result && result.duplicate) {
        // Handle duplicate case
        toast.warning(`Literature "${data.title}" already exists in your library.`);
        // Form stays open for user to modify or cancel
      } else {
        toast.error("Failed to add literature. Please try again.");
      }
    } catch (error) {
      toast.error("Failed to add literature. Please try again.");
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Literature</DialogTitle>
        </DialogHeader>

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

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-4">
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
            >
              {isSubmitting ? "Adding..." : "Add Literature"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}