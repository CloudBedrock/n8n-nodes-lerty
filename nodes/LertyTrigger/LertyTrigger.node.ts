import {
  IDataObject,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  ITriggerFunctions,
  ITriggerResponse,
  NodeOperationError,
  IWebhookFunctions,
  IWebhookResponseData,
  IHttpRequestMethods,
  ILoadOptionsFunctions,
  INodePropertyOptions,
  NodeConnectionType,
} from 'n8n-workflow';

import { LertyWebSocket, LertyMessage } from '../../utils/LertyWebSocket';
import { LertyHttp, LertyAgent } from '../../utils/LertyHttp';
import { FileUtils } from '../../utils/FileUtils';

export class LertyTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Lerty Trigger',
    name: 'lertyTrigger',
    icon: 'file:lertytrigger.svg',
    group: ['trigger'],
    version: 1,
    description: 'Triggers when receiving messages from Lerty agents',
    defaults: {
      name: 'Lerty Trigger',
    },
    inputs: [],
    outputs: [NodeConnectionType.Main],
    credentials: [
      {
        name: 'lertyApi',
        required: true,
      },
    ],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'lerty',
      },
    ],
    properties: [
      {
        displayName: 'Connection Mode',
        name: 'connectionMode',
        type: 'options',
        options: [
          {
            name: 'WebSocket',
            value: 'websocket',
            description: 'Use WebSocket for real-time communication',
          },
          {
            name: 'Webhook',
            value: 'webhook',
            description: 'Use HTTP webhook for receiving messages',
          },
          {
            name: 'Auto',
            value: 'auto',
            description: 'Try WebSocket first, fallback to webhook',
          },
        ],
        default: 'auto',
        description: 'Choose how to receive messages from Lerty',
      },
      {
        displayName: 'Topic Pattern',
        name: 'topicPattern',
        type: 'string',
        default: 'agent_chat:*',
        placeholder: 'agent_chat:tenant_123_org_456_agent_*',
        displayOptions: {
          show: {
            connectionMode: ['websocket', 'auto'],
          },
        },
        description: 'Phoenix channel topic pattern to subscribe to (supports wildcards)',
      },
      {
        displayName: 'Subscription Mode',
        name: 'subscriptionMode',
        type: 'options',
        options: [
          {
            name: 'Single Topic',
            value: 'single',
            description: 'Subscribe to a single topic or pattern',
          },
          {
            name: 'Multiple Topics',
            value: 'multiple',
            description: 'Subscribe to multiple specific topics',
          },
          {
            name: 'Agent-Based',
            value: 'agent',
            description: 'Subscribe based on selected agents',
          },
        ],
        default: 'single',
        displayOptions: {
          show: {
            connectionMode: ['websocket', 'auto'],
          },
        },
        description: 'How to determine which topics to subscribe to',
      },
      {
        displayName: 'Topics',
        name: 'topics',
        type: 'fixedCollection',
        placeholder: 'Add Topic',
        default: {},
        displayOptions: {
          show: {
            connectionMode: ['websocket', 'auto'],
            subscriptionMode: ['multiple'],
          },
        },
        typeOptions: {
          multipleValues: true,
        },
        options: [
          {
            name: 'topicValues',
            displayName: 'Topic',
            values: [
              {
                displayName: 'Topic',
                name: 'topic',
                type: 'string',
                default: '',
                placeholder: 'agent_chat:tenant_123_org_456_agent_789',
                description: 'Phoenix channel topic to subscribe to',
              },
            ],
          },
        ],
      },
      {
        displayName: 'Agents',
        name: 'agents',
        type: 'multiOptions',
        default: [],
        placeholder: 'Select agents...',
        displayOptions: {
          show: {
            connectionMode: ['websocket', 'auto'],
            subscriptionMode: ['agent'],
          },
        },
        typeOptions: {
          loadOptionsMethod: 'getAgents',
        },
        description: 'Select specific agents to listen to',
      },
      {
        displayName: 'Event Types',
        name: 'eventTypes',
        type: 'multiOptions',
        options: [
          {
            name: 'User Message',
            value: 'user_message',
            description: 'Messages from users',
          },
          {
            name: 'Agent Response',
            value: 'agent_response',
            description: 'Responses from agents',
          },
          {
            name: 'Typing Indicator',
            value: 'typing',
            description: 'Typing indicators',
          },
          {
            name: 'Agent Status',
            value: 'agent_status',
            description: 'Agent status changes',
          },
          {
            name: 'File Attachment',
            value: 'file_attachment',
            description: 'File attachments',
          },
        ],
        default: ['user_message', 'agent_response'],
        description: 'Types of events to trigger on',
      },
      {
        displayName: 'Message Filters',
        name: 'messageFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        options: [
          {
            displayName: 'User ID',
            name: 'userId',
            type: 'string',
            default: '',
            placeholder: 'user_123',
            description: 'Filter by specific user ID',
          },
          {
            displayName: 'Conversation ID',
            name: 'conversationId',
            type: 'string',
            default: '',
            placeholder: 'conv_123',
            description: 'Filter by specific conversation ID',
          },
          {
            displayName: 'Agent ID',
            name: 'agentId',
            type: 'string',
            default: '',
            placeholder: 'agent_123',
            description: 'Filter by specific agent ID',
          },
          {
            displayName: 'Content Contains',
            name: 'contentContains',
            type: 'string',
            default: '',
            placeholder: 'keyword',
            description: 'Filter messages containing specific text',
          },
        ],
      },
      {
        displayName: 'Connection Options',
        name: 'connectionOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: {
            connectionMode: ['websocket', 'auto'],
          },
        },
        options: [
          {
            displayName: 'Reconnect on Error',
            name: 'reconnectOnError',
            type: 'boolean',
            default: true,
            description: 'Whether to reconnect when connection is lost',
          },
          {
            displayName: 'Max Reconnect Attempts',
            name: 'maxReconnectAttempts',
            type: 'number',
            default: 10,
            description: 'Maximum number of reconnection attempts',
          },
          {
            displayName: 'Reconnect Delay (ms)',
            name: 'reconnectDelay',
            type: 'number',
            default: 5000,
            description: 'Delay between reconnection attempts in milliseconds',
          },
          {
            displayName: 'Heartbeat Interval (ms)',
            name: 'heartbeatInterval',
            type: 'number',
            default: 30000,
            description: 'WebSocket heartbeat interval in milliseconds',
          },
        ],
      },
      {
        displayName: 'File Handling',
        name: 'fileHandling',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Download Files',
            name: 'downloadFiles',
            type: 'boolean',
            default: false,
            description: 'Whether to download file attachments as binary data',
          },
          {
            displayName: 'Max File Size (MB)',
            name: 'maxFileSize',
            type: 'number',
            default: 10,
            description: 'Maximum file size to download in MB',
          },
          {
            displayName: 'Allowed File Types',
            name: 'allowedFileTypes',
            type: 'string',
            default: 'image/*,text/*,application/pdf',
            placeholder: 'image/*,text/*,application/pdf',
            description: 'Comma-separated list of allowed MIME types (supports wildcards)',
          },
        ],
      },
    ],
  };

  methods = {
    loadOptions: {
      async getAgents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials('lertyApi');
        const lertyHttp = new LertyHttp({
          baseUrl: credentials.baseUrl as string,
          apiToken: credentials.apiToken as string,
        });

        try {
          const agents = await lertyHttp.getAgents();
          return agents.map((agent: LertyAgent) => ({
            name: `${agent.name} (${agent.id})`,
            value: agent.id,
          }));
        } catch (error) {
          throw new NodeOperationError(this.getNode(), `Failed to load agents: ${error}`);
        }
      },
    },
  };

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
    const connectionMode = this.getNodeParameter('connectionMode') as string;
    const eventTypes = this.getNodeParameter('eventTypes') as string[];
    const messageFilters = this.getNodeParameter('messageFilters', {}) as IDataObject;
    const fileHandling = this.getNodeParameter('fileHandling', {}) as IDataObject;

    const credentials = await this.getCredentials('lertyApi');
    const wsUrl = credentials.wsUrl as string || 'wss://api.lerty.ai/socket';
    const apiToken = credentials.apiToken as string;

    let websocket: LertyWebSocket | null = null;
    let isWebSocketConnected = false;

    // Try WebSocket connection if enabled
    if (connectionMode === 'websocket' || connectionMode === 'auto') {
      try {
        websocket = new LertyWebSocket({
          wsUrl,
          apiToken,
          timeout: 10000,
          heartbeatInterval: this.getNodeParameter('connectionOptions.heartbeatInterval', 30000) as number,
          reconnectAfterMs: this.getNodeParameter('connectionOptions.reconnectDelay', 5000) as number,
          maxReconnectAttempts: this.getNodeParameter('connectionOptions.maxReconnectAttempts', 10) as number,
        });

        await websocket.connect();
        isWebSocketConnected = true;

        // Subscribe to topics
        await subscribeToTopics(this, websocket);
        
        this.logger.info('LertyTrigger: WebSocket connection established');
      } catch (error) {
        this.logger.warn(`LertyTrigger: WebSocket connection failed: ${error}`);
        if (connectionMode === 'websocket') {
          throw new NodeOperationError(this.getNode(), `WebSocket connection failed: ${error}`);
        }
      }
    }

    // Set up message handler
    const messageHandler = async (message: LertyMessage | IDataObject) => {
      try {
        const processedMessage = await processMessage(this, message, fileHandling);
        
        if (shouldTrigger(processedMessage, eventTypes, messageFilters)) {
          this.emit([[{ json: processedMessage }]]);
        }
      } catch (error) {
        this.logger.error(`LertyTrigger: Error processing message: ${error}`);
      }
    };

    // Handle WebSocket messages
    if (websocket && isWebSocketConnected) {
      // Note: This is a simplified implementation. In a real scenario,
      // you would need to handle the websocket message events properly
      // within the subscription callbacks
    }

    return {
      closeFunction: async () => {
        if (websocket) {
          await websocket.disconnect();
        }
      },
      // Note: For webhook mode, the trigger would be handled by the webhook method
    };
  }

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const body = this.getBodyData() as IDataObject;
    const headers = this.getHeaderData() as IDataObject;
    const eventTypes = this.getNodeParameter('eventTypes') as string[];
    const messageFilters = this.getNodeParameter('messageFilters', {}) as IDataObject;
    const fileHandling = this.getNodeParameter('fileHandling', {}) as IDataObject;

    try {
      const processedMessage = await processMessage(this, body, fileHandling);
      
      if (shouldTrigger(processedMessage, eventTypes, messageFilters)) {
        // For webhook mode, we need to return the data differently
        // This is a simplified approach - in a real implementation,
        // you'd need to handle the webhook trigger mechanism properly
      }

      return {
        webhookResponse: {
          status: 200,
          body: { received: true },
        },
      };
    } catch (error) {
      this.logger.error(`LertyTrigger: Webhook error: ${error}`);
      return {
        webhookResponse: {
          status: 500,
          body: { error: 'Internal server error' },
        },
      };
    }
  }

}

