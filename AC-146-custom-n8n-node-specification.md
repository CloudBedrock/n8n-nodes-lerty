# AC-146: Custom Lerty N8N Node Specification

## Overview

This document provides detailed specifications for building a custom N8N node that communicates with the Lerty application (lerty.ai). The node will replace the current generic webhook trigger + HTTP request pattern with a branded, feature-rich solution that supports both WebSocket real-time communication and HTTP webhook fallback.

## Current Integration Analysis

### Existing Pattern (Must Maintain Compatibility)
```
[Webhook Trigger] → [HTTP Request Node] → [Agent Response]
```

**Current Flow:**
1. **Webhook Trigger**: Receives user messages via `POST /webhooks/agents/{agent_id}/message`
2. **HTTP Request**: Sends agent responses back via same webhook URL
3. **Authentication**: Bearer token in Authorization header

**Current Endpoints:**
- `POST /webhooks/agents/{agent_id}/message` - Receive agent responses
- `POST /webhooks/agents/{agent_id}/setup` - Setup webhook configuration  
- `DELETE /webhooks/agents/{agent_id}/webhook` - Remove webhook
- `GET /webhooks/agents/{agent_id}/info` - Get webhook status

## New Custom Node Architecture

### Dual Protocol Support

#### 1. WebSocket Connection (Primary - Enhanced Features)
```
[Lerty Node] ←→ [Phoenix Channel] ←→ [Lerty App]
```

**WebSocket Features:**
- Real-time bidirectional communication
- Typing indicators
- Agent status updates
- Connection state management
- Automatic reconnection
- File attachment support

#### 2. HTTP Webhook (Fallback - Compatibility)
```
[Lerty Node] → [HTTP Webhook] → [Lerty App]
```

**HTTP Features:**
- Compatible with existing workflows
- Stateless operation
- Simple request/response pattern

## Custom N8N Node Specification

### Node Configuration

#### Node Properties
```typescript
interface LertyNodeConfig {
  // Connection Settings
  connectionType: 'websocket' | 'webhook' | 'auto';
  serverUrl: string; // Lerty server URL (lerty.ai)
  agent: string; // Selected agent from dropdown (auto-populated from API)
  
  // Authentication
  authMethod: 'bearer_token' | 'api_key';
  bearerToken?: string;
  apiKey?: string;
  
  // WebSocket Specific
  enableTypingIndicators?: boolean;
  enableStatusUpdates?: boolean;
  reconnectAttempts?: number;
  
  // Webhook Specific  
  webhookPath?: string;
  webhookSecret?: string;
  
  // File Handling
  enableFileUploads?: boolean;
  maxFileSize?: number; // MB
  allowedFileTypes?: string[]; // ['image/*', 'application/pdf']
}
```

#### Credential Configuration
```typescript
interface LertyCredentials {
  serverUrl: string;
  bearerToken?: string;
  apiKey?: string;
  
  // Optional organization/tenant scoping
  organizationId?: string;
  tenantId?: string;
}
```

### Node Implementation Structure

#### Primary Node: `Lerty`
**Type**: Regular Node (not trigger)
**Category**: Communication
**Icon**: Custom Lerty logo

**Input/Output:**
- **Input**: Messages to send to agent
- **Output**: Agent responses and status updates

#### Trigger Node: `Lerty Trigger`
**Type**: Trigger Node  
**Category**: Communication
**Icon**: Custom Lerty logo

**Output**: Incoming user messages from Lerty

### Message Flow Specification

#### 1. WebSocket Protocol Flow

##### Connection Establishment
```typescript
// Connect to Phoenix Channel
const topic = `agent_chat:tenant_${tenantId}_org_${orgId}_agent_${agentId}`;
const socket = new Phoenix.Socket(wsUrl, {
  params: {
    token: bearerToken,
    role: 'agent'
  }
});

const channel = socket.channel(topic, {
  token: bearerToken,
  role: 'agent'
});
```

##### Message Formats

