/**
 * 📄 ArxivProvider - arXiv PDF 抓取提供商
 * 
 * 🎯 核心功能:
 * - 专门处理 arXiv 论文的 PDF 抓取
 * - 自动将摘要页面 URL 转换为 PDF 下载链接
 * - 提供稳定的 arXiv PDF 获取服务
 * 
 * 🔄 处理流程:
 * 1. 检测是否为 arXiv URL（摘要页面或直接PDF链接）
 * 2. 转换为标准的 PDF 下载链接
 * 3. 下载并返回 PDF Blob
 */

import { IPdfProvider } from './base';
import { LibraryItem } from '../../db';

export class ArxivProvider implements IPdfProvider {
    name = 'arxiv';
    priority = 1; // 高优先级，因为对arXiv链接有很高的成功率

    /**
     * 检查是否可以处理该文献
     */
    canHandle(item: LibraryItem): boolean {
        const url = item.url || item.doi;
        if (!url) return false;

        // 检查是否为 arXiv URL
        return this.isArxivUrl(url);
    }

    /**
     * 抓取 PDF 文件
     */
    async fetchPdf(item: LibraryItem): Promise<Blob | null> {
        try {
            console.log(`[ArxivProvider] Fetching PDF for: ${item.title}`);

            const url = item.url || item.doi;
            if (!url) {
                throw new Error('No URL or DOI provided');
            }

            // 转换为 PDF 下载链接
            const pdfUrl = this.convertToPdfUrl(url);
            console.log(`[ArxivProvider] PDF URL: ${pdfUrl}`);

            // 通过代理下载 PDF
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(pdfUrl)}`;
            console.log(`[ArxivProvider] Fetching via proxy: ${proxyUrl}`);
            const response = await fetch(proxyUrl);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ details: response.statusText }));
                throw new Error(
                    `Failed to download file via proxy for ${pdfUrl}: ${errorData.details || response.statusText}`
                );
            }

            // 验证内容类型
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/pdf')) {
                throw new Error(`Invalid content type: ${contentType}`);
            }

            const pdfBlob = await response.blob();

            // 验证文件大小
            if (pdfBlob.size === 0) {
                throw new Error('Downloaded PDF is empty');
            }

            console.log(`[ArxivProvider] Successfully downloaded PDF (${pdfBlob.size} bytes)`);
            return pdfBlob;

        } catch (error) {
            console.error(`[ArxivProvider] Error fetching PDF for ${item.title}:`, error);
            return null;
        }
    }

    /**
     * 检查是否为 arXiv URL
     */
    private isArxivUrl(url: string): boolean {
        const lowerUrl = url.toLowerCase();
        return lowerUrl.includes('arxiv.org') ||
            lowerUrl.includes('arxiv:') ||
            /arxiv:\d{4}\.\d{4,5}/.test(lowerUrl);
    }

    /**
     * 将 arXiv URL 转换为 PDF 下载链接
     */
    private convertToPdfUrl(url: string): string {
        // 如果已经是 PDF 链接，直接返回
        if (url.includes('arxiv.org/pdf/') && url.endsWith('.pdf')) {
            return url;
        }

        // 从摘要页面 URL 提取论文 ID
        const abstractMatch = url.match(/arxiv\.org\/abs\/([^\s/]+)/);
        if (abstractMatch) {
            const paperId = abstractMatch[1];
            return `https://arxiv.org/pdf/${paperId}.pdf`;
        }

        // 从 DOI 格式提取论文 ID (如: arxiv:2401.01234)
        const doiMatch = url.match(/arxiv:(\d{4}\.\d{4,5})/i);
        if (doiMatch) {
            const paperId = doiMatch[1];
            return `https://arxiv.org/pdf/${paperId}.pdf`;
        }

        // 如果无法识别格式，假设是直接的 PDF URL
        return url;
    }
} 