/**
 * 🤖 LLMReferenceParser - LLM 驱动的引文解析器
 * 
 * 🎯 核心职责:
 * - 使用大语言模型来智能解析复杂、混乱的引文文本
 * - 将非结构化的引文文本转换为结构化的 JSON 数据
 * - 支持各种引文格式：APA、IEEE、MLA、混合格式等
 * - 比传统正则表达式方法更准确、更智能
 * 
 * 🚀 优势:
 * - 高准确率：LLM 在理解上下文和处理模糊格式方面远超正则表达式
 * - 高适应性：能处理各种引文格式，包括不规范的引文
 * - 易维护：无需编写复杂的正则表达式
 * - JSON修复：自动修复LLM返回的损坏JSON
 */

import useModelProvider from '@/hooks/useAiProvider';
import { generateText } from 'ai';
import { jsonrepair } from 'jsonrepair';

// 引文解析结果的类型定义 - 简化版
export interface ParsedReference {
    title?: string;
    authors?: string[];
    year?: number;
    journal?: string;
    doi?: string;
    url?: string;
    confidence?: number; // 解析置信度 (0-1)
}

export class LLMReferenceParser {
    private modelProvider: any = null;
    private readonly MAX_CHUNK_SIZE = 2000; // 每个块的最大字符数
    private readonly MIN_REFERENCES_PER_CHUNK = 3; // 每个块的最小引文数

    /**
     * 🧠 使用 LLM 解析引文文本
     * 
     * @param rawReferencesText - 原始引文文本
     * @returns 解析后的结构化引文数组
     */
    async parseReferences(rawReferencesText: string): Promise<ParsedReference[]> {
        if (!rawReferencesText || rawReferencesText.trim().length === 0) {
            return [];
        }

        try {
            // 初始化模型提供者
            await this.initializeModelProvider();

            console.log('🤖 LLM 开始解析引文...');
            console.log('输入文本长度:', rawReferencesText.length);

            // 判断是否需要拆分处理
            if (rawReferencesText.length > this.MAX_CHUNK_SIZE) {
                console.log('📦 文本过长，启用拆分并行处理...');
                return await this.parseReferencesInChunks(rawReferencesText);
            } else {
                console.log('📄 文本长度适中，使用单次处理...');
                return await this.parseSingleChunk(rawReferencesText);
            }

        } catch (error) {
            console.error('❌ LLM 引文解析失败:', error);
            // 如果 LLM 解析失败，返回原始文本作为备选
            return [{
                title: '解析失败 - 原始文本',
                authors: ['Unknown'],
                year: new Date().getFullYear(),
                journal: rawReferencesText.substring(0, 200) + '...',
                confidence: 0
            }];
        }
    }

    /**
     * 🔧 初始化模型提供者
     */
    private async initializeModelProvider(): Promise<void> {
        if (!this.modelProvider) {
            const { createModelProvider, getModel } = useModelProvider();
            const { thinkingModel } = getModel();
            this.modelProvider = await createModelProvider(thinkingModel);
        }
    }

    /**
     * 📝 构造系统提示词 - 让 LLM 扮演学术文献专家（简化版）
     */
    private buildSystemPrompt(): string {
        return `你是一位专业的学术文献分析专家，专门负责从混乱的参考文献文本中提取结构化信息。

**你的任务：**
1. 仔细分析用户提供的参考文献文本
2. 识别出每一条独立的参考文献
3. 从每条引文中提取关键信息
4. 以严格的 JSON 格式返回结果

**提取的字段（按重要性排序）：**
- title: 论文标题（最重要）
- year: 发表年份（最重要）
- authors: 作者列表（数组格式）
- journal: 期刊或会议名称
- doi: DOI 标识符
- url: 任何可访问的链接

**输出格式要求：**
- 必须返回有效的 JSON 数组
- 每个对象代表一条引文
- 如果某个字段无法确定，则省略该字段
- 不要添加任何解释文字，只返回 JSON

**示例输出：**
[
  {
    "title": "Large language models for scientific text processing",
    "authors": ["Brown, A.", "Smith, J."],
    "year": 2024,
    "journal": "Nature Machine Intelligence",
    "doi": "10.1038/s42256-024-00789-1"
  }
]`;
    }

