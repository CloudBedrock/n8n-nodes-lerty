import {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
  IHttpRequestOptions,
  ILoadOptionsFunctions,
  INodeListSearchResult,
  NodeConnectionType,
} from 'n8n-workflow';

import { LertyHttp, LertyAgent, LertyWebhookMessage } from '../../utils/LertyHttp';

export class Lerty implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Lerty',
    name: 'lerty',
    icon: 'file:lerty.svg',
    group: ['communication'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Interact with Lerty AI agents',
    defaults: {
      name: 'Lerty',
    },
    inputs: [NodeConnectionType.Main],
    outputs: [NodeConnectionType.Main],
    credentials: [
      {
        name: 'lertyApi',
        required: true,
      },
    ],
    requestDefaults: {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    },
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Get Agent',
            value: 'getAgent',
            description: 'Get information about a specific agent',
            action: 'Get information about a specific agent',
          },
          {
            name: 'List Agents',
            value: 'listAgents',
            description: 'List all available agents',
            action: 'List all available agents',
          },
          {
            name: 'Reply to Conversation',
            value: 'replyToConversation',
            description: 'Reply to an existing conversation',
            action: 'Reply to an existing conversation',
          },
          {
            name: 'Send Message',
            value: 'sendMessage',
            description: 'Send a message to a Lerty agent',
            action: 'Send a message to a lerty agent',
          },
          {
            name: 'Send Typing Indicator',
            value: 'sendTypingIndicator',
            description: 'Send typing indicator to a conversation',
            action: 'Send typing indicator to a conversation',
          },
        ],
        default: 'sendMessage',
      },
      {
        displayName: 'Agent',
        name: 'agentId',
        type: 'resourceLocator',
        default: { mode: 'list', value: '' },
        required: true,
        displayOptions: {
          show: {
            operation: ['sendMessage', 'replyToConversation', 'getAgent', 'sendTypingIndicator'],
          },
        },
        modes: [
          {
            displayName: 'From List',
            name: 'list',
            type: 'list',
            placeholder: 'Select an agent...',
            typeOptions: {
              searchListMethod: 'searchAgents',
              searchable: true,
            },
          },
          {
            displayName: 'By ID',
            name: 'id',
            type: 'string',
            placeholder: 'agent_123',
            validation: [
              {
                type: 'regex',
                properties: {
                  regex: '^[a-zA-Z0-9_-]+$',
                  errorMessage: 'Agent ID must contain only letters, numbers, hyphens, and underscores',
                },
              },
            ],
          },
        ],
      },
      {
        displayName: 'Conversation ID',
        name: 'conversationId',
        type: 'string',
        required: true,
        default: '',
        placeholder: 'conversation_123',
        displayOptions: {
          show: {
            operation: ['replyToConversation'],
          },
        },
        description: 'ID of the conversation to reply to',
      },
      {
        displayName: 'Conversation ID',
        name: 'conversationId',
        type: 'string',
        required: true,
        default: '',
        placeholder: 'conversation_123',
        displayOptions: {
          show: {
            operation: ['sendTypingIndicator'],
          },
        },
        description: 'ID of the conversation to send typing indicator to',
      },
      {
        displayName: 'Typing',
        name: 'typing',
        type: 'boolean',
        required: true,
        default: true,
        displayOptions: {
          show: {
            operation: ['sendTypingIndicator'],
          },
        },
        description: 'Whether to show typing indicator (true) or stop typing (false)',
      },
      {
        displayName: 'Message',
        name: 'message',
        type: 'string',
        required: true,
        default: '',
        placeholder: 'Hello, how can you help me?',
        displayOptions: {
          show: {
            operation: ['sendMessage', 'replyToConversation'],
          },
        },
        description: 'The message to send',
      },
      {
        displayName: 'Conversation ID',
        name: 'conversationId',
        type: 'string',
        default: '',
        placeholder: 'conversation_123',
        displayOptions: {
          show: {
            operation: ['sendMessage'],
          },
        },
        description: 'ID of the conversation (leave empty to start a new conversation)',
      },
      {
        displayName: 'User ID',
        name: 'userId',
        type: 'string',
        default: '',
        placeholder: 'user_123',
        displayOptions: {
          show: {
            operation: ['sendMessage'],
          },
        },
        description: 'ID of the user sending the message',
      },
      {
        displayName: 'File Attachment',
        name: 'fileAttachment',
        type: 'fixedCollection',
        default: {},
        placeholder: 'Add file attachment',
        displayOptions: {
          show: {
            operation: ['sendMessage'],
          },
        },
        typeOptions: {
          multipleValues: false,
        },
        options: [
          {
            name: 'file',
            displayName: 'File',
            values: [
              {
                displayName: 'File URL',
                name: 'url',
                type: 'string',
                default: '',
                placeholder: 'https://example.com/file.pdf',
                description: 'URL of the file to attach',
              },
              {
                displayName: 'File Name',
                name: 'name',
                type: 'string',
                default: '',
                placeholder: 'document.pdf',
                description: 'Name of the file (optional)',
              },
              {
                displayName: 'File Type',
                name: 'type',
                type: 'string',
                default: '',
                placeholder: 'application/pdf',
                description: 'MIME type of the file (optional)',
              },
            ],
          },
        ],
      },
      {
        displayName: 'Additional Fields',
        name: 'additionalFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        options: [
          {
            displayName: 'Metadata',
            name: 'metadata',
            type: 'fixedCollection',
            placeholder: 'Add Metadata',
            default: {},
            typeOptions: {
              multipleValues: true,
            },
            options: [
              {
                name: 'metadataValues',
                displayName: 'Metadata',
                values: [
                  {
                    displayName: 'Key',
                    name: 'key',
                    type: 'string',
                    default: '',
                    description: 'Metadata key',
                  },
                  {
                    displayName: 'Value',
                    name: 'value',
                    type: 'string',
                    default: '',
                    description: 'Metadata value',
                  },
                ],
              },
            ],
          },
          {
            displayName: 'Timeout',
            name: 'timeout',
            type: 'number',
            default: 30000,
            description: 'Request timeout in milliseconds',
          },
        ],
      },
    ],
  };

  methods = {
    listSearch: {
      searchAgents: async function (
        this: ILoadOptionsFunctions,
        filter?: string,
      ): Promise<INodeListSearchResult> {
        const credentials = await this.getCredentials('lertyApi');
        const lertyHttp = new LertyHttp({
          baseUrl: credentials.baseUrl as string,
          apiToken: credentials.apiToken as string,
        });

        try {
          const agents = await lertyHttp.getAgents();
          const results = agents
            .filter((agent: LertyAgent) => 
              !filter || agent.name.toLowerCase().includes(filter.toLowerCase())
            )
            .map((agent: LertyAgent) => ({
              name: `${agent.name} (${agent.id})`,
              value: agent.id,
            }));
          
          return {
            results,
          };
        } catch (error) {
          throw new NodeOperationError(this.getNode(), `Failed to load agents: ${error}`, {
            description: 'Make sure your API credentials are correct and the Lerty API is accessible',
          });
        }
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const results: INodeExecutionData[] = [];

    const credentials = await this.getCredentials('lertyApi');
    const lertyHttp = new LertyHttp({
      baseUrl: credentials.baseUrl as string,
      apiToken: credentials.apiToken as string,
    });

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter('operation', i) as string;

      try {
        let responseData: any;

        switch (operation) {
          case 'replyToConversation':
            responseData = await replyToConversation(this, lertyHttp, i);
            break;
          case 'sendMessage':
            responseData = await sendMessage(this, lertyHttp, i);
            break;
          case 'sendTypingIndicator':
            responseData = await sendTypingIndicator(this, lertyHttp, i);
            break;
          case 'getAgent':
            responseData = await getAgent(this, lertyHttp, i);
            break;
          case 'listAgents':
            responseData = await listAgents(this, lertyHttp, i);
            break;
          default:
            throw new NodeOperationError(
              this.getNode(),
              `Unknown operation: ${operation}`,
              { itemIndex: i }
            );
        }

        results.push({
          json: responseData,
          pairedItem: { item: i },
        });
      } catch (error: any) {
        if (this.continueOnFail()) {
          results.push({
            json: {
              error: error.message,
            },
            pairedItem: { item: i },
          });
        } else {
          throw error;
        }
      }
    }

    return [results];
  }

}

