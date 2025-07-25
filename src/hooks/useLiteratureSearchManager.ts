import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { 
  literatureSearchManager, 
  SearchConfig, 
  SearchSession, 
  SearchUnit,
  SEARCH_CONFIGS 
} from '@/libs/research/LiteratureSearchManager';

// 🎯 统一的文献搜索管理Hook - 支持MCTS 2.1和2.2阶段

interface UseLiteratureSearchManagerOptions {
  onComplete?: (session: SearchSession) => void;
  onError?: (error: Error) => void;
  onProgress?: (session: SearchSession) => void;
}

interface UseLiteratureSearchManagerReturn {
  // 核心状态
  currentSession: SearchSession | null;
  isSearching: boolean;
  isLoading: boolean;
  error: string | null;
  
  // 搜索控制
  startSearch: (config: SearchConfig) => Promise<string | null>;
  pauseSearch: () => Promise<void>;
  resumeSearch: () => Promise<void>;
  cancelSearch: () => Promise<void>;
  expandSearch: (queries: string[]) => Promise<void>;
  
  // 🚀 新增：单元级控制
  startUnitNow: (unitId: string) => Promise<void>;
  cancelUnit: (unitId: string) => Promise<void>;
  
  // 预定义配置
  startSeedingSearch: (topic: string, options?: Partial<SearchConfig>) => Promise<string | null>;
  startExpandingSearch: (topic: string, queries?: string[], options?: Partial<SearchConfig>) => Promise<string | null>;
  
  // 状态查询
  getActiveUnits: () => SearchUnit[];
  getCompletedUnits: () => SearchUnit[];
  getFailedUnits: () => SearchUnit[];
  getWaitingUnits: () => SearchUnit[]; // 🚀 新增：等待中的单元
  
  // 清理
  reset: () => void;
}

