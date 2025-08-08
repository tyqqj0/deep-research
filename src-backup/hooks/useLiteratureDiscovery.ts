import { useState, useCallback } from 'react';

interface DiscoveryResult {
  success: boolean;
  addedItems: string[];
  error?: string;
  totalFound: number;
  duplicatesSkipped: number;
}

interface DiscoveryState {
  isDiscovering: boolean;
  currentQuery: string;
  results: DiscoveryResult | null;
  progress: {
    stage: 'searching' | 'parsing' | 'matching' | 'storing' | 'complete';
    message: string;
  } | null;
}

export function useLiteratureDiscovery() {
  const [state, setState] = useState<DiscoveryState>({
    isDiscovering: false,
    currentQuery: '',
    results: null,
    progress: null,
  });

  const updateProgress = useCallback((stage: DiscoveryState['progress']) => {
    setState(prev => ({ ...prev, progress: stage }));
  }, []);

  const discoverLiterature = useCallback(async (query: string, topic: string): Promise<DiscoveryResult> => {
    setState(prev => ({
      ...prev,
      isDiscovering: true,
      currentQuery: query,
      results: null,
      progress: { stage: 'searching', message: '正在搜索文献...' }
    }));

    try {
      // Dynamic import to avoid TypeScript path issues
      const { discoverAndAddLiterature } = await import('../libs/research');
      
      updateProgress({ stage: 'searching', message: '正在搜索文献...' });
      
      const addedItems = await discoverAndAddLiterature(query, topic);
      
      const result: DiscoveryResult = {
        success: true,
        addedItems,
        totalFound: addedItems.length,
        duplicatesSkipped: 0, // TODO: Get from service metrics
      };

      setState(prev => ({
        ...prev,
        isDiscovering: false,
        results: result,
        progress: { stage: 'complete', message: `成功添加 ${addedItems.length} 篇文献` }
      }));

      return result;
    } catch (error) {
      const result: DiscoveryResult = {
        success: false,
        addedItems: [],
        error: error instanceof Error ? error.message : '未知错误',
        totalFound: 0,
        duplicatesSkipped: 0,
      };

      setState(prev => ({
        ...prev,
        isDiscovering: false,
        results: result,
        progress: { stage: 'complete', message: '文献发现失败' }
      }));

      return result;
    }
  }, [updateProgress]);

  const resetState = useCallback(() => {
    setState({
      isDiscovering: false,
      currentQuery: '',
      results: null,
      progress: null,
    });
  }, []);

  return {
    // State
    isDiscovering: state.isDiscovering,
    currentQuery: state.currentQuery,
    results: state.results,
    progress: state.progress,
    
    // Actions
    discoverLiterature,
    resetState,
  };
}