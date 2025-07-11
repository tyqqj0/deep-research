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

import { LibraryItem, LITERATURE_SOURCES } from '../db';
import { libraryService } from '../db/LibraryService';
import { parsingService } from '../parsing/ParsingService';
import { mineruService } from '../parsing/MineruService';
import { pdfFetcherService } from '../fetching';
import { MINERU_EXTRACTION_RULES } from '../parsing/extractionRules';
import { generateLibraryItemId } from '../utils/uuid';
import { llmReferenceParser, ParsedReference } from '../parsing/LLMReferenceParser';
import { llmMetadataParser, LLMParsedMetadata } from '../parsing/LLMMetadataParser';
import { transformToDirectPdfUrl } from '../fetching/UrlTransformer';

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
                source: LITERATURE_SOURCES.IMPORT,
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
     * 🔄 处理有源文献 - 智能策略：优先URL直传，后备抓取PDF
     */
    private async processItemWithSource(itemId: string): Promise<void> {
        try {
            const item = await libraryService.getLibraryItemById(itemId);
            if (!item) {
                throw new Error(`Item ${itemId} not found`);
            }

            // 🚀 **新增：在处理前，首先尝试转换URL**
            const originalUrl = item.url || '';
            const transformedUrl = transformToDirectPdfUrl(originalUrl);

            // 🚀 策略1: 如果有直接的PDF URL (或转换后的URL)，优先尝试直接上传
            if (transformedUrl && this.isPdfUrl(transformedUrl)) {
                console.log(`Attempting direct PDF URL processing for item ${itemId}: ${transformedUrl}`);

                try {
                    // 使用转换后的 URL 进行处理
                    const success = await this.processPdfFromUrl(itemId, transformedUrl);
                    if (success) {
                        console.log(`✅ Successfully processed PDF from direct URL for item ${itemId}`);
                        // 如果成功，需要将转换后的URL存回数据库，以便将来参考
                        if (originalUrl !== transformedUrl) {
                            await libraryService.updateLibraryItem(itemId, { url: transformedUrl });
                        }
                        return;
                    }
                } catch (error) {
                    console.log(`❌ Direct PDF URL failed for item ${itemId}, falling back to fetch strategy:`, error);
                }
            }

            // 🔄 策略2: 回退到传统的抓取策略
            console.log(`Using fallback fetch strategy for item ${itemId}`);
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

            // 🚀 第一阶段：LLM 智能元数据解析
            console.log(`Starting LLM metadata extraction for item ${itemId}`);
            await libraryService.updateLibraryItem(itemId, {
                parsingStatus: 'PENDING_METADATA_EXTRACTION' as any
            });

            const llmExtractedMetadata = await llmMetadataParser.parseMetadata(parsedMdData.content || '');
            console.log('LLM extracted metadata:', llmExtractedMetadata);

            // 🚀 立即更新元数据到数据库，让用户快速看到结果
            console.log(`Immediately updating metadata for item ${itemId}`);
            await libraryService.updateLibraryItem(itemId, {
                ...llmExtractedMetadata,
                parsingStatus: 'PENDING_REFERENCE_EXTRACTION' as any
            });

            // 仍然使用ParsingService提取参考文献文本块（作为LLM引文解析的输入）
            const referenceExtractionMetadata = parsingService.extractMetadata(parsedMdData, MINERU_EXTRACTION_RULES);
            const parsedContent = parsingService.createParsedContent(parsedMdData, llmExtractedMetadata);
            console.log('parsedContent', parsedContent);

            // 🚀 第二阶段：LLM 引文解析
            let finalParsedContent = parsedContent;

            // 检查是否有参考文献需要解析（从extractionRules的额外字段中获取）
            const rawReferences = (referenceExtractionMetadata as any).references;
            if (rawReferences && typeof rawReferences === 'string') {
                console.log(`Found references for item ${itemId}, starting LLM parsing`);

                // 更新状态为引文解析中
                await libraryService.updateLibraryItem(itemId, {
                    parsingStatus: 'PENDING_REFERENCE_EXTRACTION' as any
                });

                try {
                    // 使用 LLM 解析引文
                    const parsedReferences = await llmReferenceParser.parseReferences(rawReferences);

                    console.log(`Successfully parsed ${parsedReferences.length} references for item ${itemId}`);

                    // 更新解析内容，包含结构化的引文
                    finalParsedContent = {
                        ...parsedContent,
                        extractedReferences: parsedReferences
                    };

                } catch (error) {
                    console.error(`LLM reference parsing failed for item ${itemId}:`, error);

                    // 解析失败，保留原始引文文本
                    finalParsedContent = {
                        ...parsedContent,
                        extractedReferences: [{
                            raw: rawReferences,
                            title: 'Failed to parse references',
                            authors: [],
                            year: new Date().getFullYear(),
                            parseError: error instanceof Error ? error.message : String(error)
                        }]
                    };
                }
            }

            // 使用LLM解析的元数据，并从引用提取结果中移除非LibraryItem字段
            const { references, ...validMetadata } = { ...llmExtractedMetadata, ...(referenceExtractionMetadata as any) };

            // 更新数据库
            console.log(`Updating item ${itemId} to SUCCESS status`);
            await libraryService.updateLibraryItem(itemId, {
                ...validMetadata,
                parsedContent: finalParsedContent,
                parsingStatus: 'SUCCESS'
            });

            console.log(`Successfully processed item ${itemId} with Mineru and LLM reference parsing`);

            // 🔗 **新：自动双向引文链接**
            console.log(`Starting BI-DIRECTIONAL citation linking for item ${itemId}`);
            try {
                const linkingResult = await libraryService.linkNewItemBidirectionally(itemId);
                console.log(`✅ Bidirectional linking completed for item ${itemId}:`, linkingResult);
            } catch (linkingError) {
                console.error(`❌ Bidirectional linking failed for item ${itemId}:`, linkingError);
            }

        } catch (error) {
            console.error(`Mineru processing failed for item ${itemId}:`, error);
            await libraryService.updateLibraryItem(itemId, {
                parsingStatus: 'PARSING_FAILED'
            });
        }
    }

    /**
     * 🔗 判断是否为PDF直链
     */
    private isPdfUrl(url: string): boolean {
        const cleanUrl = url.toLowerCase().split('?')[0]; // 移除查询参数
        return cleanUrl.endsWith('.pdf') || url.includes('pdf') || url.includes('arxiv.org/pdf/');
    }

    /**
     * 📄 从URL直接处理PDF - 智能回退策略
     * 
     * 🎯 处理策略:
     * 1. 优先尝试 Mineru URL 直接处理（避免浏览器下载）
     * 2. 如果遇到超时错误，回退到本地下载再上传的方式
     */
    private async processPdfFromUrl(itemId: string, pdfUrl: string): Promise<boolean> {
        try {
            console.log(`Processing PDF from URL: ${pdfUrl}`);

            const item = await libraryService.getLibraryItemById(itemId);
            if (!item) {
                throw new Error(`Item ${itemId} not found`);
            }

            // 🚀 策略1: 优先使用增强的本地抓取服务
            try {
                console.log(`📥 Attempting enhanced local fetch for item ${itemId}`);
                await this.processPdfWithEnhancedFetch(itemId);
                return true;
            } catch (fetchError) {
                console.log(`❌ Enhanced local fetch failed for item ${itemId}:`, fetchError);

                // 🔄 策略2: 跳过 Mineru URL 直接处理（有问题），直接使用简单本地下载
                console.log(`🔄 Skipping Mineru URL processing (has issues), using simple local download for item ${itemId}`);
                try {
                    await this.processPdfWithLocalDownload(itemId, pdfUrl);
                    return true;
                } catch (downloadError) {
                    console.error(`❌ All strategies failed for item ${itemId}:`, downloadError);
                    throw downloadError;
                }
            }

        } catch (error) {
            console.error(`Failed to process PDF from URL ${pdfUrl}:`, error);
            await libraryService.updateLibraryItem(itemId, {
                parsingStatus: 'PARSING_FAILED'
            });
            return false;
        }
    }

    /**
     * 📥 使用增强的本地抓取服务处理 PDF
     */
    private async processPdfWithEnhancedFetch(itemId: string): Promise<void> {
        const item = await libraryService.getLibraryItemById(itemId);
        if (!item) {
            throw new Error(`Item ${itemId} not found`);
        }

        console.log(`📥 Using enhanced PDF fetch service for item: ${item.title}`);

        // 更新状态为抓取中
        await libraryService.updateLibraryItem(itemId, {
            parsingStatus: 'PENDING_PDF_FETCH'
        });

        // 使用增强的 PDF 抓取服务
        const pdfBlob = await pdfFetcherService.fetch(item);

        if (!pdfBlob) {
            throw new Error('Failed to fetch PDF using enhanced service');
        }

        console.log(`✅ Successfully fetched PDF (${pdfBlob.size} bytes), processing with Mineru`);

        // 使用现有的 Blob 处理流程
        await this.processPdfWithMineru(itemId, pdfBlob);
    }

    /**
     * 🌐 使用 Mineru URL 直接处理 PDF
     */
    private async processPdfWithMineruUrl(itemId: string, pdfUrl: string): Promise<void> {
        const item = await libraryService.getLibraryItemById(itemId);
        if (!item) {
            throw new Error(`Item ${itemId} not found`);
        }

        // 更新状态为解析中
        await libraryService.updateLibraryItem(itemId, {
            parsingStatus: 'PARSING_IN_MINERU'
        });

        // 提交任务到Mineru（使用URL直接处理）
        const taskId = await mineruService.submitTaskFromUrl(item, pdfUrl);
        console.log(`Mineru URL task submitted for item ${itemId}, task_id: ${taskId}`);

        // 轮询解析结果
        const parsedMdData = await mineruService.pollTaskResultFromUrl(taskId, (progress) => {
            console.log(`Progress for ${itemId}: ${progress.extractedPages}/${progress.totalPages}`);
        });

        // 处理解析结果
        await this.processMineuResults(itemId, parsedMdData);
    }

    /**
     * 📥 使用本地下载再上传的方式处理 PDF
     */
    private async processPdfWithLocalDownload(itemId: string, pdfUrl: string): Promise<void> {
        console.log(`📥 Downloading PDF locally from: ${pdfUrl}`);

        const response = await fetch(pdfUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/pdf')) {
            console.warn(`URL does not return PDF content type: ${contentType}`);
            throw new Error('URL does not return PDF content');
        }

        const pdfArrayBuffer = await response.arrayBuffer();
        const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });

        // 验证PDF大小
        if (pdfBlob.size === 0) {
            throw new Error('Downloaded PDF is empty');
        }

        console.log(`✅ Successfully downloaded PDF (${pdfBlob.size} bytes), processing with Mineru file upload`);

        // 使用现有的 Blob 处理流程
        await this.processPdfWithMineru(itemId, pdfBlob);
    }

    /**
     * 🔄 处理 Mineru 解析结果的通用方法
     */
    private async processMineuResults(itemId: string, parsedMdData: any): Promise<void> {
        // 🚀 第一阶段：LLM 智能元数据解析
        console.log(`Starting LLM metadata extraction for item ${itemId}`);
        await libraryService.updateLibraryItem(itemId, {
            parsingStatus: 'PENDING_METADATA_EXTRACTION' as any
        });

        const llmExtractedMetadata = await llmMetadataParser.parseMetadata(parsedMdData.content || '');
        console.log('LLM extracted metadata:', llmExtractedMetadata);

        // 🚀 立即更新元数据到数据库，让用户快速看到结果
        console.log(`Immediately updating metadata for item ${itemId}`);
        await libraryService.updateLibraryItem(itemId, {
            ...llmExtractedMetadata,
            parsingStatus: 'PENDING_REFERENCE_EXTRACTION' as any
        });

        // 仍然使用ParsingService提取参考文献文本块（作为LLM引文解析的输入）
        const referenceExtractionMetadata = parsingService.extractMetadata(parsedMdData, MINERU_EXTRACTION_RULES);
        const parsedContent = parsingService.createParsedContent(parsedMdData, llmExtractedMetadata);
        console.log('parsedContent', parsedContent);

        // 🚀 第二阶段：LLM 引文解析
        let finalParsedContent = parsedContent;

        // 检查是否有参考文献需要解析（从extractionRules的额外字段中获取）
        const rawReferences = (referenceExtractionMetadata as any).references;
        if (rawReferences && typeof rawReferences === 'string') {
            console.log(`Found references for item ${itemId}, starting LLM parsing`);

            // 更新状态为引文解析中
            await libraryService.updateLibraryItem(itemId, {
                parsingStatus: 'PENDING_REFERENCE_EXTRACTION' as any
            });

            try {
                // 使用 LLM 解析引文
                const parsedReferences = await llmReferenceParser.parseReferences(rawReferences);

                console.log(`Successfully parsed ${parsedReferences.length} references for item ${itemId}`);

                // 更新解析内容，包含结构化的引文
                finalParsedContent = {
                    ...parsedContent,
                    extractedReferences: parsedReferences
                };

            } catch (error) {
                console.error(`LLM reference parsing failed for item ${itemId}:`, error);

                // 解析失败，保留原始引文文本
                finalParsedContent = {
                    ...parsedContent,
                    extractedReferences: [{
                        raw: rawReferences,
                        title: 'Failed to parse references',
                        authors: [],
                        year: new Date().getFullYear(),
                        parseError: error instanceof Error ? error.message : String(error)
                    }]
                };
            }
        }

        // 使用LLM解析的元数据，并从引用提取结果中移除非LibraryItem字段
        const { references, ...validMetadata } = { ...llmExtractedMetadata, ...(referenceExtractionMetadata as any) };

        // 更新数据库
        console.log(`Updating item ${itemId} to SUCCESS status`);
        await libraryService.updateLibraryItem(itemId, {
            ...validMetadata,
            parsedContent: finalParsedContent,
            parsingStatus: 'SUCCESS'
        });

        console.log(`Successfully processed item ${itemId} with Mineru and LLM parsing`);

        // 🔗 **新：自动双向引文链接**
        console.log(`Starting BI-DIRECTIONAL citation linking for item ${itemId}`);
        try {
            const linkingResult = await libraryService.linkNewItemBidirectionally(itemId);
            console.log(`✅ Bidirectional linking completed for item ${itemId}:`, linkingResult);
        } catch (linkingError) {
            console.error(`❌ Bidirectional linking failed for item ${itemId}:`, linkingError);
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