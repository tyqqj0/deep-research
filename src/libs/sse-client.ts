/**
 * 🎯 SSE Client - 实时状态更新客户端
 *
 * 用于接收后端发送的Server-Sent Events，实时更新文献解析状态。
 * 替代原有的复杂轮询逻辑。
 *
 * @example
 * import { sseClient } from '@/libs/sse-client';
 *
 * // 监听文献状态更新
 * sseClient.subscribe('literature-status', (data) => {
 *   console.log('Literature status updated:', data);
 * });
 *
 * // 开始连接
 * sseClient.connect();
 *
 * // 断开连接
 * sseClient.disconnect();
 */

import { LibraryItem } from './db';

interface SSEMessage {
    type: 'literature-status' | 'parsing-progress' | 'error';
    data: any;
    timestamp: string;
}

interface LiteratureStatusUpdate {
    itemId: string;
    status: string;
    progress?: {
        stage: string;
        percentage: number;
        details?: string;
    };
    updatedItem?: Partial<LibraryItem>;
    error?: string;
}

type EventCallback = (data: any) => void;

class SSEClient {
    private eventSource: EventSource | null = null;
    private callbacks: Map<string, EventCallback[]> = new Map();
    private isConnected = false;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000; // 1秒

    /**
     * 建立SSE连接
     */
    connect(): void {
        if (this.isConnected || this.eventSource) {
            console.log('🔄 SSE already connected or connecting...');
            return;
        }

        try {
            console.log('🔄 Establishing SSE connection...');

            // 连接到后端SSE端点
            this.eventSource = new EventSource('/api/sse/live');

            this.eventSource.onopen = () => {
                console.log('✅ SSE connection established');
                this.isConnected = true;
                this.reconnectAttempts = 0;
            };

            this.eventSource.onmessage = (event) => {
                this.handleMessage(event);
            };

            this.eventSource.onerror = (error) => {
                console.error('❌ SSE connection error:', error);
                this.handleConnectionError();
            };

        } catch (error) {
            console.error('❌ Failed to establish SSE connection:', error);
            this.handleConnectionError();
        }
    }

    /**
     * 断开SSE连接
     */
    disconnect(): void {
        console.log('🔌 Disconnecting SSE...');

        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }

        this.isConnected = false;
        this.reconnectAttempts = 0;
    }

    /**
     * 订阅特定类型的事件
     * @param eventType - 事件类型
     * @param callback - 回调函数
     */
    subscribe(eventType: string, callback: EventCallback): () => void {
        if (!this.callbacks.has(eventType)) {
            this.callbacks.set(eventType, []);
        }

        const callbacks = this.callbacks.get(eventType)!;
        callbacks.push(callback);

        console.log(`📡 Subscribed to SSE event: ${eventType}`);

        // 返回取消订阅函数
        return () => {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
                console.log(`📡 Unsubscribed from SSE event: ${eventType}`);
            }
        };
    }

    /**
     * 处理接收到的消息
     */
    private handleMessage(event: MessageEvent): void {
        try {
            const message: SSEMessage = JSON.parse(event.data);
            console.log('📨 Received SSE message:', message.type, message.data);

            // 触发相应的回调函数
            const callbacks = this.callbacks.get(message.type);
            if (callbacks) {
                callbacks.forEach(callback => {
                    try {
                        callback(message.data);
                    } catch (error) {
                        console.error(`❌ Error in SSE callback for ${message.type}:`, error);
                    }
                });
            }

        } catch (error) {
            console.error('❌ Failed to parse SSE message:', error);
        }
    }

    /**
     * 处理连接错误并尝试重连
     */
    private handleConnectionError(): void {
        this.isConnected = false;

        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }

        // 尝试重连
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指数退避

            console.log(`🔄 Attempting to reconnect SSE in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            setTimeout(() => {
                this.connect();
            }, delay);
        } else {
            console.error('❌ SSE max reconnection attempts reached, giving up');
        }
    }

    /**
     * 获取连接状态
     */
    getConnectionStatus(): {
        isConnected: boolean;
        reconnectAttempts: number;
    } {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts
        };
    }
}

// 导出单例实例
export const sseClient = new SSEClient();

// 导出类型定义
export type { SSEMessage, LiteratureStatusUpdate }; 