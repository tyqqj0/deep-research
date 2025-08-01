/**
 * 🧠 Thinker - 思考推理模块  
 * 
 * 职责：实现TVC流程的第一步(Think) - 分析当前路径，生成可能的研究方向
 * 核心是LLM驱动的推理过程
 */

import { MCTSNode, LibraryItem } from '@/libs/db';
import { EvaluationContext } from '../interfaces';

export interface ResearchDirection {
  id: string;
  title: string;
  description: string;
  reasoning: string;
  confidence: number;
  keyWords: string[];
  expectedCitations: number;
}

export interface ThinkingResult {
  directions: ResearchDirection[];
  pathSummary: string;
  reasoning: string;
  confidence: number;
  executionTime: number;
}

export interface IThinker {
  /**
   * 基于当前节点路径生成可能的研究扩展方向
   */
  generateDirections(
    currentNode: MCTSNode,
    context: EvaluationContext
  ): Promise<ThinkingResult>;

  /**
   * 分析从根节点到当前节点的路径意义
   */
  analyzePath(
    path: MCTSNode[],
    context: EvaluationContext
  ): Promise<{
    pathTheme: string;
    evolutionPattern: string;
    gaps: string[];
    suggestedDirections: string[];
  }>;
}

export class DefaultThinker implements IThinker {
  async generateDirections(
    currentNode: MCTSNode,
    context: EvaluationContext
  ): Promise<ThinkingResult> {
    const startTime = Date.now();

    try {
      // 分析当前路径
      const pathAnalysis = await this.analyzePath(context.currentPath, context);

      // 生成研究方向（简化版本，后续可替换为LLM）
      const directions = await this.generateDirectionsBasic(currentNode, context, pathAnalysis);

      const executionTime = Date.now() - startTime;

      return {
        directions,
        pathSummary: pathAnalysis.pathTheme,
        reasoning: `基于路径分析，识别出${directions.length}个可能的研究方向`,
        confidence: 0.75, // 临时固定值
        executionTime
      };

    } catch (error) {
      throw new Error(`Thinking process failed: ${error.message}`);
    }
  }

  async analyzePath(
    path: MCTSNode[],
    context: EvaluationContext
  ) {
    // 简化的路径分析实现
    const pathTheme = `研究主题: ${context.researchTopic}`;
    const evolutionPattern = `路径深度: ${path.length}, 探索模式: 广度优先`;
    
    // 模拟发现的研究空白
    const gaps = [
      '缺乏最新的实验验证',
      '理论与实践结合不足', 
      '跨学科研究机会'
    ];

    const suggestedDirections = [
      '深入理论分析',
      '实验验证研究',
      '应用场景扩展',
      '方法论改进'
    ];

    return {
      pathTheme,
      evolutionPattern,
      gaps,
      suggestedDirections
    };
  }

  private async generateDirectionsBasic(
    currentNode: MCTSNode, 
    context: EvaluationContext,
    pathAnalysis: any
  ): Promise<ResearchDirection[]> {
    // 基础版本：生成固定的研究方向模板
    const baseDirections = [
      {
        title: '理论深化',
        description: '对当前理论框架进行深入分析和扩展',
        keyWords: ['理论', '框架', '模型'],
        expectedCitations: 5
      },
      {
        title: '实验验证', 
        description: '通过实验手段验证理论假设',
        keyWords: ['实验', '验证', '测试'],
        expectedCitations: 3
      },
      {
        title: '应用研究',
        description: '探索理论在实际场景中的应用',
        keyWords: ['应用', '实践', '场景'],
        expectedCitations: 4
      },
      {
        title: '方法改进',
        description: '改进现有方法的效率和准确性',
        keyWords: ['方法', '优化', '改进'],
        expectedCitations: 6
      }
    ];

    return baseDirections.map((dir, index) => ({
      id: `direction_${Date.now()}_${index}`,
      title: dir.title,
      description: dir.description,
      reasoning: `基于路径分析，${dir.title}是一个有价值的研究方向`,
      confidence: 0.7 + Math.random() * 0.2, // 0.7-0.9之间
      keyWords: dir.keyWords,
      expectedCitations: dir.expectedCitations
    }));
  }
}

