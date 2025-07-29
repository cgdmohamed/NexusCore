#!/bin/bash

# 🚨 URGENT PRODUCTION DEPLOYMENT SCRIPT
# Creative Code Nexus - Complete System Fix
# Date: January 28, 2025

echo "🚨 URGENT: Deploying Critical Production Fix..."
echo "=============================================="

# VPS Connection Details
VPS_HOST="185.46.8.114"
VPS_USER="root"
VPS_PATH="/root/nexus/NexusCore"

echo "📂 Checking local server file..."
if [ ! -f "server/prod.cjs" ]; then
    echo "❌ ERROR: server/prod.cjs not found!"
    exit 1
fi

# Get file stats
LINES=$(wc -l < server/prod.cjs)
SIZE=$(du -h server/prod.cjs | cut -f1)
echo "✅ Local file: $LINES lines, $SIZE"

echo "🚀 Deploying to production server..."

# Upload updated server file
echo "📤 Uploading server/prod.cjs..."
scp server/prod.cjs $VPS_USER@$VPS_HOST:$VPS_PATH/server/prod.cjs

if [ $? -eq 0 ]; then
    echo "✅ File uploaded successfully"
else
    echo "❌ Upload failed!"
    exit 1
fi

echo "🔄 Restarting production services..."

# Restart PM2 process
ssh $VPS_USER@$VPS_HOST "cd $VPS_PATH && pm2 restart companyos"

# Clear Nginx cache
ssh $VPS_USER@$VPS_HOST "sudo rm -rf /var/cache/nginx/* && sudo systemctl reload nginx"

echo "🧪 Testing critical endpoints..."

# Test tasks stats endpoint
echo "Testing /api/tasks/stats..."
curl -s -o /dev/null -w "Status: %{http_code}\n" https://nexus.creativecode.com.eg/api/tasks/stats

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo "Expected: 401 (Auth Required) instead of 404"
echo "Action: Login and test dashboard functionality"
echo "=============================================="