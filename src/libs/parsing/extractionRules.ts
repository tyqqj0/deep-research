/**
 * 🔍 ExtractionRules - 元数据提取规则集
 * 
 * 🎯 核心职责:
 * - 定义可重用的、声明式的规则，用于从不同来源的原始解析数据中提取标准元数据。
 * - 支持简单路径提取和正则表达式提取两种模式。
 * - 将 `ParsingService` 中的提取逻辑与特定数据源的字段路径解耦。
 * 
 * ❌ 不负责:
 * - 实现提取逻辑本身 (这部分由 `ParsingService` 的 `extractMetadata` 方法负责)。
 * 
 * 💡 使用方式:
 * - 在这里定义一个规则对象，`ParsingService` 会使用这个对象来查找元数据。
 * - key 是我们内部的标准字段名 (e.g., 'title')。
 * - value 可以是：
 *   - 简单路径数组: ['metadata.title', 'title']
 *   - 正则表达式对象: { type: 'regex', pattern: /^#\s+(.+)$/m, source: 'content' }
 */

export interface ExtractionRule {
    // 简单路径提取
    paths?: string[];
    // 正则表达式提取
    regex?: {
        pattern: RegExp;
        source: string; // 'content' | 'metadata' | 'full'
        group?: number; // 捕获组索引，默认为 1
        flags?: string; // 正则表达式标志
    };
    // 后处理函数
    postProcess?: (value: any) => any;
}

export interface ExtractionRules {
    [key: string]: ExtractionRule;
}

/**
 * 🧪 适用于 Mineru 服务返回的科学论文 Markdown 数据的提取规则
 * 
 * 📋 支持的格式示例:
 * ```markdown
 * # PAPER TITLE HERE
 * 
 * Authors: John Doe, Jane Smith
 * Anonymous authors
 * 
 * ## ABSTRACT
 * 
 * This paper presents...
 * 
 * Keywords: keyword1, keyword2
 * 
 * DOI: 10.1000/example.2024.001
 * 
 * ## 1. INTRODUCTION
 * ...
 * ```
 */
