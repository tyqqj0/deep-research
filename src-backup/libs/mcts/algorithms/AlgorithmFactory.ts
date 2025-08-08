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

import { AlgorithmTemplate } from '../templates/AlgorithmTemplate';
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

// 导入新的细粒度模块
import { IThinker, DefaultThinker, LLMThinker } from './modules/Thinker';
import { IFormulator, DefaultFormulator, LLMFormulator } from './modules/Formulator';
import { ICiter, DefaultCiter, SemanticCiter, NLICiter } from './modules/Citer';
import { IValidator, DefaultValidator, LLMValidator } from './modules/Validator';
import { ILocator, DefaultLocator, LLMLocator, AdaptiveLocator } from './modules/Locator';
import { IRewardCalculator, DefaultRewardCalculator, MLRewardCalculator, LLMRewardCalculator } from './modules/RewardCalculator';
import { IExpander, DefaultExpander, AdvancedExpander } from './modules/Expander';

// 算法实现注册表
interface AlgorithmRegistry {
  // 传统的三大组件（向后兼容）
  evaluators: Map<string, new (config?: any) => NodeEvaluator>;
  expanders: Map<string, new (config?: any) => NodeExpander>;
  selectors: Map<string, new (config?: any) => SelectionStrategy>;
  
  // 新的细粒度模块
  thinkers: Map<string, new (config?: any) => IThinker>;
  formulators: Map<string, new (config?: any) => IFormulator>;
  citers: Map<string, new (config?: any) => ICiter>;
  validators: Map<string, new (config?: any) => IValidator>;
  locators: Map<string, new (config?: any) => ILocator>;
  rewardCalculators: Map<string, new (config?: any) => IRewardCalculator>;
  modularExpanders: Map<string, new (config?: any) => IExpander>;
}

// 细粒度模块配置接口
export interface ModularAlgorithmConfiguration {
  thinker: { type: string; config?: any };
  formulator: { type: string; config?: any };
  citer: { type: string; config?: any };
  validator: { type: string; config?: any };
  locator: { type: string; config?: any };
  rewardCalculator: { type: string; config?: any };
  expander: { type: string; config?: any };
  global?: any;
}

export class AlgorithmFactory implements IAlgorithmFactory {
  private registry: AlgorithmRegistry;

