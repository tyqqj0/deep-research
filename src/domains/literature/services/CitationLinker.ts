// @/domains/literature/services/CitationLinker.ts

import { inject, injectable } from 'tsyringe';
import { ICitationLinker } from './ICitationLinker';
import { ILiteratureRepository } from '../repositories/ILiteratureRepository';
import { IMatchingEngine } from './IMatchingEngine';

@injectable()
export class CitationLinker implements ICitationLinker {
  constructor(
    @inject(ILiteratureRepository) private repository: ILiteratureRepository,
    @inject(IMatchingEngine) private matchingEngine: IMatchingEngine
  ) {}

  async linkCitationsForItem(itemId: string): Promise<void> {
    const item = await this.repository.getItemById(itemId);
    if (!item || !item.parsedContent?.extractedReferences) {
      return;
    }

    for (const ref of item.parsedContent.extractedReferences) {
      const matchedItem = await this.matchingEngine.findMatchingLiterature(ref, itemId);
      if (matchedItem) {
        await this.createCitationLink(itemId, matchedItem.id);
      }
    }
  }

  async linkNewItemBidirectionally(newItemId: string): Promise<void> {
    const newItem = await this.repository.getItemById(newItemId);
    if (!newItem) return;

    // Link citations from the new item to existing items in the library
    await this.linkCitationsForItem(newItemId);

    // Check all other items in the library to see if they cite the new item
    const allItems = await this.repository.getAllItems();
    for (const item of allItems) {
      if (item.id === newItemId) continue;
      if (item.parsedContent?.extractedReferences) {
        for (const ref of item.parsedContent.extractedReferences) {
          const matchedItem = await this.matchingEngine.findMatchingLiterature(ref, item.id);
          if (matchedItem && matchedItem.id === newItemId) {
            await this.createCitationLink(item.id, newItemId);
          }
        }
      }
    }
  }

  async createCitationLink(sourceItemId: string, targetItemId: string): Promise<boolean> {
    if (sourceItemId === targetItemId) return false;

    // Check if link already exists
    const existingCitations = await this.repository.getCitationsBySource(sourceItemId);
    if (existingCitations.some(c => c.targetItemId === targetItemId)) {
      return false;
    }

    await this.repository.addCitation({ sourceItemId, targetItemId });
    return true;
  }

  async deleteCitationLink(sourceItemId: string, targetItemId: string): Promise<void> {
    await this.repository.deleteCitation(sourceItemId, targetItemId);
  }
}
