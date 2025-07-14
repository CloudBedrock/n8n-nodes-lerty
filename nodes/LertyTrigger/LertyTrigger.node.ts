import {
  IDataObject,
  INodeType,
  INodeTypeDescription,
  ITriggerFunctions,
  ITriggerResponse,
  IWebhookFunctions,
  IWebhookResponseData,
  IHookFunctions,
  ILoadOptionsFunctions,
  INodePropertyOptions,
  NodeConnectionType,
  NodeOperationError,
} from 'n8n-workflow';

import { LertyHttp, LertyAgent } from '../../utils/LertyHttp';

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
        // Dynamic path to trigger UUID generation
        path: '={{$parameter["agentId"]}}',
      },
    ],
    properties: [
      {
        displayName: 'Agent',
        name: 'agentId',
        type: 'options',
        required: true,
        typeOptions: {
          loadOptionsMethod: 'getAgents',
        },
        default: '',
        description: 'The Lerty agent to receive messages from',
      },
      {
        displayName: 'Event Types',
        name: 'eventTypes',
        type: 'multiOptions',
        options: [
          {
            name: 'Agent Response',
            value: 'agent_response',
            description: 'Responses from agents',
          },
          {
            name: 'User Message',
            value: 'user_message',
            description: 'Messages from users',
          },
          {
            name: 'File Attachment',
            value: 'file_attachment',
            description: 'File attachments',
          },
        ],
        default: ['user_message'],
        description: 'Types of events to trigger on',
      },
      {
        displayName: 'Additional Fields',
        name: 'additionalFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        options: [
          {
            displayName: 'Secret Token',
            name: 'secretToken',
            type: 'string',
            typeOptions: {
              password: true,
            },
            default: '',
            description: 'Secret token for webhook authentication',
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
            name: agent.name,
            value: agent.id,
            description: `ID: ${agent.id}`,
          }));
        } catch (error) {
          throw new NodeOperationError(this.getNode(), `Failed to load agents: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    },
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl('default');
        const agentId = this.getNodeParameter('agentId') as string;
        const credentials = await this.getCredentials('lertyApi');
        
        const lertyHttp = new LertyHttp({
          baseUrl: credentials.baseUrl as string,
          apiToken: credentials.apiToken as string,
        });

        try {
          // Check if webhook exists for this agent
          // This would need to be implemented in your Lerty API
          // For now, return false to always create
          return false;
        } catch (error) {
          return false;
        }
      },

      async create(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl('default') as string;
        const agentId = this.getNodeParameter('agentId') as string;
        const eventTypes = this.getNodeParameter('eventTypes', []) as string[];
        const additionalFields = this.getNodeParameter('additionalFields', {}) as IDataObject;
        const credentials = await this.getCredentials('lertyApi');

        const lertyHttp = new LertyHttp({
          baseUrl: credentials.baseUrl as string,
          apiToken: credentials.apiToken as string,
        });

        try {
          // Register webhook with Lerty
          // This is a placeholder - implement actual API call
          const body = {
            url: webhookUrl,
            agent_id: agentId,
            event_types: eventTypes,
            secret: additionalFields.secretToken || undefined,
          };

          // TODO: Make actual API call to register webhook
          // await lertyHttp.registerWebhook(agentId, body);
          
          // Store webhook data for later use
          const webhookData = this.getWorkflowStaticData('node');
          webhookData.webhookId = `webhook_${agentId}_${Date.now()}`;
          webhookData.agentId = agentId;

          return true;
        } catch (error) {
          throw new NodeOperationError(
            this.getNode(),
            `Failed to register webhook: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      },

      async delete(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData('node');
        const credentials = await this.getCredentials('lertyApi');

        if (!webhookData.webhookId) {
          return true;
        }

        const lertyHttp = new LertyHttp({
          baseUrl: credentials.baseUrl as string,
          apiToken: credentials.apiToken as string,
        });

        try {
          // Unregister webhook from Lerty
          // TODO: Make actual API call to unregister webhook
          // await lertyHttp.deleteWebhook(webhookData.agentId, webhookData.webhookId);

          delete webhookData.webhookId;
          delete webhookData.agentId;

          return true;
        } catch (error) {
          return false;
        }
      },
    },
  };

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
    // Minimal implementation - webhooks are handled by webhook() method
    return {
      closeFunction: async () => {},
      manualTriggerFunction: async () => {
        throw new NodeOperationError(
          this.getNode(),
          'This node only works with webhooks. Please activate the workflow.',
        );
      },
    };
  }

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const body = this.getBodyData() as IDataObject;
    const headers = this.getHeaderData() as IDataObject;
    const eventTypes = this.getNodeParameter('eventTypes', []) as string[];
    const additionalFields = this.getNodeParameter('additionalFields', {}) as IDataObject;
    const agentId = this.getNodeParameter('agentId') as string;

    // Validate secret token if provided
    if (additionalFields.secretToken) {
      const receivedToken = headers['x-lerty-signature'] || headers['authorization'];
      if (receivedToken !== additionalFields.secretToken) {
        return {
          webhookResponse: {
            status: 401,
            body: { error: 'Unauthorized' },
          },
        };
      }
    }

    // Filter by event type
    if (eventTypes.length > 0 && body.type && !eventTypes.includes(body.type as string)) {
      return {
        webhookResponse: {
          status: 200,
          body: { received: true, filtered: true },
        },
      };
    }

    // Enrich the output with agent_id and other useful metadata
    const outputData = {
      ...body,
      agent_id: agentId,
      // Ensure conversation_id is available (handle different field names)
      conversation_id: body.conversation_id || body.conversationId || body.thread_id,
      // Ensure response_webhook is available if it exists
      response_webhook: body.response_webhook || body.responseWebhook || body.callback_url,
    };
    
    // Log what we're outputting for debugging
    console.log('LertyTrigger output:', JSON.stringify(outputData, null, 2));

    // Return the data to the workflow
    return {
      workflowData: [
        [
          {
            json: outputData,
            headers,
          },
        ],
      ],
    };
  }
}