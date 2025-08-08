// @/domains/literature/services/ICitationLinker.ts

/**
 * Interface for the Citation Linker service.
 * Defines the contract for business logic related to creating, deleting,
 * and finding citation links between literature items.
 */
export interface ICitationLinker {
  /**
   * Automatically links citations for a given item based on its parsed references.
   * @param itemId - The ID of the literature item.
   */
  linkCitationsForItem(itemId: string): Promise<void>;

  /**
   * Performs bidirectional linking for a new item against the entire library.
   * @param newItemId - The ID of the newly added literature item.
   */
  linkNewItemBidirectionally(newItemId: string): Promise<void>;

  /**
   * Manually creates a citation link from a source item to a target item.
   * @param sourceItemId - The ID of the item that contains the citation.
   * @param targetItemId - The ID of the item that is being cited.
   * @returns True if the link was created successfully, false otherwise.
   */
  createCitationLink(sourceItemId: string, targetItemId: string): Promise<boolean>;

  /**
   * Deletes a citation link between two items.
   * @param sourceItemId - The ID of the source item.
   * @param targetItemId - The ID of the target item.
   */
  deleteCitationLink(sourceItemId: string, targetItemId: string): Promise<void>;
}

// Token for Dependency Injection
export const ICitationLinker = Symbol('ICitationLinker');
