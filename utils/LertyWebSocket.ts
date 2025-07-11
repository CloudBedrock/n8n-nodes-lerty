import { Socket, Channel } from 'phoenix';
import { IDataObject } from 'n8n-workflow';

export interface LertyWebSocketConfig {
  wsUrl: string;
  apiToken: string;
  timeout?: number;
  heartbeatInterval?: number;
  reconnectAfterMs?: number;
  maxReconnectAttempts?: number;
}

export interface LertyMessage {
  id: string;
  type: 'user_message' | 'agent_response' | 'typing' | 'agent_status' | 'file_attachment';
  content: string;
  conversationId: string;
  userId?: string;
  agentId?: string;
  timestamp: string;
  metadata?: IDataObject;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
}

export interface TopicSubscription {
  topic: string;
  channel: Channel;
  callback: (message: LertyMessage) => void;
}

export class LertyWebSocket {
  private socket: Socket | null = null;
  private subscriptions: Map<string, TopicSubscription> = new Map();
  private config: LertyWebSocketConfig;
  private reconnectAttempts = 0;
  private isConnected = false;

  constructor(config: LertyWebSocketConfig) {
    this.config = {
      timeout: 10000,
      heartbeatInterval: 30000,
      reconnectAfterMs: 5000,
      maxReconnectAttempts: 10,
      ...config,
    };
  }

  async connect(): Promise<void> {
    if (this.socket && this.isConnected) {
      return;
    }

    this.socket = new Socket(this.config.wsUrl, {
      params: {
        token: this.config.apiToken,
      },
      timeout: this.config.timeout,
      heartbeatIntervalMs: this.config.heartbeatInterval,
      reconnectAfterMs: this.config.reconnectAfterMs,
    });

    return new Promise((resolve, reject) => {
      this.socket!.onOpen(() => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve();
      });

      this.socket!.onError((error: any) => {
        this.isConnected = false;
        reject(new Error(`WebSocket connection error: ${error}`));
      });

      this.socket!.onClose(() => {
        this.isConnected = false;
        this.handleReconnect();
      });

      this.socket!.connect();
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.config.maxReconnectAttempts!) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect().catch(() => {
          // Reconnection failed, will try again
        });
      }, this.config.reconnectAfterMs! * this.reconnectAttempts);
    }
  }

  async subscribe(topic: string, callback: (message: LertyMessage) => void): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    if (this.subscriptions.has(topic)) {
      throw new Error(`Already subscribed to topic: ${topic}`);
    }

    const channel = this.socket.channel(topic, {});
    
    channel.on('message', (payload: any) => {
      try {
        const message: LertyMessage = this.parseMessage(payload);
        callback(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    return new Promise((resolve, reject) => {
      channel.join()
        .receive('ok', () => {
          this.subscriptions.set(topic, { topic, channel, callback });
          resolve();
        })
        .receive('error', (error: any) => {
          reject(new Error(`Failed to subscribe to topic ${topic}: ${error}`));
        });
    });
  }

  async unsubscribe(topic: string): Promise<void> {
    const subscription = this.subscriptions.get(topic);
    if (!subscription) {
      return;
    }

    await subscription.channel.leave();
    this.subscriptions.delete(topic);
  }

  async sendMessage(topic: string, message: Partial<LertyMessage>): Promise<void> {
    const subscription = this.subscriptions.get(topic);
    if (!subscription) {
      throw new Error(`Not subscribed to topic: ${topic}`);
    }

    return new Promise((resolve, reject) => {
      subscription.channel.push('message', message)
        .receive('ok', () => resolve())
        .receive('error', (error: any) => reject(new Error(`Failed to send message: ${error}`)));
    });
  }

  private parseMessage(payload: any): LertyMessage {
    return {
      id: payload.id || '',
      type: payload.type || 'user_message',
      content: payload.content || '',
      conversationId: payload.conversation_id || '',
      userId: payload.user_id,
      agentId: payload.agent_id,
      timestamp: payload.timestamp || new Date().toISOString(),
      metadata: payload.metadata || {},
      fileUrl: payload.file_url,
      fileName: payload.file_name,
      fileType: payload.file_type,
    };
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      // Unsubscribe from all topics
      for (const [topic] of this.subscriptions) {
        await this.unsubscribe(topic);
      }
      
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  isTopicSubscribed(topic: string): boolean {
    return this.subscriptions.has(topic);
  }
}