  constructor() {
    this.registry = {
      // 传统组件
      evaluators: new Map(),
      expanders: new Map(),
      selectors: new Map(),
      
      // 细粒度模块
      thinkers: new Map(),
      formulators: new Map(),
      citers: new Map(),
      validators: new Map(),
      locators: new Map(),
      rewardCalculators: new Map(),
      modularExpanders: new Map()
    };
    
    // 注册默认算法
    this.registerDefaultAlgorithms();
    this.registerModularAlgorithms();
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

  // ==================== 细粒度模块创建方法 ====================

  createThinker(type: string, config?: any): IThinker {
    const ThinkerClass = this.registry.thinkers.get(type);
    if (!ThinkerClass) {
      throw new AlgorithmError(
        `未知的思考器类型: ${type}`,
        'thinker',
        { availableTypes: this.getAvailableThinkers() }
      );
    }

    try {
      // 🎯 支持SessionConnector依赖注入
      if (config && config.sessionConnector) {
        return new ThinkerClass(config.sessionConnector);
      } else {
        return new ThinkerClass(config);
      }
    } catch (error) {
      throw new AlgorithmError(
        `创建思考器失败: ${error.message}`,
        'thinker',
        { type, config, error }
      );
    }
  }

  createFormulator(type: string, config?: any): IFormulator {
    const FormulatorClass = this.registry.formulators.get(type);
    if (!FormulatorClass) {
      throw new AlgorithmError(
        `未知的表述器类型: ${type}`,
        'formulator',
        { availableTypes: this.getAvailableFormulators() }
      );
    }
    
    try {
      return new FormulatorClass(config);
    } catch (error) {
      throw new AlgorithmError(
        `创建表述器失败: ${error.message}`,
        'formulator',
        { type, config, error }
      );
    }
  }

  createCiter(type: string, config?: any): ICiter {
    const CiterClass = this.registry.citers.get(type);
    if (!CiterClass) {
      throw new AlgorithmError(
        `未知的引用器类型: ${type}`,
        'citer',
        { availableTypes: this.getAvailableCiters() }
      );
    }

    try {
      // 🎯 支持SessionConnector依赖注入
      if (config && config.sessionConnector) {
        return new CiterClass(config.sessionConnector);
      } else {
        return new CiterClass(config);
      }
    } catch (error) {
      throw new AlgorithmError(
        `创建引用器失败: ${error.message}`,
        'citer',
        { type, config, error }
      );
    }
  }

  createValidator(type: string, config?: any): IValidator {
    const ValidatorClass = this.registry.validators.get(type);
    if (!ValidatorClass) {
      throw new AlgorithmError(
        `未知的验证器类型: ${type}`,
        'validator',
        { availableTypes: this.getAvailableValidators() }
      );
    }
    
    try {
      return new ValidatorClass(config);
    } catch (error) {
      throw new AlgorithmError(
        `创建验证器失败: ${error.message}`,
        'validator',
        { type, config, error }
      );
    }
  }

  createLocator(type: string, config?: any): ILocator {
    const LocatorClass = this.registry.locators.get(type);
    if (!LocatorClass) {
      throw new AlgorithmError(
        `未知的定位器类型: ${type}`,
        'locator',
        { availableTypes: this.getAvailableLocators() }
      );
    }
    
    try {
      return new LocatorClass(config);
    } catch (error) {
      throw new AlgorithmError(
        `创建定位器失败: ${error.message}`,
        'locator',
        { type, config, error }
      );
    }
  }

  createRewardCalculator(type: string, config?: any): IRewardCalculator {
    const RewardCalculatorClass = this.registry.rewardCalculators.get(type);
    if (!RewardCalculatorClass) {
      throw new AlgorithmError(
        `未知的奖励计算器类型: ${type}`,
        'rewardCalculator',
        { availableTypes: this.getAvailableRewardCalculators() }
      );
    }
    
    try {
      return new RewardCalculatorClass(config);
    } catch (error) {
      throw new AlgorithmError(
        `创建奖励计算器失败: ${error.message}`,
        'rewardCalculator',
        { type, config, error }
      );
    }
  }

  createModularExpander(type: string, config?: any): IExpander {
    const ExpanderClass = this.registry.modularExpanders.get(type);
    if (!ExpanderClass) {
      throw new AlgorithmError(
        `未知的模块化扩展器类型: ${type}`,
        'modularExpander',
        { availableTypes: this.getAvailableModularExpanders() }
      );
    }

    try {
      // 🎯 修复：正确传递依赖注入参数
      if (config && config.thinker && config.formulator && config.citer && config.validator && config.rewardCalculator) {
        return new ExpanderClass(
          config.thinker,
          config.formulator,
          config.citer,
          config.validator,
          config.rewardCalculator
        );
      } else {
        // 兼容旧的配置方式
        return new ExpanderClass(config);
      }
    } catch (error) {
      throw new AlgorithmError(
        `创建模块化扩展器失败: ${error.message}`,
        'modularExpander',
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

  // 细粒度模块发现方法
  getAvailableThinkers(): string[] {
    return Array.from(this.registry.thinkers.keys());
  }

  getAvailableFormulators(): string[] {
    return Array.from(this.registry.formulators.keys());
  }

  getAvailableCiters(): string[] {
    return Array.from(this.registry.citers.keys());
  }

  getAvailableValidators(): string[] {
    return Array.from(this.registry.validators.keys());
  }

  getAvailableLocators(): string[] {
    return Array.from(this.registry.locators.keys());
  }

  getAvailableRewardCalculators(): string[] {
    return Array.from(this.registry.rewardCalculators.keys());
  }

  getAvailableModularExpanders(): string[] {
    return Array.from(this.registry.modularExpanders.keys());
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

  // 细粒度模块注册方法
  registerThinker(type: string, thinkerClass: new (config?: any) => IThinker): void {
    if (this.registry.thinkers.has(type)) {
      console.warn(`思考器类型 ${type} 已存在，将被覆盖`);
    }
    this.registry.thinkers.set(type, thinkerClass);
  }

  registerFormulator(type: string, formulatorClass: new (config?: any) => IFormulator): void {
    if (this.registry.formulators.has(type)) {
      console.warn(`表述器类型 ${type} 已存在，将被覆盖`);
    }
    this.registry.formulators.set(type, formulatorClass);
  }

  registerCiter(type: string, citerClass: new (config?: any) => ICiter): void {
    if (this.registry.citers.has(type)) {
      console.warn(`引用器类型 ${type} 已存在，将被覆盖`);
    }
    this.registry.citers.set(type, citerClass);
  }

  registerValidator(type: string, validatorClass: new (config?: any) => IValidator): void {
    if (this.registry.validators.has(type)) {
      console.warn(`验证器类型 ${type} 已存在，将被覆盖`);
    }
    this.registry.validators.set(type, validatorClass);
  }

  registerLocator(type: string, locatorClass: new (config?: any) => ILocator): void {
    if (this.registry.locators.has(type)) {
      console.warn(`定位器类型 ${type} 已存在，将被覆盖`);
    }
    this.registry.locators.set(type, locatorClass);
  }

  registerRewardCalculator(type: string, rewardCalculatorClass: new (config?: any) => IRewardCalculator): void {
    if (this.registry.rewardCalculators.has(type)) {
      console.warn(`奖励计算器类型 ${type} 已存在，将被覆盖`);
    }
    this.registry.rewardCalculators.set(type, rewardCalculatorClass);
  }

  registerModularExpander(type: string, expanderClass: new (config?: any) => IExpander): void {
    if (this.registry.modularExpanders.has(type)) {
      console.warn(`模块化扩展器类型 ${type} 已存在，将被覆盖`);
    }
    this.registry.modularExpanders.set(type, expanderClass);
  }

  // ==================== 配置驱动的算法套件创建 ====================

  /**
   * 🆕 从算法模板创建套件
   * @param template 算法模板
   * @returns 完整的模块化算法套件
   */
  createSuiteFromTemplate(template: AlgorithmTemplate, sessionConnector?: any) {
    const config = { ...template.configuration };
    if (sessionConnector) {
      (config as any).sessionConnector = sessionConnector;
    }
    return this.createModularAlgorithmSuite(config);
  }


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

  // 创建细粒度模块化算法套件
  createModularAlgorithmSuite(configuration: ModularAlgorithmConfiguration) {
    try {
      // 🎯 传递SessionConnector到各个模块
      const thinkerConfig = {
        ...configuration.thinker.config,
        sessionConnector: (configuration as any).sessionConnector
      };

      const citerConfig = {
        ...configuration.citer.config,
        sessionConnector: (configuration as any).sessionConnector
      };

      const thinker = this.createThinker(
        configuration.thinker.type,
        thinkerConfig
      );

      const formulator = this.createFormulator(
        configuration.formulator.type,
        configuration.formulator.config
      );

      const citer = this.createCiter(
        configuration.citer.type,
        citerConfig
      );
      
      const validator = this.createValidator(
        configuration.validator.type,
        configuration.validator.config
      );
      
      const locator = this.createLocator(
        configuration.locator.type,
        configuration.locator.config
      );
      
      const rewardCalculator = this.createRewardCalculator(
        configuration.rewardCalculator.type,
        configuration.rewardCalculator.config
      );
      
      // 创建带有依赖注入的扩展器
      const expanderConfig = {
        ...configuration.expander.config,
        thinker,
        formulator,
        citer,
        validator,
        rewardCalculator
      };
      
      const expander = this.createModularExpander(
        configuration.expander.type,
        expanderConfig
      );

      return {
        // 细粒度模块
        thinker,
        formulator,
        citer,
        validator,
        locator,
        rewardCalculator,
        expander,
        
        // 全局配置
        config: configuration.global
      };
      
    } catch (error) {
      throw new AlgorithmError(
        `创建模块化算法套件失败: ${error.message}`,
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

  // 获取默认的模块化配置
  getDefaultModularConfiguration(): ModularAlgorithmConfiguration {
    return {
      thinker: {
        type: 'default',
        config: {
          maxDirections: 5,
          diversityThreshold: 0.3,
          minConfidence: 0.6
        }
      },
      formulator: {
        type: 'default',
        config: {
          maxVariants: 3,
          keywordThreshold: 0.5
        }
      },
      citer: {
        type: 'default',
        config: {
          maxCitations: 10,
          diversityWeight: 0.3,
          relevanceThreshold: 0.3  // 🎯 降低阈值从0.6到0.3，增加匹配成功率
        }
      },
      validator: {
        type: 'default',
        config: {
          qualityThreshold: 0.4,  // 🎯 降低质量阈值从0.6到0.4
          duplicationThreshold: 0.8,
          validateTVC: true
        }
      },
      locator: {
        type: 'default',
        config: {
          explorationConstant: 1.41,
          semanticWeight: 0.3,
          adaptiveExploration: false
        }
      },
      rewardCalculator: {
        type: 'default',
        config: {
          importanceWeight: 0.4,
          citationWeight: 0.3,
          pathWeight: 0.3,
          useNormalization: true
        }
      },
      expander: {
        type: 'default',
        config: {
          maxCandidates: 8,  // 🎯 增加候选数量从5到8
          minValidationScore: 0.4,  // 🎯 降低验证分数阈值从0.6到0.4
          minRewardThreshold: 0.3,  // 🎯 降低奖励阈值从0.5到0.3
          enableParallelProcessing: true,
          skipLowQualityNodes: false
        }
      },
      global: {
        llmModel: 'gpt-3.5-turbo',
        temperature: 0.3,
        maxTokens: 2000,
        enableCaching: true,
        enableLogging: true
      }
    };
  }

  // ==================== 私有辅助方法 ====================

  private registerDefaultAlgorithms(): void {
    // 注册默认算法实现
    this.registerEvaluator('default', DefaultNodeEvaluator);
    this.registerEvaluator('llm-enhanced', DefaultNodeEvaluator); // 🎯 添加缺失的类型
    this.registerEvaluator('graph-based', DefaultNodeEvaluator); // 暂时复用
    this.registerEvaluator('hybrid', DefaultNodeEvaluator); // 暂时复用

    this.registerExpander('default', DefaultNodeExpander);
    this.registerExpander('tvc-process', DefaultNodeExpander); // 🎯 添加缺失的类型
    this.registerExpander('citation-based', DefaultNodeExpander); // 暂时复用
    this.registerExpander('semantic', DefaultNodeExpander); // 暂时复用

    this.registerSelector('default', DefaultSelectionStrategy);
    this.registerSelector('sg-uct', DefaultSelectionStrategy); // 🎯 添加缺失的类型
    this.registerSelector('traditional-uct', DefaultSelectionStrategy); // 暂时复用
    this.registerSelector('adaptive', DefaultSelectionStrategy); // 暂时复用
  }

  private registerModularAlgorithms(): void {
    // 注册Thinker模块
    this.registerThinker('default', DefaultThinker);
    this.registerThinker('llm', LLMThinker);
    
    // 注册Formulator模块
    this.registerFormulator('default', DefaultFormulator);
    this.registerFormulator('llm', LLMFormulator);
    
    // 注册Citer模块
    this.registerCiter('default', DefaultCiter);
    this.registerCiter('semantic', SemanticCiter);
    this.registerCiter('nli', NLICiter);
    
    // 注册Validator模块
    this.registerValidator('default', DefaultValidator);
    this.registerValidator('llm', LLMValidator);
    
    // 注册Locator模块
    this.registerLocator('default', DefaultLocator);
    this.registerLocator('llm', LLMLocator);
    this.registerLocator('adaptive', AdaptiveLocator);
    
    // 注册RewardCalculator模块
    this.registerRewardCalculator('default', DefaultRewardCalculator);
    this.registerRewardCalculator('ml', MLRewardCalculator);
    this.registerRewardCalculator('llm', LLMRewardCalculator);
    
    // 注册模块化Expander
    this.registerModularExpander('default', DefaultExpander);
    this.registerModularExpander('advanced', AdvancedExpander);
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

// 便利函数：创建默认模块化算法套件
export function createDefaultModularAlgorithmSuite(sessionConnector?: any) {
  const config = algorithmFactory.getDefaultModularConfiguration();

  // 🎯 如果提供了SessionConnector，注入到配置中
  if (sessionConnector) {
    config.sessionConnector = sessionConnector;
  }

  return algorithmFactory.createModularAlgorithmSuite(config);
}

// 便利函数：创建LLM增强的模块化算法套件
export function createLLMEnhancedAlgorithmSuite(llmApiKey: string) {
  const config = algorithmFactory.getDefaultModularConfiguration();
  
  // 使用LLM增强版本
  config.thinker.type = 'llm';
  config.thinker.config = { ...config.thinker.config, llmApiKey };
  
  config.formulator.type = 'llm';
  config.formulator.config = { ...config.formulator.config, llmApiKey };
  
  config.citer.type = 'semantic'; // 使用语义检索
  config.citer.config = { ...config.citer.config };
  
  config.validator.type = 'llm';
  config.validator.config = { ...config.validator.config, llmApiKey };
  
  config.locator.type = 'llm';
  config.locator.config = { ...config.locator.config, llmApiKey };
  
  config.rewardCalculator.type = 'llm';
  config.rewardCalculator.config = { ...config.rewardCalculator.config, llmApiKey };
  
  return algorithmFactory.createModularAlgorithmSuite(config);
}