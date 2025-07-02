/**
 * Deep Research 错误码系统
 * 
 * 本文件定义了统一的错误码枚举，用于替代分散的国际化调用
 * 遵循错误码模式：Utils层返回错误码，React层负责翻译显示
 */

/**
 * 研究错误码枚举
 * 每个错误码对应一个标准的翻译键
 */
export enum ResearchErrorCode {
  // 搜索相关错误
  SEARCH_FAILED = 'SEARCH_FAILED',
  SEARCH_ERROR = 'SEARCH_ERROR',
  SEARCH_TIMEOUT = 'SEARCH_TIMEOUT',
  
  // 任务生成相关错误
  TASK_GENERATION_FAILED = 'TASK_GENERATION_FAILED',
  AI_FAILED_TO_GENERATE_PLAN = 'AI_FAILED_TO_GENERATE_PLAN',
  NO_LEARNING_FOR_RERUN = 'NO_LEARNING_FOR_RERUN',
  
  // 重试相关错误
  RETRY_EXHAUSTED = 'RETRY_EXHAUSTED',
  MAX_RETRIES_EXCEEDED = 'MAX_RETRIES_EXCEEDED',
  
  // 深度研究相关错误
  DEEPER_RESEARCH_FAILED = 'DEEPER_RESEARCH_FAILED',
  NO_COMPLETED_TASKS = 'NO_COMPLETED_TASKS',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  
  // AI 服务相关错误
  AI_PROVIDER_ERROR = 'AI_PROVIDER_ERROR',
  AI_RESPONSE_INVALID = 'AI_RESPONSE_INVALID',
  AI_QUOTA_EXCEEDED = 'AI_QUOTA_EXCEEDED',
  
  // 网络和连接错误
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  
  // 系统错误
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * 错误码到翻译键的映射
 * 确保每个错误码都有对应的翻译键
 */
export const ERROR_CODE_TO_MESSAGE_KEY: Record<ResearchErrorCode, string> = {
  [ResearchErrorCode.SEARCH_FAILED]: 'research.status.searchFailed',
  [ResearchErrorCode.SEARCH_ERROR]: 'research.status.searchError',
  [ResearchErrorCode.SEARCH_TIMEOUT]: 'research.error.searchTimeout',
  
  [ResearchErrorCode.TASK_GENERATION_FAILED]: 'research.error.taskGenerationFailed',
  [ResearchErrorCode.AI_FAILED_TO_GENERATE_PLAN]: 'research.error.aiFailedToGeneratePlan',
  [ResearchErrorCode.NO_LEARNING_FOR_RERUN]: 'research.error.noLearningForRerun',
  
  [ResearchErrorCode.RETRY_EXHAUSTED]: 'research.error.retryExhausted',
  [ResearchErrorCode.MAX_RETRIES_EXCEEDED]: 'research.error.maxRetriesExceeded',
  
  [ResearchErrorCode.DEEPER_RESEARCH_FAILED]: 'research.error.deeperResearchFailed',
  [ResearchErrorCode.NO_COMPLETED_TASKS]: 'research.status.noCompletedTasks',
  [ResearchErrorCode.INSUFFICIENT_DATA]: 'research.error.insufficientData',
  
  [ResearchErrorCode.AI_PROVIDER_ERROR]: 'research.error.aiProviderError',
  [ResearchErrorCode.AI_RESPONSE_INVALID]: 'research.error.aiResponseInvalid',
  [ResearchErrorCode.AI_QUOTA_EXCEEDED]: 'research.error.aiQuotaExceeded',
  
  [ResearchErrorCode.NETWORK_ERROR]: 'research.error.networkError',
  [ResearchErrorCode.CONNECTION_TIMEOUT]: 'research.error.connectionTimeout',
  
  [ResearchErrorCode.SYSTEM_ERROR]: 'research.error.systemError',
  [ResearchErrorCode.UNKNOWN_ERROR]: 'research.error.unknownError'
};

/**
 * 研究错误接口
 * 标准化的错误对象结构
 */
export interface ResearchError {
  /** 错误码 */
  code: ResearchErrorCode;
  
  /** 翻译键 */
  messageKey: string;
  
  /** 翻译参数 */
  params?: Record<string, any>;
  
  /** 原始错误对象 */
  originalError?: Error;
  
  /** 错误上下文信息 */
  context?: {
    taskId?: string;
    taskTitle?: string;
    retryCount?: number;
    depth?: number;
    [key: string]: any;
  };
  
  /** 错误发生时间 */
  timestamp?: Date;
}

/**
 * 错误工厂函数
 * 便于创建标准化的错误对象
 */
export class ResearchErrorFactory {
  /**
   * 创建搜索失败错误
   */
  static createSearchFailed(
    taskId?: string,
    taskTitle?: string,
    originalError?: Error
  ): ResearchError {
    return {
      code: ResearchErrorCode.SEARCH_FAILED,
      messageKey: ERROR_CODE_TO_MESSAGE_KEY[ResearchErrorCode.SEARCH_FAILED],
      originalError,
      context: { taskId, taskTitle },
      timestamp: new Date()
    };
  }

