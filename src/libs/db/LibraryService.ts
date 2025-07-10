/**
 * 📚 LibraryService - 文献管理核心服务层
 * 
 * 🎯 核心功能:
 * - 文献条目的增删改查操作
 * - 智能的文献创建和处理工作流
 * - PDF抓取、上传和解析的协调管理
 * - Mineru解析服务的集成和状态管理
 * - 引用关系的建立和维护
 * 
 * 🧠 智能工作流设计:
 * 
 * 1️⃣ 手动添加工作流 (createFromMetadata)
 *    ├── 有DOI/URL → 直接Mineru处理
 *    └── 无DOI/URL → 等待手动上传
 * 
 * 2️⃣ 搜索结果工作流 (createFromSearchResult)
 *    ├── 尝试PDF抓取
 *    ├── 成功 → Mineru处理
 *    └── 失败 → 等待手动上传
 * 
 * 3️⃣ PDF上传工作流 (createFromPdfUpload)
 *    └── 直接Mineru处理提取元数据
 * 
 * 🔄 状态流转图:
 * IDLE → PENDING_PDF_FETCH → PENDING_MINERU_SUBMISSION → PARSING_IN_MINERU → SUCCESS
 *   ↓                              ↑
 * AWAITING_MANUAL_UPLOAD ──────────┘
 *   ↓
 * FAILED / PARSING_FAILED
 * 
 * 🚀 性能优化:
 * - 所有长时间操作都是异步非阻塞的
 * - 支持并发处理多个文献项目
 * - 智能错误恢复和状态管理
 * - 实时状态更新和UI反馈
 * 
 * 📱 使用场景:
 * - AddLiteratureForm: 手动添加文献
 * - PdfUploadDialog: PDF文件上传
 * - Zotero导入: 批量文献导入
 * - Tavily搜索: 外部搜索结果导入
 * - 引用管理: 文献关系维护
 */

import { db, LibraryItem, LiteratureTree } from './index';
import { LibraryItemSchema, ParsingStatusEnum } from './schema';
import { generateLibraryItemId } from '../utils/uuid';
import { pdfFetcherService } from '../fetching';
import { mineruService } from '../parsing';

type ParsingStatus = typeof ParsingStatusEnum[number];

export class LibraryService {
  private db = db;

  /**
   * Get all library items
   */
  async getAllLibraryItems(): Promise<LibraryItem[]> {
    try {
      const items = await this.db.library.orderBy('createdAt').reverse().toArray();
      return items;
    } catch (error) {
      console.error('Error getting all library items:', error);
      throw new Error('Failed to fetch library items');
    }
  }

  /**
   * Get library item by ID
   */
  async getLibraryItemById(id: string): Promise<LibraryItem | null> {
    try {
      const item = await this.db.library.get(id);
      return item || null;
    } catch (error) {
      console.error('Error getting library item by ID:', error);
      throw new Error('Failed to fetch library item');
    }
  }

  /**
   * Check for duplicate literature by title
   */
  async checkDuplicateByTitle(title: string): Promise<LibraryItem[]> {
    try {
      const duplicates = await this.db.library
        .where('title')
        .equalsIgnoreCase(title.trim())
        .toArray();
      return duplicates;
    } catch (error) {
      console.error('Error checking duplicates:', error);
      throw new Error('Failed to check duplicates');
    }
  }

  /**
   * Add new library item with duplicate check
   */
  async addLibraryItem(item: LibraryItem): Promise<{ success: boolean; duplicate?: LibraryItem[] }> {
    try {
      // Validate the item
      const validatedItem = LibraryItemSchema.parse(item);
      
      // Check for duplicates
      const duplicates = await this.checkDuplicateByTitle(validatedItem.title);
      
      if (duplicates.length > 0) {
        return {
          success: false,
          duplicate: duplicates
        };
      }
      
      // Add to database
      await this.db.library.add(validatedItem);
      return { success: true };
    } catch (error) {
      console.error('Error adding library item:', error);
      throw new Error('Failed to add library item');
    }
  }

