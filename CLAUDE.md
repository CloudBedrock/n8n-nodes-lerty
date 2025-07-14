# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an n8n custom node package (`n8n-nodes-lerty`) that provides integration with the Lerty AI platform. The project creates two custom nodes:

1. **Lerty Node** - A regular node for sending messages to Lerty agents
2. **Lerty Trigger Node** - A trigger node for receiving messages from Lerty users

The nodes support both WebSocket (Phoenix channels) and HTTP webhook communication protocols for real-time bidirectional communication with Lerty agents.

## Architecture

### Core Components
- **Custom N8N Nodes**: Two nodes (Lerty and LertyTrigger) that integrate with the Lerty platform
- **Phoenix WebSocket Integration**: Uses Phoenix channels for real-time communication with topic-based triggering
- **HTTP Webhook Fallback**: Supports traditional webhook-based communication
- **File Attachment Support**: Handles file uploads/downloads via S3 presigned URLs
- **Topic-Based Triggering**: Similar to Redis n8n node, supports triggering on specific WebSocket topics/channels

### Key Dependencies
- `phoenix`: ^1.7.21 - Phoenix channels for WebSocket communication
- `n8n-workflow`: ^1.82.0 - n8n workflow types and interfaces
- `typescript`: ^5.8.3 - TypeScript support
- `@types/node`: ^24.0.12 - Node.js type definitions

## Development Commands

### Required Setup Commands
```bash
# Install dependencies
npm install

# Build TypeScript and icons (required for n8n nodes)
npm run build

# Watch mode for development
npm run dev

# Format code
npm run format

# Lint code
npm run lint

# Fix linting issues
npm run lintfix

# Test the node locally
npm run test
```

### Package.json Requirements
The package.json MUST be updated with the following n8n-specific configuration:

```json
{
  "name": "n8n-nodes-lerty",
  "version": "0.1.0",
  "description": "n8n community node for Lerty AI platform integration",
  "keywords": ["n8n-community-node-package"],
  "license": "MIT",
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/n8n-nodes-lerty.git"
  },
  "engines": {
    "node": ">=20.15"
  },
  "main": "index.js",
  "scripts": {
    "build": "npx rimraf dist && tsc && gulp build:icons",
    "dev": "tsc --watch",
    "format": "prettier nodes credentials --write",
    "lint": "eslint nodes credentials package.json",
    "lintfix": "eslint nodes credentials package.json --fix",
    "prepublishOnly": "npm run build && npm run lint -c .eslintrc.prepublish.js nodes credentials package.json",
    "test": "npm run build && n8n-node-dev test"
  },
  "files": ["dist"],
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": [
      "dist/credentials/LertyApi.credentials.js"
    ],
    "nodes": [
      "dist/nodes/Lerty/Lerty.node.js",
      "dist/nodes/LertyTrigger/LertyTrigger.node.js"
    ]
  },
  "devDependencies": {
    "@typescript-eslint/parser": "~8.32.0",
    "eslint": "^8.57.0",
    "eslint-plugin-n8n-nodes-base": "^1.16.3",
    "gulp": "^5.0.0",
    "prettier": "^3.5.0",
    "rimraf": "^6.0.1",
    "typescript": "^5.8.3"
  }
}
```

## Project Structure

```
n8n-nodes-lerty/
├── package.json                 # Project dependencies and scripts
├── AC-146-*.md                 # Detailed specification document
├── nodes/                      # (To be created) Custom n8n nodes
│   ├── Lerty/                 # Main Lerty node
│   └── LertyTrigger/          # Trigger node for incoming messages
├── credentials/               # (To be created) Authentication credentials
├── types/                     # (To be created) TypeScript type definitions
└── utils/                     # (To be created) Utility functions
    ├── LertyWebSocket.ts      # WebSocket connection handling
    ├── LertyHttp.ts           # HTTP webhook handling  
    └── FileUtils.ts           # File attachment utilities
```

## Development Guidelines

### Authentication
- Support Bearer token authentication for Lerty API
- Use n8n credentials system for secure token storage
- Implement dynamic agent selection via API calls

### Message Handling
- Support both WebSocket (Phoenix channels) and HTTP webhook protocols
- Handle file attachments with S3 presigned URLs
- Implement proper error handling and connection management
- Support typing indicators and status updates for WebSocket connections

