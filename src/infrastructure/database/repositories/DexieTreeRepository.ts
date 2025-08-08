// @/infrastructure/database/repositories/DexieTreeRepository.ts

import { injectable } from 'tsyringe';
import { ITreeRepository } from '@/domains/tree/repositories/ITreeRepository';
import { ResearchTreeData } from '@/domains/tree/entities/ResearchTree';
import { db } from '@/infrastructure/database/dexie/connection';
import { Logger } from '../../logging/Logger';

@injectable()
export class DexieTreeRepository implements ITreeRepository {
  private logger = Logger.getInstance();

  async getAllTrees(): Promise<ResearchTreeData[]> {
    try {
      this.logger.debug('Fetching all trees from database');
      const trees = await db.literatureTrees.orderBy('createdAt').reverse().toArray();
      
      // Convert from old format to new format
      return trees.map(tree => ({
        id: tree.id,
        name: tree.name,
        rootNodeId: tree.rootNodeId,
        nodes: tree.nodes,
        createdAt: tree.createdAt
      }));
    } catch (error) {
      this.logger.error('Failed to fetch all trees', { error });
      throw new Error('Failed to fetch trees from database');
    }
  }

  async getTreeById(id: string): Promise<ResearchTreeData | null> {
    try {
      this.logger.debug('Fetching tree by ID', { treeId: id });
      const tree = await db.literatureTrees.get(id);
      
      if (!tree) {
        return null;
      }

      // Convert from old format to new format
      return {
        id: tree.id,
        name: tree.name,
        rootNodeId: tree.rootNodeId,
        nodes: tree.nodes,
        createdAt: tree.createdAt
      };
    } catch (error) {
      this.logger.error('Failed to fetch tree by ID', { treeId: id, error });
      throw new Error(`Failed to fetch tree with ID: ${id}`);
    }
  }

  async createTree(tree: ResearchTreeData): Promise<string> {
    try {
      this.logger.debug('Creating new tree', { treeId: tree.id, name: tree.name });
      
      // Convert to old format for database storage
      const dbTree = {
        id: tree.id,
        name: tree.name,
        rootNodeId: tree.rootNodeId,
        nodes: tree.nodes,
        createdAt: tree.createdAt
      };

      await db.literatureTrees.add(dbTree);
      this.logger.info('Tree created successfully', { treeId: tree.id });
      return tree.id;
    } catch (error) {
      this.logger.error('Failed to create tree', { treeId: tree.id, error });
      throw new Error(`Failed to create tree: ${error.message}`);
    }
  }

  async updateTree(tree: ResearchTreeData): Promise<void> {
    try {
      this.logger.debug('Updating tree', { treeId: tree.id });
      
      // Convert to old format for database storage
      const dbTree = {
        id: tree.id,
        name: tree.name,
        rootNodeId: tree.rootNodeId,
        nodes: tree.nodes,
        createdAt: tree.createdAt
      };

      await db.literatureTrees.put(dbTree);
      this.logger.info('Tree updated successfully', { treeId: tree.id });
    } catch (error) {
      this.logger.error('Failed to update tree', { treeId: tree.id, error });
      throw new Error(`Failed to update tree: ${error.message}`);
    }
  }

  async deleteTree(id: string): Promise<void> {
    try {
      this.logger.debug('Deleting tree', { treeId: id });
      const count = await db.literatureTrees.where('id').equals(id).delete();
      
      if (count === 0) {
        throw new Error(`Tree with ID ${id} not found`);
      }
      
      this.logger.info('Tree deleted successfully', { treeId: id });
    } catch (error) {
      this.logger.error('Failed to delete tree', { treeId: id, error });
      throw new Error(`Failed to delete tree: ${error.message}`);
    }
  }

  async getTreeCount(): Promise<number> {
    try {
      const count = await db.literatureTrees.count();
      this.logger.debug('Retrieved tree count', { count });
      return count;
    } catch (error) {
      this.logger.error('Failed to get tree count', { error });
      throw new Error('Failed to get tree count');
    }
  }

  async getTreesByCreationDate(startDate: Date, endDate?: Date): Promise<ResearchTreeData[]> {
    try {
      this.logger.debug('Fetching trees by creation date', { startDate, endDate });
      
      let query = db.literatureTrees.where('createdAt').aboveOrEqual(startDate);
      
      if (endDate) {
        query = query.and(tree => tree.createdAt <= endDate);
      }
      
      const trees = await query.toArray();
      
      // Convert from old format to new format
      return trees.map(tree => ({
        id: tree.id,
        name: tree.name,
        rootNodeId: tree.rootNodeId,
        nodes: tree.nodes,
        createdAt: tree.createdAt
      }));
    } catch (error) {
      this.logger.error('Failed to fetch trees by creation date', { startDate, endDate, error });
      throw new Error('Failed to fetch trees by creation date');
    }
  }
}