    /**
     * 👤 构造用户提示词
     */
    private buildUserPrompt(rawText: string): string {
        return `请解析以下参考文献文本，提取出所有独立的引文并转换为结构化的 JSON 格式：

\`\`\`
${rawText}
\`\`\`

请返回 JSON 数组，每个对象包含一条引文的结构化信息。重点关注标题和年份的准确提取。`;
    }

    /**
     * 🔀 拆分并行处理长引文文本
     */
    private async parseReferencesInChunks(rawReferencesText: string): Promise<ParsedReference[]> {
        // 智能拆分引文文本
        const chunks = this.splitReferencesText(rawReferencesText);

        console.log(`📦 拆分为 ${chunks.length} 个块进行并行处理`);

        // 并行处理所有块
        const chunkPromises = chunks.map((chunk, index) =>
            this.parseSingleChunk(chunk, `块${index + 1}`)
        );

        // 等待所有并行任务完成
        const chunkResults = await Promise.all(chunkPromises);

        // 合并所有结果
        const allReferences = chunkResults.flat();

        console.log(`✅ 并行处理完成，总共解析到 ${allReferences.length} 条引文`);

        return allReferences;
    }

    /**
     * ✂️ 智能拆分引文文本
     */
    private splitReferencesText(text: string): string[] {
        const chunks: string[] = [];
        const lines = text.split('\n');

        let currentChunk = '';
        let referenceCount = 0;

        for (const line of lines) {
            const trimmedLine = line.trim();

            // 跳过空行
            if (!trimmedLine) {
                currentChunk += line + '\n';
                continue;
            }

            // 检测是否是新的引文开始（简单启发式）
            const isNewReference = this.isLikelyNewReference(trimmedLine);

            if (isNewReference) {
                referenceCount++;
            }

            // 检查是否需要开始新块
            if (currentChunk.length > 0 &&
                (currentChunk.length + line.length > this.MAX_CHUNK_SIZE)) {

                // 保存当前块
                chunks.push(currentChunk.trim());
                currentChunk = '';
                referenceCount = isNewReference ? 1 : 0;
            }

            currentChunk += line + '\n';
        }

        // 添加最后一个块
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks.filter(chunk => chunk.length > 0);
    }

    /**
     * 🔍 判断是否可能是新引文的开始
     */
    private isLikelyNewReference(line: string): boolean {
        // 启发式规则：检测常见的引文开始模式
        const patterns = [
            /^\d+\.\s+/, // 数字编号：1. 2. 3.
            /^\[\d+\]/, // 方括号编号：[1] [2] [3]
            /^[A-Z][a-z]+,\s+[A-Z]\./, // 作者格式：Smith, J.
            /^\w+\s+et\s+al\./, // et al. 格式
            /^\w+\s+\(\d{4}\)/, // 作者(年份)格式
        ];

        return patterns.some(pattern => pattern.test(line));
    }

