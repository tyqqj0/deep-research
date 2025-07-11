/**
 * 룰 LExtractionRules - 元数据提取规则集
 * 
 * 🎯 核心职责:
 * - 定义可重用的、声明式的规则，用于从不同来源的原始解析数据中提取标准元数据。
 * - 将 `ParsingService` 中的提取逻辑与特定数据源的字段路径解耦。
 * 
 * ❌ 不负责:
 * - 实现提取逻辑本身 (这部分由 `ParsingService` 的 `extractMetadata` 方法负责)。
 * 
 * 💡 使用方式:
 * - 在这里定义一个规则对象，`ParsingService` 会使用这个对象来查找元数据。
 * - key 是我们内部的标准字段名 (e.g., 'title')。
 * - value 是一个数组，包含所有可能找到该字段的路径。服务会按顺序尝试。
 */

/**
 * 适用于 Mineru 服务返回的原始数据的提取规则。
 */
export const MINERU_EXTRACTION_RULES = {
    title: [
        'metadata.Title',
        'metadata.title'
    ],
    authors: [
        'metadata.Authors',
        'metadata.authors',
        'metadata.author'
    ],
    year: [
        'metadata.year',
        'metadata.Year',
        'metadata.date',
        'metadata.published_date'
    ],
    doi: [
        'metadata.doi',
        'metadata.DOI'
    ],
    abstract: [
        'metadata.abstract',
        'metadata.Abstract',
        'metadata.summary'
    ]
}; 