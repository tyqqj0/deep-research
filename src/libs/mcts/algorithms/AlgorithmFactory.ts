/**
 * 🏭 算法工厂 - 可插拔算法管理器
 * 
 * 核心职责：
 * - 根据配置创建具体的算法实现
 * - 管理算法类型注册和发现
 * - 提供算法升级和切换的统一接口
 * 
 * 设计优势：
 * - 支持运行时算法切换
 * - 便于添加新的算法实现
 * - 配置驱动的算法选择
 */

import {
  NodeEvaluator,
  NodeExpander, 
  SelectionStrategy,
  AlgorithmFactory as IAlgorithmFactory,
  AlgorithmConfiguration,
  AlgorithmError
} from './interfaces';

import {
  DefaultNodeEvaluator,
  DefaultNodeExpander,
  DefaultSelectionStrategy
} from './DefaultAlgorithms';

// 算法实现注册表
interface AlgorithmRegistry {
  evaluators: Map<string, new (config?: any) => NodeEvaluator>;
  expanders: Map<string, new (config?: any) => NodeExpander>;
  selectors: Map<string, new (config?: any) => SelectionStrategy>;
}

export class AlgorithmFactory implements IAlgorithmFactory {
  private registry: AlgorithmRegistry;

  constructor() {
    this.registry = {
      evaluators: new Map(),
      expanders: new Map(),
      selectors: new Map()
    };
    
    // 注册默认算法
    this.registerDefaultAlgorithms();
  }

  // ==================== 算法创建方法 ====================

  createEvaluator(type: string, config?: any): NodeEvaluator {
    const EvaluatorClass = this.registry.evaluators.get(type);
    if (!EvaluatorClass) {
      throw new AlgorithmError(
        `未知的评估器类型: ${type}`,
        'evaluator',
        { availableTypes: this.getAvailableEvaluators() }
      );
    }
    
    try {
      return new EvaluatorClass(config);
    } catch (error) {
      throw new AlgorithmError(
        `创建评估器失败: ${error.message}`,
        'evaluator',
        { type, config, error }
      );
    }
  }

  createExpander(type:string, config?: any): NodeExpander {
    const ExpanderClass = this.registry.expanders.get(type);
    if (!ExpanderClass) {
      throw new AlgorithmError(
        `未知的扩展器类型: ${type}`,
        'expander',
        { availableTypes: this.getAvailableExpanders() }
      );
    }
    
    try {
      return new ExpanderClass(config);
    } catch (error) {
      throw new AlgorithmError(
        `创建扩展器失败: ${error.message}`,
        'expander',
        { type, config, error }
      );
    }
  }

  createSelector(type: string, config?: any): SelectionStrategy {
    const SelectorClass = this.registry.selectors.get(type);
    if (!SelectorClass) {
      throw new AlgorithmError(
        `未知的选择策略类型: ${type}`,
        'selector',
        { availableTypes: this.getAvailableSelectors() }
      );
    }
    
    try {
      return new SelectorClass(config);
    } catch (error) {
      throw new AlgorithmError(
        `创建选择策略失败: ${error.message}`,
        'selector',
        { type, config, error }
      );
    }
  }

  // ==================== 算法发现方法 ====================

  getAvailableEvaluators(): string[] {
    return Array.from(this.registry.evaluators.keys());
  }

  getAvailableExpanders(): string[] {
    return Array.from(this.registry.expanders.keys());
  }

  getAvailableSelectors(): string[] {
    return Array.from(this.registry.selectors.keys());
  }

  // ==================== 算法注册方法 ====================

  registerEvaluator(type: string, evaluatorClass: new (config?: any) => NodeEvaluator): void {
    if (this.registry.evaluators.has(type)) {
      console.warn(`评估器类型 ${type} 已存在，将被覆盖`);
    }
    this.registry.evaluators.set(type, evaluatorClass);
  }

  registerExpander(type: string, expanderClass: new (config?: any) => NodeExpander): void {
    if (this.registry.expanders.has(type)) {
      console.warn(`扩展器类型 ${type} 已存在，将被覆盖`);
    }
    this.registry.expanders.set(type, expanderClass);
  }

  registerSelector(type: string, selectorClass: new (config?: any) => SelectionStrategy): void {
    if (this.registry.selectors.has(type)) {
      console.warn(`选择策略类型 ${type} 已存在，将被覆盖`);
    }
    this.registry.selectors.set(type, selectorClass);
  }

  // ==================== 配置驱动的算法套件创建 ====================

  createAlgorithmSuite(configuration: AlgorithmConfiguration) {
    try {
      const evaluator = this.createEvaluator(
        configuration.evaluator.type, 
        configuration.evaluator.config
      );
      
      const expander = this.createExpander(
        configuration.expander.type,
        configuration.expander.config  
      );
      
      const selector = this.createSelector(
        configuration.selector.type,
        configuration.selector.config
      );

      return {
        evaluator,
        expander,
        selector,
        config: configuration.global
      };
    } catch (error) {
      throw new AlgorithmError(
        `创建算法套件失败: ${error.message}`,
        'factory',
        { configuration, error }
      );
    }
  }