**User Message (Incoming to N8N)**
```json
{
  "event": "user_message",
  "payload": {
    "conversation_id": "uuid-v4",
    "content": "Hello, I need help with...",
    "message_type": "text",
    "message_id": "uuid-v4",
    "user_id": "uuid-v4",
    "timestamp": "2025-01-10T16:00:00Z",
    "metadata": {
      "source": "web",
      "ip_address": "192.168.1.1"
    },
    "attachments": [
      {
        "type": "image",
        "url": "https://s3.amazonaws.com/...",
        "filename": "screenshot.png",
        "size": 1024000,
        "mime_type": "image/png"
      }
    ]
  }
}
```

**Agent Response (Outgoing from N8N)**
```json
{
  "event": "agent_response", 
  "payload": {
    "conversation_id": "uuid-v4",
    "content": "I can help you with that...",
    "message_id": "external-id-123",
    "timestamp": "2025-01-10T16:01:00Z",
    "metadata": {
      "processing_time": 1500,
      "model": "gpt-4"
    },
    "attachments": [
      {
        "type": "file",
        "url": "https://s3.amazonaws.com/...",
        "filename": "report.pdf",
        "size": 2048000,
        "mime_type": "application/pdf"
      }
    ]
  }
}
```

**Typing Indicator**
```json
{
  "event": "typing",
  "payload": {
    "conversation_id": "uuid-v4",
    "typing": true
  }
}
```

**Status Update**
```json
{
  "event": "agent_status",
  "payload": {
    "status": "active",
    "metadata": {
      "last_active": "2025-01-10T16:01:00Z"
    }
  }
}
```

#### 2. HTTP Webhook Protocol Flow (Fallback)

**Incoming Webhook (User Message)**
```http
POST /webhooks/agents/{agent_id}/message
Authorization: Bearer {token}
Content-Type: application/json

{
  "conversation_id": "uuid-v4",
  "content": "Hello, I need help with...",
  "message_id": "uuid-v4", 
  "timestamp": "2025-01-10T16:00:00Z",
  "user_id": "uuid-v4",
  "organization_id": "uuid-v4",
  "metadata": {
    "source": "web"
  }
}
```

**Response Processing (Agent Response)**
```http
POST {response_webhook_url}
Authorization: Bearer {token}
Content-Type: application/json

{
  "conversation_id": "uuid-v4",
  "content": "I can help you with that...",
  "message_id": "external-id-123",
  "timestamp": "2025-01-10T16:01:00Z"
}
```

### File Attachment Support

#### File Upload Flow

1. **Client uploads file to AgentChat**
2. **AgentChat returns presigned S3 URL or direct URL**
3. **URL included in message attachments array**
4. **N8N node can download/process files as needed**

#### File Handling in N8N Node

```typescript
interface FileAttachment {
  type: 'image' | 'document' | 'audio' | 'video';
  url: string;
  filename: string;
  size: number;
  mime_type: string;
  presigned_url?: string; // For temporary access
  expires_at?: string; // When presigned URL expires
}

// Node should provide helper functions
const fileUtils = {
  downloadFile: async (attachment: FileAttachment) => Buffer,
  uploadResponse: async (fileBuffer: Buffer, filename: string) => FileAttachment,
  validateFileType: (attachment: FileAttachment, allowedTypes: string[]) => boolean
};
```

## Lerty Server Enhancements Required

### 1. Agent Selection API

```elixir
# New endpoint for N8N node agent selection
GET /api/v1/agents
Authorization: Bearer {token}

# Response:
{
  "agents": [
    {
      "id": "uuid-v4",
      "name": "Customer Support Agent",
      "description": "Handles customer inquiries and support tickets",
      "enabled": true,
      "webhook_url": "https://lerty.ai/webhooks/agents/uuid-v4/message",
      "websocket_topic": "agent_chat:tenant_123_org_456_agent_uuid-v4"
    },
    {
      "id": "uuid-v5", 
      "name": "Sales Assistant",
      "description": "Helps with product information and sales inquiries",
      "enabled": true,
      "webhook_url": "https://lerty.ai/webhooks/agents/uuid-v5/message",
      "websocket_topic": "agent_chat:tenant_123_org_456_agent_uuid-v5"
    }
  ],
  "organization": {
    "id": "uuid-org",
    "name": "Acme Corp"
  },
  "tenant": {
    "id": "uuid-tenant",
    "name": "Acme Tenant"
  }
}
```

