/**
 * 🎯 API Client - 与后端服务通信的统一接口
 *
 * 基于新的后端API规范 (114.132.91.247:8000)
 * 支持异步任务处理和OSS直传功能
 *
 * @example
 * import { apiClient } from '@/libs/api';
 *
 * // 请求上传许可
 * const { uploadUrl, publicUrl } = await apiClient.requestUploadUrl('paper.pdf');
 * 
 * // 直传到OSS
 * await apiClient.uploadFileToOSS(uploadUrl, file);
 *
 * // 提交文献（异步处理）
 * const taskId = await apiClient.submitLiterature({ 
 *   source: { title: 'Paper', authors: ['Author'], url: publicUrl } 
 * });
 *
 * // 轮询任务状态
 * const status = await apiClient.getTaskStatus(taskId);
 */

// 🌐 API配置
const API_BASE_URL = 'http://114.132.91.247:8000';

// 🔍 类型定义 - 基于后端API文档
interface LiteratureSource {
    authors: string[];
    title: string;
    doi?: string;
    url?: string;
    year?: number;
    journal?: string;
}

// 🚀 导出新的后端任务相关类型（与schema.ts保持一致）
export type { BackendTaskResponse, LiteratureStatus, ComponentStatus };

interface SubmitLiteratureRequest {
    source: LiteratureSource;
}

// 🚀 新API响应结构 - 完全匹配后端返回格式
interface ComponentStatus {
    status: 'success' | 'processing' | 'failed' | 'pending';
    stage: string;
    progress: number; // 0-100
    started_at: string | null;
    completed_at: string | null;
    error_info: object | null;
    source: string | null;
    attempts: number; // 0-3
}

interface LiteratureStatus {
    literature_id: string;
    overall_status: 'completed' | 'processing' | 'failed';
    overall_progress: number; // 0-100
    component_status: {
        metadata: ComponentStatus;
        content: ComponentStatus;
        references: ComponentStatus;
    };
    created_at: string;
    updated_at: string;
}

interface BackendTaskResponse {
    // === 任务执行信息（轮询控制用） ===
    task_id: string;
    execution_status: 'completed' | 'processing' | 'pending' | 'failed';
    result_type: 'created' | 'duplicate';

    // === 文献处理信息（详细展示用） ===
    literature_id: string | null;
    literature_status: LiteratureStatus | null;

    // === 聚合和兼容性字段 ===
    status: string; // 向后兼容（映射到execution_status）
    overall_progress: number; // 0-100
    current_stage: string | null;
    resource_url: string | null;
    error_info: object | null;
}

// 🗑️ 保留旧接口用于过渡期间的兼容性
interface TaskStatus {
    task_id: string;
    status: 'processing' | 'success' | 'failed';
    stage: string;
    progress_percentage: number;
    created_at: string;
    updated_at: string;
    estimated_completion?: string;
}

interface Literature {
    id: string;
    title: string;
    authors: string[];
    doi?: string;
    url?: string;
    year?: number;
    journal?: string;
    created_at: string;
    updated_at: string;
    identifiers?: {
        arxiv_id?: string;
        doi?: string;
    };
    metadata?: {
        authors: Array<{ name: string }>;
        title: string;
        year: number;
    };
    references?: any[];
    content?: {
        has_grobid_fulltext: boolean;
        pdf_url?: string;
    };
}

interface LiteratureFulltext {
    literature_id: string;
    source: string;
    parsed_at: string;
    parsed_fulltext: {
        body_text?: string;
        acknowledgments?: string;
        appendices?: string;
        sections?: Array<{
            title: string;
            content: string;
            level: number;
        }>;
        figures?: any[];
        tables?: any[];
    };
    grobid_processing_info?: {
        grobid_version: string;
        processed_at: string;
        processing_time_ms: number;
        status: string;
        text_length_chars: number;
    };
}

interface UploadUrlResponse {
    uploadUrl: string;
    publicUrl: string;
}

/**
 * 处理API响应的通用函数
 */
async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        let errorMessage = `HTTP Error: ${response.status} ${response.statusText}`;

        try {
            const errorData = await response.json();
            if (errorData.detail) {
                // FastAPI格式的错误信息
                if (Array.isArray(errorData.detail)) {
                    errorMessage = errorData.detail.map((err: any) => err.msg).join(', ');
                } else {
                    errorMessage = errorData.detail;
                }
            }
        } catch (parseError) {
            console.warn('Failed to parse error response as JSON');
        }

        throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return response.json() as Promise<T>;
    }

    return response.text() as Promise<T>;
}

/**
 * 封装的API客户端
 */
