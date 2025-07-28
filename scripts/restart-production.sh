#!/bin/bash
# Production restart script for Creative Code Nexus

echo "🔄 Restarting Creative Code Nexus Production Server"
echo "=================================================="

# Create logs directory if it doesn't exist
mkdir -p logs

# Stop existing PM2 process
echo "🛑 Stopping existing PM2 process..."
pm2 delete companyos 2>/dev/null || echo "No existing process found"

# Start new PM2 process with proper logging
echo "🚀 Starting new PM2 process..."
pm2 start server/prod.cjs --name companyos

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Show process status
echo "📊 Current PM2 status:"
pm2 status

echo ""
echo "✅ Production server restarted successfully!"
echo ""
echo "Monitor logs with:"
echo "  ./scripts/view-logs.sh live     # Application logs"
echo "  pm2 logs companyos             # PM2 process logs"
echo "  pm2 monit                      # Real-time monitoring"
echo ""
echo "Check system health:"
echo "  ./scripts/log-analysis.sh health"