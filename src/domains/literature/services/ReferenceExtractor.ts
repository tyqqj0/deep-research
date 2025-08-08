// @/domains/literature/services/ReferenceExtractor.ts

import { injectable } from 'tsyringe';
import { ExtractedReferenceData } from './SimilarityCalculator';

@injectable()
export class ReferenceExtractor {

  /**
   * Extracts and flattens reference data from potentially nested or varied formats.
   * @param reference - The raw reference object.
   * @returns A standardized object with title, authors, year, and DOI.
   */
  extractReferenceData(reference: any): ExtractedReferenceData {
    if (!reference) {
      return {};
    }

    // This is a simplified version of the logic from the old ReferenceExtractor.
    // It handles various possible structures of the reference object.
    const title = reference.title || reference['container-title'] || reference.journal || '';
    
    let authors: string[] = [];
    if (Array.isArray(reference.author)) {
        authors = reference.author.map((a: any) => `${a.given} ${a.family}`.trim());
    }

    let year: number | undefined;
    if (reference.issued && reference.issued['date-parts'] && reference.issued['date-parts'][0]) {
        year = reference.issued['date-parts'][0][0];
    }

    const doi = reference.DOI || '';

    return {
      title,
      authors,
      year,
      doi,
    };
  }
}
