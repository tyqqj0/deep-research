import { useState, useEffect, useCallback } from 'react';
import { useLibraryStore } from '@/store/libraryStore';
import { zoteroService } from '@/libs/zotero';
import type { ZoteroUserInfo, ZoteroCollection, ZoteroGroup, ZoteroLibrary } from '@/libs/zotero/types';
import { toast } from 'sonner';

/**
 * 훅: useZotero
 * 
 * @description
 * 이 훅은 Zotero 통합과 관련된 모든 상태 관리 및 비즈니스 로직을 캡슐화합니다.
 * LibraryPage 컴포넌트에서 Zotero 관련 코드를 분리하여 복잡성을 줄이고 재사용성을 높입니다.
 * 
 * @returns Zotero 데이터, 상태 및 관련 핸들러 함수를 포함하는 객체를 반환합니다.
 */
export function useZotero() {
    const { isInitialized, initialize } = useLibraryStore();

    const [userInfo, setUserInfo] = useState<ZoteroUserInfo | null>(null);
    const [collections, setCollections] = useState<ZoteroCollection[]>([]);
    const [groups, setGroups] = useState<ZoteroGroup[]>([]);
    const [libraries, setLibraries] = useState<ZoteroLibrary[]>([]);
    const [currentLibrary, setCurrentLibrary] = useState<ZoteroLibrary | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const initializeZotero = async () => {
            // Library store가 초기화되었는지 확인
            if (!isInitialized) {
                await initialize();
            }

            // Zotero가 이미 구성되어 있는지 확인
            const storedConfig = zoteroService.getStoredConfig();
            if (storedConfig) {
                setIsConnected(true);
                // 캐시된 사용자 정보 시도
                const cachedUserInfo = zoteroService.getCachedUserInfo();
                if (cachedUserInfo) {
                    setUserInfo(cachedUserInfo);
                }
                // 캐시된 라이브러리 정보 로드
                const cachedCollections = zoteroService.getCachedCollections();
                const cachedGroups = zoteroService.getCachedGroups();
                const cachedLibraries = zoteroService.getCachedLibraries();
                const currentLib = zoteroService.getCurrentLibrary();
                setCollections(cachedCollections);
                setGroups(cachedGroups);
                setLibraries(cachedLibraries);
                setCurrentLibrary(currentLib);
            }
        };

        initializeZotero().catch(error => {
            console.error('Zotero initialization failed:', error);
            toast.error('Zotero 초기화에 실패했습니다.');
        });
    }, [isInitialized, initialize]);

    const handleLibraryChange = useCallback(async (libraryId: string) => {
        try {
            const collections = await zoteroService.switchLibrary(libraryId);
            setCollections(collections);
            setCurrentLibrary(zoteroService.getCurrentLibrary());
        } catch (error) {
            toast.error('라이브러리 전환에 실패했습니다.');
            console.error('Library switch error:', error);
        }
    }, []);

    const handleLoginSuccess = useCallback(async (newUserInfo: ZoteroUserInfo, newCollections: ZoteroCollection[], newGroups: ZoteroGroup[]) => {
        setUserInfo(newUserInfo);
        setCollections(newCollections);
        setGroups(newGroups);
        setIsConnected(true);

        // 로그인 성공 후 사용 가능한 라이브러리 가져오기
        try {
            const newLibraries = await zoteroService.getAvailableLibraries();
            setLibraries(newLibraries);
            setCurrentLibrary(zoteroService.getCurrentLibrary());
        } catch (error) {
            console.error('Failed to get libraries:', error);
            toast.error('라이브러리를 가져오는 데 실패했습니다.');
        }
    }, []);

    return {
        userInfo,
        collections,
        groups,
        libraries,
        currentLibrary,
        isConnected,
        handleLibraryChange,
        handleLoginSuccess,
    };
} 