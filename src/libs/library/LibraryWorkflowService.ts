/**
 * 📚 LibraryWorkflowService - 文献管理工作流服务 (业务流程层)
 * 
 * 🎯 核心职责 (Orchestrator):
 * - 作为业务流程的总指挥，编排其他底层服务完成复杂的文献入库和管理任务。
 * - 管理文献在整个生命周期中的状态流转 (e.g., PENDING -> PARSING -> SUCCESS/FAILED)。
 * 
 * 🔄 典型工作流程 (例如: 从PDF上传):
 * 1. 调用 `db.LibraryService` 创建初始记录。
 * 2. 调用具体的解析服务 (如 `parsing.MineruService`) 提交PDF并获取原始解析结果。
 * 3. 将原始结果传递给 `parsing.ParsingService`，使用规则进行结构化映射，得到标准元数据。
 * 4. 调用 `db.LibraryService` 将提取出的元数据和最终状态更新回数据库。
 * 
 * ❌ 不负责:
 * - 直接的数据库操作 (委托给 `db.LibraryService`)。
 * - 解析和映射的具体实现 (委托给 `parsing` 目录下的服务)。
 * - 文件抓取的具体实现 (委托给 `fetching` 目录下的服务)。
 * 
 * ➡️ 这是一个高阶服务，专注于 "做什么" 和 "按什么顺序做"，连接着具体实现和最终业务目标。
 */

import { LibraryItem } from '../db';
import { libraryService } from '../db/LibraryService';
import { parsingService } from '../parsing/ParsingService';
import { mineruService } from '../parsing/MineruService';
import { pdfFetcherService } from '../fetching';
import { MINERU_EXTRACTION_RULES } from '../parsing/extractionRules';
import { generateLibraryItemId } from '../utils/uuid';