    /**
     * 📄 处理单个文本块
     */
    private async parseSingleChunk(rawText: string, chunkLabel: string = ''): Promise<ParsedReference[]> {
        const label = chunkLabel ? `[${chunkLabel}] ` : '';
        const maxRetries = 3;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // 构造专家级 Prompt
                const systemPrompt = this.buildSystemPrompt();
                const userPrompt = this.buildUserPrompt(rawText);

                console.log(`${label}🤖 开始解析引文块... (尝试 ${attempt}/${maxRetries})`);
                console.log(`${label}📝 输入文本长度:`, rawText.length);

                // 使用 generateText 而不是 streamText 来获取完整响应
                const result = await generateText({
                    model: this.modelProvider,
                    system: systemPrompt,
                    prompt: userPrompt,
                    temperature: 0.1, // 低温度，确保输出稳定
                    maxTokens: 8000
                });

                const fullResponse = result.text;
                // console.log(`${label}🤖 LLM 响应长度:`, fullResponse.length);
                // console.log(`${label}🤖 LLM 响应:`, fullResponse);

                // 检查响应是否为空
                if (!fullResponse || fullResponse.trim().length === 0) {
                    console.warn(`${label}⚠️ LLM 返回空响应 (尝试 ${attempt}/${maxRetries})`);
                    if (attempt < maxRetries) {
                        continue;
                    } else {
                        console.error(`${label}❌ 经过 ${maxRetries} 次尝试，LLM 仍返回空响应`);
                        return [];
                    }
                }

                // 解析 JSON 响应（带修复功能）
                const parsedReferences = this.parseJsonResponse(fullResponse);

                // 检查解析结果是否为空
                if (parsedReferences.length === 0) {
                    console.warn(`${label}⚠️ 解析结果为空 (尝试 ${attempt}/${maxRetries})`);
                    if (attempt < maxRetries) {
                        continue;
                    } else {
                        console.error(`${label}❌ 经过 ${maxRetries} 次尝试，仍无法获得有效的解析结果`);
                        return [];
                    }
                }
                // console.log(`原始文本：${rawText}`);
                // console.log(`解析结果：${parsedReferences}`);
                console.log(`${label}✅ 解析完成，提取到`, parsedReferences.length, '条引文');
                return parsedReferences;

            } catch (error) {
                console.error(`${label}❌ 引文解析失败 (尝试 ${attempt}/${maxRetries}):`, error);
                
                if (attempt < maxRetries) {
                    console.log(`${label}🔄 准备重试...`);
                    // 等待一小段时间再重试
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    console.error(`${label}❌ 经过 ${maxRetries} 次尝试，解析仍然失败`);
                    return [];
                }
            }
        }

        return [];
    }

    /**
     * 🔍 解析 LLM 的 JSON 响应（带修复功能）
     */
    private parseJsonResponse(response: string): ParsedReference[] {
        try {
            // 清理响应文本，提取 JSON 部分
            let jsonText = response.trim();

            // 移除可能的 markdown 代码块标记
            jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

            // 查找 JSON 数组的开始和结束
            const startIndex = jsonText.indexOf('[');
            const endIndex = jsonText.lastIndexOf(']');

            if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                jsonText = jsonText.substring(startIndex, endIndex + 1);
            }

            // 首先尝试直接解析 JSON
            let parsed;
            try {
                parsed = JSON.parse(jsonText);
            } catch (firstError) {
                console.log('🔧 JSON 解析失败，尝试修复...');

                // 使用 jsonrepair 修复损坏的 JSON
                try {
                    const repairedJson = jsonrepair(jsonText);
                    console.log('✅ JSON 修复成功');
                    parsed = JSON.parse(repairedJson);
                } catch (repairError) {
                    console.error('❌ JSON 修复也失败:', repairError);
                    throw firstError; // 抛出原始错误
                }
            }

            if (Array.isArray(parsed)) {
                return parsed.map(item => this.validateAndCleanReference(item));
            } else {
                console.warn('LLM 返回的不是数组格式');
                return [];
            }

        } catch (error) {
            console.error('JSON 解析失败:', error);
            console.log('原始响应:', response);

            // 尝试从响应中提取部分信息作为备选
            return this.extractFallbackReferences(response);
        }
    }

    /**
     * ✅ 验证和清理单个引文对象（简化版）
     */
    private validateAndCleanReference(item: any): ParsedReference {
        const reference: ParsedReference = {};

        // 清理和验证各个字段
        if (item.title && typeof item.title === 'string') {
            reference.title = item.title.trim();
        }

        if (item.authors) {
            if (Array.isArray(item.authors)) {
                reference.authors = item.authors
                    .filter((author: any) => typeof author === 'string')
                    .map((author: any) => author.trim())
                    .filter((author: any) => author.length > 0);
            } else if (typeof item.authors === 'string') {
                reference.authors = [item.authors.trim()];
            }
        }

        if (item.year) {
            const year = parseInt(item.year);
            if (year >= 1900 && year <= new Date().getFullYear() + 5) {
                reference.year = year;
            }
        }

        if (item.journal && typeof item.journal === 'string') {
            reference.journal = item.journal.trim();
        }

        if (item.doi && typeof item.doi === 'string') {
            reference.doi = item.doi.trim();
        }

        if (item.url && typeof item.url === 'string') {
            reference.url = item.url.trim();
        }

        // 设置置信度
        reference.confidence = (reference.title && reference.year) ? 0.9 : 0.5;

        return reference;
    }

    /**
     * 🆘 备选方案：从响应中提取部分信息
     */
    private extractFallbackReferences(response: string): ParsedReference[] {
        // 如果 JSON 解析失败，尝试从文本中提取一些基本信息
        const lines = response.split('\n').filter(line => line.trim().length > 10);

        return lines.slice(0, 5).map(line => ({
            title: line.substring(0, 100) + '...',
            authors: ['Unknown'],
            year: new Date().getFullYear(),
            confidence: 0.1
        }));
    }
}

// 导出单例实例
export const llmReferenceParser = new LLMReferenceParser(); 