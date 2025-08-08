// @/domains/literature/services/MatchingEngine.ts

import { inject, injectable } from 'tsyringe';
import { IMatchingEngine } from './IMatchingEngine';
import { ILiteratureRepository } from '../repositories/ILiteratureRepository';
import { LibraryItem } from '../entities';
import { SimilarityCalculator } from './SimilarityCalculator'; // We will create this
import { ReferenceExtractor } from './ReferenceExtractor'; // We will create this

@injectable()
export class MatchingEngine implements IMatchingEngine {
  private thresholds = {
    gatekeeperThreshold: 0.4,
    finalThreshold: 0.6
  };

  constructor(
    @inject(ILiteratureRepository) private repository: ILiteratureRepository,
    @inject(SimilarityCalculator) private similarityCalculator: SimilarityCalculator,
    @inject(ReferenceExtractor) private referenceExtractor: ReferenceExtractor
  ) {}

  async findDuplicate(literatureData: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<LibraryItem | null> {
    if (literatureData.doi) {
      const item = await this.repository.findItemByDoi(literatureData.doi);
      if (item) return item;
    }
    if (literatureData.url) {
      const item = await this.repository.findItemByUrl(literatureData.url);
      if (item) return item;
    }
    
    // Title-based similarity matching (simplified for brevity)
    if (literatureData.title) {
        const allItems = await this.repository.getAllItems();
        // ... complex matching logic from old MatchingEngine would go here ...
        // This logic would now use `allItems` from the repository instead of direct DB access.
    }

    return null;
  }
  
  async findMatchingLiterature(reference: any, sourceItemId?: string): Promise<LibraryItem | null> {
    const extractedRef = this.referenceExtractor.extractReferenceData(reference);
    
    if(extractedRef.doi) {
        const item = await this.repository.findItemByDoi(extractedRef.doi);
        if (item && item.id !== sourceItemId) return item;
    }

    // ... more complex matching logic ...
    return null;
  }
}