// Simple UUID v4 generator
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function replyToConversation(executeFunctions: IExecuteFunctions, lertyHttp: LertyHttp, itemIndex: number): Promise<any> {
    const agentId = executeFunctions.getNodeParameter('agentId', itemIndex, '', { extractValue: true }) as string;
    const conversationId = executeFunctions.getNodeParameter('conversationId', itemIndex) as string;
    const message = executeFunctions.getNodeParameter('message', itemIndex) as string;
    
    // Get the response webhook URL from the input data
    const inputData = executeFunctions.getInputData()[itemIndex];
    let responseWebhook = inputData.json.response_webhook as string;
    
    // If not found directly, check if it's in the original trigger data (passed through by typing indicator)
    if (!responseWebhook && inputData.json._originalTriggerData) {
      const originalTriggerData = inputData.json._originalTriggerData as IDataObject;
      responseWebhook = originalTriggerData.response_webhook as string;
    }
    
    // If still not found, try to find it in the workflow execution data from the LertyTrigger node
    if (!responseWebhook) {
      try {
        const workflowData = executeFunctions.getWorkflowDataProxy(itemIndex);
        const lertyTriggerData = workflowData.$('Lerty Trigger');
        if (lertyTriggerData && lertyTriggerData.item && lertyTriggerData.item.json) {
          responseWebhook = lertyTriggerData.item.json.response_webhook as string;
        }
      } catch (error) {
        // Ignore errors if Lerty Trigger node is not found
      }
    }
    
    // Log the raw values to debug expression evaluation
    console.log('Debug - agentId:', agentId);
    console.log('Debug - conversationId:', conversationId);
    console.log('Debug - message:', message);
    console.log('Debug - responseWebhook:', responseWebhook);
    
    // Check if expressions were not evaluated (contain literal expression syntax)
    if (conversationId.includes('{{') || conversationId.includes('}}')) {
      throw new NodeOperationError(
        executeFunctions.getNode(),
        `Conversation ID contains unevaluated expression: ${conversationId}. Please ensure the expression is properly formatted.`,
        { itemIndex }
      );
    }
    
    if (!conversationId || conversationId.trim() === '') {
      throw new NodeOperationError(
        executeFunctions.getNode(),
        'Conversation ID is required but was empty',
        { itemIndex }
      );
    }
    
    if (!responseWebhook) {
      console.log('Warning: response_webhook not found in input data:', JSON.stringify(inputData.json, null, 2));
      
      // Fallback: try to use the agent webhook endpoint
      console.log('Falling back to agent webhook endpoint');
      
      const fallbackMessageData: Partial<LertyWebhookMessage> = {
        id: generateUUID(),
        content: message,
        conversationId: conversationId,
        agentId: agentId,
        type: 'agent_response',
        timestamp: new Date().toISOString(),
      };
      
      return await lertyHttp.sendMessage(agentId, fallbackMessageData);
    }
    
    const messageData: IDataObject = {
      conversation_id: conversationId,
      content: message,
      message_id: generateUUID(),
      timestamp: new Date().toISOString(),
      // Include additional fields that might be needed
      user_id: inputData.json.user_id || '',
      organization_id: inputData.json.organization_id || '',
    };

    try {
      console.log('Debug - Response webhook URL:', responseWebhook);
      console.log('Debug - Request body:', JSON.stringify(messageData, null, 2));
      
      // Send to the response webhook URL
      const requestOptions: IHttpRequestOptions = {
        method: 'POST',
        url: responseWebhook,
        headers: {
          'Authorization': `Bearer ${lertyHttp['config'].apiToken}`,
          'Content-Type': 'application/json',
        },
        body: messageData,
        json: true,
      };
      
      const response = await executeFunctions.helpers.httpRequest(requestOptions);
      return response;
    } catch (error: any) {
      // Enhanced error logging for 422 errors
      if (error.response?.status === 422) {
        console.error('422 Error Details:');
        console.error('Response body:', JSON.stringify(error.response.body, null, 2));
        console.error('Request that failed:', {
          agentId: agentId,
          body: messageData,
          conversationId: conversationId
        });
        
        const errorDetails = error.response.body?.errors || error.response.body?.message || 'Unknown validation error';
        throw new NodeOperationError(
          executeFunctions.getNode(),
          `Validation error (422): ${JSON.stringify(errorDetails)}. ConversationId: "${conversationId}"`,
          { itemIndex, description: `Full error: ${JSON.stringify(error.response.body)}` }
        );
      }
      
      throw new NodeOperationError(
        executeFunctions.getNode(),
        `Failed to reply to conversation: ${error instanceof Error ? error.message : String(error)}`,
        { itemIndex }
      );
    }
  }