### Node Configuration
- Provide agent selection dropdown populated from Lerty API
- Support connection type selection (websocket/webhook/auto)
- Include file upload configuration options
- Implement proper validation and error messages
- **Topic-Based Triggering**: Support triggering on specific Phoenix channel topics (similar to Redis n8n node)
- **Channel Pattern Matching**: Allow wildcard and pattern-based topic subscription
- **Multi-Topic Support**: Enable listening to multiple channels simultaneously

### Development Workflow
1. Create node structure following n8n community package guidelines
2. Implement credentials and authentication
3. Build HTTP webhook functionality first (backward compatibility)
4. Add WebSocket support with Phoenix channels
5. Implement file attachment handling
6. Add comprehensive testing and documentation

## Testing

### Local Container Deployment (IMPORTANT)

When testing with the n8n container in `~/dev/licensed`, the custom node files must be copied to the mounted directory after each build.

#### Container Setup
The n8n container uses this volume mount configuration in `docker-compose.override.yml`:
```yaml
services:
  n8n:
    volumes:
      - ./custom-nodes:/home/node/.n8n/custom
```

#### Deployment Steps for Local Container

1. **Build the node**:
```bash
cd ~/dev/n8n-nodes-lerty
npm run build
```

2. **Copy dist files to the mounted directory** (CRITICAL STEP):
```bash
cp -r ~/dev/n8n-nodes-lerty/dist/* ~/dev/licensed/custom-nodes/n8n-nodes-lerty/dist/
```

3. **Restart the n8n container**:
```bash
cd ~/dev/licensed
docker compose restart n8n
```

#### Create Deployment Script

Save this as `deploy-local.sh` in the project root:
```bash
#!/bin/bash
# deploy-local.sh - Deploy n8n-nodes-lerty to local container

echo "🔨 Building n8n-nodes-lerty..."
cd ~/dev/n8n-nodes-lerty && npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "📦 Copying files to container mount..."
cp -r ~/dev/n8n-nodes-lerty/dist/* ~/dev/licensed/custom-nodes/n8n-nodes-lerty/dist/

echo "🔄 Restarting n8n container..."
cd ~/dev/licensed && docker compose restart n8n

echo "✅ Deployment complete!"
echo "📋 Check logs with: cd ~/dev/licensed && docker compose logs -f n8n"
```

Make it executable:
```bash
chmod +x deploy-local.sh
```

#### Common Issues and Solutions

1. **Changes not appearing after rebuild**:
   - You likely forgot to copy files to the mounted directory
   - Run: `cp -r ~/dev/n8n-nodes-lerty/dist/* ~/dev/licensed/custom-nodes/n8n-nodes-lerty/dist/`

2. **Verify files were copied**:
   ```bash
   ls -la ~/dev/licensed/custom-nodes/n8n-nodes-lerty/dist/nodes/Lerty/
   # Check the timestamp to ensure files are recent
   ```

3. **Check container is using updated files**:
   ```bash
   cd ~/dev/licensed
   docker compose exec n8n ls -la /home/node/.n8n/custom/n8n-nodes-lerty/dist/nodes/Lerty/
   ```

4. **Debug logs not appearing**:
   - Ensure you copied the files AND restarted the container
   - Check logs: `docker compose logs n8n --tail=100`

### Local Testing with Phoenix App

#### Prerequisites
1. **Phoenix App Setup**: Ensure your local Lerty Phoenix app is running
2. **n8n Installation**: Install n8n locally for testing
3. **Node Development**: Build and link the node package

#### Testing Steps (Alternative Method)
```bash
# 1. Build the node package
npm run build

# 2. Link the package globally (for local testing)
npm link

# 3. In your n8n installation directory, link the package
npm link n8n-nodes-lerty

# 4. Start n8n with custom nodes enabled
N8N_CUSTOM_EXTENSIONS=n8n-nodes-lerty n8n start

# 5. Alternative: Use n8n-node-dev for testing
npm install -g n8n-node-dev
n8n-node-dev test
```