export class LibraryWorkflowService {
    /**
     * 📄 PDF文件上传创建 - 从PDF文件创建新文献条目
     * 
     * 📝 使用场景: 拖拽上传PDF文件、批量PDF导入
     * 
     * 🔄 处理流程:
     * 1. 使用PDF文件名作为标题创建基本条目
     * 2. 直接提交Mineru解析提取元数据
     * 3. 后期元数据会自动更新到条目中
     */
    async createFromPdfUpload(pdfFile: File): Promise<string> {
        try {
            // 生成唯一标题
            const baseTitle = pdfFile.name.replace(/\.pdf$/i, '');
            const uniqueTitle = await this.generateUniqueTitle(baseTitle);

            // 创建初始条目
            const itemId = generateLibraryItemId();
            const initialItem: LibraryItem = {
                id: itemId,
                title: uniqueTitle,
                authors: ['Unknown'],
                year: new Date().getFullYear(),
                source: 'manual',
                parsingStatus: 'PENDING_MINERU_SUBMISSION',
                createdAt: new Date()
            };

            // 保存到数据库
            const addResult = await libraryService.addLibraryItem(initialItem);
            if (!addResult.success) {
                throw new Error('Failed to create initial item record');
            }

            console.log(`Created item ${itemId} from PDF upload, starting processing`);

            // 转换为Blob进行处理
            const pdfBlob = new Blob([await pdfFile.arrayBuffer()], { type: 'application/pdf' });

            // 异步处理PDF（不阻塞返回）
            this.processPdfWithMineru(itemId, pdfBlob).catch(error => {
                console.error(`Background PDF processing failed for item ${itemId}:`, error);
            });

            return itemId;
        } catch (error) {
            console.error('Error creating item from PDF upload:', error);
            throw new Error('Failed to create item from PDF upload');
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
     */
    async createFromMetadata(metadata: Partial<LibraryItem>): Promise<string> {
        try {
            const hasSource = Boolean(metadata.doi || metadata.url);
            const itemId = generateLibraryItemId();

            // 智能设置初始状态
            const initialStatus = hasSource ? 'PENDING_MINERU_SUBMISSION' : 'AWAITING_MANUAL_UPLOAD';

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
                parsingStatus: initialStatus,
                createdAt: new Date(),
                updatedAt: metadata.updatedAt
            };

            // 保存到数据库
            const addResult = await libraryService.addLibraryItem(item);
            if (!addResult.success) {
                if (addResult.duplicate) {
                    throw new Error(`Duplicate item found: ${addResult.duplicate[0].title}`);
                }
                throw new Error('Failed to create item record');
            }

            if (hasSource) {
                // 有DOI/URL，直接尝试Mineru处理
                console.log(`Created item ${itemId} with source, starting direct processing`);
                this.processItemWithSource(itemId).catch(error => {
                    console.error(`Background processing failed for item ${itemId}:`, error);
                });
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
            const itemId = generateLibraryItemId();

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
                parsingStatus: 'PENDING_PDF_FETCH',
                createdAt: new Date(),
                updatedAt: metadata.updatedAt
            };

            // 保存到数据库
            const addResult = await libraryService.addLibraryItem(item);
            if (!addResult.success) {
                if (addResult.duplicate) {
                    throw new Error(`Duplicate item found: ${addResult.duplicate[0].title}`);
                }
                throw new Error('Failed to create item record');
            }

            console.log(`Created item ${itemId} from search result, starting PDF fetch process`);

            // 触发PDF抓取流程
            this.fetchAndProcessPdf(itemId).catch(error => {
                console.error(`Background PDF fetch failed for item ${itemId}:`, error);
            });

            return itemId;
        } catch (error) {
            console.error('Error creating item from search result:', error);
            throw new Error('Failed to create item from search result');
        }
    }

    /**
     * 📤 为现有条目上传PDF - 完成手动上传流程
     * 
     * 📝 使用场景: 
     * - 状态为"AWAITING_MANUAL_UPLOAD"的条目
     * - 用户通过上传按钮手动添加PDF
     */
    async uploadPdfForExistingItem(itemId: string, pdfFile: File): Promise<void> {
        try {
            const existingItem = await libraryService.getLibraryItemById(itemId);
            if (!existingItem) {
                throw new Error(`Library item with ID ${itemId} not found`);
            }

            // 更新状态为解析中
            await libraryService.updateLibraryItem(itemId, {
                parsingStatus: 'PENDING_MINERU_SUBMISSION'
            });

            // 转换为Blob进行处理
            const pdfBlob = new Blob([await pdfFile.arrayBuffer()], { type: 'application/pdf' });

            console.log(`Uploaded PDF for existing item ${itemId}, starting processing`);

            // 异步处理PDF
            this.processPdfWithMineru(itemId, pdfBlob).catch(error => {
                console.error(`Background PDF processing failed for item ${itemId}:`, error);
            });

        } catch (error) {
            console.error('Error uploading PDF for existing item:', error);
            throw new Error('Failed to upload PDF for existing item');
        }
    }

    /**
     * 🔄 处理有源文献 - 从DOI/URL获取PDF并解析
     */
    private async processItemWithSource(itemId: string): Promise<void> {
        try {
            const item = await libraryService.getLibraryItemById(itemId);
            if (!item) {
                throw new Error(`Item ${itemId} not found`);
            }

            // 尝试从DOI/URL获取PDF
            const pdfBlob = await pdfFetcherService.fetch(item);

            if (pdfBlob) {
                // 成功获取PDF，进行解析
                console.log(`Successfully fetched PDF for item ${itemId}, starting processing`);
                await this.processPdfWithMineru(itemId, pdfBlob);
            } else {
                // 获取PDF失败，等待手动上传
                await libraryService.updateLibraryItem(itemId, {
                    parsingStatus: 'AWAITING_MANUAL_UPLOAD'
                });
                console.log(`Failed to fetch PDF for item ${itemId}, awaiting manual upload`);
            }
        } catch (error) {
            console.error(`Processing with source failed for item ${itemId}:`, error);
            await libraryService.updateLibraryItem(itemId, {
                parsingStatus: 'AWAITING_MANUAL_UPLOAD'
            });
        }
    }

    /**
     * 🔄 抓取并处理PDF - 完整的抓取+解析流程
     */
    private async fetchAndProcessPdf(itemId: string): Promise<void> {
        try {
            const item = await libraryService.getLibraryItemById(itemId);
            if (!item) {
                throw new Error(`Item ${itemId} not found`);
            }

            // 尝试抓取PDF
            const pdfBlob = await pdfFetcherService.fetch(item);

            if (pdfBlob) {
                // 成功抓取PDF，开始解析
                console.log(`Successfully fetched PDF for item ${itemId}, starting processing`);
                await this.processPdfWithMineru(itemId, pdfBlob);
            } else {
                // 抓取失败，等待手动上传
                await libraryService.updateLibraryItem(itemId, {
                    parsingStatus: 'AWAITING_MANUAL_UPLOAD'
                });
                console.log(`PDF fetch failed for item ${itemId}, awaiting manual upload`);
            }
        } catch (error) {
            console.error(`PDF fetch and process failed for item ${itemId}:`, error);
            await libraryService.updateLibraryItem(itemId, {
                parsingStatus: 'FAILED'
            });
        }
    }

    /**
     * ⚙️ 使用Mineru处理PDF - 核心解析流程
     */
    private async processPdfWithMineru(itemId: string, pdfBlob: Blob): Promise<void> {
        try {
            const item = await libraryService.getLibraryItemById(itemId);
            if (!item) {
                throw new Error(`Item ${itemId} not found`);
            }

            // 更新状态为解析中
            await libraryService.updateLibraryItem(itemId, {
                parsingStatus: 'PARSING_IN_MINERU'
            });

            // 提交任务到Mineru
            const batchId = await mineruService.submitTaskFromFile(item, pdfBlob);
            console.log(`Mineru task submitted for item ${itemId}, batch_id: ${batchId}`);

            // 轮询解析结果
            const parsedMdData = await mineruService.pollTaskResult(batchId, (progress) => {
                // 这里可以添加进度更新逻辑
                console.log(`Progress for ${itemId}: ${progress.extractedPages}/${progress.totalPages}`);
            });

            // 使用ParsingService进行结构化映射
            const extractedMetadata = parsingService.extractMetadata(parsedMdData, MINERU_EXTRACTION_RULES);
            const parsedContent = parsingService.createParsedContent(parsedMdData);

            // 更新数据库
            await libraryService.updateLibraryItem(itemId, {
                ...extractedMetadata,
                parsedContent: parsedContent,
                parsingStatus: 'SUCCESS'
            });

            console.log(`Successfully processed item ${itemId} with Mineru`);

        } catch (error) {
            console.error(`Mineru processing failed for item ${itemId}:`, error);
            await libraryService.updateLibraryItem(itemId, {
                parsingStatus: 'PARSING_FAILED'
            });
        }
    }

    /**
     * 🔤 生成唯一标题 - 避免重复文献标题冲突
     */
    private async generateUniqueTitle(baseTitle: string): Promise<string> {
        try {
            // 检查基础标题是否已存在
            const duplicates = await libraryService.checkDuplicateByTitle(baseTitle);

            if (duplicates.length === 0) {
                return baseTitle;
            }

            // 添加数字后缀生成唯一标题
            let counter = 2;
            let uniqueTitle = `${baseTitle} (${counter})`;

            while (true) {
                const duplicatesWithSuffix = await libraryService.checkDuplicateByTitle(uniqueTitle);
                if (duplicatesWithSuffix.length === 0) {
                    return uniqueTitle;
                }
                counter++;
                uniqueTitle = `${baseTitle} (${counter})`;

                // 防止无限循环
                if (counter > 100) {
                    throw new Error('Could not generate unique title after 100 attempts');
                }
            }
        } catch (error) {
            console.error('Error generating unique title:', error);
            // 回退：使用时间戳后缀
            return `${baseTitle}_${Date.now()}`;
        }
    }
}

export const libraryWorkflowService = new LibraryWorkflowService(); 