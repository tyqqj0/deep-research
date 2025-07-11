import { useState, useEffect, useCallback } from 'react';
import { LibraryItem } from '@/libs/db';
import { libraryService } from '@/libs/db/LibraryService';

export interface CitationData {
  references: LibraryItem[];
  citedBy: LibraryItem[];
  unlinkedReferences: any[];
  isLoading: boolean;
  error: string | null;
}

export interface CitationActions {
  refresh: () => Promise<void>;
  linkCitation: (sourceId: string, targetId: string) => Promise<void>;
  unlinkCitation: (sourceId: string, targetId: string) => Promise<void>;
  autoLinkCitations: (itemId: string) => Promise<{
    totalReferences: number;
    linkedCount: number;
    unlinkedCount: number;
  }>;
}

/**
 * 🔗 useCitations Hook - 引文数据管理
 * 
 * 提供完整的引文数据获取、链接管理和自动化功能
 */
export function useCitations(itemId: string | null): CitationData & CitationActions {
  const [data, setData] = useState<CitationData>({
    references: [],
    citedBy: [],
    unlinkedReferences: [],
    isLoading: false,
    error: null
  });

  // 获取引文数据
  const fetchCitationData = useCallback(async () => {
    if (!itemId) {
      setData(prev => ({ ...prev, references: [], citedBy: [], unlinkedReferences: [] }));
      return;
    }

    setData(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const [relationships, unlinkedRefs] = await Promise.all([
        libraryService.getCitationRelationships(itemId),
        libraryService.getUnlinkedReferences(itemId)
      ]);

      setData(prev => ({
        ...prev,
        references: relationships.references,
        citedBy: relationships.citedBy,
        unlinkedReferences: unlinkedRefs,
        isLoading: false
      }));
    } catch (error) {
      console.error('Error fetching citation data:', error);
      setData(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false
      }));
    }
  }, [itemId]);

  // 初始化和刷新
  const refresh = useCallback(async () => {
    await fetchCitationData();
  }, [fetchCitationData]);

  // 手动链接引文
  const linkCitation = useCallback(async (sourceId: string, targetId: string) => {
    try {
      await libraryService.createCitationLink(sourceId, targetId);
      await refresh(); // 刷新数据
    } catch (error) {
      console.error('Error linking citation:', error);
      throw error;
    }
  }, [refresh]);

  // 取消链接引文
  const unlinkCitation = useCallback(async (sourceId: string, targetId: string) => {
    try {
      await libraryService.deleteCitationLink(sourceId, targetId);
      await refresh(); // 刷新数据
    } catch (error) {
      console.error('Error unlinking citation:', error);
      throw error;
    }
  }, [refresh]);

  // 自动链接引文
  const autoLinkCitations = useCallback(async (itemId: string) => {
    try {
      const result = await libraryService.linkCitationsForItem(itemId);
      await refresh(); // 刷新数据
      return result;
    } catch (error) {
      console.error('Error auto-linking citations:', error);
      throw error;
    }
  }, [refresh]);

  // 监听 itemId 变化
  useEffect(() => {
    fetchCitationData();
  }, [fetchCitationData]);

  return {
    ...data,
    refresh,
    linkCitation,
    unlinkCitation,
    autoLinkCitations
  };
}

/**
 * Hook to check if an item exists in the library
 * @param itemId - The ID of the library item to check
 * @returns Boolean indicating if the item exists in the library
 */
export function useIsInLibrary(itemId: string | null) {
  const isInLibrary = useLiveQuery(
    async () => {
      if (!itemId) return false;

      try {
        const item = await db.library.get(itemId);
        return !!item;
      } catch (error) {
        console.error('Error checking if item is in library:', error);
        return false;
      }
    },
    [itemId]
  );

  return isInLibrary !== undefined ? isInLibrary : false;
}