"use client";

import { useState } from "react";
import { LibraryItem } from "@/libs/db";
import { LiteratureListItem } from "./LiteratureListItem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutGrid, List, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LiteratureListProps {
  items: LibraryItem[];
  isLoading: boolean;
  onEdit: (item: LibraryItem) => void;
  onDelete: (id: string) => void;
  onSelectForTree: (item: LibraryItem) => void;
}

type SortField = 'title' | 'year' | 'createdAt' | 'authors';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'list' | 'grid';

export function LiteratureList({ 
  items, 
  isLoading, 
  onEdit, 
  onDelete, 
  onSelectForTree 
}: LiteratureListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Sort items
  const sortedItems = [...items].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'title':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      case 'year':
        aValue = a.year;
        bValue = b.year;
        break;
      case 'createdAt':
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      case 'authors':
        aValue = a.authors.join(', ').toLowerCase();
        bValue = b.authors.join(', ').toLowerCase();
        break;
      default:
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const toggleItemSelection = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const selectAllItems = () => {
    setSelectedItems(new Set(items.map(item => item.id)));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const handleBulkDelete = () => {
    selectedItems.forEach(id => onDelete(id));
    clearSelection();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <div className="text-muted-foreground">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-lg font-semibold mb-2">No Literature Found</h3>
            <p className="text-sm mb-4">
              Start building your literature collection by adding your first item.
            </p>
            <Button onClick={() => {/* TODO: Open add form */}}>
              Add Your First Literature
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {items.length} items
          </span>
          {selectedItems.size > 0 && (
            <Badge variant="secondary">
              {selectedItems.size} selected
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Bulk Actions */}
          {selectedItems.size > 0 && (
            <div className="flex items-center gap-2 mr-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDelete}
                className="text-red-600"
              >
                Delete Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
              >
                Clear Selection
              </Button>
            </div>
          )}

          {/* Selection Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectedItems.size === items.length ? clearSelection : selectAllItems}
            >
              {selectedItems.size === items.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="year">Year</SelectItem>
                <SelectItem value="createdAt">Date Added</SelectItem>
                <SelectItem value="authors">Authors</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={toggleSortOrder}
            >
              {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            </Button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-r-none"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-l-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Literature Items */}
      <div className={
        viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' 
          : 'space-y-4'
      }>
        {sortedItems.map((item) => (
          <LiteratureListItem
            key={item.id}
            item={item}
            isSelected={selectedItems.has(item.id)}
            onSelect={() => toggleItemSelection(item.id)}
            onEdit={() => onEdit(item)}
            onDelete={() => onDelete(item.id)}
            onSelectForTree={() => onSelectForTree(item)}
            viewMode={viewMode}
          />
        ))}
      </div>

      {/* Pagination or Load More */}
      {sortedItems.length > 20 && (
        <div className="text-center pt-4">
          <Button variant="outline" onClick={() => {/* TODO: Load more */}}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}