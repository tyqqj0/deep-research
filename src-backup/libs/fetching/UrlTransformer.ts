/**
 * 🔗 UrlTransformer - 智能 URL 转换器
 *
 * 🎯 核心职责:
 * - 接收一个可能为学术页面（如 arXiv 摘要页）的 URL。
 * - 根据预定义的规则，尝试将其转换为直接指向 PDF 文件的 URL。
 * - 如果没有匹配的规则，则原样返回 URL。
 *
 * 🔄 使用场景:
 * - 在文献导入流程中，用户粘贴一个页面链接，系统在后台自动转换为 PDF 链接，
 *   然后将此链接交给 Mineru 等后端服务进行处理，避免了浏览器端下载的开销。
 *
 * ✨ 设计思想:
 * - 可扩展性：通过 `TRANSFORMATION_RULES` 数组，可以轻松添加对新网站的支持，
 *   无需修改核心转换逻辑。
 * - 健壮性：使用正则表达式进行精确匹配，并对转换逻辑进行封装。
 */

interface UrlTransformationRule {
    name: string;
    // 用于匹配 URL 的正则表达式，应包含捕获组以提取关键信息（如论文ID）
    pattern: RegExp;
    // 转换函数，接收匹配结果并返回新的 URL
    transform: (match: RegExpMatchArray) => string;
}

// 📚 转换规则列表 - 在此添加对新网站的支持
const TRANSFORMATION_RULES: UrlTransformationRule[] = [
    {
        name: 'arXiv',
        // 匹配 "https://arxiv.org/abs/..." 或 "http://arxiv.org/abs/..."
        pattern: /^https?:\/\/arxiv\.org\/abs\/([^\s/]+)/,
        transform: (match) => {
            const paperId = match[1];
            // 将 "abs" 替换为 "pdf" 并添加 ".pdf" 后缀
            return `https://arxiv.org/pdf/${paperId}.pdf`;
        }
    },
    // TODO: 在此添加更多规则，例如:
    // {
    //   name: 'bioRxiv',
    //   pattern: /.../,
    //   transform: (match) => { ... }
    // },
];

/**
 * 将给定的 URL 尝试转换为直接的 PDF 链接。
 * 它会遍历所有已定义的转换规则，并应用第一个匹配的规则。
 *
 * @param originalUrl - 用户提供的原始 URL。
 * @returns 转换后的 PDF URL；如果没有规则匹配，则返回原始 URL。
 */
export function transformToDirectPdfUrl(originalUrl: string): string {
    if (!originalUrl) {
        return '';
    }

    for (const rule of TRANSFORMATION_RULES) {
        const match = originalUrl.match(rule.pattern);
        if (match) {
            console.log(`[UrlTransformer] Matched rule "${rule.name}" for URL: ${originalUrl}`);
            const transformedUrl = rule.transform(match);
            console.log(`[UrlTransformer] Transformed URL to: ${transformedUrl}`);
            return transformedUrl;
        }
    }

    // 如果没有匹配的规则，则返回原始 URL
    return originalUrl;
} 