### 2. File Upload API

```elixir
# New controller: LertyWeb.FileUploadController
POST /api/v1/agents/{agent_id}/files
Authorization: Bearer {token}
Content-Type: multipart/form-data

# Response:
{
  "file_id": "uuid-v4",
  "url": "https://s3.amazonaws.com/bucket/files/uuid-v4/filename.ext",
  "presigned_url": "https://s3.amazonaws.com/...", 
  "expires_at": "2025-01-10T17:00:00Z",
  "filename": "document.pdf",
  "size": 1024000,
  "mime_type": "application/pdf"
}
```

### 3. Enhanced Message Schema

```elixir
# Add to Chat.Message schema
defmodule Lerty.Chat.Message do
  schema "messages" do
    # ... existing fields
    field :attachments, {:array, :map}, default: []
    field :message_type, :string, default: "text" # text, image, document, audio, video
    field :external_message_id, :string # For N8N correlation
    field :metadata, :map, default: %{}
  end
end
```

### 4. WebSocket Channel Enhancements

```elixir
# LertyWeb.AgentChatChannel - already implemented
def handle_in("user_message", payload, socket) do
  # Handle attachments in payload["attachments"]
  # Validate file permissions and access
  # Process message with file context
end
```

## N8N Node Development Guide

### Project Structure
```
n8n-nodes-lerty/
├── package.json
├── README.md
├── nodes/
│   ├── Lerty/
│   │   ├── Lerty.node.ts
│   │   ├── Lerty.node.json
│   │   └── lerty.svg
│   └── LertyTrigger/
│       ├── LertyTrigger.node.ts
│       ├── LertyTrigger.node.json
│       └── lerty-trigger.svg
├── credentials/
│   ├── LertyApi.credentials.ts
│   └── LertyApi.credentials.json
├── types/
│   └── Lerty.types.ts
└── utils/
    ├── LertyWebSocket.ts
    ├── LertyHttp.ts
    └── FileUtils.ts
```

### Key Implementation Files

#### 1. `nodes/Lerty/Lerty.node.ts`
```typescript
import { IExecuteFunctions } from 'n8n-core';
import { INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { LertyWebSocket } from '../../utils/LertyWebSocket';
import { LertyHttp } from '../../utils/LertyHttp';

export class Lerty implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Lerty',
    name: 'lerty',
    icon: 'file:lerty.svg',
    group: ['communication'],
    version: 1,
    description: 'Send messages to Lerty agents with real-time WebSocket or HTTP fallback',
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
    properties: [
      // Agent Selection
      {
        displayName: 'Agent',
        name: 'agent',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getAgents',
        },
        required: true,
        default: '',
        description: 'Select the agent to send messages to',
      },
      // Node configuration properties
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        options: [
          {
            name: 'Send Message',
            value: 'sendMessage',
          },
          {
            name: 'Update Status', 
            value: 'updateStatus',
          },
          {
            name: 'Send Typing Indicator',
            value: 'sendTyping',
          },
        ],
        default: 'sendMessage',
      },
      // ... more properties
    ],
    
    methods: {
      loadOptions: {
        // Load available agents from Lerty API
        async getAgents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
          const credentials = await this.getCredentials('lertyApi');
          const options: OptionsWithUri = {
            method: 'GET',
            uri: `${credentials.serverUrl}/api/v1/agents`,
            headers: {
              'Authorization': `Bearer ${credentials.bearerToken}`,
              'Accept': 'application/json',
            },
            json: true,
          };
          
          const response = await this.helpers.request(options);
          
          return response.agents.map((agent: any) => ({
            name: `${agent.name}${agent.description ? ` - ${agent.description}` : ''}`,
            value: agent.id,
            description: agent.enabled ? 'Active' : 'Inactive',
          }));
        },
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const agentId = this.getNodeParameter('agent', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;
    
    // Get agent details for endpoint mapping
    const credentials = await this.getCredentials('lertyApi');
    const agentResponse = await this.helpers.request({
      method: 'GET',
      uri: `${credentials.serverUrl}/api/v1/agents`,
      headers: {
        'Authorization': `Bearer ${credentials.bearerToken}`,
        'Accept': 'application/json',
      },
      json: true,
    });
    
    const agent = agentResponse.agents.find((a: any) => a.id === agentId);
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }
    
    // Implementation using agent.webhook_url or agent.websocket_topic
    // depending on connectionType configuration
  }
}
```

