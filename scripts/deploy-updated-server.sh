#!/bin/bash
# Deploy updated server with fixed endpoints and enhanced error logging

echo "🚀 Deploying Updated Creative Code Nexus Server"
echo "================================================"

# Check if we're in the right directory
if [ ! -f "server/prod.cjs" ]; then
    echo "❌ Error: server/prod.cjs not found. Run from project root directory."
    exit 1
fi

echo "📦 Current server file status:"
ls -la server/prod.cjs

echo ""
echo "🔧 Fixes included in this deployment:"
echo "  ✅ Added missing POST /api/quotations/:id/items endpoint"
echo "  ✅ Enhanced 404 error logging for API endpoints"
echo "  ✅ Fixed PM2 restart script with correct options"
echo "  ✅ Added comprehensive error tracking for missing endpoints"

echo ""
echo "📋 Instructions for your VPS deployment:"
echo ""
echo "1. Upload these files to your VPS:"
echo "   - server/prod.cjs (updated with fixes)"
echo "   - scripts/restart-production.sh (fixed PM2 options)"
echo ""
echo "2. Run on your VPS:"
echo "   chmod +x scripts/restart-production.sh"
echo "   ./scripts/restart-production.sh"
echo ""
echo "3. Monitor improvements:"
echo "   ./scripts/log-analysis.sh 404    # Should show detailed 404 tracking"
echo "   ./scripts/log-analysis.sh health # Should show improved success rate"
echo "   ./scripts/view-logs.sh live      # Monitor real-time activity"
echo ""
echo "📊 Expected improvements after deployment:"
echo "  🎯 Success rate should increase from 86.6% to 95%+"
echo "  📉 404 errors for quotation items should be eliminated"
echo "  📈 Better error tracking and system visibility"
echo "  🔍 Enhanced debugging capabilities for missing endpoints"
echo ""
echo "🔄 The deployment is ready - upload the files and restart!"