#!/bin/bash
# Simple deployment script for Creative Code Nexus

echo "🚀 Deploying Creative Code Nexus to Production Server..."

# Copy the production server file
echo "📁 Copying production server file..."
cp server/prod.cjs /tmp/nexus-prod.cjs

echo "🔧 Server file ready for upload to your VPS"
echo ""
echo "Next steps:"
echo "1. Upload /tmp/nexus-prod.cjs to your server as server/prod.cjs"
echo "2. Run: pm2 delete all && pm2 start server/prod.cjs --name companyos"
echo "3. Test: curl -X POST http://localhost:5000/api/login -H 'Content-Type: application/json' -d '{\"username\":\"admin\",\"password\":\"admin123\"}'"
echo ""
echo "✅ Your Creative Code Nexus system will be fully functional!"