#### 2. `nodes/LertyTrigger/LertyTrigger.node.ts`
```typescript
import { ITriggerFunctions } from 'n8n-core';
import { INodeType, INodeTypeDescription, ITriggerResponse } from 'n8n-workflow';

export class LertyTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Lerty Trigger',
    name: 'lertyTrigger',
    icon: 'file:lerty-trigger.svg',
    group: ['trigger'],
    version: 1,
    description: 'Triggers when messages are received from Lerty users',
    defaults: {
      name: 'Lerty Trigger',
    },
    inputs: [],
    outputs: ['main'],
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
      // Agent Selection for Trigger
      {
        displayName: 'Agent',
        name: 'agent',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getAgents',
        },
        required: true,
        default: '',
        description: 'Select the agent to receive messages from',
      },
      // Trigger configuration
    ],
    
    methods: {
      loadOptions: {
        // Load available agents from Lerty API
        async getAgents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
          const credentials = await this.getCredentials('lertyApi');
          const options: OptionsWithUri = {
            method: 'GET',
            uri: `${credentials.serverUrl}/api/v1/agents`,
            headers: {
              'Authorization': `Bearer ${credentials.bearerToken}`,
              'Accept': 'application/json',
            },
            json: true,
          };
          
          const response = await this.helpers.request(options);
          
          return response.agents.map((agent: any) => ({
            name: `${agent.name}${agent.description ? ` - ${agent.description}` : ''}`,
            value: agent.id,
            description: agent.enabled ? 'Active' : 'Inactive',
          }));
        },
      },
    },
  };

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
    const agentId = this.getNodeParameter('agent', 0) as string;
    
    // Get agent details for endpoint mapping
    const credentials = await this.getCredentials('lertyApi');
    const agentResponse = await this.helpers.request({
      method: 'GET',
      uri: `${credentials.serverUrl}/api/v1/agents`,
      headers: {
        'Authorization': `Bearer ${credentials.bearerToken}`,
        'Accept': 'application/json',
      },
      json: true,
    });
    
    const agent = agentResponse.agents.find((a: any) => a.id === agentId);
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }
    
    // Implementation for both WebSocket and Webhook triggers
    // Uses agent.webhook_url and agent.websocket_topic for proper routing
  }
}
```

### 3. WebSocket Utility (`utils/LertyWebSocket.ts`)
```typescript
import WebSocket from 'ws';
import { Phoenix } from 'phoenix';

export class LertyWebSocket {
  private socket: Phoenix.Socket;
  private channel: Phoenix.Channel;
  
  constructor(
    private serverUrl: string,
    private agentId: string,
    private credentials: any,
    private websocketTopic?: string
  ) {}

  async connect(): Promise<void> {
    // Use provided websocket topic or construct default
    const topic = this.websocketTopic || `agent_chat:agent_${this.agentId}`;
    
    // Establish WebSocket connection
    // Join agent channel using topic from API
    // Set up event listeners
  }

  async sendMessage(payload: any): Promise<void> {
    // Send message via channel
  }

  async sendTyping(conversationId: string, typing: boolean): Promise<void> {
    // Send typing indicator
  }

  async updateStatus(status: string): Promise<void> {
    // Update agent status
  }

  onMessage(callback: (message: any) => void): void {
    // Set up message listener
  }

  async disconnect(): Promise<void> {
    // Clean up connection
  }
}
```

## Development Phases