  /**
   * 创建任务生成失败错误
   */
  static createTaskGenerationFailed(
    params?: Record<string, any>,
    originalError?: Error
  ): ResearchError {
    return {
      code: ResearchErrorCode.TASK_GENERATION_FAILED,
      messageKey: ERROR_CODE_TO_MESSAGE_KEY[ResearchErrorCode.TASK_GENERATION_FAILED],
      params,
      originalError,
      timestamp: new Date()
    };
  }

  /**
   * 创建重试耗尽错误
   */
  static createRetryExhausted(
    taskId: string,
    retryCount: number,
    originalError?: Error
  ): ResearchError {
    return {
      code: ResearchErrorCode.RETRY_EXHAUSTED,
      messageKey: ERROR_CODE_TO_MESSAGE_KEY[ResearchErrorCode.RETRY_EXHAUSTED],
      params: { retryCount },
      originalError,
      context: { taskId, retryCount },
      timestamp: new Date()
    };
  }

  /**
   * 创建AI生成计划失败错误
   */
  static createAiFailedToGeneratePlan(
    originalError?: Error
  ): ResearchError {
    return {
      code: ResearchErrorCode.AI_FAILED_TO_GENERATE_PLAN,
      messageKey: ERROR_CODE_TO_MESSAGE_KEY[ResearchErrorCode.AI_FAILED_TO_GENERATE_PLAN],
      originalError,
      timestamp: new Date()
    };
  }

  /**
   * 创建深度研究失败错误
   */
  static createDeeperResearchFailed(
    depth?: number,
    originalError?: Error
  ): ResearchError {
    return {
      code: ResearchErrorCode.DEEPER_RESEARCH_FAILED,
      messageKey: ERROR_CODE_TO_MESSAGE_KEY[ResearchErrorCode.DEEPER_RESEARCH_FAILED],
      originalError,
      context: { depth },
      timestamp: new Date()
    };
  }

  /**
   * 创建没有完成任务错误
   */
  static createNoCompletedTasks(): ResearchError {
    return {
      code: ResearchErrorCode.NO_COMPLETED_TASKS,
      messageKey: ERROR_CODE_TO_MESSAGE_KEY[ResearchErrorCode.NO_COMPLETED_TASKS],
      timestamp: new Date()
    };
  }

  /**
   * 创建网络错误
   */
  static createNetworkError(originalError?: Error): ResearchError {
    return {
      code: ResearchErrorCode.NETWORK_ERROR,
      messageKey: ERROR_CODE_TO_MESSAGE_KEY[ResearchErrorCode.NETWORK_ERROR],
      originalError,
      timestamp: new Date()
    };
  }

  /**
   * 创建AI提供商错误
   */
  static createAiProviderError(
    provider?: string,
    originalError?: Error
  ): ResearchError {
    return {
      code: ResearchErrorCode.AI_PROVIDER_ERROR,
      messageKey: ERROR_CODE_TO_MESSAGE_KEY[ResearchErrorCode.AI_PROVIDER_ERROR],
      params: { provider },
      originalError,
      timestamp: new Date()
    };
  }

  /**
   * 创建系统错误
   */
  static createSystemError(originalError?: Error): ResearchError {
    return {
      code: ResearchErrorCode.SYSTEM_ERROR,
      messageKey: ERROR_CODE_TO_MESSAGE_KEY[ResearchErrorCode.SYSTEM_ERROR],
      originalError,
      timestamp: new Date()
    };
  }

  /**
   * 从错误码创建通用错误
   */
  static createFromCode(
    code: ResearchErrorCode,
    params?: Record<string, any>,
    originalError?: Error
  ): ResearchError {
    return {
      code,
      messageKey: ERROR_CODE_TO_MESSAGE_KEY[code],
      params,
      originalError,
      timestamp: new Date()
    };
  }
}

/**
 * 错误辅助函数
 */
export class ResearchErrorUtils {
  /**
   * 检查是否为研究错误
   */
  static isResearchError(error: any): error is ResearchError {
    return error && 
           typeof error === 'object' && 
           'code' in error && 
           'messageKey' in error &&
           Object.values(ResearchErrorCode).includes(error.code);
  }

  /**
   * 从原始错误创建研究错误
   */
  static fromError(originalError: Error, code: ResearchErrorCode = ResearchErrorCode.UNKNOWN_ERROR): ResearchError {
    return ResearchErrorFactory.createFromCode(code, undefined, originalError);
  }

  /**
   * 获取错误的显示消息（用于调试）
   */
  static getDebugMessage(error: ResearchError): string {
    const codeStr = `[${error.code}]`;
    const keyStr = error.messageKey;
    const paramsStr = error.params ? JSON.stringify(error.params) : '';
    const contextStr = error.context ? JSON.stringify(error.context) : '';
    
    return `${codeStr} ${keyStr} ${paramsStr} ${contextStr}`.trim();
  }
}