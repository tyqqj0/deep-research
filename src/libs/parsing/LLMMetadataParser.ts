/**
 * 🤖 LLMMetadataParser - AI 驱动的元数据解析器
 * 
 * 🎯 核心职责:
 * - 使用大语言模型从学术论文的原始文本中智能提取关键元数据
 * - 比传统正则表达式更准确、更鲁棒地处理各种格式的论文
 * - 返回结构化的、可直接用于数据库更新的元数据对象
 * 
 * 🧠 工作原理:
 * - 接收论文的完整文本（通常是前几页包含元数据的部分）
 * - 通过精心设计的 Prompt 指示 AI 模型扮演"学术出版专家"
 * - AI 模型识别并提取标题、作者、摘要、DOI 等关键信息
 * - 返回严格的 JSON 格式结果，确保数据一致性
 */

import { LibraryItem } from '../db';
import useModelProvider from '@/hooks/useAiProvider';
import { generateText } from 'ai';

// LLM 解析的元数据接口
export interface LLMParsedMetadata extends Partial<LibraryItem> {
    title?: string;
    authors?: string[];
    abstract?: string;
    keywords?: string[];
    doi?: string;
    publication_year?: number;
    journal_or_conference?: string;
}

export class LLMMetadataParser {
    private modelProvider: any = null;