### Phase 1: Basic HTTP Node (Backward Compatible)
- [x] HTTP webhook trigger functionality
- [x] HTTP response sending
- [x] Bearer token authentication
- [x] Basic message handling
- [x] Agent selection API integration
- [x] Dynamic agent dropdown in N8N UI
- [ ] Custom node packaging

### Phase 2: WebSocket Enhancement
- [ ] Phoenix Channel WebSocket connection
- [ ] Real-time bidirectional communication
- [ ] Typing indicators
- [ ] Agent status updates
- [ ] Connection management

### Phase 3: File Attachment Support
- [ ] File upload API integration
- [ ] Presigned S3 URL handling
- [ ] File download utilities
- [ ] Multiple file type support
- [ ] File validation and security

### Phase 4: Advanced Features
- [ ] Connection fallback (WebSocket → HTTP)
- [ ] Message queuing during disconnection
- [ ] Error recovery and retry logic
- [ ] Performance monitoring
- [ ] Advanced authentication methods

## Testing Strategy

### Unit Testing
- WebSocket connection management
- HTTP request/response handling
- File upload/download utilities
- Authentication mechanisms

### Integration Testing

- End-to-end message flow
- File attachment processing
- Error handling scenarios
- Performance under load

### Compatibility Testing

- Backward compatibility with existing workflows
- Multiple N8N versions
- Different Lerty configurations

## Deployment and Distribution

### N8N Community Package
1. Develop as community package
2. Publish to npm as `n8n-nodes-lerty`
3. Users install via: `npm install n8n-nodes-lerty`

### N8N Cloud Integration
1. Submit for official review
2. Follow N8N community guidelines
3. Maintain backward compatibility
4. Provide comprehensive documentation

### Installation Instructions

```bash
# For self-hosted N8N
npm install n8n-nodes-lerty

# Add to environment
N8N_CUSTOM_EXTENSIONS="/path/to/n8n-nodes-lerty"

# Restart N8N
npm run start
```

## Security Considerations

### Authentication
- Secure token storage in N8N credentials
- Token rotation support
- API key alternative authentication

### File Handling
- File type validation
- Size limits enforcement
- Malware scanning integration
- Secure temporary storage

### WebSocket Security
- Connection authentication
- Message encryption in transit
- Rate limiting
- DDOS protection

## Documentation Requirements

### User Documentation
- Installation guide
- Configuration tutorial
- Example workflows
- Troubleshooting guide

### Developer Documentation  
- API reference
- WebSocket protocol details
- File handling guide
- Custom authentication setup

## Success Metrics

### Functionality
- [ ] 100% backward compatibility with existing workflows
- [ ] WebSocket real-time communication working
- [ ] File attachments supported
- [ ] Connection fallback operational

### Performance
- [ ] < 100ms message delivery latency
- [ ] Supports 1000+ concurrent connections
- [ ] 99.9% uptime for WebSocket connections
- [ ] File uploads up to 100MB

### User Experience
- [ ] Simplified configuration vs generic webhook
- [ ] Real-time features working smoothly
- [ ] Clear error messages and debugging
- [ ] Comprehensive documentation

## Timeline

### Week 1-2: Planning and Setup
- [x] Requirements analysis
- [x] Architecture design
- [ ] Development environment setup
- [ ] Basic project structure

### Week 3-4: HTTP Implementation
- [ ] Basic HTTP node functionality
- [ ] Authentication integration
- [ ] Backward compatibility testing
- [ ] Initial package structure

### Week 5-6: WebSocket Implementation
- [ ] Phoenix Channel integration
- [ ] Real-time message handling
- [ ] Connection management
- [ ] WebSocket testing

### Week 7-8: File Support
- [ ] File upload API enhancement
- [ ] File attachment handling
- [ ] Security implementation
- [ ] File testing

### Week 9-10: Polish and Testing
- [ ] End-to-end testing
- [ ] Documentation completion
- [ ] Performance optimization
- [ ] Community package preparation

This specification provides a comprehensive roadmap for building the custom Lerty N8N node while maintaining full backward compatibility with existing integrations.
