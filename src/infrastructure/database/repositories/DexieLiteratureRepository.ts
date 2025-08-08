// @/infrastructure/database/repositories/DexieLiteratureRepository.ts

import { injectable } from 'tsyringe';
import { ILiteratureRepository } from '@/domains/literature/repositories/ILiteratureRepository';
import { LibraryItem, Citation } from '@/domains/literature/entities';
import { db } from '@/infrastructure/database/dexie/connection';
import { generateCitationId } from '@/infrastructure/utils/id';

@injectable()
export class DexieLiteratureRepository implements ILiteratureRepository {
  async getAllItems(): Promise<LibraryItem[]> {
    return db.library.toArray();
  }

  async getItemById(id: string): Promise<LibraryItem | null> {
    const item = await db.library.get(id);
    return item || null;
  }
  
  async getItemsBySource(source: string): Promise<LibraryItem[]> {
      return db.library.where('source').equals(source).toArray();
  }

  async getItemsByYearRange(startYear: number, endYear: number): Promise<LibraryItem[]> {
      return db.library.where('year').between(startYear, endYear, true, true).toArray();
  }

  async getItemsByTopic(topic: string): Promise<LibraryItem[]> {
      return db.library.filter(item => !!(item.topics && item.topics.includes(topic))).toArray();
  }

  async findItemByDoi(doi: string): Promise<LibraryItem | null> {
    const item = await db.library.where('doi').equals(doi).first();
    return item || null;
  }

  async findItemByUrl(url: string): Promise<LibraryItem | null> {
    const item = await db.library.where('url').equals(url).first();
    return item || null;
  }

  async addItem(item: LibraryItem): Promise<string> {
    return db.library.add(item);
  }

  async updateItem(id: string, updates: Partial<LibraryItem>): Promise<void> {
    await db.library.update(id, updates);
  }

  async deleteItem(id: string): Promise<void> {
    await db.library.delete(id);
  }

  async getAllCitations(): Promise<Array<{ source: string; target: string }>> {
    const citations = await db.citations.toArray();
    return citations.map(c => ({ source: c.sourceItemId, target: c.targetItemId }));
  }
  
  async getCitationsBySource(sourceItemId: string): Promise<Citation[]> {
      return db.citations.where('sourceItemId').equals(sourceItemId).toArray();
  }

  async getCitationsByTarget(targetItemId: string): Promise<Citation[]> {
      return db.citations.where('targetItemId').equals(targetItemId).toArray();
  }

  async addCitation(citation: Omit<Citation, 'id' | 'createdAt'>): Promise<void> {
    const newCitation: Citation = {
        id: generateCitationId(citation.sourceItemId, citation.targetItemId),
        ...citation,
        createdAt: new Date(),
    }
    await db.citations.add(newCitation);
  }

  async deleteCitation(sourceItemId: string, targetItemId: string): Promise<void> {
    const citationId = generateCitationId(sourceItemId, targetItemId);
    await db.citations.delete(citationId);
  }

  async clearAll(): Promise<void> {
    await db.library.clear();
    await db.citations.clear();
  }
}
