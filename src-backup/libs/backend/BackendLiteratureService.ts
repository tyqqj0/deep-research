/**
 * 🌐 BackendLiteratureService - 后端文献解析服务API客户端
 * 
 * 🎯 核心职责:
 * - 与后端文献解析服务进行通信
 * - 提交文献解析任务（DOI、URL、PDF文件）
 * - 轮询任务状态并获取详细进度信息
 * - 获取最终的结构化文献数据
 * 
 * 🔄 工作流程:
 * 1. submitLiterature() - 提交文献源，获得taskId
 * 2. getTaskStatus() - 轮询任务状态，监控进度
 * 3. getLiterature() - 任务完成后获取最终数据
 * 
 * 📝 基于后端API v1.1规范实现
 */

// 后端API数据类型定义
export interface LiteratureSource {
  doi?: string;
  url?: string;
}

export interface SubmitLiteratureRequest {
  source: LiteratureSource;
}

export interface SubmitLiteratureResponse {
  taskId: string;
  status_url: string;
}

export interface ComponentStatus {
  status: 'pending' | 'processing' | 'success' | 'failed' | 'waiting';
  stage: string;
  progress: number;
  source?: string;
  next_action?: string;
  error_info?: {
    error_message: string;
    [key: string]: any;
  };
}

export interface TaskStatus {
  task_id: string;
  overall_status: 'processing' | 'success' | 'partial_success' | 'failed';
  literature_id?: string;
  resource_url?: string;
  error_info?: {
    error_message: string;
    [key: string]: any;
  };
  components: {
    metadata: ComponentStatus;
    content: ComponentStatus;
    references: ComponentStatus;
  };
}

export interface BackendLiterature {
  id: string;
  identifiers: {
    doi?: string;
    arxiv_id?: string;
  };
  metadata: {
    title: string;
    authors: Array<{ name: string }>;
    year: number;
    journal?: string;
    abstract?: string;
    keywords?: string[];
  };
  content: {
    pdf_url?: string;
    source_page_url?: string;
    full_text?: string;
  };
  references: Array<{
    raw_text: string;
    parsed: {
      title?: string;
      authors?: string[];
      year?: number;
      journal?: string;
    };
    source: string;
  }>;
  task_info: any;
}

/**
 * 后端文献解析服务配置
 */
interface BackendConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export class BackendLiteratureService {
  private config: BackendConfig;

  constructor(config?: Partial<BackendConfig>) {
    this.config = {
      baseUrl: process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000/api/v1',
      timeout: 30000, // 30秒超时
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };
  }

  /**
   * 🚀 提交文献解析任务
   * 
   * @param source - 文献源信息（DOI或URL）
   * @returns Promise<SubmitLiteratureResponse> - 任务ID和状态URL
   */
  async submitLiterature(source: LiteratureSource): Promise<SubmitLiteratureResponse> {
    try {
      console.log(`[BackendService] Submitting literature:`, source);

      const request: SubmitLiteratureRequest = { source };
      
      const response = await this.makeRequest('/literatures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
      }

      const result: SubmitLiteratureResponse = await response.json();
      console.log(`[BackendService] Task submitted successfully:`, result);
      
      return result;
    } catch (error) {
      console.error('[BackendService] Error submitting literature:', error);
      throw new Error(`Failed to submit literature: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 📊 获取任务状态
   * 
   * @param taskId - 任务ID
   * @returns Promise<TaskStatus> - 详细的任务状态信息
   */
  async getTaskStatus(taskId: string): Promise<TaskStatus> {
    try {
      const response = await this.makeRequest(`/tasks/${taskId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
      }

      const result: TaskStatus = await response.json();
      return result;
    } catch (error) {
      console.error(`[BackendService] Error getting task status for ${taskId}:`, error);
      throw new Error(`Failed to get task status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 📄 提交PDF文件解析任务
   *
   * @param pdfFile - PDF文件（File或Blob）
   * @param metadata - 可选的元数据信息
   * @returns Promise<SubmitLiteratureResponse> - 任务ID和状态URL
   */
  async submitPdfFile(pdfFile: File | Blob, metadata?: { title?: string; authors?: string[] }): Promise<SubmitLiteratureResponse> {
    try {
      console.log(`[BackendService] Submitting PDF file (${pdfFile.size} bytes)`);

      // 创建FormData来上传文件
      const formData = new FormData();

      // 添加PDF文件
      if (pdfFile instanceof File) {
        formData.append('file', pdfFile);
      } else {
        // 如果是Blob，需要创建一个File对象
        const fileName = metadata?.title ? `${metadata.title}.pdf` : 'document.pdf';
        const file = new File([pdfFile], fileName, { type: 'application/pdf' });
        formData.append('file', file);
      }

      // 添加可选的元数据
      if (metadata) {
        formData.append('metadata', JSON.stringify(metadata));
      }

      const response = await this.makeRequest('/literatures/upload', {
        method: 'POST',
        body: formData,
        // 不设置Content-Type，让浏览器自动设置multipart/form-data
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
      }

      const result: SubmitLiteratureResponse = await response.json();
      console.log(`[BackendService] PDF file submitted successfully:`, result);

      return result;
    } catch (error) {
      console.error('[BackendService] Error submitting PDF file:', error);
      throw new Error(`Failed to submit PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 📚 获取最终文献数据
   *
   * @param literatureId - 文献ID
   * @returns Promise<BackendLiterature> - 完整的文献数据
   */
  async getLiterature(literatureId: string): Promise<BackendLiterature> {
    try {
      console.log(`[BackendService] Fetching literature data for: ${literatureId}`);

      const response = await this.makeRequest(`/literatures/${literatureId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
      }

      const result: BackendLiterature = await response.json();
      console.log(`[BackendService] Literature data fetched successfully:`, result.metadata.title);
      
      return result;
    } catch (error) {
      console.error(`[BackendService] Error getting literature ${literatureId}:`, error);
      throw new Error(`Failed to get literature: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 🌐 通用HTTP请求方法
   * 
   * @param endpoint - API端点
   * @param options - fetch选项
   * @returns Promise<Response> - HTTP响应
   */
  private async makeRequest(endpoint: string, options: RequestInit): Promise<Response> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    // 添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * 🔧 获取服务配置信息
   */
  getConfig(): BackendConfig {
    return { ...this.config };
  }

  /**
   * 🔧 更新服务配置
   */
  updateConfig(newConfig: Partial<BackendConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// 导出单例实例
export const backendLiteratureService = new BackendLiteratureService();