async function sendMessage(executeFunctions: IExecuteFunctions, lertyHttp: LertyHttp, itemIndex: number): Promise<any> {
    const agentId = executeFunctions.getNodeParameter('agentId', itemIndex, '', { extractValue: true }) as string;
    const message = executeFunctions.getNodeParameter('message', itemIndex) as string;
    const conversationId = executeFunctions.getNodeParameter('conversationId', itemIndex, '') as string;
    const userId = executeFunctions.getNodeParameter('userId', itemIndex, '') as string;
    const fileAttachment = executeFunctions.getNodeParameter('fileAttachment', itemIndex, {}) as IDataObject;
    const additionalFields = executeFunctions.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;

    const messageData: Partial<LertyWebhookMessage> = {
      id: generateUUID(),
      content: message,
      conversationId: conversationId || `conversation_${Date.now()}`,
      userId: userId || undefined,
      type: 'user_message',
      timestamp: new Date().toISOString(),
    };

    // Add file attachment if provided
    if (fileAttachment.file) {
      const file = fileAttachment.file as IDataObject;
      if (file.url) {
        messageData.fileUrl = file.url as string;
        messageData.fileName = file.name as string || 'file';
        messageData.fileType = file.type as string || 'application/octet-stream';
      }
    }

    // Add metadata if provided
    if (additionalFields.metadata) {
      const metadata = additionalFields.metadata as IDataObject;
      const metadataValues = metadata.metadataValues as IDataObject[];
      if (metadataValues && metadataValues.length > 0) {
        messageData.metadata = {};
        metadataValues.forEach((item) => {
          messageData.metadata![item.key as string] = item.value;
        });
      }
    }

    return await lertyHttp.sendMessage(agentId, messageData);
  }

