/**
 * 📚 ZoteroProvider - Zotero API PDF 抓取提供商
 * 
 * 🎯 核心功能:
 * - 利用 Zotero API 的强大抓取能力获取 PDF
 * - 支持多种学术网站和出版商
 * - 提供高质量的元数据和 PDF 文件
 * 
 * 🔄 处理流程:
 * 1. 使用 Zotero Web API 的 translate 功能
 * 2. 从返回的结果中提取 PDF 附件
 * 3. 下载 PDF 文件
 * 
 * 📝 注意事项:
 * - 需要有效的 Zotero API 密钥
 * - 某些网站可能需要机构访问权限
 */

import { IPdfProvider } from './base';
import { LibraryItem } from '../../db';
import { zoteroService } from '../../zotero/ZoteroService';

export class ZoteroProvider implements IPdfProvider {
    name = 'zotero';
    priority = 2; // 中等优先级，因为需要API配置

    /**
 * 检查是否可以处理该文献
 */
    canHandle(item: LibraryItem): boolean {
        // 🔍 只处理有 Zotero Key 的文献（已同步的文献）
        return Boolean(item.zoteroKey && zoteroService.isConfigured());
    }

    /**
 * 抓取 PDF 文件
 */
    async fetchPdf(item: LibraryItem): Promise<Blob | null> {
        try {
            console.log(`[ZoteroProvider] Fetching PDF for: ${item.title}`);

            // 🚀 主要策略: 如果有 Zotero Key，直接从 Zotero API 获取 PDF 附件
            if (item.zoteroKey && zoteroService.isConfigured()) {
                console.log(`[ZoteroProvider] Using Zotero API to get PDF attachment for key: ${item.zoteroKey}`);
                const pdfBlob = await zoteroService.getPdfAttachment(item.zoteroKey);

                if (pdfBlob) {
                    console.log(`[ZoteroProvider] Successfully got PDF from Zotero API (${pdfBlob.size} bytes)`);
                    return pdfBlob;
                }

                console.log(`[ZoteroProvider] No PDF attachment found in Zotero for this item`);
                return null; // 如果 Zotero 中没有 PDF，就不尝试其他方法了
            }

            // 如果没有 Zotero Key，说明这个文献不在 Zotero 库中，ZoteroProvider 无法处理
            console.log(`[ZoteroProvider] Item has no Zotero key, cannot handle this item`);
            return null;

        } catch (error) {
            console.error(`[ZoteroProvider] Error fetching PDF for ${item.title}:`, error);
            return null;
        }
    }


} 