  // ==================== 算法信息和元数据 ====================

  getAlgorithmInfo() {
    return {
      evaluators: this.getAvailableEvaluators().map(type => ({
        type,
        description: this.getAlgorithmDescription('evaluator', type),
        parameters: this.getAlgorithmParameters('evaluator', type)
      })),
      expanders: this.getAvailableExpanders().map(type => ({
        type,
        description: this.getAlgorithmDescription('expander', type),
        parameters: this.getAlgorithmParameters('expander', type)
      })),
      selectors: this.getAvailableSelectors().map(type => ({
        type,
        description: this.getAlgorithmDescription('selector', type),
        parameters: this.getAlgorithmParameters('selector', type)
      }))
    };
  }

  // ==================== 默认配置生成 ====================

  getDefaultConfiguration(): AlgorithmConfiguration {
    return {
      evaluator: {
        type: 'default',
        config: {
          graphWeight: 0.7,
          llmModel: 'gpt-3.5-turbo',
          temperatureWeight: 0.8,
          usePageRank: true,
          useCitationCount: true
        }
      },
      expander: {
        type: 'default',
        config: {
          maxCandidates: 5,
          useNLI: false, // 默认关闭，需要LLM支持
          temporalValidation: true,
          retrievalMethod: 'keyword'
        }
      },
      selector: {
        type: 'default',
        config: {
          explorationConstant: 1.41, // 标准UCT参数
          semanticWeight: 0.3,
          adaptiveExploration: false,
          llmGuidanceStrength: 0.5
        }
      },
      global: {
        explorationConstant: 1.41,
        semanticWeight: 0.3,
        maxIterations: 100,
        maxDepth: 8,
        temperatureDecay: 0.95,
        batchSize: 1
      }
    };
  }

  // ==================== 私有辅助方法 ====================

  private registerDefaultAlgorithms(): void {
    // 注册默认算法实现
    this.registerEvaluator('default', DefaultNodeEvaluator);
    this.registerEvaluator('graph-based', DefaultNodeEvaluator); // 暂时复用
    this.registerEvaluator('hybrid', DefaultNodeEvaluator); // 暂时复用
    
    this.registerExpander('default', DefaultNodeExpander);
    this.registerExpander('citation-based', DefaultNodeExpander); // 暂时复用
    this.registerExpander('semantic', DefaultNodeExpander); // 暂时复用
    
    this.registerSelector('default', DefaultSelectionStrategy);
    this.registerSelector('traditional-uct', DefaultSelectionStrategy); // 暂时复用
    this.registerSelector('sg-uct', DefaultSelectionStrategy); // 暂时复用
  }

  private getAlgorithmDescription(category: string, type: string): string {
    // 返回算法描述信息
    const descriptions: Record<string, Record<string, string>> = {
      evaluator: {
        'default': '基础节点评估器，结合图结构和简化语义分析',
        'graph-based': '基于图结构特征的节点重要性评估',
        'llm-enhanced': 'LLM增强的语义评估器（待实现）',
        'hybrid': '混合评估策略，结合多种评估方法'
      },
      expander: {
        'default': '默认节点扩展器，基于关键词匹配和时序验证',
        'citation-based': '基于引用关系的智能扩展',
        'tvc-process': 'TVC过程驱动的节点扩展（待实现）',
        'semantic': '语义相似性驱动的扩展策略'
      },
      selector: {
        'default': '标准UCT选择策略的简化实现',
        'traditional-uct': '经典蒙特卡洛树搜索UCT算法',
        'sg-uct': 'LLM增强的自引导UCT选择策略（待实现）',
        'adaptive': '自适应探索常数的选择策略'
      }
    };

    return descriptions[category]?.[type] || '未知算法类型';
  }

  private getAlgorithmParameters(category: string, type: string): Record<string, any> {
    // 返回算法参数信息
    const parameters: Record<string, Record<string, any>> = {
      evaluator: {
        'default': {
          graphWeight: { type: 'number', default: 0.7, range: [0, 1], description: '图结构权重γ' },
          llmModel: { type: 'string', default: 'gpt-3.5-turbo', description: 'LLM模型名称' }
        }
      },
      expander: {
        'default': {
          maxCandidates: { type: 'number', default: 5, range: [1, 20], description: '最大候选数量' },
          temporalValidation: { type: 'boolean', default: true, description: '启用时序验证' }
        }
      },
      selector: {
        'default': {
          explorationConstant: { type: 'number', default: 1.41, range: [0.1, 5], description: 'UCT探索常数c' },
          semanticWeight: { type: 'number', default: 0.3, range: [0, 1], description: '语义权重λ' }
        }
      }
    };

    return parameters[category]?.[type] || {};
  }
}

// 导出单例工厂实例
export const algorithmFactory = new AlgorithmFactory();

// 便利函数：创建默认算法套件
export function createDefaultAlgorithmSuite() {
  return algorithmFactory.createAlgorithmSuite(
    algorithmFactory.getDefaultConfiguration()
  );
}