export function useLiteratureSearchManager(
  options: UseLiteratureSearchManagerOptions = {}
): UseLiteratureSearchManagerReturn {
  const { onComplete, onError, onProgress } = options;
  
  // 状态管理
  const [currentSession, setCurrentSession] = useState<SearchSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs to store callback references
  const sessionListenerRef = useRef<((session: SearchSession) => void) | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);

  // 计算衍生状态
  const isSearching = currentSession?.state === 'running' || currentSession?.state === 'preparing';

  // 清理事件监听器
  const cleanupListener = useCallback(() => {
    if (sessionListenerRef.current && currentSessionIdRef.current) {
      literatureSearchManager.removeEventListener(currentSessionIdRef.current, sessionListenerRef.current);
      sessionListenerRef.current = null;
      currentSessionIdRef.current = null;
    }
  }, []);

  // 设置会话监听器
  const setupSessionListener = useCallback((sessionId: string) => {
    cleanupListener(); // 先清理旧的监听器
    
    const listener = (session: SearchSession) => {
      console.log(`📊 [SearchHook] Session update:`, session.state, `${session.progress}%`);
      setCurrentSession({ ...session }); // 创建新对象以触发React更新
      
      // 触发回调
      onProgress?.(session);
      
      if (session.state === 'completed') {
        console.log(`🎉 [SearchHook] Search completed: ${session.totalAdded} items added`);
        setIsLoading(false);
        onComplete?.(session);
      } else if (session.state === 'failed') {
        console.error(`❌ [SearchHook] Search failed:`, session.error);
        setError(session.error || 'Search failed');
        setIsLoading(false);
        onError?.(new Error(session.error || 'Search failed'));
      } else if (session.state === 'cancelled') {
        console.log(`🛑 [SearchHook] Search cancelled`);
        setIsLoading(false);
      }
    };
    
    literatureSearchManager.addEventListener(sessionId, listener);
    sessionListenerRef.current = listener;
    currentSessionIdRef.current = sessionId;
  }, [onComplete, onError, onProgress, cleanupListener]);

  // 开始搜索
  const startSearch = useCallback(async (config: SearchConfig): Promise<string | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🚀 [SearchHook] Starting search with config:', config);
      const sessionId = await literatureSearchManager.startSearch(config);
      
      setupSessionListener(sessionId);
      return sessionId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start search';
      console.error('❌ [SearchHook] Failed to start search:', err);
      setError(errorMessage);
      setIsLoading(false);
      onError?.(new Error(errorMessage));
      return null;
    }
  }, [setupSessionListener, onError]);

  // 预定义的播种搜索
  const startSeedingSearch = useCallback(async (
    topic: string, 
    options: Partial<SearchConfig> = {}
  ): Promise<string | null> => {
    const config: SearchConfig = {
      ...SEARCH_CONFIGS.INITIAL_SEEDING,
      topic,
      ...options
    };
    
    console.log('🌱 [SearchHook] Starting seeding search for topic:', topic);
    return startSearch(config);
  }, [startSearch]);

  // 预定义的扩展搜索
  const startExpandingSearch = useCallback(async (
    topic: string,
    queries: string[] = [],
    options: Partial<SearchConfig> = {}
  ): Promise<string | null> => {
    const config: SearchConfig = {
      ...SEARCH_CONFIGS.CONTINUOUS_EXPANSION,
      topic,
      queries,
      ...options
    };
    
    console.log('🔄 [SearchHook] Starting expanding search for topic:', topic);
    return startSearch(config);
  }, [startSearch]);

  // 搜索控制方法
  const pauseSearch = useCallback(async (): Promise<void> => {
    if (!currentSession) return;
    try {
      await literatureSearchManager.pauseSearch(currentSession.id);
    } catch (err) {
      console.error('❌ [SearchHook] Failed to pause search:', err);
      toast.error('Failed to pause search');
    }
  }, [currentSession]);

  const resumeSearch = useCallback(async (): Promise<void> => {
    if (!currentSession) return;
    try {
      await literatureSearchManager.resumeSearch(currentSession.id);
    } catch (err) {
      console.error('❌ [SearchHook] Failed to resume search:', err);
      toast.error('Failed to resume search');
    }
  }, [currentSession]);

  const cancelSearch = useCallback(async (): Promise<void> => {
    if (!currentSession) return;
    try {
      await literatureSearchManager.cancelSearch(currentSession.id);
    } catch (err) {
      console.error('❌ [SearchHook] Failed to cancel search:', err);
      toast.error('Failed to cancel search');
    }
  }, [currentSession]);

  const expandSearch = useCallback(async (queries: string[]): Promise<void> => {
    if (!currentSession) {
      throw new Error('No active search session');
    }
    try {
      await literatureSearchManager.expandSearch(currentSession.id, queries);
      console.log(`🔄 [SearchHook] Expanded search with ${queries.length} new queries`);
    } catch (err) {
      console.error('❌ [SearchHook] Failed to expand search:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to expand search';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [currentSession]);

  // 🚀 新增：单元级控制方法
  const startUnitNow = useCallback(async (unitId: string): Promise<void> => {
    if (!currentSession) {
      throw new Error('No active search session');
    }
    try {
      await literatureSearchManager.startUnitNow(currentSession.id, unitId);
      console.log(`▶️ [SearchHook] Started unit immediately: ${unitId}`);
    } catch (err) {
      console.error('❌ [SearchHook] Failed to start unit:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start unit';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [currentSession]);

  const cancelUnit = useCallback(async (unitId: string): Promise<void> => {
    if (!currentSession) {
      throw new Error('No active search session');
    }
    try {
      await literatureSearchManager.cancelUnit(currentSession.id, unitId);
      console.log(`🛑 [SearchHook] Cancelled unit: ${unitId}`);
    } catch (err) {
      console.error('❌ [SearchHook] Failed to cancel unit:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel unit';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  }, [currentSession]);

  // 状态查询方法
  const getActiveUnits = useCallback((): SearchUnit[] => {
    if (!currentSession) return [];
    return literatureSearchManager.getActiveUnits(currentSession.id);
  }, [currentSession]);

  const getCompletedUnits = useCallback((): SearchUnit[] => {
    return currentSession?.units.filter(unit => unit.state === 'completed') || [];
  }, [currentSession]);

  const getFailedUnits = useCallback((): SearchUnit[] => {
    return currentSession?.units.filter(unit => unit.state === 'failed') || [];
  }, [currentSession]);

  // 🚀 新增：等待中的单元
  const getWaitingUnits = useCallback((): SearchUnit[] => {
    return currentSession?.units.filter(unit => unit.state === 'waiting') || [];
  }, [currentSession]);

  // 重置状态
  const reset = useCallback(() => {
    console.log('🔄 [SearchHook] Resetting state');
    cleanupListener();
    setCurrentSession(null);
    setIsLoading(false);
    setError(null);
  }, [cleanupListener]);

  // 清理效果
  useEffect(() => {
    return () => {
      cleanupListener();
    };
  }, [cleanupListener]);

  return {
    // 核心状态
    currentSession,
    isSearching,
    isLoading,
    error,
    
    // 搜索控制
    startSearch,
    pauseSearch,
    resumeSearch,
    cancelSearch,
    expandSearch,
    
    // 🚀 新增：单元级控制
    startUnitNow,
    cancelUnit,
    
    // 预定义配置
    startSeedingSearch,
    startExpandingSearch,
    
    // 状态查询
    getActiveUnits,
    getCompletedUnits,
    getFailedUnits,
    getWaitingUnits, // 🚀 新增
    
    // 清理
    reset
  };
}

export default useLiteratureSearchManager;