export const MINERU_EXTRACTION_RULES: ExtractionRules = {
    // 📝 标题提取 - 优先从第一个 # 标题提取
    title: {
        regex: {
            pattern: /^#\s+(.+?)$/m,
            source: 'content',
            group: 1
        },
        paths: ['metadata.title', 'metadata.Title'],
        postProcess: (value: string) => {
            // 清理标题中的多余空格和换行
            return value?.replace(/\s+/g, ' ').trim();
        }
    },

    // 👥 作者提取 - 多种模式支持
    authors: {
        regex: {
            // 匹配多种作者格式：
            // - "Authors: John Doe, Jane Smith"
            // - "Anonymous authors"
            // - "John Doe, Jane Smith"（在标题后的第一行）
            pattern: /(?:^|\n)(?:Authors?[:\s]*(.+?)(?:\n|$)|^(Anonymous authors?)(?:\n|$)|^([A-Z][^#\n]+?)(?:\n|$))/im,
            source: 'content',
            group: 1
        },
        paths: ['metadata.Authors', 'metadata.authors', 'metadata.author'],
        postProcess: (value: any) => {
            if (typeof value === 'string') {
                // 处理特殊情况
                if (value.toLowerCase().includes('anonymous')) {
                    return ['Anonymous'];
                }
                if (value.toLowerCase().includes('under review') || value.toLowerCase().includes('double-blind')) {
                    return ['Anonymous'];
                }

                // 处理各种作者分隔符
                return value
                    .split(/[,;&\n]|and\s+/)
                    .map(author => author.trim())
                    .filter(author => author && author.length > 2)
                    .slice(0, 10); // 限制作者数量
            }
            return value;
        }
    },

    // 📅 年份提取 - 从多个位置尝试
    year: {
        regex: {
            pattern: /(?:year|published|date)[:\s]*(\d{4})|(\b(?:19|20)\d{2}\b)/im,
            source: 'content',
            group: 1
        },
        paths: ['metadata.year', 'metadata.Year', 'metadata.date', 'metadata.published_date'],
        postProcess: (value: any) => {
            const year = parseInt(value);
            const currentYear = new Date().getFullYear();
            return (year >= 1900 && year <= currentYear + 5) ? year : currentYear;
        }
    },

    // 🔗 DOI 提取 - 改进的正则表达式
    doi: {
        regex: {
            pattern: /(?:DOI|doi)[:\s]*(10\.\d+\/[^\s\n]+)/im,
            source: 'content',
            group: 1
        },
        paths: ['metadata.doi', 'metadata.DOI'],
        postProcess: (value: string) => {
            // 清理 DOI 格式
            return value?.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '').trim();
        }
    },

    // 📄 摘要提取 - 从 ABSTRACT 部分提取
    abstract: {
        regex: {
            pattern: /##?\s*ABSTRACT\s*\n([\s\S]*?)(?=\n##?\s|\n\n\n|$)/im,
            source: 'content',
            group: 1
        },
        paths: ['metadata.abstract', 'metadata.Abstract', 'metadata.summary'],
        postProcess: (value: string) => {
            // 清理摘要格式
            return value?.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        }
    },

    // 🏷️ 关键词提取
    keywords: {
        regex: {
            pattern: /(?:keywords?|key\s*words?)[:\s]*(.+?)(?:\n|$)/im,
            source: 'content',
            group: 1
        },
        paths: ['metadata.keywords'],
        postProcess: (value: string) => {
            if (typeof value === 'string') {
                return value
                    .split(/[,;]/)
                    .map(keyword => keyword.trim())
                    .filter(keyword => keyword.length > 0);
            }
            return value;
        }
    },

    // 📚 期刊/会议信息提取
    publication: {
        regex: {
            pattern: /(?:published\s+in|journal|conference|proceedings)[:\s]*(.+?)(?:\n|$)/im,
            source: 'content',
            group: 1
        },
        paths: ['metadata.publication', 'metadata.journal', 'metadata.conference']
    },

    // 📖 参考文献提取 - 从 REFERENCES 部分提取
    references: {
        regex: {
            // 匹配 "# REFERENCES" 或 "## REFERENCES" 后的所有内容
            pattern: /##?\s*REFERENCES\s*\n([\s\S]*?)(?=\n##?\s|$)/im,
            source: 'content',
            group: 1
        },
        paths: ['metadata.references', 'metadata.References', 'metadata.bibliography'],
        postProcess: (value: string) => {
            if (typeof value === 'string') {
                // 智能分割参考文献 - 处理在一行上的多个参考文献
                let references = value
                    .split(/\n/)
                    .map(ref => ref.trim())
                    .filter(ref => ref.length > 0);

                // 如果只有一行，说明所有参考文献都在一行上，需要智能分割
                if (references.length === 1) {
                    const singleLine = references[0];

                    // 使用年份后跟句号和大写字母的模式来分割
                    const yearEndPattern = /(\b(?:19|20)\d{2}\b\.)\s+([A-Z][a-z]+)/g;

                    // 在年份后插入换行符来分割
                    let splitText = singleLine.replace(yearEndPattern, '$1\n$2');

                    // 再次按行分割
                    references = splitText
                        .split(/\n/)
                        .map(ref => ref.trim())
                        .filter(ref => ref.length > 0);
                }

                // 进一步解析每个参考文献条目
                return references.map(ref => {
                    // 尝试提取基本信息：作者、标题、期刊/会议、年份、DOI/URL
                    const parsed = parseReference(ref);
                    return {
                        raw: ref,
                        ...parsed
                    };
                });
            }
            return value;
        }
    }
};

/**
 * 解析单个参考文献条目
 * @param reference 原始参考文献字符串
 * @returns 解析后的参考文献对象
 */
function parseReference(reference: string): any {
    const result: any = {};

    // 提取 DOI
    const doiMatch = reference.match(/(?:doi[:\s]*|DOI[:\s]*)(10\.\d+\/[^\s,]+)/i);
    if (doiMatch) {
        result.doi = doiMatch[1];
    }

    // 提取 URL
    const urlMatch = reference.match(/(?:URL\s+)?(https?:\/\/[^\s,]+)/i);
    if (urlMatch) {
        result.url = urlMatch[1];
    }

    // 提取年份
    const yearMatch = reference.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
        result.year = parseInt(yearMatch[0]);
    }

    // 提取 arXiv ID
    const arxivMatch = reference.match(/arXiv[:\s]*([0-9]{4}\.[0-9]{4,5})/i);
    if (arxivMatch) {
        result.arxivId = arxivMatch[1];
    }

    // 尝试提取标题（通常是第一个句号前的部分，或者是引号中的内容）
    const titleMatch = reference.match(/^([^.]+\.)|"([^"]+)"/);
    if (titleMatch) {
        result.title = (titleMatch[1] || titleMatch[2])?.replace(/\.$/, '').trim();
    }

    // 尝试提取作者（通常在标题前）
    const authorMatch = reference.match(/^([^.]+?)(?:\.|,)/);
    if (authorMatch && authorMatch[1]) {
        const authorText = authorMatch[1].trim();
        // 简单的作者分割（按逗号和 "and" 分割）
        const authors = authorText
            .split(/,|\sand\s/)
            .map(author => author.trim())
            .filter(author => author.length > 0);

        if (authors.length > 0) {
            result.authors = authors;
        }
    }

    return result;
} 