#### Phoenix App Configuration
Ensure your local Phoenix app has the following endpoints available:
- `GET /api/v1/agents` - For agent selection
- `POST /webhooks/agents/{agent_id}/message` - For HTTP webhook testing
- WebSocket endpoint at `/socket` for Phoenix channels

#### Testing Scenarios
1. **HTTP Webhook Testing**:
   - Create a workflow with the Lerty Trigger node
   - Configure webhook endpoint
   - Send test messages via curl or Postman
   - Verify message receipt in n8n

2. **WebSocket Testing**:
   - Configure WebSocket connection in Lerty node
   - Test real-time message exchange
   - Verify typing indicators and status updates

3. **File Attachment Testing**:
   - Test file upload via Phoenix app
   - Verify file URL handling in n8n workflow
   - Test file download functionality

#### Test Environment Variables
```bash
# Set Phoenix app URL for testing
export LERTY_API_URL=http://localhost:4000
export LERTY_WS_URL=ws://localhost:4000/socket

# n8n configuration
export N8N_CUSTOM_EXTENSIONS=n8n-nodes-lerty
export N8N_NODES_INCLUDE=n8n-nodes-lerty
```

### Unit Testing Framework
For comprehensive testing, consider:
- **Jest**: For unit testing utility functions
- **Supertest**: For HTTP endpoint testing
- **Socket.io-client**: For WebSocket testing
- **n8n-workflow**: For node execution testing

```bash
# Install testing dependencies
npm install --save-dev jest @types/jest supertest socket.io-client
```

## API Integration

The nodes integrate with Lerty platform APIs:
- Agent selection: `GET /api/v1/agents`
- WebSocket topics: `agent_chat:tenant_{id}_org_{id}_agent_{id}`
- File uploads: `POST /api/v1/agents/{id}/files`
- Webhook endpoints: `POST /webhooks/agents/{id}/message`

### Topic-Based Triggering (Similar to Redis n8n Node)

The Lerty Trigger node supports subscribing to specific Phoenix channel topics:

#### Topic Patterns
- **Agent-specific**: `agent_chat:tenant_{tenant_id}_org_{org_id}_agent_{agent_id}`
- **Organization-wide**: `agent_chat:tenant_{tenant_id}_org_{org_id}_agent_*`
- **Tenant-wide**: `agent_chat:tenant_{tenant_id}_org_*_agent_*`
- **Global patterns**: `agent_chat:*` (all agent conversations)
- **Custom topics**: `notifications:*`, `system:*`, `alerts:*`

#### Configuration Options
```typescript
interface LertyTriggerConfig {
  // Topic subscription configuration
  topicPattern: string; // e.g., "agent_chat:tenant_123_org_456_agent_*"
  subscriptionMode: 'single' | 'pattern' | 'multiple';
  topics?: string[]; // For multiple topic subscription
  
  // Message filtering
  eventTypes?: string[]; // ['user_message', 'agent_response', 'typing', 'status']
  messageFilters?: {
    userId?: string;
    conversationId?: string;
    messageType?: string;
  };
  
  // Connection management
  reconnectOnError: boolean;
  maxReconnectAttempts: number;
  reconnectDelay: number;
}
```

#### Example Topic Subscriptions
```typescript
// Listen to specific agent
topicPattern: "agent_chat:tenant_123_org_456_agent_789"

// Listen to all agents in organization
topicPattern: "agent_chat:tenant_123_org_456_agent_*"

// Listen to multiple specific topics
subscriptionMode: "multiple"
topics: [
  "agent_chat:tenant_123_org_456_agent_789",
  "notifications:tenant_123_org_456",
  "system:tenant_123"
]

// Listen to all agent conversations globally
topicPattern: "agent_chat:*"
```

## Message Formats

### WebSocket Messages
- `user_message`: Incoming user messages with attachments
- `agent_response`: Outgoing agent responses
- `typing`: Typing indicator events
- `agent_status`: Agent status updates

### HTTP Webhook
- Standard JSON payload with conversation metadata
- File attachments via URL references
- Bearer token authentication required

## Deployment

### Prerequisites for Deployment
1. **Package Requirements**:
   - Package name must start with `n8n-nodes-` 
   - Must include `n8n-community-node-package` in keywords
   - Requires Node.js >= 20.15
   - Must have proper `n8n` configuration section