// LLM增强版本 - 真正的AI驱动思考推理
export class LLMThinker implements IThinker {
  constructor(
    private llmApiKey: string,
    private model: string = 'gpt-3.5-turbo',
    private temperature: number = 0.7,
    private maxTokens: number = 1500
  ) {}

  async generateDirections(
    currentNode: MCTSNode,
    context: EvaluationContext
  ): Promise<ThinkingResult> {
    const startTime = Date.now();

    try {
      // 1. 分析当前路径
      const pathAnalysis = await this.analyzePath(context.currentPath || [], context);

      // 2. 构建LLM提示词
      const prompt = this.buildThinkingPrompt(currentNode, context, pathAnalysis);

      // 3. 调用LLM生成研究方向
      const response = await this.callLLM(prompt);

      // 4. 解析LLM响应
      const directions = this.parseDirectionsFromResponse(response);

      const executionTime = Date.now() - startTime;

      return {
        directions,
        pathSummary: pathAnalysis.pathTheme,
        reasoning: `基于LLM分析，从${pathAnalysis.gaps.length}个研究空白中识别出${directions.length}个有价值的扩展方向`,
        confidence: this.calculateLLMConfidence(response, directions),
        executionTime
      };

    } catch (error) {
      console.error('LLM思考过程失败:', error);
      // 降级到默认实现
      const defaultThinker = new DefaultThinker();
      return await defaultThinker.generateDirections(currentNode, context);
    }
  }

  async analyzePath(
    path: MCTSNode[],
    context: EvaluationContext
  ) {
    try {
      // 构建路径分析提示词
      const pathPrompt = this.buildPathAnalysisPrompt(path, context);

      // 调用LLM进行路径分析
      const response = await this.callLLM(pathPrompt);

      // 解析分析结果
      return this.parsePathAnalysisFromResponse(response, path, context);

    } catch (error) {
      console.error('LLM路径分析失败:', error);
      // 降级到简化分析
      return {
        pathTheme: `研究主题: ${context.researchTopic}`,
        evolutionPattern: `路径深度: ${path.length}, 探索状态: 深度优先`,
        gaps: ['理论深化机会', '实验验证空间', '应用拓展方向'],
        suggestedDirections: ['理论建模', '实证研究', '技术应用', '跨域融合']
      };
    }
  }

  private buildThinkingPrompt(
    currentNode: MCTSNode,
    context: EvaluationContext,
    pathAnalysis: any
  ): string {
    return `
# 研究方向生成任务

## 研究背景
- **研究主题**: ${context.researchTopic}
- **当前路径深度**: ${context.currentPath?.length || 0}
- **路径主题**: ${pathAnalysis.pathTheme}
- **演进模式**: ${pathAnalysis.evolutionPattern}

## 已识别的研究空白
${pathAnalysis.gaps.map((gap, index) => `${index + 1}. ${gap}`).join('\n')}

## 建议的研究方向
${pathAnalysis.suggestedDirections.map((dir, index) => `${index + 1}. ${dir}`).join('\n')}

## 当前节点信息
- **节点ID**: ${currentNode.id}
- **访问次数**: ${currentNode.visits}
- **成功率**: ${currentNode.visits > 0 ? (currentNode.wins / currentNode.visits).toFixed(2) : '0.00'}

## 任务要求
请基于以上信息，生成3-5个具体的研究扩展方向。每个方向应该：
1. **创新性**: 在现有基础上有明确的创新点
2. **可行性**: 有实际的研究和实施路径
3. **价值性**: 对整体研究目标有重要贡献
4. **具体性**: 有明确的研究内容和预期成果

## 输出格式
请严格按照以下JSON格式输出：

\`\`\`json
{
  "directions": [
    {
      "title": "研究方向标题",
      "description": "详细描述研究内容、方法和预期成果",
      "reasoning": "选择这个方向的理由和创新点",
      "confidence": 0.85,
      "keyWords": ["关键词1", "关键词2", "关键词3"],
      "expectedCitations": 6
    }
  ],
  "analysis": {
    "overallStrategy": "整体研究策略说明",
    "innovationPoints": ["创新点1", "创新点2"],
    "challenges": ["挑战1", "挑战2"]
  }
}
\`\`\`
`;
  }

