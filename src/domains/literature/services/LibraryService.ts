// @/domains/literature/services/LibraryService.ts

import { inject, injectable } from 'tsyringe';
import { ILibraryService } from './ILibraryService';
import { ILiteratureRepository } from '../repositories/ILiteratureRepository';
import { IMatchingEngine } from './IMatchingEngine'; // We will create this interface
import { ICitationLinker } from './ICitationLinker'; // We will create this interface
import { LibraryItem } from '../entities';
import { generateLibraryItemId } from '@/infrastructure/utils/id';

@injectable()
export class LibraryService implements ILibraryService {
  constructor(
    @inject(ILiteratureRepository) private repository: ILiteratureRepository,
    @inject(IMatchingEngine) private matchingEngine: IMatchingEngine,
    @inject(ICitationLinker) private citationLinker: ICitationLinker
  ) {}

  async addOrUpdateFromAPI(literatureData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const existingItem = await this.matchingEngine.findDuplicate(literatureData);

    if (existingItem) {
      const mergedData = await this.intelligentMerge(existingItem, literatureData);
      await this.repository.updateItem(existingItem.id, mergedData);
      return existingItem.id;
    } else {
      const newItem: LibraryItem = {
        id: generateLibraryItemId(),
        ...literatureData,
        createdAt: new Date(),
      };
      const newId = await this.repository.addItem(newItem);
      await this.linkNewItemBidirectionally(newId);
      return newId;
    }
  }

  async updateWithDuplicateCheck(id: string, updateData: Partial<LibraryItem>): Promise<void> {
    const existingItem = await this.repository.getItemById(id);
    if (!existingItem) throw new Error(`Item not found: ${id}`);
    
    // Logic to check if duplicate check is needed
    // ...
    
    await this.repository.updateItem(id, { ...updateData, updatedAt: new Date() });
  }

  async deleteLibraryItem(id: string): Promise<void> {
    // Business logic to ensure data integrity before deleting
    // e.g., check for dependencies in other domains
    await this.repository.deleteItem(id);
    // Also delete all related citations
    const sourceCitations = await this.repository.getCitationsBySource(id);
    const targetCitations = await this.repository.getCitationsByTarget(id);
    for(const citation of sourceCitations) {
        await this.repository.deleteCitation(citation.sourceItemId, citation.targetItemId);
    }
    for(const citation of targetCitations) {
        await this.repository.deleteCitation(citation.sourceItemId, citation.targetItemId);
    }
  }
  
  async linkCitationsForItem(itemId: string): Promise<void> {
      await this.citationLinker.linkCitationsForItem(itemId);
  }

  async linkNewItemBidirectionally(newItemId: string): Promise<void> {
      await this.citationLinker.linkNewItemBidirectionally(newItemId);
  }

  async createManualCitationLink(sourceItemId: string, targetItemId: string): Promise<boolean> {
      return this.citationLinker.createCitationLink(sourceItemId, targetItemId);
  }

  private async intelligentMerge(
    existingItem: LibraryItem,
    newData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Partial<LibraryItem>> {
    // Merging logic remains largely the same, but without direct DB access
    // ...
    return {}; // Placeholder for merged data
  }
}