async function getAgent(executeFunctions: IExecuteFunctions, lertyHttp: LertyHttp, itemIndex: number): Promise<any> {
    const agentId = executeFunctions.getNodeParameter('agentId', itemIndex, '', { extractValue: true }) as string;
    return await lertyHttp.getAgent(agentId);
  }

async function listAgents(executeFunctions: IExecuteFunctions, lertyHttp: LertyHttp, itemIndex: number): Promise<any> {
    const agents = await lertyHttp.getAgents();
    return { agents, count: agents.length };
  }


async function sendTypingIndicator(executeFunctions: IExecuteFunctions, lertyHttp: LertyHttp, itemIndex: number): Promise<any> {
    const agentId = executeFunctions.getNodeParameter('agentId', itemIndex, '', { extractValue: true }) as string;
    const conversationId = executeFunctions.getNodeParameter('conversationId', itemIndex) as string;
    const typing = executeFunctions.getNodeParameter('typing', itemIndex) as boolean;
    
    // Check if we have a response_webhook in the input data to extract the correct base URL
    const inputData = executeFunctions.getInputData()[itemIndex];
    const responseWebhook = inputData.json.response_webhook as string;
    
    let typingResult;
    
    if (responseWebhook) {
      // Extract base URL from response webhook
      const webhookUrl = new URL(responseWebhook);
      const baseUrl = `${webhookUrl.protocol}//${webhookUrl.host}`;
      
      // Create a temporary HTTP client with the correct base URL
      const dynamicLertyHttp = new LertyHttp({
        baseUrl: baseUrl,
        apiToken: lertyHttp['config'].apiToken,
      });
      
      typingResult = await dynamicLertyHttp.sendTypingIndicator(agentId, conversationId, typing);
    } else {
      // Fallback to the configured base URL
      typingResult = await lertyHttp.sendTypingIndicator(agentId, conversationId, typing);
    }
    
    // Preserve the original trigger data for subsequent nodes
    return {
      ...typingResult,
      // Pass through the original trigger data so replyToConversation can access it
      _originalTriggerData: inputData.json
    };
  }