  /**
   * Update library item
   */
  async updateLibraryItem(id: string, updates: Partial<LibraryItem>): Promise<void> {
    try {
      const existingItem = await this.getLibraryItemById(id);
      if (!existingItem) {
        throw new Error(`Library item with ID ${id} not found`);
      }

      const updatedItem: LibraryItem = {
        ...existingItem,
        ...updates,
        updatedAt: new Date()
      };

      // Validate the updated item
      const validatedItem = LibraryItemSchema.parse(updatedItem);
      
      // Update in database
      await this.db.library.update(id, validatedItem);
    } catch (error) {
      console.error('Error updating library item:', error);
      throw new Error('Failed to update library item');
    }
  }

  /**
   * Delete library item
   */
  async deleteLibraryItem(id: string): Promise<void> {
    try {
      const count = await this.db.library.where('id').equals(id).delete();
      if (count === 0) {
        throw new Error(`Library item with ID ${id} not found`);
      }
    } catch (error) {
      console.error('Error deleting library item:', error);
      throw new Error('Failed to delete library item');
    }
  }

  /**
   * Bulk delete library items
   */
  async bulkDeleteLibraryItems(ids: string[]): Promise<void> {
    try {
      await this.db.library.where('id').anyOf(ids).delete();
    } catch (error) {
      console.error('Error bulk deleting library items:', error);
      throw new Error('Failed to delete library items');
    }
  }

  /**
   * Search library items
   */
  async searchLibraryItems(query: string): Promise<LibraryItem[]> {
    try {
      const lowerQuery = query.toLowerCase();
      
      const items = await this.db.library
        .filter(item => 
          item.title.toLowerCase().includes(lowerQuery) ||
          item.authors.some(author => author.toLowerCase().includes(lowerQuery)) ||
          (item.publication && item.publication.toLowerCase().includes(lowerQuery)) ||
          (item.abstract && item.abstract.toLowerCase().includes(lowerQuery))
        )
        .toArray();
      
      return items;
    } catch (error) {
      console.error('Error searching library items:', error);
      throw new Error('Failed to search library items');
    }
  }

  /**
   * Get items by source
   */
  async getItemsBySource(source: string): Promise<LibraryItem[]> {
    try {
      const items = await this.db.library.where('source').equals(source).toArray();
      return items;
    } catch (error) {
      console.error('Error getting items by source:', error);
      throw new Error('Failed to fetch items by source');
    }
  }

  /**
   * Get items by year range
   */
  async getItemsByYearRange(startYear: number, endYear: number): Promise<LibraryItem[]> {
    try {
      const items = await this.db.library
        .where('year')
        .between(startYear, endYear, true, true)
        .toArray();
      return items;
    } catch (error) {
      console.error('Error getting items by year range:', error);
      throw new Error('Failed to fetch items by year range');
    }
  }

  /**
   * Get all literature trees
   */
  async getAllTrees(): Promise<LiteratureTree[]> {
    try {
      const trees = await this.db.literatureTrees.orderBy('createdAt').reverse().toArray();
      return trees;
    } catch (error) {
      console.error('Error getting all literature trees:', error);
      throw new Error('Failed to fetch literature trees');
    }
  }

  /**
   * Get literature tree by ID
   */
  async getTreeById(id: string): Promise<LiteratureTree | null> {
    try {
      const tree = await this.db.literatureTrees.get(id);
      return tree || null;
    } catch (error) {
      console.error('Error getting literature tree by ID:', error);
      throw new Error('Failed to fetch literature tree');
    }
  }

  /**
   * Save literature tree
   */
  async saveTree(tree: LiteratureTree): Promise<void> {
    try {
      await this.db.literatureTrees.put(tree);
    } catch (error) {
      console.error('Error saving literature tree:', error);
      throw new Error('Failed to save literature tree');
    }
  }

  /**
   * Delete literature tree
   */
  async deleteTree(id: string): Promise<void> {
    try {
      const count = await this.db.literatureTrees.where('id').equals(id).delete();
      if (count === 0) {
        throw new Error(`Literature tree with ID ${id} not found`);
      }
    } catch (error) {
      console.error('Error deleting literature tree:', error);
      throw new Error('Failed to delete literature tree');
    }
  }

