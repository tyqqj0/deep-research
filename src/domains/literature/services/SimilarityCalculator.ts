// @/domains/literature/services/SimilarityCalculator.ts

import { injectable } from 'tsyringe';
import { LibraryItem } from '../entities';

// Define a type for the data structure we use for matching
export type ExtractedReferenceData = {
    title?: string;
    authors?: string[];
    year?: number;
    doi?: string;
};

@injectable()
export class SimilarityCalculator {
  
  // A simple string similarity algorithm (Jaro-Winkler or similar would be used in a real scenario)
  calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) {
      return 1.0;
    }
    const matchingChars = Array.from(shorter).filter(char => longer.includes(char)).length;
    return matchingChars / longer.length;
  }
  
  calculateMatchScore(ref: ExtractedReferenceData, item: LibraryItem): number {
    let score = 0;
    let weights = 0;

    if (ref.title && item.title) {
      score += this.calculateStringSimilarity(ref.title.toLowerCase(), item.title.toLowerCase()) * 3; // Title is heavily weighted
      weights += 3;
    }
    
    if (ref.authors && ref.authors.length > 0 && item.authors && item.authors.length > 0) {
        const authorSimilarity = this.calculateStringSimilarity(ref.authors.join(' '), item.authors.join(' '));
        score += authorSimilarity;
        weights += 1;
    }

    if (ref.year && item.year) {
      const yearDiff = Math.abs(ref.year - item.year);
      const yearScore = Math.max(0, 1 - yearDiff / 5); // Score decreases over a 5-year difference
      score += yearScore;
      weights += 1;
    }

    return weights > 0 ? score / weights : 0;
  }
}