  private buildPathAnalysisPrompt(path: MCTSNode[], context: EvaluationContext): string {
    return `
# 研究路径分析任务

## 研究主题
${context.researchTopic}

## 当前探索路径
路径长度: ${path.length}
${path.map((node, index) => `第${index + 1}层: 节点${node.id} (访问${node.visits}次, 成功率${node.visits > 0 ? (node.wins / node.visits * 100).toFixed(1) : '0'}%)`).join('\n')}

## 分析任务
请分析这条研究路径，提供以下洞察：

1. **路径主题**: 整条路径体现的研究主题和方向
2. **演进模式**: 研究如何从浅层向深层发展
3. **研究空白**: 当前路径中缺失的重要研究维度
4. **建议方向**: 下一步可能的有价值研究方向

## 输出格式
请严格按照以下JSON格式输出：

\`\`\`json
{
  "pathTheme": "路径整体主题总结",
  "evolutionPattern": "研究演进模式描述",
  "gaps": ["研究空白1", "研究空白2", "研究空白3"],
  "suggestedDirections": ["建议方向1", "建议方向2", "建议方向3", "建议方向4"],
  "insights": {
    "strengths": ["路径优势1", "路径优势2"],
    "weaknesses": ["路径不足1", "路径不足2"],
    "opportunities": ["机会1", "机会2"]
  }
}
\`\`\`
`;
  }

