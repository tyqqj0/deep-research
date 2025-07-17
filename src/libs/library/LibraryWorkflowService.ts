/**
 * 📚 LibraryWorkflowService v2.0 - 后端集成版文献管理工作流服务
 * 
 * 🎯 核心职责 (重构版):
 * - 智能路由：根据文献来源选择最佳处理方式（Zotero vs 后端）
 * - 后端集成：将大部分解析工作委托给后端服务
 * - Zotero增强：保持Zotero PDF获取的独特优势
 * - 状态管理：简化的状态流转和进度跟踪
 * 
 * 🔄 新的工作流程:
 * 1. 智能判断文献类型（Zotero文献 vs 普通文献）
 * 2. Zotero文献：前端获取PDF → 后端解析
 * 3. 普通文献：直接后端处理
 * 4. 统一的状态同步和进度显示
 * 
 * ✅ 保留功能:
 * - Zotero PDF获取能力
 * - 本地数据库管理
 * - 实时状态更新
 * 
 * 🗑️ 移除功能:
 * - 前端Mineru集成
 * - 前端LLM解析
 * - 复杂的解析状态管理
 */

import { LibraryItem, LITERATURE_SOURCES } from '../db';
import { libraryService } from '../db/LibraryService';
import { generateLibraryItemId } from '../utils/uuid';
import { backendLiteratureService, syncService } from '../backend';
import { zoteroService } from '../zotero/ZoteroService';
import { pdfFetcherService } from '../fetching';

export class LibraryWorkflowService {
    /**
     * 📄 PDF文件上传创建 - 简化版后端处理
     * 
     * 📝 使用场景: 拖拽上传PDF文件、批量PDF导入
     * 
     * 🔄 新流程:
     * 1. 创建本地记录
     * 2. 提交PDF到后端处理
     * 3. 开始状态同步
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
                source: LITERATURE_SOURCES.IMPORT,
                parsingStatus: 'PENDING',
                createdAt: new Date()
            };

            // 保存到数据库
            const addResult = await libraryService.addLibraryItem(initialItem);
            if (!addResult.success) {
                throw new Error('Failed to create initial item record');
            }

            console.log(`[WorkflowService] Created item ${itemId} from PDF upload, submitting to backend`);

            // 🚀 新逻辑：直接提交到后端处理
            this.processPdfWithBackend(itemId, pdfFile).catch(error => {
                console.error(`[WorkflowService] Background PDF processing failed for item ${itemId}:`, error);
            });

            return itemId;
        } catch (error) {
            console.error('[WorkflowService] Error creating item from PDF upload:', error);
            throw new Error('Failed to create item from PDF upload');
        }
    }

    /**
     * 🎯 手动添加文献 - 智能路由版
     * 
     * 📝 使用场景: AddLiteratureForm 手动创建文献
     * 
     * 🧠 智能逻辑:
     * - 有zoteroKey → Zotero处理流程
     * - 有DOI/URL → 后端处理流程
     * - 都没有 → 等待手动上传
     */
    async createFromMetadata(metadata: Partial<LibraryItem>): Promise<string> {
        try {
            const itemId = generateLibraryItemId();

            // 🔍 智能判断处理方式
            const isZoteroItem = Boolean(metadata.zoteroKey);
            const hasSource = Boolean(metadata.doi || metadata.url);
            
            let initialStatus: LibraryItem['parsingStatus'];
            if (isZoteroItem) {
                initialStatus = 'PENDING_PDF_FETCH'; // Zotero需要先获取PDF
            } else if (hasSource) {
                initialStatus = 'PENDING'; // 有源信息，可以后端处理
            } else {
                initialStatus = 'AWAITING_MANUAL_UPLOAD'; // 需要手动上传
            }

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

            // 🚀 根据类型启动相应的处理流程
            if (isZoteroItem) {
                console.log(`[WorkflowService] Created Zotero item ${itemId}, starting Zotero processing`);
                this.processZoteroItem(itemId).catch(error => {
                    console.error(`[WorkflowService] Zotero processing failed for item ${itemId}:`, error);
                });
            } else if (hasSource) {
                console.log(`[WorkflowService] Created item ${itemId} with source, starting backend processing`);
                this.processWithBackend(itemId).catch(error => {
                    console.error(`[WorkflowService] Backend processing failed for item ${itemId}:`, error);
                });
            } else {
                console.log(`[WorkflowService] Created item ${itemId} without source, awaiting manual upload`);
            }

            return itemId;
        } catch (error) {
            console.error('[WorkflowService] Error creating item from metadata:', error);
            throw new Error('Failed to create item from metadata');
        }
    }

