/**
 * 🤖 LLM 引文解析服务
 * 
 * 🎯 核心职责:
 * - 使用 LLM 模型智能解析参考文献文本
 * - 将混杂的引文文本转换为结构化的数据
 * - 支持各种引文格式（APA、IEEE、带编号等）
 * 
 * 💡 优势:
 * - 比正则表达式更准确、更智能
 * - 能处理复杂的混合格式
 * - 自动适应新的引文格式
 */

import { streamText } from 'ai';
import useModelProvider from '@/hooks/useAiProvider';

export interface ParsedReference {
    title: string;
    authors: string[];
    year: number;
    journal?: string;
    doi?: string;
    url?: string;
    arxivId?: string;
    raw: string; // 原始文本
}

export class LLMReferenceParser {
    constructor() {
        // 类构造函数保持简单
    }

    /**
     * 🚀 使用 LLM 解析参考文献
     * @param referencesText 原始参考文献文本
     * @returns 解析后的结构化引文数组
     */
    async parseReferences(referencesText: string): Promise<ParsedReference[]> {
        try {
            // 使用 useModelProvider hook 的功能
            const modelProviderHook = useModelProvider();
            const { thinkingModel } = modelProviderHook.getModel();
            const modelProvider = await modelProviderHook.createModelProvider(thinkingModel);

            const systemPrompt = this.createSystemPrompt();
            const userPrompt = this.createUserPrompt(referencesText);

            const result = await streamText({
                model: modelProvider,
                system: systemPrompt,
                prompt: userPrompt,
            });

            // 收集完整的响应
            let fullResponse = '';
            for await (const chunk of result.textStream) {
                fullResponse += chunk;
            }

            // 解析 JSON 响应
            const parsedReferences = this.parseJsonResponse(fullResponse);
            return parsedReferences;

        } catch (error) {
            console.error('LLM 引文解析失败:', error);
            throw new Error(`引文解析失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 🎯 创建系统提示词 - 定义 LLM 的角色和任务
     */
    private createSystemPrompt(): string {
        return `你是一个专业的学术文献引文解析专家。你的任务是将混杂的参考文献文本解析成结构化的数据。

**你的能力:**
- 识别各种引文格式（APA、IEEE、MLA、编号格式等）
- 处理黏连在一起的多条引文
- 提取关键信息（标题、作者、年份、期刊等）
- 处理不规范的引文格式

**输出要求:**
1. 必须返回有效的 JSON 数组格式
2. 每个引文对象包含以下字段：
   - title: 论文标题（必需）
   - authors: 作者数组（必需）
   - year: 发表年份（必需，数字格式）
   - journal: 期刊/会议名称（可选）
   - doi: DOI 标识符（可选）
   - url: 链接地址（可选）
   - arxivId: arXiv ID（可选）
   - raw: 原始引文文本（必需）

**处理原则:**
- 如果某个字段无法确定，设为 null 或省略
- 确保年份是数字格式
- 作者数组中每个元素是完整的姓名
- 保持原始文本的完整性

**示例输出:**
[
  {
    "title": "Large language models can learn temporal reasoning",
    "authors": ["Siheng Xiong", "Ali Payani", "Ramana Kompella", "Faramarz Fekri"],
    "year": 2024,
    "journal": "arXiv preprint",
    "arxivId": "2401.06853",
    "raw": "Siheng Xiong, Ali Payani, Ramana Kompella, and Faramarz Fekri. Large language models can learn temporal reasoning. arXiv preprint arXiv:2401.06853, 2024."
  }
]`;
    }

    /**
     * 📝 创建用户提示词 - 包含待解析的引文文本
     */
    private createUserPrompt(referencesText: string): string {
        return `请解析以下参考文献文本，将其转换为结构化的 JSON 数组：

${referencesText}

请严格按照系统提示中的格式返回 JSON 数组。`;
    }

    /**
     * 🔧 解析 LLM 返回的 JSON 响应
     */
    private parseJsonResponse(response: string): ParsedReference[] {
        try {
            // 尝试提取 JSON 部分
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('响应中未找到有效的 JSON 数组');
            }

            const jsonStr = jsonMatch[0];
            const parsed = JSON.parse(jsonStr);

            if (!Array.isArray(parsed)) {
                throw new Error('响应不是有效的数组格式');
            }

            // 验证和清理数据
            return parsed.map((item: any, index: number) => {
                if (!item.title || !item.authors || !item.year) {
                    console.warn(`引文 ${index + 1} 缺少必需字段，跳过`);
                    return null;
                }

                return {
                    title: String(item.title).trim(),
                    authors: Array.isArray(item.authors) ? item.authors.map((a: any) => String(a).trim()) : [String(item.authors).trim()],
                    year: parseInt(String(item.year)),
                    journal: item.journal ? String(item.journal).trim() : undefined,
                    doi: item.doi ? String(item.doi).trim() : undefined,
                    url: item.url ? String(item.url).trim() : undefined,
                    arxivId: item.arxivId ? String(item.arxivId).trim() : undefined,
                    raw: item.raw ? String(item.raw).trim() : ''
                };
            }).filter(Boolean) as ParsedReference[];

        } catch (error) {
            console.error('解析 JSON 响应失败:', error);
            console.error('原始响应:', response);
            throw new Error(`解析响应失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

/**
 * 🏭 工厂函数 - 创建 LLM 引文解析器实例
 */
export function createLLMReferenceParser(): LLMReferenceParser {
    return new LLMReferenceParser();
} 