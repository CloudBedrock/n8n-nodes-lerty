import { IDataObject, IHttpRequestMethods, IHttpRequestOptions } from 'n8n-workflow';

export interface LertyHttpConfig {
  baseUrl: string;
  apiToken: string;
  timeout?: number;
}

export interface LertyAgent {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  tenantId: string;
  organizationId: string;
  metadata?: IDataObject;
}

export interface LertyWebhookMessage {
  id: string;
  type: 'user_message' | 'agent_response';
  content: string;
  conversationId: string;
  userId?: string;
  agentId: string;
  timestamp: string;
  metadata?: IDataObject;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
}


export class LertyHttp {
  private config: LertyHttpConfig;

  constructor(config: LertyHttpConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  private async makeRequest<T>(
    method: IHttpRequestMethods,
    endpoint: string,
    data?: IDataObject,
    options?: Partial<IHttpRequestOptions>
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const requestHeaders: Record<string, string> = {
      'Authorization': `Bearer ${this.config.apiToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (options?.headers) {
      Object.keys(options.headers).forEach(key => {
        requestHeaders[key] = String(options.headers![key]);
      });
    }

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return result as T;
    } catch (error) {
      throw new Error(`Request failed: ${error}`);
    }
  }

  async getAgents(): Promise<LertyAgent[]> {
    try {
      const response = await this.makeRequest<{ agents: LertyAgent[] }>('GET', '/api/v1/agents');
      return response.agents || [];
    } catch (error) {
      throw new Error(`Failed to fetch agents: ${error}`);
    }
  }

  async getAgent(agentId: string): Promise<LertyAgent> {
    try {
      const response = await this.makeRequest<{ agent: LertyAgent }>('GET', `/api/v1/agents/${agentId}`);
      return response.agent;
    } catch (error) {
      throw new Error(`Failed to fetch agent ${agentId}: ${error}`);
    }
  }

  async sendMessage(agentId: string, message: Partial<LertyWebhookMessage>): Promise<LertyWebhookMessage> {
    try {
      const response = await this.makeRequest<{ message: LertyWebhookMessage }>(
        'POST',
        `/webhooks/agents/${agentId}/message`,
        message
      );
      return response.message;
    } catch (error) {
      throw new Error(`Failed to send message to agent ${agentId}: ${error}`);
    }
  }


  async downloadFile(fileUrl: string): Promise<Buffer> {
    try {
      const response = await fetch(fileUrl, {
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      throw new Error(`Failed to download file: ${error}`);
    }
  }

  async validateWebhook(payload: any, signature: string): Promise<boolean> {
    // Implement webhook signature validation if needed
    // This would typically use HMAC verification
    return true;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getAgents();
      return true;
    } catch (error) {
      return false;
    }
  }

  async sendTypingIndicator(agentId: string, conversationId: string, typing: boolean): Promise<any> {
    try {
      const response = await this.makeRequest<any>(
        'POST',
        `/api/agents/${agentId}/callback`,
        {
          data: {
            typing: typing,
          },
          conversation_id: conversationId,
          callback_type: 'typing',
        }
      );
      return response;
    } catch (error) {
      throw new Error(`Failed to send typing indicator for agent ${agentId}: ${error}`);
    }
  }
}