import { LibraryItem } from '../db';
import * as zip from '@zip.js/zip.js';
import { getMineruConfig, type MineruConfig } from './config';

// 官方API响应接口定义
interface MineruApiResponse<T> {
  code: number;
  msg: string;
  trace_id: string;
  data: T;
}

interface MineruFileUploadResponse {
  batch_id: string;
  file_urls: string[];
}

interface MineruTaskResult {
  task_id: string;
  state: 'pending' | 'running' | 'done' | 'failed';
  full_zip_url?: string;
  err_msg?: string;
  extract_progress?: {
    extracted_pages: number;
    total_pages: number;
    start_time: string;
  };
}

interface MineruParsedData {
  references?: any[];
  content?: string;
  metadata?: any;
  [key: string]: any;
}

/**
 * 🔧 MineruService - 基于官方API v4的PDF解析服务
 * 
 * 📚 官方文档: https://mineru.net/api/v4
 * 
 * 🎯 支持的解析流程:
 * 1. 批量文件上传解析 (推荐) - 适合本地PDF文件
 * 2. 单个文件解析 - 适合有URL的PDF
 * 
 * 🔄 处理步骤:
 * 1. 申请上传URL
 * 2. 上传PDF文件
 * 3. 轮询任务状态
 * 4. 下载解析结果
 */
export class MineruService {
  private readonly config: MineruConfig;
  private useProxy: boolean = false;

  constructor() {
    const { config, warnings } = getMineruConfig();
    this.config = config;
    
    if (warnings.length > 0) {
      console.warn('⚠️  MineruService configuration warnings:', warnings);
    }
  }

  /**
   * 🚀 从PDF文件提交解析任务 - 使用批量文件上传API
   * 
   * @param item - 文献条目信息
   * @param pdfBlob - PDF文件Blob
   * @returns Promise<string> - 返回batch_id用于轮询结果
   */
  async submitTaskFromFile(item: LibraryItem, pdfBlob: Blob): Promise<string> {
    try {
      console.log(`📄 Submitting PDF to Mineru for item: ${item.title}`);
      
      // Step 1: 申请文件上传URL
      const uploadResponse = await this.requestFileUploadUrl(item);
      const { batch_id, file_urls } = uploadResponse.data;
      
      // Step 2: 上传PDF文件
      console.log(`📤 Uploading PDF to URL: ${file_urls[0]}`);
      console.log(`📤 Upload response data:`, uploadResponse.data);
      await this.uploadFileToUrl(file_urls[0], pdfBlob);
      console.log(`✅ PDF uploaded successfully, batch_id: ${batch_id}`);
      
      return batch_id;
    } catch (error) {
      console.error('❌ Error submitting task to Mineru:', error);
      throw new Error(`Failed to submit task to Mineru: ${error}`);
    }
  }

  /**
   * 🔄 轮询任务结果 - 使用batch_id查询解析结果
   * 
   * @param batchId - 批量任务ID
   * @param onProgress - 进度回调函数
   * @returns Promise<MineruParsedData> - 解析结果数据
   */
  async pollTaskResult(batchId: string, onProgress?: (progress: { extractedPages: number; totalPages: number; startTime: string }) => void): Promise<MineruParsedData> {
    return new Promise((resolve, reject) => {
      console.log(`🔄 Starting to poll task result for batch_id: ${batchId}`);
      
      const pollInterval = setInterval(async () => {
        try {
          const response = await this.getBatchTaskStatus(batchId);
          const results = response.data.extract_result;
          
          if (!results || results.length === 0) {
            return; // 不记录"等待中"状态，减少日志噪音
          }
          
          const result = results[0]; // 我们只处理单个文件
          
          // 只记录状态变化，不记录持续的运行状态
          if (result.state === 'done' || result.state === 'failed') {
            console.log(`📊 Task ${batchId} state: ${result.state}`);
          }
          
          switch (result.state) {
            case 'done':
              clearInterval(pollInterval);
              if (result.full_zip_url) {
                try {
                  const parsedData = await this.fetchAndUnzipResult(result.full_zip_url);
                  resolve(parsedData);
                } catch (unzipError) {
                  console.error('❌ Error processing result:', unzipError);
                  reject(new Error(`Failed to process result: ${unzipError}`));
                }
              } else {
                reject(new Error('Task completed but no result URL provided'));
              }
              break;
              
            case 'failed':
              clearInterval(pollInterval);
              reject(new Error(`Task failed: ${result.err_msg || 'Unknown error'}`));
              break;
              
            case 'waiting-file':
            case 'pending':
            case 'running':
              // 继续轮询，更新进度
              if (result.extract_progress) {
                const { extracted_pages, total_pages, start_time } = result.extract_progress;
                
                // 调用进度回调
                if (onProgress) {
                  onProgress({
                    extractedPages: extracted_pages,
                    totalPages: total_pages,
                    startTime: start_time
                  });
                }
              }
              break;
              
            default:
              console.warn(`⚠️ Unknown task state: ${result.state}`);
              break;
          }
        } catch (error) {
          console.error('❌ Error polling task status:', error);
          clearInterval(pollInterval);
          reject(error);
        }
      }, this.config.pollInterval);
      
      // 设置超时防止无限轮询
      setTimeout(() => {
        clearInterval(pollInterval);
        reject(new Error(`Task polling timeout after ${this.config.maxPollTimeout / 1000} seconds`));
      }, this.config.maxPollTimeout);
    });
  }

