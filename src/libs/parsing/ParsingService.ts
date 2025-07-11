/**
 * 🔬 ParsingService - 结构化映射服务 (Adapter)
 * 
 * 🎯 核心职责:
 * - 扮演 "适配器" (Adapter) 的角色，将来自任何解析源的、半结构化的原始数据，转换为我们应用内部统一的、标准化的数据格式。
 * - 其核心是 `extractMetadata` 方法，它接收原始数据和一个规则集 (`extractionRules.ts`)，然后输出一个可直接用于数据库更新的 `Partial<LibraryItem>` 对象。
 * 
 * ❌ 不负责:
 * - 与任何外部 API (如 Mineru) 进行通信。这个职责被委托给更底层的、具体的服务 (例如 `MineruService.ts`)。
 * - 它不关心数据是怎么被解析出来的，只关心如何根据规则去 "映射" 和 "提取" 已有的数据。
 * 
 * ➡️ 这是一个纯粹的数据转换服务，专注于 "如何将A格式的数据映射为B格式"。
 */

import { LibraryItem } from '../db';

// 解析规则类型定义
export interface ExtractionRules {
    [key: string]: string[];
}

// 解析后的内容类型
export interface ParsedContent {
    extractedText: string;
    extractedMetadata: any;
    extractedReferences: any[];
    parsedAt: Date;
    fullZipUrl?: string;
}

export class ParsingService {
    /**
     * 🤖 从解析数据中提取元数据 - 核心映射方法
     * 
     * @param parsedData - 来自任何解析源的原始数据 (如 Mineru 的输出)
     * @param rules - 提取规则集，定义了如何从原始数据中找到各个字段
     * @returns 标准化的元数据对象，可直接用于数据库更新
     */
    extractMetadata(parsedData: any, rules: ExtractionRules): Partial<LibraryItem> {
        const extractedMetadata: Partial<LibraryItem> = {};

        // 遍历规则，按照优先级顺序提取每个字段
        for (const [field, paths] of Object.entries(rules)) {
            const value = this.extractFieldByPaths(parsedData, paths);

            if (value !== null) {
                switch (field) {
                    case 'title':
                        extractedMetadata.title = this.cleanString(value as string);
                        break;
                    case 'authors':
                        extractedMetadata.authors = this.extractAuthors(value);
                        break;
                    case 'year':
                        extractedMetadata.year = this.parseYear(value);
                        break;
                    case 'doi':
                        extractedMetadata.doi = this.cleanString(value as string);
                        break;
                    case 'abstract':
                        extractedMetadata.abstract = this.cleanString(value as string);
                        break;
                    default:
                        // 其他字段直接赋值
                        (extractedMetadata as any)[field] = value;
                }
            }
        }

        return extractedMetadata;
    }

    /**
     * 📄 创建解析内容对象
     * 
     * @param parsedMdData - Mineru 等服务返回的原始数据
     * @returns 标准化的解析内容对象
     */
    createParsedContent(parsedMdData: any): ParsedContent {
        return {
            extractedText: parsedMdData.content || '',
            extractedMetadata: parsedMdData.metadata || {},
            extractedReferences: parsedMdData.references || [],
            parsedAt: new Date(),
            fullZipUrl: parsedMdData.fullZipUrl || ''
        };
    }

    /**
     * 🔍 根据路径数组提取字段值
     * 
     * @param data - 原始数据对象
     * @param paths - 可能的字段路径数组，按优先级排序
     * @returns 找到的第一个有效值，或 null
     */
    private extractFieldByPaths(data: any, paths: string[]): any {
        for (const path of paths) {
            const value = this.getNestedValue(data, path);
            if (value !== null && value !== undefined && value !== '') {
                return value;
            }
        }
        return null;
    }

    /**
     * 🔗 获取嵌套对象的值
     * 
     * @param obj - 目标对象
     * @param path - 点分隔的路径字符串 (如 'metadata.title')
     * @returns 找到的值或 null
     */
    private getNestedValue(obj: any, path: string): any {
        try {
            return path.split('.').reduce((current, key) => {
                return current && current[key] !== undefined ? current[key] : null;
            }, obj);
        } catch {
            return null;
        }
    }

    /**
     * 👥 提取作者信息
     * 
     * @param authorData - 原始作者数据
     * @returns 标准化的作者数组
     */
    private extractAuthors(authorData: any): string[] {
        if (!authorData) return [];

        let authors: string[] = [];

        if (Array.isArray(authorData)) {
            authors = authorData.map((author: any) =>
                typeof author === 'string' ? author : author.name || String(author)
            );
        } else if (typeof authorData === 'string') {
            authors = authorData.split(/[,;]/).map((a: string) => a.trim());
        }

        // 清理和过滤作者名称
        authors = authors
            .map(author => this.cleanString(author))
            .filter(author => author && author.length > 1);

        return authors;
    }

    /**
     * 📅 解析年份
     * 
     * @param yearValue - 原始年份数据
     * @returns 有效的年份数字或当前年份
     */
    private parseYear(yearValue: any): number {
        if (typeof yearValue === 'number') {
            return yearValue > 1000 && yearValue < 2100 ? yearValue : new Date().getFullYear();
        }

        if (typeof yearValue === 'string') {
            // 提取4位数年份
            const yearMatch = yearValue.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
                const year = parseInt(yearMatch[0]);
                return year > 1000 && year < 2100 ? year : new Date().getFullYear();
            }
        }

        return new Date().getFullYear();
    }

    /**
     * 🧹 清理字符串
     * 
     * @param str - 原始字符串
     * @returns 清理后的字符串
     */
    private cleanString(str: string): string {
        if (typeof str !== 'string') return String(str);

        return str.trim()
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/[""]/g, '"')
            .replace(/['']/g, "'");
    }

    /**
     * 📊 提取引用信息
     * 
     * @param parsedData - 解析后的数据
     * @returns 结构化的引用数组
     */
    extractReferences(parsedData: any): any[] {
        return parsedData.references || parsedData.extractedReferences || [];
    }
}

export const parsingService = new ParsingService();