2. **Code Quality Requirements**:
   - All linting checks must pass: `npm run lint`
   - Code must be formatted: `npm run format`
   - Build must be successful: `npm run build`
   - No runtime dependencies for verified community nodes

### Deployment Steps

#### 1. Prepare for Publication
```bash
# Ensure all requirements are met
npm run build
npm run lint
npm run format

# Test the built package
npm run test

# Verify package contents
npm pack --dry-run
```

#### 2. NPM Registry Publication
```bash
# Login to npm (first time only)
npm login

# Publish to npm registry
npm publish

# For scoped packages (if using organization)
npm publish --access public
```

#### 3. Community Node Submission
For verified community nodes (optional but recommended):

1. **Submit to n8n Community**:
   - Visit n8n community node submission process
   - Follow verification guidelines
   - Ensure no runtime dependencies
   - Pass all automated checks

2. **Documentation Requirements**:
   - Comprehensive README.md in npm package
   - Usage examples and screenshots
   - API documentation
   - Troubleshooting guide

#### 4. Installation by Users

**Via n8n GUI** (for verified nodes):
- Browse community nodes in n8n interface
- Install directly from the GUI

**Via npm** (for all nodes):
```bash
# Install globally
npm install -g n8n-nodes-lerty

# Or install in n8n directory
npm install n8n-nodes-lerty
```

**Via Docker** (for containerized n8n):
```dockerfile
# Add to Dockerfile
RUN npm install -g n8n-nodes-lerty
```

#### 5. Environment Configuration
Users need to configure:
```bash
# For self-hosted n8n
export N8N_CUSTOM_EXTENSIONS=n8n-nodes-lerty
# or
export N8N_NODES_INCLUDE=n8n-nodes-lerty

# Then restart n8n
n8n start
```

### Post-Deployment
1. **Monitor Usage**: Check npm download statistics
2. **Handle Issues**: Respond to GitHub issues and support requests
3. **Updates**: Use semantic versioning for updates
4. **Documentation**: Keep README and documentation updated

### Version Management
```bash
# Update version before publishing
npm version patch   # for bug fixes
npm version minor   # for new features
npm version major   # for breaking changes

# Then publish
npm publish
```

## Required Files Structure

Before development begins, you must create these additional files:

### 1. TypeScript Configuration (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": [
    "nodes/**/*",
    "credentials/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

### 2. ESLint Configuration (`.eslintrc.js`)
```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['plugin:n8n-nodes-base/nodes'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    // Add custom rules here
  },
};
```

### 3. Prettier Configuration (`.prettierrc`)
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### 4. Gulp Configuration (`gulpfile.js`)
```javascript
const gulp = require('gulp');

gulp.task('build:icons', function() {
  return gulp.src('nodes/**/*.{png,svg}')
    .pipe(gulp.dest('dist/nodes'));
});
```

### 5. Index File (`index.js`)
```javascript
// Entry point for the package
// This file will be generated by the build process
```

## Important Notes

### Development Guidelines
- **Node.js Version**: Requires Node.js >= 20.15
- **TypeScript**: All code must be written in TypeScript
- **No Runtime Dependencies**: Verified community nodes cannot have runtime dependencies
- **Build Process**: Must use TypeScript compilation + gulp for icons

### Package Requirements
- Package name must start with `n8n-nodes-`
- Must include `n8n-community-node-package` in keywords
- Must have proper `n8n` configuration section in package.json
- All file paths in `n8n` config must point to compiled `.js` files in `dist/`

### Security & Compatibility
- Maintain backward compatibility with existing webhook integrations
- Follow n8n community package guidelines for node development
- Implement proper security measures for file handling
- Support both self-hosted and cloud n8n deployments
- Include comprehensive documentation and examples

### First-Time Setup Checklist
1. ✅ Clone n8n-nodes-starter template
2. ⚠️ Update package.json with Lerty-specific configuration
3. ⚠️ Add required configuration files (tsconfig.json, .eslintrc.js, etc.)
4. ⚠️ Set up proper project structure (nodes/, credentials/, utils/)
5. ⚠️ Install all required devDependencies
6. ⚠️ Implement node logic following n8n patterns
7. ⚠️ Test locally with Phoenix app
8. ⚠️ Prepare for npm publication