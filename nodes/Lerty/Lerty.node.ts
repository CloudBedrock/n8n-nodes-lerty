import {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
  IHttpRequestOptions,
} from 'n8n-workflow';

import { LertyHttp, LertyAgent, LertyWebhookMessage } from '../../utils/LertyHttp';
import { FileUtils } from '../../utils/FileUtils';

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
    inputs: ['main'],
    outputs: ['main'],
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
            name: 'Send Message',
            value: 'sendMessage',
            description: 'Send a message to a Lerty agent',
            action: 'Send a message to a Lerty agent',
          },
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
            name: 'Upload File',
            value: 'uploadFile',
            description: 'Upload a file to an agent',
            action: 'Upload a file to an agent',
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
            operation: ['sendMessage', 'getAgent', 'uploadFile'],
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
        displayName: 'Message',
        name: 'message',
        type: 'string',
        required: true,
        default: '',
        placeholder: 'Hello, how can you help me?',
        displayOptions: {
          show: {
            operation: ['sendMessage'],
          },
        },
        description: 'The message to send to the agent',
      },
      {
        displayName: 'Conversation ID',
        name: 'conversationId',
        type: 'string',
        default: '',
        placeholder: 'conv_123',
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
        displayName: 'File Source',
        name: 'fileSource',
        type: 'options',
        options: [
          {
            name: 'URL',
            value: 'url',
            description: 'Upload file from URL',
          },
          {
            name: 'Binary Data',
            value: 'binary',
            description: 'Upload file from binary data',
          },
        ],
        default: 'url',
        displayOptions: {
          show: {
            operation: ['uploadFile'],
          },
        },
      },
      {
        displayName: 'File URL',
        name: 'fileUrl',
        type: 'string',
        default: '',
        placeholder: 'https://example.com/file.pdf',
        required: true,
        displayOptions: {
          show: {
            operation: ['uploadFile'],
            fileSource: ['url'],
          },
        },
        description: 'URL of the file to upload',
      },
      {
        displayName: 'Binary Property',
        name: 'binaryProperty',
        type: 'string',
        default: 'data',
        placeholder: 'data',
        required: true,
        displayOptions: {
          show: {
            operation: ['uploadFile'],
            fileSource: ['binary'],
          },
        },
        description: 'Name of the binary property containing the file data',
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
        this: IExecuteFunctions,
        filter?: string,
      ): Promise<{ name: string; value: string }[]> {
        const credentials = await this.getCredentials('lertyApi');
        const lertyHttp = new LertyHttp({
          baseUrl: credentials.baseUrl as string,
          apiToken: credentials.apiToken as string,
        });

        try {
          const agents = await lertyHttp.getAgents();
          return agents
            .filter((agent: LertyAgent) => 
              !filter || agent.name.toLowerCase().includes(filter.toLowerCase())
            )
            .map((agent: LertyAgent) => ({
              name: `${agent.name} (${agent.id})`,
              value: agent.id,
            }));
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
          case 'sendMessage':
            responseData = await this.sendMessage(lertyHttp, i);
            break;
          case 'getAgent':
            responseData = await this.getAgent(lertyHttp, i);
            break;
          case 'listAgents':
            responseData = await this.listAgents(lertyHttp, i);
            break;
          case 'uploadFile':
            responseData = await this.uploadFile(lertyHttp, i);
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
      } catch (error) {
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

  private async sendMessage(lertyHttp: LertyHttp, itemIndex: number): Promise<any> {
    const agentId = this.getNodeParameter('agentId', itemIndex, '', { extractValue: true }) as string;
    const message = this.getNodeParameter('message', itemIndex) as string;
    const conversationId = this.getNodeParameter('conversationId', itemIndex, '') as string;
    const userId = this.getNodeParameter('userId', itemIndex, '') as string;
    const fileAttachment = this.getNodeParameter('fileAttachment', itemIndex, {}) as IDataObject;
    const additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;

    const messageData: Partial<LertyWebhookMessage> = {
      content: message,
      conversationId: conversationId || `conv_${Date.now()}`,
      userId: userId || undefined,
      type: 'user_message',
      timestamp: new Date().toISOString(),
    };

    // Add file attachment if provided
    if (fileAttachment.file) {
      const file = fileAttachment.file as IDataObject;
      if (file.url) {
        messageData.fileUrl = file.url as string;
        messageData.fileName = file.name as string || FileUtils.extractFileInfo(file.url as string).name;
        messageData.fileType = file.type as string || FileUtils.extractFileInfo(file.url as string).type;
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

  private async getAgent(lertyHttp: LertyHttp, itemIndex: number): Promise<any> {
    const agentId = this.getNodeParameter('agentId', itemIndex, '', { extractValue: true }) as string;
    return await lertyHttp.getAgent(agentId);
  }

  private async listAgents(lertyHttp: LertyHttp, itemIndex: number): Promise<any> {
    const agents = await lertyHttp.getAgents();
    return { agents, count: agents.length };
  }

  private async uploadFile(lertyHttp: LertyHttp, itemIndex: number): Promise<any> {
    const agentId = this.getNodeParameter('agentId', itemIndex, '', { extractValue: true }) as string;
    const fileSource = this.getNodeParameter('fileSource', itemIndex) as string;

    let fileBuffer: Buffer;
    let fileName: string;
    let fileType: string;

    if (fileSource === 'url') {
      const fileUrl = this.getNodeParameter('fileUrl', itemIndex) as string;
      const fileInfo = FileUtils.extractFileInfo(fileUrl);
      fileName = fileInfo.name;
      fileType = fileInfo.type;
      fileBuffer = await FileUtils.downloadFileFromUrl(fileUrl);
    } else {
      const binaryPropertyName = this.getNodeParameter('binaryProperty', itemIndex) as string;
      const binaryData = this.helpers.assertBinaryData(itemIndex, binaryPropertyName);
      
      fileBuffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
      fileName = binaryData.fileName || 'file';
      fileType = binaryData.mimeType || 'application/octet-stream';
    }

    // Validate file
    if (!FileUtils.validateFileType(fileType)) {
      throw new NodeOperationError(
        this.getNode(),
        `Unsupported file type: ${fileType}`,
        { itemIndex }
      );
    }

    if (!FileUtils.validateFileSize(fileBuffer.length)) {
      throw new NodeOperationError(
        this.getNode(),
        `File size too large: ${FileUtils.formatFileSize(fileBuffer.length)}`,
        { itemIndex }
      );
    }

    return await lertyHttp.uploadFile(agentId, fileBuffer, fileName, fileType);
  }
}