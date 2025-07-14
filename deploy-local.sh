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