  /**
   * Export library items as JSON
   */
  async exportLibraryAsJSON(): Promise<string> {
    try {
      const items = await this.getAllLibraryItems();
      return JSON.stringify(items, null, 2);
    } catch (error) {
      console.error('Error exporting library as JSON:', error);
      throw new Error('Failed to export library');
    }
  }

  /**
   * Import library items from JSON
   */
  async importLibraryFromJSON(jsonData: string): Promise<{ added: number; errors: string[] }> {
    const result = { added: 0, errors: [] as string[] };
    
    try {
      const items = JSON.parse(jsonData) as LibraryItem[];
      
      if (!Array.isArray(items)) {
        throw new Error('Invalid JSON format: expected array of items');
      }

      for (const item of items) {
        try {
          // Generate new ID to avoid conflicts
          const itemWithNewId: LibraryItem = {
            ...item,
            id: generateLibraryItemId(),
            createdAt: new Date(item.createdAt),
            updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined
          };

          await this.addLibraryItem(itemWithNewId);
          result.added++;
        } catch (error) {
          result.errors.push(`Failed to import item "${item.title}": ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Import failed: ${error}`);
    }

    return result;
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    totalItems: number;
    totalTrees: number;
    itemsBySource: Record<string, number>;
    itemsByYear: Record<number, number>;
  }> {
    try {
      const [items, trees] = await Promise.all([
        this.getAllLibraryItems(),
        this.getAllTrees()
      ]);

      const itemsBySource: Record<string, number> = {};
      const itemsByYear: Record<number, number> = {};

      items.forEach(item => {
        const source = item.source || 'unknown';
        itemsBySource[source] = (itemsBySource[source] || 0) + 1;
        
        itemsByYear[item.year] = (itemsByYear[item.year] || 0) + 1;
      });

      return {
        totalItems: items.length,
        totalTrees: trees.length,
        itemsBySource,
        itemsByYear
      };
    } catch (error) {
      console.error('Error getting statistics:', error);
      throw new Error('Failed to get statistics');
    }
  }

  /**
   * Clear all data (use with caution)
   */
  async clearAllData(): Promise<void> {
    try {
      await Promise.all([
        this.db.library.clear(),
        this.db.literatureTrees.clear()
      ]);
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw new Error('Failed to clear data');
    }
  }

  /**
   * Private method to create item record with validation and duplicate check
   */
  private async _createItemRecord(metadata: Partial<LibraryItem>): Promise<string> {
    try {
      // Generate ID if not provided
      const itemId = metadata.id || generateLibraryItemId();
      
      // Create complete item with defaults
      const item: LibraryItem = {
        id: itemId,
        title: metadata.title || '',
        authors: metadata.authors || [],
        year: metadata.year || new Date().getFullYear(),
        source: metadata.source,
        publication: metadata.publication,
        abstract: metadata.abstract,
        summary: metadata.summary,
        zoteroKey: metadata.zoteroKey,
        doi: metadata.doi,
        url: metadata.url,
        pdfPath: metadata.pdfPath,
        parsingStatus: metadata.parsingStatus || 'IDLE',
        createdAt: new Date(),
        updatedAt: metadata.updatedAt
      };

      // Validate the item
      const validatedItem = LibraryItemSchema.parse(item);
      
      // Check for duplicates if title is provided
      if (validatedItem.title) {
        const duplicates = await this.checkDuplicateByTitle(validatedItem.title);
        if (duplicates.length > 0) {
          throw new Error(`Duplicate item found: ${validatedItem.title}`);
        }
      }
      
      // Add to database
      await this.db.library.add(validatedItem);
      return itemId;
    } catch (error) {
      console.error('Error creating item record:', error);
      throw new Error('Failed to create item record');
    }
  }

  /**
   * Update parsing status for an item
   */
  async updateParsingStatus(itemId: string, status: ParsingStatus): Promise<void> {
    try {
      const existingItem = await this.getLibraryItemById(itemId);
      if (!existingItem) {
        throw new Error(`Library item with ID ${itemId} not found`);
      }

      await this.db.library.update(itemId, {
        parsingStatus: status,
        updatedAt: new Date()
      });
      
      console.log(`Updated parsing status for item ${itemId} to ${status}`);
    } catch (error) {
      console.error('Error updating parsing status:', error);
      throw new Error('Failed to update parsing status');
    }
  }

  /**
   * Link PDF data to an item (stores placeholder reference)
   */
  async linkPdfToItem(itemId: string, pdfData: Blob): Promise<void> {
    try {
      const existingItem = await this.getLibraryItemById(itemId);
      if (!existingItem) {
        throw new Error(`Library item with ID ${itemId} not found`);
      }

      // For now, just store a placeholder reference
      // TODO: Implement actual Blob storage in IndexedDB
      const pdfPath = `indexeddb_blob_ref_${itemId}`;
      
      await this.db.library.update(itemId, {
        pdfPath,
        updatedAt: new Date()
      });
      
      console.log(`Linked PDF to item ${itemId}, size: ${pdfData.size} bytes`);
    } catch (error) {
      console.error('Error linking PDF to item:', error);
      throw new Error('Failed to link PDF to item');
    }
  }

  /**
   * Private method to trigger background PDF processing
   */
  private async triggerBackgroundProcessing(itemId: string): Promise<void> {
    try {
      console.log(`Starting background processing for item ${itemId}`);
      
      // Get the item from database
      const item = await this.getLibraryItemById(itemId);
      if (!item) {
        throw new Error(`Item ${itemId} not found`);
      }

      // Try to fetch PDF using the PDF fetcher service
      const pdfBlob = await pdfFetcherService.fetch(item);
      
      if (pdfBlob) {
        // Successfully got PDF - save to disk and trigger Mineru processing
        const pdfPath = await this.savePdfToDisk(itemId, pdfBlob);
        
        // Update database with PDF path and set status to pending Mineru submission
        await this.db.library.update(itemId, {
          pdfPath,
          parsingStatus: 'PENDING_MINERU_SUBMISSION',
          updatedAt: new Date()
        });
        
        console.log(`Successfully fetched PDF for item ${itemId}, starting Mineru processing`);
        
        // Trigger Mineru processing asynchronously (non-blocking)
        void this.triggerMineruProcessing(itemId, pdfBlob);
      } else {
        // Failed to get PDF - set status to awaiting manual upload
        await this.updateParsingStatus(itemId, 'AWAITING_MANUAL_UPLOAD');
        console.log(`PDF fetch failed for item ${itemId}, awaiting manual upload`);
      }
    } catch (error) {
      console.error(`Background processing failed for item ${itemId}:`, error);
      try {
        // Set status to failed on any error
        await this.updateParsingStatus(itemId, 'FAILED');
      } catch (statusError) {
        console.error(`Failed to update status to FAILED for item ${itemId}:`, statusError);
      }
    }
  }

  /**
   * 🎯 手动添加文献 - 智能路由到不同处理流程
   * 
   * 📝 使用场景: AddLiteratureForm 手动创建文献
   * 
   * 🧠 智能逻辑:
   * - 有DOI/URL → 直接提交Mineru解析PDF
   * - 没有DOI/URL → 等待手动上传PDF
   * - 不会卡在"fetching"状态
   */
  async createFromMetadata(metadata: Partial<LibraryItem>): Promise<string> {
    try {
      const hasSource = Boolean(metadata.doi || metadata.url);
      
      // 智能设置初始状态
      const initialStatus = hasSource ? 'PENDING_MINERU_SUBMISSION' : 'AWAITING_MANUAL_UPLOAD';
      
      const itemId = await this._createItemRecord({
        ...metadata,
        parsingStatus: initialStatus
      });
      
      if (hasSource) {
        // 有DOI/URL，直接尝试Mineru处理
        console.log(`Created item ${itemId} with source (${metadata.doi || metadata.url}), starting direct Mineru processing`);
        void this.triggerDirectMineruProcessing(itemId);
      } else {
        // 没有源，等待手动上传
        console.log(`Created item ${itemId} without source, awaiting manual PDF upload`);
      }
      
      return itemId;
    } catch (error) {
      console.error('Error creating item from metadata:', error);
      throw new Error('Failed to create item from metadata');
    }
  }

  /**
   * 🔍 外部搜索结果导入 - 需要PDF抓取的场景
   * 
   * 📝 使用场景: Tavily搜索、文献推荐等外部来源
   * 
   * 🔄 处理流程:
   * 1. 尝试从DOI/URL抓取PDF
   * 2. 成功 → Mineru解析
   * 3. 失败 → 等待手动上传
   */
  async createFromSearchResult(metadata: Partial<LibraryItem>): Promise<string> {
    try {
      const itemId = await this._createItemRecord({
        ...metadata,
        parsingStatus: 'PENDING_PDF_FETCH'
      });
      
      // 触发PDF抓取流程
      void this.triggerBackgroundProcessing(itemId);
      
      console.log(`Created item ${itemId} from search result, starting PDF fetch process`);
      return itemId;
    } catch (error) {
      console.error('Error creating item from search result:', error);
      throw new Error('Failed to create item from search result');
    }
  }

  /**
   * 🚀 直接Mineru处理 - 从DOI/URL获取PDF并立即解析
   * 
   * 📝 使用场景: 手动添加有DOI/URL的文献
   * 
   * 🔄 处理流程:
   * 1. 从DOI/URL获取PDF内容
   * 2. 保存PDF并更新状态
   * 3. 提交Mineru解析处理
   * 4. 失败时设置为等待手动上传
   */
  private async triggerDirectMineruProcessing(itemId: string): Promise<void> {
    try {
      console.log(`Starting direct Mineru processing for item ${itemId}`);
      
      // Get the item from database
      const item = await this.getLibraryItemById(itemId);
      if (!item) {
        throw new Error(`Item ${itemId} not found`);
      }

      // Try to get PDF from DOI/URL using the fetcher service
      const pdfBlob = await pdfFetcherService.fetch(item);
      
      if (pdfBlob) {
        // Successfully got PDF - save and process with Mineru
        const pdfPath = await this.savePdfToDisk(itemId, pdfBlob);
        
        // Update database with PDF path and set status to pending Mineru submission
        await this.db.library.update(itemId, {
          pdfPath,
          parsingStatus: 'PENDING_MINERU_SUBMISSION',
          updatedAt: new Date()
        });
        
        console.log(`Successfully got PDF for item ${itemId}, submitting to Mineru`);
        
        // Process with Mineru asynchronously (non-blocking)
        void this.triggerMineruProcessing(itemId, pdfBlob);
      } else {
        // Failed to get PDF - set status to awaiting manual upload
        await this.updateParsingStatus(itemId, 'AWAITING_MANUAL_UPLOAD');
        console.log(`Failed to get PDF for item ${itemId}, awaiting manual upload`);
      }
    } catch (error) {
      console.error(`Direct Mineru processing failed for item ${itemId}:`, error);
      try {
        // Set status to awaiting manual upload on any error
        await this.updateParsingStatus(itemId, 'AWAITING_MANUAL_UPLOAD');
      } catch (statusError) {
        console.error(`Failed to update status for item ${itemId}:`, statusError);
      }
    }
  }

  /**
   * 🔄 PDF抓取 + Mineru处理 - 完整的后台处理流程
   * 
   * 📝 使用场景: 外部搜索结果导入 (Tavily等)
   * 
   * 🔄 处理流程:
   * 1. 尝试抓取PDF
   * 2. 成功 → 保存并提交Mineru
   * 3. 失败 → 等待手动上传
   */
  private async triggerBackgroundProcessing(itemId: string): Promise<void> {
    try {
      console.log(`Starting background processing for item ${itemId}`);
      
      // Get the item from database
      const item = await this.getLibraryItemById(itemId);
      if (!item) {
        throw new Error(`Item ${itemId} not found`);
      }

      // Try to fetch PDF using the PDF fetcher service
      const pdfBlob = await pdfFetcherService.fetch(item);
      
      if (pdfBlob) {
        // Successfully got PDF - save to disk and trigger Mineru processing
        const pdfPath = await this.savePdfToDisk(itemId, pdfBlob);
        
        // Update database with PDF path and set status to pending Mineru submission
        await this.db.library.update(itemId, {
          pdfPath,
          parsingStatus: 'PENDING_MINERU_SUBMISSION',
          updatedAt: new Date()
        });
        
        console.log(`Successfully fetched PDF for item ${itemId}, starting Mineru processing`);
        
        // Trigger Mineru processing asynchronously (non-blocking)
        void this.triggerMineruProcessing(itemId, pdfBlob);
      } else {
        // Failed to get PDF - set status to awaiting manual upload
        await this.updateParsingStatus(itemId, 'AWAITING_MANUAL_UPLOAD');
        console.log(`PDF fetch failed for item ${itemId}, awaiting manual upload`);
      }
    } catch (error) {
      console.error(`Background processing failed for item ${itemId}:`, error);
      try {
        // Set status to failed on any error
        await this.updateParsingStatus(itemId, 'FAILED');
      } catch (statusError) {
        console.error(`Failed to update status to FAILED for item ${itemId}:`, statusError);
      }
    }
  }

  /**
   * ⚙️ Mineru处理核心逻辑
   * 
   * 📝 使用场景: 当已经有PDF Blob时的Mineru处理
   * 
   * 🔄 处理流程:
   * 1. 提交任务到Mineru
   * 2. 轮询处理结果
   * 3. 提取引用关系
   * 4. 更新状态为成功
   */
  private async triggerMineruProcessing(itemId: string, pdfBlob: Blob): Promise<void> {
    try {
      console.log(`Starting Mineru processing for item ${itemId}`);
      
      // Get the item from database
      const item = await this.getLibraryItemById(itemId);
      if (!item) {
        throw new Error(`Item ${itemId} not found`);
      }

      // Submit task to Mineru
      const taskId = await mineruService.submitTaskFromFile(item, pdfBlob);
      
      // Update database with Mineru task ID and set status to parsing in Mineru
      await this.db.library.update(itemId, {
        mineruTaskId: taskId,
        parsingStatus: 'PARSING_IN_MINERU',
        updatedAt: new Date()
      });
      
      console.log(`Mineru task submitted for item ${itemId}, task_id: ${taskId}`);
      
      // Wait for Mineru processing to complete
      const parsedData = await mineruService.pollTaskResult(taskId);
      
      // Process the parsed data and extract citations
      await this.linkCitations(itemId, parsedData.references || []);
      
      // Update status to success
      await this.updateParsingStatus(itemId, 'SUCCESS');
      
      console.log(`Mineru processing completed successfully for item ${itemId}`);
      
    } catch (error) {
      console.error(`Mineru processing failed for item ${itemId}:`, error);
      try {
        // Set status to parsing failed on any error
        await this.updateParsingStatus(itemId, 'PARSING_FAILED');
      } catch (statusError) {
        console.error(`Failed to update status to PARSING_FAILED for item ${itemId}:`, statusError);
      }
    }
  }

  /**
   * 💾 保存PDF到磁盘 - PDF文件存储核心逻辑
   * 
   * 📝 使用场景: 
   * - PDF抓取成功后的存储
   * - 用户上传PDF后的存储
   * - Mineru处理前的文件准备
   * 
   * 🔄 处理流程:
   * 1. 生成唯一的PDF文件路径
   * 2. 将Blob数据写入到指定位置
   * 3. 返回可访问的文件路径
   * 
   * 💡 实现考虑:
   * - 文件命名规则: pdfs/{itemId}.pdf
   * - 存储位置: 本地文件系统 或 云存储
   * - 安全性: 防止路径遍历攻击
   * - 容错性: 存储失败时的处理
   * 
   * 🚧 TODO: 实现实际的文件存储逻辑
   * - 本地存储: 使用Node.js fs模块
   * - 云存储: 集成AWS S3/Azure Blob/Google Cloud Storage
   * - 权限控制: 确保PDF文件访问权限
   */
  private async savePdfToDisk(itemId: string, pdfBlob: Blob): Promise<string> {
    // 生成PDF存储路径
    const pdfPath = `pdfs/${itemId}.pdf`;
    
    console.log(`Saving PDF for item ${itemId}, size: ${pdfBlob.size} bytes`);
    
    // TODO: 实现实际的文件存储逻辑
    // 在真实实现中，您需要:
    // 1. 创建pdfs目录（如果不存在）
    // 2. 将blob数据写入到文件系统
    // 3. 处理存储错误和异常
    // 4. 返回可访问的文件路径或URL
    
    // 示例实现（需要在服务端环境中使用）:
    // const fs = require('fs').promises;
    // const path = require('path');
    // const fullPath = path.join(process.cwd(), 'storage', pdfPath);
    // await fs.mkdir(path.dirname(fullPath), { recursive: true });
    // const buffer = await pdfBlob.arrayBuffer();
    // await fs.writeFile(fullPath, Buffer.from(buffer));
    
    return pdfPath;
  }

  /**
   * 📄 PDF文件上传创建 - 从PDF文件创建新文献条目
   * 
   * 📝 使用场景: 拖拽上传PDF文件、批量PDF导入
   * 
   * 🔄 处理流程:
   * 1. 使用PDF文件名作为标题创建基本条目
   * 2. 保存PDF文件到磁盘
   * 3. 直接提交Mineru解析提取元数据
   * 4. 后期元数据会自动更新到条目中
   * 
   * 💡 智能特性:
   * - 自动从PDF文件名生成标题
   * - 设置作者为"Unknown"等待元数据提取
   * - 跳过PDF抓取阶段，直接处理
   */
  async createFromPdfUpload(pdfFile: File): Promise<string> {
    try {
      // Create basic item record with PDF file name as title
      const itemId = await this._createItemRecord({
        title: pdfFile.name.replace(/\.pdf$/i, ''),
        authors: ['Unknown'],
        year: new Date().getFullYear(),
        parsingStatus: 'PENDING_MINERU_SUBMISSION',
        source: 'MANUAL'
      });
      
      // Convert File to Blob for processing
      const pdfBlob = new Blob([await pdfFile.arrayBuffer()], { type: 'application/pdf' });
      
      // Save PDF and update path
      const pdfPath = await this.savePdfToDisk(itemId, pdfBlob);
      await this.db.library.update(itemId, {
        pdfPath,
        updatedAt: new Date()
      });
      
      console.log(`Created item ${itemId} from PDF upload, starting Mineru processing`);
      
      // Trigger Mineru processing asynchronously (non-blocking)
      void this.triggerMineruProcessing(itemId, pdfBlob);
      
      return itemId;
    } catch (error) {
      console.error('Error creating item from PDF upload:', error);
      throw new Error('Failed to create item from PDF upload');
    }
  }

  /**
   * 📤 为现有条目上传PDF - 完成手动上传流程
   * 
   * 📝 使用场景: 
   * - 状态为"AWAITING_MANUAL_UPLOAD"的条目
   * - 用户通过上传按钮手动添加PDF
   * - 从文献详情页面上传PDF
   * 
   * 🔄 处理流程:
   * 1. 验证条目存在性
   * 2. 保存PDF文件到磁盘
   * 3. 更新条目PDF路径
   * 4. 状态变更为"PENDING_MINERU_SUBMISSION"
   * 5. 触发Mineru解析处理
   * 
   * 🎯 状态转换: AWAITING_MANUAL_UPLOAD → PENDING_MINERU_SUBMISSION → PARSING_IN_MINERU → SUCCESS
   */
  async uploadPdfForExistingItem(itemId: string, pdfFile: File): Promise<void> {
    try {
      const existingItem = await this.getLibraryItemById(itemId);
      if (!existingItem) {
        throw new Error(`Library item with ID ${itemId} not found`);
      }

      // Convert File to Blob for processing
      const pdfBlob = new Blob([await pdfFile.arrayBuffer()], { type: 'application/pdf' });
      
      // Save PDF and update item
      const pdfPath = await this.savePdfToDisk(itemId, pdfBlob);
      await this.db.library.update(itemId, {
        pdfPath,
        parsingStatus: 'PENDING_MINERU_SUBMISSION',
        updatedAt: new Date()
      });
      
      console.log(`Uploaded PDF for existing item ${itemId}, starting Mineru processing`);
      
      // Trigger Mineru processing asynchronously (non-blocking)
      void this.triggerMineruProcessing(itemId, pdfBlob);
      
    } catch (error) {
      console.error('Error uploading PDF for existing item:', error);
      throw new Error('Failed to upload PDF for existing item');
    }
  }

  /**
   * Get citation relationships for an item
   */
  async getCitationRelationships(itemId: string): Promise<{
    references: LibraryItem[];
    citedBy: LibraryItem[];
  }> {
    try {
      // Get references (items this item cites)
      const referenceCitations = await this.db.citations
        .where('sourceItemId')
        .equals(itemId)
        .toArray();
      
      const references = await Promise.all(
        referenceCitations.map(citation => this.db.library.get(citation.targetItemId))
      );
      
      // Get cited by (items that cite this item)
      const citedByCitations = await this.db.citations
        .where('targetItemId')
        .equals(itemId)
        .toArray();
      
      const citedBy = await Promise.all(
        citedByCitations.map(citation => this.db.library.get(citation.sourceItemId))
      );
      
      return {
        references: references.filter(Boolean) as LibraryItem[],
        citedBy: citedBy.filter(Boolean) as LibraryItem[]
      };
    } catch (error) {
      console.error('Error getting citation relationships:', error);
      throw new Error('Failed to get citation relationships');
    }
  }

  /**
   * 🔗 链接引用关系 - 处理Mineru解析出的引用数据
   * 
   * 📝 使用场景:
   * - Mineru解析PDF完成后的引用处理
   * - 建立文献间的引用关系网络
   * - 为引用推荐和关联发现提供数据
   * 
   * 🔄 处理流程:
   * 1. 解析Mineru返回的引用数据
   * 2. 通过标题/DOI匹配现有文献
   * 3. 创建引用关系记录
   * 4. 建立双向引用链接
   * 
   * 💡 智能匹配策略:
   * - 精确匹配: DOI、标题完全匹配
   * - 模糊匹配: 标题相似度匹配
   * - 作者匹配: 第一作者姓名匹配
   * - 年份匹配: 出版年份辅助验证
   * 
   * 🚧 TODO: 实现引用链接逻辑
   * - 引用数据标准化处理
   * - 智能文献匹配算法
   * - 引用关系数据库操作
   * - 引用网络图谱构建
   */
  private async linkCitations(itemId: string, references: any[]): Promise<void> {
    try {
      console.log(`Linking ${references.length} citations for item ${itemId}`);
      
      // TODO: 实现引用处理逻辑
      // 典型的实现流程包括:
      // 1. 标准化引用数据格式
      // 2. 提取关键信息(标题、作者、年份、DOI)
      // 3. 在现有文献库中搜索匹配项
      // 4. 创建引用关系记录
      // 5. 更新引用计数和关联度
      
      for (const reference of references) {
        // 处理每个引用记录
        // const citationRecord = await this.processCitationReference(itemId, reference);
        // if (citationRecord) {
        //   await this.createCitationRecord(itemId, citationRecord);
        // }
      }
      
      console.log(`Successfully linked citations for item ${itemId}`);
    } catch (error) {
      console.error(`Error linking citations for item ${itemId}:`, error);
      // 不在这里抛出异常，因为引用链接不是主要工作流的关键步骤
    }
  }
}

// Export singleton instance
export const libraryService = new LibraryService();