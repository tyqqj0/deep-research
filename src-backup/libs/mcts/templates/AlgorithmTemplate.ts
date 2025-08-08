
import { ModularAlgorithmConfiguration } from '../algorithms/AlgorithmFactory';

/**
 * ⚙️ 单个算法模块的配置
 */
export interface AlgorithmModuleConfig {
  type: string;
  config?: any;
}

/**
 * 🧠 算法模板定义
 * 这是配置管理的核心数据结构，定义了一个完整的、可复用的算法套件。
 */
export interface AlgorithmTemplate {
  id: string;          // 唯一ID，如 "default-balanced" 或自定义的UUID
  name: string;        // 用户友好的模板名称，如 "默认平衡型"
  description: string; // 模板的详细描述
  isDefault: boolean;  // 是否为系统内置的默认模板
  configuration: ModularAlgorithmConfiguration; // 模板的核心配置
}
