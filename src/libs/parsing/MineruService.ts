import { LibraryItem } from '../db';
import * as zip from '@zip.js/zip.js';
import { getMineruConfig, type MineruConfig } from './config';

interface MineruFileUploadResponse {
  data_id: string;
  upload_url: string;
}

interface MineruBatchTaskResponse {
  tasks: Array<{
    task_id: string;
    data_id: string;
    state: 'pending' | 'running' | 'done' | 'failed';
  }>;
}

interface MineruTaskResult {
  task_id: string;
  state: 'pending' | 'running' | 'done' | 'failed';
  result?: {
    full_zip_url?: string;
    [key: string]: any;
  };
  error?: string;
}

interface MineruParsedData {
  references?: any[];
  content?: string;
  metadata?: any;
  [key: string]: any;
}

/**
 * Service for integrating with Mineru PDF parsing API
 * Handles async task submission and result polling
 */
export class MineruService {
  private readonly config: MineruConfig;

  constructor() {
    const { config, warnings } = getMineruConfig();
    this.config = config;
    
    if (warnings.length > 0) {
      console.warn('⚠️  MineruService configuration warnings:', warnings);
    }
  }

  /**
   * Submit a PDF file for parsing and return task ID
   * @param item - Library item containing metadata
   * @param pdfBlob - PDF file as Blob
   * @returns Promise resolving to task ID
   */
  async submitTaskFromFile(item: LibraryItem, pdfBlob: Blob): Promise<string> {
    try {
      console.log(`Submitting PDF to Mineru for item: ${item.title}`);
      
      // Step 1: Get upload URL
      const uploadResponse = await this.getUploadUrl();
      const { data_id, upload_url } = uploadResponse;
      
      // Step 2: Upload PDF file
      await this.uploadFile(upload_url, pdfBlob);
      console.log(`PDF uploaded successfully, data_id: ${data_id}`);
      
      // Step 3: Poll for task ID
      const taskId = await this.pollForTaskId(data_id);
      console.log(`Task created successfully, task_id: ${taskId}`);
      
      return taskId;
    } catch (error) {
      console.error('Error submitting task to Mineru:', error);
      throw new Error(`Failed to submit task to Mineru: ${error}`);
    }
  }

  /**
   * Poll for task completion and return parsed results
   * @param taskId - Task ID from Mineru
   * @returns Promise resolving to parsed data
   */
  async pollTaskResult(taskId: string): Promise<MineruParsedData> {
    return new Promise((resolve, reject) => {
      console.log(`Starting to poll task result for task_id: ${taskId}`);
      
      const pollInterval = setInterval(async () => {
        try {
          const result = await this.getTaskStatus(taskId);
          
          console.log(`Task ${taskId} state: ${result.state}`);
          
          switch (result.state) {
            case 'done':
              clearInterval(pollInterval);
              if (result.result?.full_zip_url) {
                try {
                  const parsedData = await this.fetchAndUnzipResult(result.result.full_zip_url);
                  resolve(parsedData);
                } catch (unzipError) {
                  console.error('Error processing result:', unzipError);
                  reject(new Error(`Failed to process result: ${unzipError}`));
                }
              } else {
                reject(new Error('Task completed but no result URL provided'));
              }
              break;
              
            case 'failed':
              clearInterval(pollInterval);
              reject(new Error(`Task failed: ${result.error || 'Unknown error'}`));
              break;
              
            case 'pending':
            case 'running':
              // Continue polling
              break;
              
            default:
              console.warn(`Unknown task state: ${result.state}`);
              break;
          }
        } catch (error) {
          console.error('Error polling task status:', error);
          clearInterval(pollInterval);
          reject(error);
        }
      }, this.config.pollInterval);
      
      // Set timeout to avoid infinite polling
      setTimeout(() => {
        clearInterval(pollInterval);
        reject(new Error(`Task polling timeout after ${this.config.maxPollTimeout / 1000} seconds`));
      }, this.config.maxPollTimeout);
    });
  }

  /**
   * Get upload URL for file
   */
  private async getUploadUrl(): Promise<MineruFileUploadResponse> {
    const response = await fetch(`${this.config.baseUrl}/file-urls/batch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        count: 1,
        file_type: 'pdf'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.urls[0]; // Assuming batch returns array of URLs
  }

  /**
   * Upload file to the provided URL
   */
  private async uploadFile(uploadUrl: string, pdfBlob: Blob): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/pdf'
      },
      body: pdfBlob
    });

    if (!response.ok) {
      throw new Error(`Upload failed! status: ${response.status}`);
    }
  }

  /**
   * Poll for task ID using data_id
   */
  private async pollForTaskId(dataId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`${this.config.baseUrl}/extract/tasks`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.config.apiToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data: MineruBatchTaskResponse = await response.json();
          const matchingTask = data.tasks.find(task => task.data_id === dataId);
          
          if (matchingTask) {
            clearInterval(pollInterval);
            resolve(matchingTask.task_id);
          }
        } catch (error) {
          console.error('Error polling for task ID:', error);
          clearInterval(pollInterval);
          reject(error);
        }
      }, 2000); // Poll every 2 seconds for task ID
      
      // Timeout after 2 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        reject(new Error('Timeout waiting for task ID'));
      }, 2 * 60 * 1000);
    });
  }

  /**
   * Get task status
   */
  private async getTaskStatus(taskId: string): Promise<MineruTaskResult> {
    const response = await fetch(`${this.config.baseUrl}/extract/task/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Download and unzip result from Mineru
   * TODO: Implement actual ZIP processing logic based on Mineru's response format
   */
  private async fetchAndUnzipResult(zipUrl: string): Promise<MineruParsedData> {
    try {
      console.log(`Downloading result from: ${zipUrl}`);
      
      // Download the ZIP file
      const response = await fetch(zipUrl);
      if (!response.ok) {
        throw new Error(`Failed to download result: ${response.status}`);
      }
      
      const zipBlob = await response.blob();
      
      // Unzip and process the contents
      const zipReader = new zip.ZipReader(new zip.BlobReader(zipBlob));
      const entries = await zipReader.getEntries();
      
      let parsedData: MineruParsedData = {};
      
      // Process each file in the ZIP
      for (const entry of entries) {
        if (entry.filename.endsWith('.json')) {
          // Extract JSON files (assuming they contain parsed data)
          const jsonBlob = await entry.getData!(new zip.BlobWriter());
          const jsonText = await jsonBlob.text();
          const jsonData = JSON.parse(jsonText);
          
          // Merge JSON data
          parsedData = { ...parsedData, ...jsonData };
        }
      }
      
      await zipReader.close();
      
      console.log('Successfully processed Mineru result');
      return parsedData;
      
    } catch (error) {
      console.error('Error processing Mineru result:', error);
      throw new Error(`Failed to process Mineru result: ${error}`);
    }
  }

  /**
   * Get available parsing providers
   */
  getProviderInfo(): { name: string; version: string } {
    return {
      name: 'Mineru',
      version: '1.0.0'
    };
  }
}

// Export singleton instance
export const mineruService = new MineruService();