    /**
     * 🎯 从论文文本中提取元数据
     * 
     * @param paperText - 论文的原始文本（通常是前几页）
     * @returns 结构化的元数据对象
     */
    async parseMetadata(paperText: string): Promise<LLMParsedMetadata> {
        try {
            // 初始化模型提供者
            await this.initializeModelProvider();

            // 预处理文本：取前 8000 字符，确保包含所有元数据
            const truncatedText = this.preprocessText(paperText);

            // 构建专家级 Prompt
            const systemPrompt = this.buildSystemPrompt();
            const userPrompt = this.buildUserPrompt(truncatedText);

            console.log('🤖 开始 LLM 元数据解析...');
            console.log('📝 输入文本长度:', truncatedText.length);

            // 调用 AI 模型
            const result = await generateText({
                model: this.modelProvider,
                system: systemPrompt,
                prompt: userPrompt,
                temperature: 0.1, // 低温度确保一致性
                maxTokens: 2000
            });

            const response = result.text;
            console.log('🤖 LLM 响应:', response);

            // 解析和验证 JSON 响应
            const parsedMetadata = this.parseAndValidateResponse(response);

            console.log('✅ 成功解析元数据:', parsedMetadata);
            return parsedMetadata;

        } catch (error) {
            console.error('LLM metadata parsing failed:', error);

            // 返回基础的错误恢复元数据
            return {
                title: 'Failed to extract title',
                authors: ['Unknown'],
                year: new Date().getFullYear(),
                abstract: 'Failed to extract abstract',
                parseError: error instanceof Error ? error.message : String(error)
            };
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
     * 📝 预处理论文文本
     */
    private preprocessText(text: string): string {
        // 取前 8000 字符，通常包含了所有重要的元数据
        const truncated = text.substring(0, 2500);

        // 清理常见的噪声
        return truncated
            .replace(/\n{3,}/g, '\n\n')  // 合并多余换行
            .replace(/\s{3,}/g, ' ')     // 合并多余空格
            .trim();
    }

    /**
     * 🧠 构建系统提示词
     */
    private buildSystemPrompt(): string {
        return `你是一位专业的学术出版专家，专门负责从学术论文中提取关键元数据信息。

**你的任务：**
1. 仔细分析用户提供的学术论文文本（通常是论文的前几页）
2. 从中识别并提取关键的元数据信息
3. 以严格的 JSON 格式返回结果

**需要提取的字段：**
- title: 论文主标题（最重要）
- authors: 作者列表（数组格式，不包括机构信息）
- abstract: 完整摘要内容（不包括"Abstract"标题本身）
- keywords: 关键词列表（如果有明确列出，否则推断3-5个核心关键词）
- doi: DOI标识符（如 10.xxxx/xxxxx 格式）
- publication_year: 发表年份（从日期、版权信息等推断）
- journal_or_conference: 期刊或会议名称

**输出格式要求：**
- 必须返回有效的 JSON 对象（不是数组）
- 如果某个字段无法确定，则省略该字段
- 不要添加任何解释文字，只返回 JSON

**示例输出：**
{
  "title": "Large Language Models for Academic Text Processing",
  "authors": ["Brown, A.", "Smith, J.", "Wang, L."],
  "abstract": "This paper presents a comprehensive study...",
  "keywords": ["natural language processing", "machine learning", "text analysis"],
  "doi": "10.1038/s42256-024-00789-1",
  "publication_year": 2024,
  "journal_or_conference": "Nature Machine Intelligence"
}`;
    }

    /**
     * 👤 构建用户提示词
     */
    private buildUserPrompt(text: string): string {
        return `请从以下学术论文文本中提取元数据信息，并以 JSON 格式返回：

\`\`\`
${text}
\`\`\`

请严格按照指定的 JSON 格式返回，重点关注标题、作者、摘要的准确提取。`;
    }



    /**
     * 🔍 解析和验证 AI 响应
     */
    private parseAndValidateResponse(response: string): LLMParsedMetadata {
        try {
            // 清理响应文本，移除可能的 markdown 格式
            let cleanResponse = response.trim();

            // 移除可能的 ```json 包装
            if (cleanResponse.startsWith('```json')) {
                cleanResponse = cleanResponse.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
            } else if (cleanResponse.startsWith('```')) {
                cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            // 尝试解析 JSON
            const parsed = JSON.parse(cleanResponse) as LLMParsedMetadata;

            // 验证和标准化数据
            return this.validateAndNormalizeMetadata(parsed);

        } catch (error) {
            console.error('Failed to parse LLM response:', error);
            console.error('Raw response:', response);

            throw new Error(`Invalid JSON response from LLM: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * ✅ 验证和标准化解析出的元数据
     */
    private validateAndNormalizeMetadata(parsed: any): LLMParsedMetadata {
        const normalized: LLMParsedMetadata = {};

        // 标题
        if (parsed.title && typeof parsed.title === 'string') {
            normalized.title = parsed.title.trim();
        }

        // 作者
        if (Array.isArray(parsed.authors)) {
            normalized.authors = parsed.authors
                .filter((author: any) => typeof author === 'string' && author.trim())
                .map((author: string) => author.trim())
                .slice(0, 20); // 限制作者数量
        } else if (typeof parsed.authors === 'string') {
            normalized.authors = [parsed.authors.trim()];
        }

        // 摘要
        if (parsed.abstract && typeof parsed.abstract === 'string') {
            normalized.abstract = parsed.abstract.trim();
        }

        // 关键词
        if (Array.isArray(parsed.keywords)) {
            normalized.keywords = parsed.keywords
                .filter((keyword: any) => typeof keyword === 'string' && keyword.trim())
                .map((keyword: string) => keyword.trim())
                .slice(0, 10); // 限制关键词数量
        }

        // DOI
        if (parsed.doi && typeof parsed.doi === 'string' && parsed.doi !== 'null') {
            normalized.doi = parsed.doi.trim();
        }

        // 年份
        if (parsed.publication_year) {
            const year = parseInt(String(parsed.publication_year));
            if (year > 1000 && year <= new Date().getFullYear() + 2) {
                normalized.year = year;
            }
        }

        // 期刊/会议
        if (parsed.journal_or_conference && typeof parsed.journal_or_conference === 'string' && parsed.journal_or_conference !== 'null') {
            normalized.publication = parsed.journal_or_conference.trim();
        }

        return normalized;
    }

    /**
     * 🧪 测试元数据提取（用于调试）
     */
    async testExtraction(sampleText: string): Promise<{
        success: boolean;
        result?: LLMParsedMetadata;
        error?: string;
        rawResponse?: string;
    }> {
        try {
            await this.initializeModelProvider();
            
            const systemPrompt = this.buildSystemPrompt();
            const userPrompt = this.buildUserPrompt(sampleText);
            
            const result = await generateText({
                model: this.modelProvider,
                system: systemPrompt,
                prompt: userPrompt,
                temperature: 0.1,
                maxTokens: 2000
            });

            const rawResponse = result.text;
            const parsedResult = this.parseAndValidateResponse(rawResponse);

            return {
                success: true,
                result: parsedResult,
                rawResponse
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}

export const llmMetadataParser = new LLMMetadataParser(); 