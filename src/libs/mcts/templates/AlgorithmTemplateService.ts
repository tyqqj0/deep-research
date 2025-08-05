import { AlgorithmTemplate } from './AlgorithmTemplate';
import { algorithmFactory, ModularAlgorithmConfiguration } from '../algorithms/AlgorithmFactory';
import { nanoid } from 'nanoid';

const STORAGE_KEY = 'mcts_algorithm_templates';

/**
 * ⚙️ 算法模板管理服务
 * 
 * 核心职责:
 * - 提供默认的算法模板
 * - 从localStorage加载/保存用户自定义模板
 * - 提供模板的增、删、改、查接口
 */
class AlgorithmTemplateService {
  private templates: Map<string, AlgorithmTemplate> = new Map();

  constructor() {
    this.loadTemplates();
  }

  /**
   * 加载所有模板（默认+自定义）
   */
  private loadTemplates(): void {
    // 1. 加载默认模板
    const defaultTemplates = this.createDefaultTemplates();
    defaultTemplates.forEach(t => this.templates.set(t.id, t));

    // 2. 从localStorage加载自定义模板
    try {
      const storedTemplates = localStorage.getItem(STORAGE_KEY);
      if (storedTemplates) {
        const customTemplates: AlgorithmTemplate[] = JSON.parse(storedTemplates);
        customTemplates.forEach(t => {
          if (!this.templates.has(t.id)) {
            this.templates.set(t.id, { ...t, isDefault: false });
          }
        });
      }
    } catch (error) {
      console.error('Failed to load custom algorithm templates:', error);
    }
  }

  /**
   * 保存自定义模板到localStorage
   */
  private saveCustomTemplates(): void {
    const customTemplates = Array.from(this.templates.values()).filter(t => !t.isDefault);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customTemplates));
    } catch (error) {
      console.error('Failed to save custom algorithm templates:', error);
    }
  }
  
  /**
   * 创建系统内置的默认模板
   */
  private createDefaultTemplates(): AlgorithmTemplate[] {
    const defaultConfig = algorithmFactory.getDefaultModularConfiguration();

    const explorationConfig: ModularAlgorithmConfiguration = JSON.parse(JSON.stringify(defaultConfig));
    explorationConfig.locator.config.explorationConstant = 2.5;
    explorationConfig.thinker.config.diversityThreshold = 0.7;
    explorationConfig.citer.config.relevanceThreshold = 0.2;

    const exploitationConfig: ModularAlgorithmConfiguration = JSON.parse(JSON.stringify(defaultConfig));
    exploitationConfig.locator.config.explorationConstant = 0.5;
    exploitationConfig.rewardCalculator.config.citationWeight = 0.5;
    exploitationConfig.validator.config.qualityThreshold = 0.7;

    const semanticConfig: ModularAlgorithmConfiguration = JSON.parse(JSON.stringify(defaultConfig));
    semanticConfig.thinker.type = 'llm';
    semanticConfig.formulator.type = 'llm';
    semanticConfig.citer.type = 'semantic';
    semanticConfig.validator.type = 'llm';
    semanticConfig.locator.type = 'llm';
    semanticConfig.rewardCalculator.type = 'llm';


    return [
      {
        id: 'default-balanced',
        name: '默认平衡',
        description: '在探索和利用之间取得平衡的标准配置，适合大多数研究场景。',
        isDefault: true,
        configuration: defaultConfig,
      },
      {
        id: 'exploration-focused',
        name: '探索优先',
        description: '鼓励MCTS探索更多未知领域，寻找新的研究方向，适合早期研究。',
        isDefault: true,
        configuration: explorationConfig,
      },
      {
        id: 'exploitation-focused',
        name: '利用优先',
        description: '专注于挖掘已知有价值的路径，适合深入研究特定主题。',
        isDefault: true,
        configuration: exploitationConfig,
      },
      {
        id: 'llm-enhanced',
        name: 'LLM语义增强',
        description: '全面使用LLM进行思考、表述和验证，研究质量更高但速度较慢。',
        isDefault: true,
        configuration: semanticConfig,
      }
    ];
  }

  /**
   * 获取所有模板
   * @returns {AlgorithmTemplate[]}
   */
  getTemplates(): AlgorithmTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 根据ID获取模板
   * @param {string} id
   * @returns {AlgorithmTemplate | undefined}
   */
  getTemplate(id: string): AlgorithmTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * 添加一个新模板
   * @param {Omit<AlgorithmTemplate, 'id' | 'isDefault'>} newTemplateData
   * @returns {AlgorithmTemplate}
   */
  addTemplate(newTemplateData: Omit<AlgorithmTemplate, 'id' | 'isDefault'>): AlgorithmTemplate {
    const newTemplate: AlgorithmTemplate = {
      ...newTemplateData,
      id: nanoid(),
      isDefault: false,
    };
    this.templates.set(newTemplate.id, newTemplate);
    this.saveCustomTemplates();
    return newTemplate;
  }

  /**
   * 更新一个模板
   * @param {string} id
   * @param {Partial<AlgorithmTemplate>} updates
   * @returns {AlgorithmTemplate | undefined}
   */
  updateTemplate(id: string, updates: Partial<Omit<AlgorithmTemplate, 'id' | 'isDefault'>>): AlgorithmTemplate | undefined {
    const existingTemplate = this.templates.get(id);
    if (existingTemplate && !existingTemplate.isDefault) {
      const updatedTemplate = { ...existingTemplate, ...updates };
      this.templates.set(id, updatedTemplate);
      this.saveCustomTemplates();
      return updatedTemplate;
    }
    return undefined;
  }

  /**
   * 删除一个模板
   * @param {string} id
   * @returns {boolean}
   */
  deleteTemplate(id: string): boolean {
    const existingTemplate = this.templates.get(id);
    if (existingTemplate && !existingTemplate.isDefault) {
      const deleted = this.templates.delete(id);
      if (deleted) {
        this.saveCustomTemplates();
      }
      return deleted;
    }
    return false;
  }
}

export const algorithmTemplateService = new AlgorithmTemplateService();
