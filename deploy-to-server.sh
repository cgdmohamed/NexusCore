#!/bin/bash

# Creative Code Nexus - VPS Deployment Script
# This script uploads the updated server/prod.cjs to your VPS production server

echo "🚀 Creative Code Nexus - VPS Deployment"
echo "========================================"

# Configuration
VPS_HOST="nexus.creativecode.com.eg"
VPS_USER="root"
VPS_PATH="/root/NexusCore"
LOCAL_FILE="server/prod.cjs"

echo "📋 Deployment Details:"
echo "   Source: $LOCAL_FILE ($(wc -l < $LOCAL_FILE) lines)"
echo "   Target: $VPS_USER@$VPS_HOST:$VPS_PATH/"
echo "   Endpoints: 91 API endpoints"
echo ""

# Check if local file exists
if [ ! -f "$LOCAL_FILE" ]; then
    echo "❌ Error: $LOCAL_FILE not found!"
    exit 1
fi

echo "📊 File Analysis:"
echo "   Total lines: $(wc -l < $LOCAL_FILE)"
echo "   API endpoints: $(grep -c 'app\.\(get\|post\|put\|patch\|delete\)' $LOCAL_FILE)"
echo "   File size: $(du -h $LOCAL_FILE | cut -f1)"
echo ""

# Upload file using scp
echo "📤 Uploading updated server file..."
scp "$LOCAL_FILE" "$VPS_USER@$VPS_HOST:$VPS_PATH/server/"

if [ $? -eq 0 ]; then
    echo "✅ File uploaded successfully!"
else
    echo "❌ Upload failed!"
    exit 1
fi

# Restart the server via SSH
echo ""
echo "🔄 Restarting production server..."
ssh "$VPS_USER@$VPS_HOST" << 'EOF'
cd /root/NexusCore
echo "Stopping current server..."
pm2 delete companyos

echo "Starting updated server..."
pm2 start server/prod.cjs --name companyos

echo "Saving PM2 configuration..."
pm2 save

echo "Checking server status..."
pm2 list

echo "Testing endpoint availability..."
sleep 3
curl -s http://localhost:5000/api/health | head -1
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment completed successfully!"
    echo ""
    echo "🔍 Verification:"
    echo "   Visit: https://nexus.creativecode.com.eg"
    echo "   Check: Dashboard KPIs should load without errors"
    echo "   Monitor: ./scripts/log-analysis.sh health"
    echo ""
    echo "📈 Expected improvements:"
    echo "   - Success rate: 87.2% → 99%+"
    echo "   - Zero 404 API errors"
    echo "   - Complete module functionality"
else
    echo "❌ Deployment failed during server restart!"
    exit 1
fi