export const apiClient = {
    /**
     * 📤 请求文件上传许可
     * @param fileName - 文件名
     * @param contentType - 文件MIME类型，默认为'application/pdf'
     * @returns Promise<UploadUrlResponse> - 包含上传URL和公开访问URL
     */
    _requestUploadUrl: async (
        fileName: string,
        contentType: string = 'application/pdf'
    ): Promise<UploadUrlResponse> => {
        console.log(`📤 Requesting upload permission for: ${fileName}`);

        const response = await fetch(`${API_BASE_URL}/api/upload/request-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName,
                contentType
            }),
        });

        const result = await handleResponse<UploadUrlResponse>(response);
        console.log(`✅ Upload permission granted for: ${fileName}`);
        return result;
    },

    /**
     * ☁️ 直接上传文件到OSS
     * @param uploadUrl - 预签名的上传URL
     * @param file - 要上传的文件
     * @returns Promise<void>
     */
    _uploadFileToOSS: async (uploadUrl: string, file: File): Promise<void> => {
        console.log(`☁️ Uploading file to OSS: ${file.name} (${file.size} bytes)`);

        const response = await fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type || 'application/pdf',
            },
        });

        if (!response.ok) {
            throw new Error(`OSS upload failed: ${response.status} ${response.statusText}`);
        }

        console.log(`✅ File uploaded successfully to OSS: ${file.name}`);
    },

    /**     
     * 📄 上传PDF文件
     * @param fileName - 文件名
     * @param contentType - 文件类型
     * @param file - 文件
     * @returns Promise<{ publicUrl: string }> - 返回公开访问URL
     */
    uploadPdf: async (fileName: string, contentType: string, file: File): Promise<{ publicUrl: string }> => {
        const { uploadUrl, publicUrl } = await apiClient._requestUploadUrl(fileName, contentType);
        await apiClient._uploadFileToOSS(uploadUrl, file);
        return { publicUrl };
    },
            
    /**
     * 📚 提交文献进行异步处理
     * @param data - 文献信息
     * @returns Promise<string> - 返回任务ID
     */
    submitLiterature: async (data: SubmitLiteratureRequest): Promise<string> => {
        console.log('📚 Submitting literature for processing:', data.source.title);

        const response = await fetch(`${API_BASE_URL}/api/literature`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        // 根据API文档，这个接口返回202状态码和包含task_id的对象
        if (response.status !== 202) {
            throw new Error(`Unexpected response status: ${response.status}`);
        }

        const result = await handleResponse<{ task_id: string }>(response);

        // 🐞 调试：输出后端的实际返回格式
        console.log('🐞 [Debug] Backend response for submitLiterature:', result);
        console.log(`✅ Literature submitted, task_id: ${result.task_id}`);

        return result.task_id;
    },

    /**
     * 📊 查询任务状态
     * @param taskId - 任务ID
     * @returns Promise<TaskStatus> - 任务状态信息
     */
    getTaskStatus: async (taskId: string): Promise<BackendTaskResponse> => {
        const response = await fetch(`${API_BASE_URL}/api/task/${taskId}`);
        const result = await handleResponse<BackendTaskResponse>(response);

        // 🐞 调试：输出后端的实际返回格式
        console.log('🐞 [Debug] Backend TaskResponse:', result);

        // 只在状态变化时打印日志，避免轮询时的噪音
        if (result.execution_status !== 'processing') {
            console.log(`📊 Task ${taskId} execution_status: ${result.execution_status} (${result.current_stage})`);
        }

        return result;
    },

    /**
     * 📖 获取文献详细信息
     * @param literatureId - 文献ID
     * @returns Promise<Literature> - 文献详情
     */
    getLiterature: async (literatureId: string): Promise<Literature> => {
        console.log(`📖 Fetching literature: ${literatureId}`);

        const response = await fetch(`${API_BASE_URL}/api/literature/${literatureId}`);
        const result = await handleResponse<Literature>(response);

        console.log(`✅ Literature fetched: ${result.title}`);

        // 🔍 详细调试引文数据
        console.log(`🔍 [DEBUG] Literature data structure:`, {
            id: result.id,
            title: result.title,
            authors: result.authors,
            referencesCount: result.references?.length || 0,
            referencesType: typeof result.references,
            referencesIsArray: Array.isArray(result.references),
            firstFewReferences: result.references?.slice(0, 3),
            sampleReference: result.references?.[0] ? {
                keys: Object.keys(result.references[0]),
                structure: result.references[0]
            } : 'No references'
        });

        return result;
    },

    /**
     * 📄 获取文献全文内容
     * @param literatureId - 文献ID
     * @returns Promise<LiteratureFulltext> - 文献全文信息
     */
    getLiteratureFulltext: async (literatureId: string): Promise<LiteratureFulltext> => {
        console.log(`📄 Fetching fulltext for literature: ${literatureId}`);

        const response = await fetch(`${API_BASE_URL}/api/literature/${literatureId}/fulltext`);
        const result = await handleResponse<LiteratureFulltext>(response);

        console.log(`✅ Fulltext fetched for: ${literatureId}`);
        return result;
    },
};

// 导出类型定义，供其他模块使用
export type {
    LiteratureSource,
    SubmitLiteratureRequest,
    TaskStatus,
    Literature,
    LiteratureFulltext,
    UploadUrlResponse
}; 