  /**
   * 🌐 通用请求处理 - 智能CORS代理回退
   * 
   * @param url 请求URL
   * @param options fetch选项
   * @param type 请求类型：'api' | 'download' | 'upload'
   */
  private async makeRequest(url: string, options: RequestInit, type: 'api' | 'download' | 'upload' = 'api'): Promise<Response> {
    console.log(`[MineruService] Making ${type} request to: ${url}`);

    // 首先尝试直接请求
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        console.log(`✅ Direct ${type} request successful`);
        return response;
      }
    } catch (error) {
      // 检查是否应该使用代理
      if (this.shouldUseProxy(undefined, error as Error)) {
        // 不记录预期的CORS错误，直接尝试代理
        console.log(`🔄 Trying ${type} request via proxy...`);
        
        try {
          const proxyResponse = await this.makeProxyRequest(url, options, type);
          console.log(`✅ Proxy ${type} request successful`);
          return proxyResponse;
        } catch (proxyError) {
          console.log(`❌ Proxy ${type} request failed:`, proxyError);
          throw proxyError;
        }
      }
      
      // 只记录非预期的错误
      console.log(`❌ Direct ${type} request failed:`, error);
      throw error;
    }
    
    // 直接请求返回错误状态但没有异常，仍然尝试代理
    console.log(`🔄 Direct request failed, trying proxy...`);
    return this.makeProxyRequest(url, options, type);
  }

  /**
   * 🔄 代理请求处理
   */
  private async makeProxyRequest(originalUrl: string, options: RequestInit, type: 'api' | 'download' | 'upload'): Promise<Response> {
    switch (type) {
      case 'api':
        // API请求通过 /api/mineru 代理
        const apiPath = originalUrl.replace(this.config.baseUrl, '');
        const proxyApiUrl = `/api/mineru${apiPath}`;
        return fetch(proxyApiUrl, options);
        
      case 'download':
        // 文件下载通过 /api/mineru-download 代理
        const downloadProxyUrl = `/api/mineru-download?url=${encodeURIComponent(originalUrl)}`;
        return fetch(downloadProxyUrl);
        
      case 'upload':
        // 文件上传需要特殊处理，先获取代理URL
        const uploadProxyInitUrl = `/api/mineru-upload`;
        const uploadResponse = await fetch(uploadProxyInitUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uploadUrl: originalUrl,
            fileSize: (options.body as Blob)?.size || 0
          })
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`Upload proxy init failed: ${uploadResponse.status}`);
        }
        
        const { proxyUploadUrl } = await uploadResponse.json();
        return fetch(proxyUploadUrl, { method: 'PUT', body: options.body });
        
      default:
        throw new Error(`Unknown proxy type: ${type}`);
    }
  }

  /**
   * 🚫 检查是否应该使用代理
   */
  private shouldUseProxy(response?: Response, error?: Error): boolean {
    return (
      // CORS错误
      (response && response.status === 0) ||
      // 网络错误
      (error && (
        error.message.includes('fetch') ||
        error.message.includes('CORS') ||
        error.message.includes('Network') ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('ERR_FAILED') ||
        error.name === 'TypeError'
      ))
    );
  }

  /**
   * 📋 申请文件上传URL
   */
  private async requestFileUploadUrl(item: LibraryItem): Promise<MineruApiResponse<MineruFileUploadResponse>> {
    const url = `${this.config.baseUrl}/file-urls/batch`;
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        enable_formula: true,
        enable_table: true,
        is_ocr: true,
        language: 'auto', // 自动检测语言
        model_version: 'v2', // 使用最新模型
        files: [{
          name: `${item.title}.pdf`,
          is_ocr: true,
          data_id: item.id // 使用文献ID作为data_id
        }]
      })
    };

    const response = await this.makeRequest(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data = await response.json();
    
    // 检查API响应状态
    if (data.code !== 0) {
      throw new Error(`API error: ${data.msg} (code: ${data.code})`);
    }

    return data;
  }

  /**
   * 📤 上传文件到指定URL - 智能代理上传
   */
  private async uploadFileToUrl(uploadUrl: string, pdfBlob: Blob): Promise<void> {
    try {
      console.log(`📤 Uploading ${pdfBlob.size} bytes to OSS...`);
      
      // 使用统一的代理请求方法上传文件
      await this.makeRequest(uploadUrl, { method: 'PUT', body: pdfBlob }, 'upload');
      
      console.log(`✅ File uploaded successfully`);
      
    } catch (error) {
      console.error(`❌ Upload failed:`, error);
      // 提供用户友好的错误信息
      if (error instanceof Error) {
        if (error.message.includes('CORS') || error.message.includes('ERR_FAILED')) {
          throw new Error(`网络限制: 无法直接上传到云存储。文献已保存到库中，请稍后重试或联系技术支持。`);
        } else {
          throw new Error(`${error.message} 文献已保存到库中。`);
        }
      } else {
        throw new Error(`上传失败: 未知错误。文献已保存到库中。`);
      }
    }
  }

  /**
   * 📊 获取批量任务状态
   */
  private async getBatchTaskStatus(batchId: string): Promise<MineruApiResponse<{
    batch_id: string;
    extract_result: Array<{
      file_name: string;
      state: 'waiting-file' | 'pending' | 'running' | 'done' | 'failed';
      full_zip_url?: string;
      err_msg?: string;
      data_id?: string;
      extract_progress?: {
        extracted_pages: number;
        total_pages: number;
        start_time: string;
      };
    }>;
  }>> {
    const url = `${this.config.baseUrl}/extract-results/batch/${batchId}`;
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await this.makeRequest(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data = await response.json();
    
    // 检查API响应状态
    if (data.code !== 0) {
      throw new Error(`API error: ${data.msg} (code: ${data.code})`);
    }

    return data;
  }

  /**
   * 📦 下载并解压解析结果 - 支持代理下载
   */
  private async fetchAndUnzipResult(zipUrl: string): Promise<MineruParsedData> {
    try {
      console.log(`📥 Downloading result from: ${zipUrl}`);
      
      // 使用统一的代理请求方法下载文件
      const response = await this.makeRequest(zipUrl, {}, 'download');
      
      const zipBlob = await response.blob();
      
      // 解压并处理内容
      const zipReader = new zip.ZipReader(new zip.BlobReader(zipBlob));
      const entries = await zipReader.getEntries();
      
      let parsedData: MineruParsedData = {};
      
      // 处理ZIP中的每个文件
      for (const entry of entries) {
        if (entry.filename.endsWith('.json')) {
          // 提取JSON文件（包含解析数据）
          const jsonBlob = await entry.getData!(new zip.BlobWriter());
          const jsonText = await jsonBlob.text();
          const jsonData = JSON.parse(jsonText);
          
          // 合并JSON数据
          parsedData = { ...parsedData, ...jsonData };
        } else if (entry.filename.endsWith('.md')) {
          // 提取Markdown文件（主要内容）
          const mdBlob = await entry.getData!(new zip.BlobWriter());
          const mdText = await mdBlob.text();
          parsedData.content = mdText;
        }
      }
      
      await zipReader.close();
      
      console.log('✅ Successfully processed Mineru result');
      return parsedData;
      
    } catch (error) {
      console.error('❌ Error processing Mineru result:', error);
      throw new Error(`Failed to process Mineru result: ${error}`);
    }
  }

  /**
   * 📋 获取服务提供商信息
   */
  getProviderInfo(): { name: string; version: string } {
    return {
      name: 'Mineru',
      version: '4.0.0'
    };
  }
}

// 导出单例实例
export const mineruService = new MineruService();