async function subscribeToTopics(triggerFunctions: ITriggerFunctions, websocket: LertyWebSocket): Promise<void> {
    const subscriptionMode = triggerFunctions.getNodeParameter('subscriptionMode') as string;
    const topics: string[] = [];

    switch (subscriptionMode) {
      case 'single':
        const topicPattern = triggerFunctions.getNodeParameter('topicPattern') as string;
        topics.push(topicPattern);
        break;
      case 'multiple':
        const topicConfig = triggerFunctions.getNodeParameter('topics', {}) as IDataObject;
        const topicValues = topicConfig.topicValues as IDataObject[];
        if (topicValues) {
          topics.push(...topicValues.map(t => t.topic as string));
        }
        break;
      case 'agent':
        const agents = triggerFunctions.getNodeParameter('agents') as string[];
        agents.forEach(agentId => {
          topics.push(`agent_chat:agent_${agentId}`);
        });
        break;
    }

    // Subscribe to each topic
    for (const topic of topics) {
      await websocket.subscribe(topic, (message: LertyMessage) => {
        // Message will be processed in the trigger method
      });
    }
  }

async function processMessage(triggerFunctions: ITriggerFunctions | IWebhookFunctions, message: LertyMessage | IDataObject, fileHandling: IDataObject): Promise<any> {
    const processedMessage = { ...message };

    // Handle file attachments
    if (message.fileUrl && fileHandling.downloadFiles) {
      try {
        const maxFileSize = (fileHandling.maxFileSize as number || 10) * 1024 * 1024; // MB to bytes
        const allowedTypes = (fileHandling.allowedFileTypes as string || 'image/*,text/*,application/pdf')
          .split(',').map(t => t.trim());

        const fileInfo = FileUtils.extractFileInfo(message.fileUrl as string);
        
        // Check if file type is allowed
        const isAllowed = allowedTypes.some(allowedType => {
          if (allowedType.endsWith('/*')) {
            const category = allowedType.split('/')[0];
            return fileInfo.type.startsWith(category);
          }
          return fileInfo.type === allowedType;
        });

        if (isAllowed) {
          const credentials = await triggerFunctions.getCredentials('lertyApi');
          const fileBuffer = await FileUtils.downloadFileFromUrl(message.fileUrl as string, {
            'Authorization': `Bearer ${credentials.apiToken}`,
          });

          if (fileBuffer.length <= maxFileSize) {
            (processedMessage as any).binary = {
              file: {
                data: fileBuffer.toString('base64'),
                mimeType: fileInfo.type,
                fileName: fileInfo.name,
                fileSize: fileBuffer.length,
              },
            };
          }
        }
      } catch (error) {
        triggerFunctions.logger.warn(`LertyTrigger: Failed to download file: ${error}`);
      }
    }

    return processedMessage;
  }

function shouldTrigger(message: any, eventTypes: string[], messageFilters: IDataObject): boolean {
    // Check event type filter
    if (eventTypes.length > 0 && !eventTypes.includes(message.type)) {
      return false;
    }

    // Check message filters
    if (messageFilters.userId && message.userId !== messageFilters.userId) {
      return false;
    }

    if (messageFilters.conversationId && message.conversationId !== messageFilters.conversationId) {
      return false;
    }

    if (messageFilters.agentId && message.agentId !== messageFilters.agentId) {
      return false;
    }

    if (messageFilters.contentContains && 
        (!message.content || !message.content.toLowerCase().includes((messageFilters.contentContains as string).toLowerCase()))) {
      return false;
    }

    return true;
  }