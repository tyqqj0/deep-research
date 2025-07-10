import { useLiveQuery } from 'dexie-react-hooks';
import { db, LibraryItem } from '@/libs/db';

/**
 * Hook to fetch citation relationships for a library item
 * @param itemId - The ID of the library item
 * @returns Object containing references and citedBy arrays
 */
export function useCitations(itemId: string | null) {
  // Get references (items this item cites)
  const references = useLiveQuery(
    async () => {
      if (!itemId) return [];
      
      try {
        // Get all citations where this item is the source
        const referenceCitations = await db.citations
          .where('sourceItemId')
          .equals(itemId)
          .toArray();
        
        // Get the actual library items
        const referenceItems = await Promise.all(
          referenceCitations.map(citation => db.library.get(citation.targetItemId))
        );
        
        // Filter out any null results
        return referenceItems.filter(Boolean) as LibraryItem[];
      } catch (error) {
        console.error('Error fetching references:', error);
        return [];
      }
    },
    [itemId]
  );

  // Get cited by (items that cite this item)
  const citedBy = useLiveQuery(
    async () => {
      if (!itemId) return [];
      
      try {
        // Get all citations where this item is the target
        const citedByCitations = await db.citations
          .where('targetItemId')
          .equals(itemId)
          .toArray();
        
        // Get the actual library items
        const citedByItems = await Promise.all(
          citedByCitations.map(citation => db.library.get(citation.sourceItemId))
        );
        
        // Filter out any null results
        return citedByItems.filter(Boolean) as LibraryItem[];
      } catch (error) {
        console.error('Error fetching cited by:', error);
        return [];
      }
    },
    [itemId]
  );

  return {
    references: references || [],
    citedBy: citedBy || [],
    isLoading: references === undefined || citedBy === undefined
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