    /**
     * 📤 为现有条目上传PDF - 后端处理版
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

            // 更新状态为处理中
            await libraryService.updateLibraryItem(itemId, {
                parsingStatus: 'PENDING'
            });

            console.log(`[WorkflowService] Uploaded PDF for existing item ${itemId}, starting backend processing`);

            // 🚀 提交到后端处理
            await this.processPdfWithBackend(itemId, pdfFile);

        } catch (error) {
            console.error('[WorkflowService] Error uploading PDF for existing item:', error);
            throw new Error('Failed to upload PDF for existing item');
        }
    }

    /**
     * 🔄 Zotero文献处理流程 - 混合处理模式
     * 
     * 🎯 策略: 前端获取PDF → 后端解析
     */
    private async processZoteroItem(itemId: string): Promise<void> {
        try {
            const item = await libraryService.getLibraryItemById(itemId);
            if (!item || !item.zoteroKey) {
                throw new Error(`Zotero item ${itemId} not found or missing zoteroKey`);
            }

            console.log(`[WorkflowService] Processing Zotero item ${itemId} with key: ${item.zoteroKey}`);

            // 🚀 尝试从Zotero获取PDF
            if (zoteroService.isConfigured()) {
                const pdfBlob = await zoteroService.getPdfAttachment(item.zoteroKey);
                
                if (pdfBlob) {
                    console.log(`[WorkflowService] Successfully got PDF from Zotero for item ${itemId}`);
                    // 有PDF，提交到后端解析
                    await this.processPdfWithBackend(itemId, pdfBlob);
                    return;
                }
            }

            // 🔄 没有PDF，尝试其他方式获取
            console.log(`[WorkflowService] No PDF from Zotero, trying other methods for item ${itemId}`);
            const pdfBlob = await pdfFetcherService.fetch(item);
            
            if (pdfBlob) {
                console.log(`[WorkflowService] Successfully fetched PDF for Zotero item ${itemId}`);
                await this.processPdfWithBackend(itemId, pdfBlob);
            } else {
                // 获取失败，等待手动上传
                await libraryService.updateLibraryItem(itemId, {
                    parsingStatus: 'AWAITING_MANUAL_UPLOAD'
                });
                console.log(`[WorkflowService] Failed to get PDF for Zotero item ${itemId}, awaiting manual upload`);
            }

        } catch (error) {
            console.error(`[WorkflowService] Zotero processing failed for item ${itemId}:`, error);
            await libraryService.updateLibraryItem(itemId, {
                parsingStatus: 'FAILED'
            });
        }
    }

    /**
     * 🌐 后端处理流程 - 纯后端模式
     * 
     * 🎯 策略: 直接提交DOI/URL到后端
     */
    private async processWithBackend(itemId: string): Promise<void> {
        try {
            const item = await libraryService.getLibraryItemById(itemId);
            if (!item) {
                throw new Error(`Item ${itemId} not found`);
            }

            console.log(`[WorkflowService] Processing item ${itemId} with backend`);

            // 准备提交数据
            const source: any = {};
            if (item.doi) source.doi = item.doi;
            if (item.url) source.url = item.url;

            if (!source.doi && !source.url) {
                throw new Error('No DOI or URL available for backend processing');
            }

            // 🚀 提交到后端
            const response = await backendLiteratureService.submitLiterature({ source });
            
            // 更新本地记录
            await libraryService.updateLibraryItem(itemId, {
                parsingStatus: 'PROCESSING',
                backendTaskId: response.taskId
            });

            // 🔄 开始状态同步
            syncService.startPolling(
                response.taskId,
                itemId,
                (progress) => {
                    console.log(`[WorkflowService] Progress for ${itemId}:`, progress.overall_status);
                },
                (error) => {
                    console.error(`[WorkflowService] Error for ${itemId}:`, error.message);
                }
            );

            console.log(`[WorkflowService] Started backend processing for item ${itemId}, taskId: ${response.taskId}`);

        } catch (error) {
            console.error(`[WorkflowService] Backend processing failed for item ${itemId}:`, error);
            await libraryService.updateLibraryItem(itemId, {
                parsingStatus: 'FAILED'
            });
        }
    }

    /**
     * 📄 PDF文件后端处理 - 统一的PDF处理入口
     *
     * 🎯 用于: PDF上传、Zotero PDF、手动上传PDF
     */
    private async processPdfWithBackend(itemId: string, pdfFile: File | Blob): Promise<void> {
        try {
            console.log(`[WorkflowService] Processing PDF with backend for item ${itemId}`);

            // 获取文献信息用于元数据
            const item = await libraryService.getLibraryItemById(itemId);
            const metadata = item ? {
                title: item.title,
                authors: item.authors
            } : undefined;

            // 更新状态为处理中
            await libraryService.updateLibraryItem(itemId, {
                parsingStatus: 'PROCESSING'
            });

            // 🚀 提交PDF到后端
            const response = await backendLiteratureService.submitPdfFile(pdfFile, metadata);

            // 更新本地记录
            await libraryService.updateLibraryItem(itemId, {
                parsingStatus: 'PROCESSING',
                backendTaskId: response.taskId
            });

            // 🔄 开始状态同步
            syncService.startPolling(
                response.taskId,
                itemId,
                (progress) => {
                    console.log(`[WorkflowService] PDF Progress for ${itemId}:`, progress.overall_status);
                },
                (error) => {
                    console.error(`[WorkflowService] PDF Error for ${itemId}:`, error.message);
                }
            );

            console.log(`[WorkflowService] Started PDF backend processing for item ${itemId}, taskId: ${response.taskId}`);

        } catch (error) {
            console.error(`[WorkflowService] PDF backend processing failed for item ${itemId}:`, error);
            await libraryService.updateLibraryItem(itemId, {
                parsingStatus: 'FAILED'
            });
        }
    }

    /**
     * 🔤 生成唯一标题 - 保留原有逻辑
     */
    private async generateUniqueTitle(baseTitle: string): Promise<string> {
        try {
            const duplicates = await libraryService.checkDuplicateByTitle(baseTitle);

            if (duplicates.length === 0) {
                return baseTitle;
            }

            let counter = 2;
            let uniqueTitle = `${baseTitle} (${counter})`;

            while (true) {
                const duplicatesWithSuffix = await libraryService.checkDuplicateByTitle(uniqueTitle);
                if (duplicatesWithSuffix.length === 0) {
                    return uniqueTitle;
                }
                counter++;
                uniqueTitle = `${baseTitle} (${counter})`;

                if (counter > 100) {
                    throw new Error('Could not generate unique title after 100 attempts');
                }
            }
        } catch (error) {
            console.error('[WorkflowService] Error generating unique title:', error);
            return `${baseTitle}_${Date.now()}`;
        }
    }
}

export const libraryWorkflowService = new LibraryWorkflowService();