  private async callLLM(prompt: string): Promise<string> {
    try {
      // 这里应该调用实际的LLM API
      // 为了演示，我们使用一个模拟的响应
      
      if (process.env.NODE_ENV === 'development') {
        // 开发环境下返回模拟响应
        return this.getMockLLMResponse(prompt);
      }

      // 实际的API调用代码（需要根据具体的LLM服务调整）
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.llmApiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的学术研究助手，擅长分析研究方向和生成有价值的学术见解。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: this.temperature,
          max_tokens: this.maxTokens
        })
      });

      if (!response.ok) {
        throw new Error(`LLM API调用失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '';

    } catch (error) {
      console.error('LLM API调用错误:', error);
      throw error;
    }
  }

  private getMockLLMResponse(prompt: string): string {
    if (prompt.includes('研究方向生成任务')) {
      return `
\`\`\`json
{
  "directions": [
    {
      "title": "多模态深度学习架构优化",
      "description": "结合视觉、文本和音频信息的统一深度学习框架，重点解决模态间信息融合和特征对齐问题，预期在多媒体理解任务上实现显著性能提升",
      "reasoning": "当前多模态学习存在模态差异大、融合效果差的问题，该方向有明确的技术创新点和应用价值",
      "confidence": 0.82,
      "keyWords": ["多模态学习", "深度融合", "特征对齐", "架构优化"],
      "expectedCitations": 8
    },
    {
      "title": "联邦学习隐私保护机制",
      "description": "设计新型差分隐私和同态加密结合的联邦学习框架，在保证模型性能的同时最大化数据隐私保护，适用于医疗、金融等敏感领域",
      "reasoning": "隐私保护是联邦学习的核心挑战，现有方案在隐私-效用平衡上仍有改进空间",
      "confidence": 0.78,
      "keyWords": ["联邦学习", "差分隐私", "同态加密", "隐私保护"],
      "expectedCitations": 6
    },
    {
      "title": "自适应神经网络压缩算法",
      "description": "开发基于任务特征自动调整压缩策略的神经网络压缩方法，实现模型大小和性能的最优平衡，特别适用于边缘计算场景",
      "reasoning": "现有压缩方法多为静态策略，缺乏对具体任务的自适应能力，该方向具有重要的实用价值",
      "confidence": 0.75,
      "keyWords": ["模型压缩", "自适应算法", "边缘计算", "神经网络优化"],
      "expectedCitations": 5
    }
  ],
  "analysis": {
    "overallStrategy": "围绕AI系统的实用化和产业化需求，重点关注多模态、隐私保护和模型优化三个核心方向",
    "innovationPoints": ["模态融合新架构", "隐私-效用平衡机制", "自适应压缩策略"],
    "challenges": ["技术复杂度高", "评估标准不统一", "实际部署难度大"]
  }
}
\`\`\`
`;
    } else {
      return `
\`\`\`json
{
  "pathTheme": "人工智能理论与应用深度融合的研究路径",
  "evolutionPattern": "从基础理论研究逐步向实际应用场景扩展，体现了从抽象到具体的研究演进",
  "gaps": ["缺乏跨学科交叉研究", "实验验证不够充分", "产业应用案例较少", "理论创新有限"],
  "suggestedDirections": ["理论突破与创新", "大规模实验验证", "产业应用拓展", "跨学科融合研究"],
  "insights": {
    "strengths": ["研究深度逐步增加", "技术路线相对清晰"],
    "weaknesses": ["创新突破点不够明显", "应用场景相对单一"],
    "opportunities": ["新兴技术融合机会", "产业需求快速增长"]
  }
}
\`\`\`
`;
    }
  }

  private parseDirectionsFromResponse(response: string): ResearchDirection[] {
    try {
      // 提取JSON部分
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('响应中未找到有效的JSON格式');
      }

      const data = JSON.parse(jsonMatch[1]);
      const directions = data.directions || [];

      return directions.map((dir: any, index: number) => ({
        id: `llm_direction_${Date.now()}_${index}`,
        title: dir.title || '未命名研究方向',
        description: dir.description || '暂无描述',
        reasoning: dir.reasoning || '基于LLM分析生成',
        confidence: Math.min(1, Math.max(0, dir.confidence || 0.7)),
        keyWords: Array.isArray(dir.keyWords) ? dir.keyWords : [],
        expectedCitations: Math.max(1, dir.expectedCitations || 3)
      }));

    } catch (error) {
      console.error('解析LLM响应失败:', error);
      // 返回降级结果
      return [{
        id: `fallback_direction_${Date.now()}`,
        title: '深度理论研究',
        description: '基于当前研究基础进行深入的理论分析和方法改进',
        reasoning: 'LLM解析失败，使用降级方案',
        confidence: 0.6,
        keyWords: ['理论研究', '方法改进'],
        expectedCitations: 3
      }];
    }
  }

  private parsePathAnalysisFromResponse(response: string, path: MCTSNode[], context: EvaluationContext) {
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('路径分析响应中未找到有效的JSON格式');
      }

      const data = JSON.parse(jsonMatch[1]);

      return {
        pathTheme: data.pathTheme || `研究主题: ${context.researchTopic}`,
        evolutionPattern: data.evolutionPattern || `路径深度: ${path.length}, 演进模式: 深度探索`,
        gaps: Array.isArray(data.gaps) ? data.gaps : ['理论深化机会', '实验验证需求'],
        suggestedDirections: Array.isArray(data.suggestedDirections) ? data.suggestedDirections : ['理论建模', '实证验证']
      };

    } catch (error) {
      console.error('解析路径分析响应失败:', error);
      // 返回降级结果
      return {
        pathTheme: `研究主题: ${context.researchTopic}`,
        evolutionPattern: `路径深度: ${path.length}, 探索状态: 持续深入`,
        gaps: ['需要更多理论支撑', '缺乏实验验证', '应用场景有限'],
        suggestedDirections: ['理论创新', '实验设计', '应用拓展', '方法优化']
      };
    }
  }

  private calculateLLMConfidence(response: string, directions: ResearchDirection[]): number {
    // 基于响应质量和方向数量计算置信度
    let confidence = 0.7; // 基础置信度

    // 如果成功解析出方向，提高置信度
    if (directions.length > 0) {
      confidence += 0.1;
    }

    // 基于方向的平均置信度调整
    if (directions.length > 0) {
      const avgDirectionConfidence = directions.reduce((sum, dir) => sum + dir.confidence, 0) / directions.length;
      confidence = (confidence + avgDirectionConfidence) / 2;
    }

    // 基于响应长度调整（更详细的响应通常质量更高）
    if (response.length > 500) {
      confidence += 0.05;
    }

    return Math.min(1, Math.max(0.3, confidence));
  }
}