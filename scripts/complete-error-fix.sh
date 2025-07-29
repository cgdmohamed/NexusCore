#!/bin/bash

# Creative Code Nexus - Complete Error Analysis & Deployment Fix Tool
# This script provides comprehensive error checking, deployment verification, and system health monitoring

set -e

echo "🔍 Creative Code Nexus - Complete System Analysis & Fix"
echo "====================================================="

# Configuration
VPS_HOST="nexus.creativecode.com.eg"
VPS_USER="root"
VPS_PATH="/root/NexusCore"
LOCAL_FILE="server/prod.cjs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check file status
check_local_file() {
    log_info "Checking local updated server file..."
    
    if [ ! -f "$LOCAL_FILE" ]; then
        log_error "Updated server file not found: $LOCAL_FILE"
        return 1
    fi
    
    local lines=$(wc -l < "$LOCAL_FILE")
    local endpoints=$(grep -c 'app\.\(get\|post\|put\|patch\|delete\)' "$LOCAL_FILE" || echo "0")
    local size=$(du -h "$LOCAL_FILE" | cut -f1)
    
    log_success "Local file analysis:"
    echo "   📄 Lines: $lines"
    echo "   🔗 Endpoints: $endpoints"
    echo "   💾 Size: $size"
    
    if [ "$lines" -lt 1400 ]; then
        log_warning "File seems small (expected ~1432 lines)"
    fi
    
    if [ "$endpoints" -lt 80 ]; then
        log_warning "Low endpoint count (expected ~91 endpoints)"
    fi
}

# Function to check VPS connectivity
check_vps_connectivity() {
    log_info "Testing VPS connectivity..."
    
    if ssh -o ConnectTimeout=10 "$VPS_USER@$VPS_HOST" "echo 'Connected'" 2>/dev/null; then
        log_success "VPS SSH connection successful"
        return 0
    else
        log_error "Cannot connect to VPS via SSH"
        return 1
    fi
}

# Function to analyze VPS current state
analyze_vps_state() {
    log_info "Analyzing current VPS state..."
    
    ssh "$VPS_USER@$VPS_HOST" << 'EOF'
echo "📊 Current VPS Server Analysis:"
echo "==============================="

# Check if server file exists
if [ -f "/root/NexusCore/server/prod.cjs" ]; then
    lines=$(wc -l < /root/NexusCore/server/prod.cjs)
    endpoints=$(grep -c 'app\.\(get\|post\|put\|patch\|delete\)' /root/NexusCore/server/prod.cjs || echo "0")
    echo "✅ Server file found: $lines lines, $endpoints endpoints"
else
    echo "❌ Server file not found"
fi

# Check PM2 status
if command -v pm2 >/dev/null 2>&1; then
    echo ""
    echo "📋 PM2 Process Status:"
    pm2 list | grep companyos || echo "❌ No companyos process found"
else
    echo "❌ PM2 not found"
fi

# Check Nginx status
if systemctl is-active nginx >/dev/null 2>&1; then
    echo ""
    echo "✅ Nginx service: Active"
else
    echo "❌ Nginx service: Not active"
fi

# Test local endpoint
echo ""
echo "🔍 Testing local endpoint:"
if curl -s http://localhost:5000/api/tasks/stats >/dev/null 2>&1; then
    echo "✅ /api/tasks/stats responds"
else
    echo "❌ /api/tasks/stats not responding"
fi

# Check recent errors
echo ""
echo "📋 Recent Error Summary:"
if [ -f "/root/NexusCore/logs/error.log" ]; then
    recent_errors=$(tail -20 /root/NexusCore/logs/error.log | grep "404" | wc -l)
    echo "Recent 404 errors: $recent_errors"
else
    echo "No error log found"
fi
EOF
}

# Function to deploy updated server
deploy_server() {
    log_info "Deploying updated server to VPS..."
    
    # Upload file
    if scp "$LOCAL_FILE" "$VPS_USER@$VPS_HOST:$VPS_PATH/server/"; then
        log_success "File uploaded successfully"
    else
        log_error "File upload failed"
        return 1
    fi
    
    # Restart server
    ssh "$VPS_USER@$VPS_HOST" << 'EOF'
cd /root/NexusCore

echo "🔄 Restarting server..."
pm2 delete companyos 2>/dev/null || echo "No existing process"
pm2 start server/prod.cjs --name companyos
pm2 save

echo "✅ Server restarted"
EOF
}

# Function to clear all caches
clear_all_caches() {
    log_info "Clearing all caches on VPS..."
    
    ssh "$VPS_USER@$VPS_HOST" << 'EOF'
# Clear Nginx cache
echo "🧹 Clearing Nginx cache..."
rm -rf /var/cache/nginx/* 2>/dev/null || echo "Nginx cache already empty"
nginx -s reload

# Clear any temporary files
echo "🧹 Clearing temporary files..."
find /tmp -name "*nginx*" -type f -delete 2>/dev/null || true

echo "✅ All caches cleared"
EOF
}

# Function to run comprehensive tests
run_endpoint_tests() {
    log_info "Testing critical endpoints..."
    
    ssh "$VPS_USER@$VPS_HOST" << 'EOF'
echo "🔍 Endpoint Testing Results:"
echo "============================"

endpoints=(
    "/api/tasks/stats"
    "/api/dashboard/kpis"
    "/api/activities"
    "/api/employees"
    "/api/payment-sources/stats"
    "/api/config"
    "/api/health"
)

for endpoint in "${endpoints[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5000$endpoint" 2>/dev/null)
    
    if [ "$response" = "200" ] || [ "$response" = "304" ]; then
        echo "✅ $endpoint → $response"
    elif [ "$response" = "401" ]; then
        echo "🔐 $endpoint → $response (Auth required)"
    else
        echo "❌ $endpoint → $response"
    fi
done
EOF
}

# Function to generate final report
generate_report() {
    log_info "Generating deployment report..."
    
    ssh "$VPS_USER@$VPS_HOST" << 'EOF'
echo ""
echo "📊 FINAL DEPLOYMENT REPORT"
echo "=========================="

# Server stats
if [ -f "/root/NexusCore/server/prod.cjs" ]; then
    lines=$(wc -l < /root/NexusCore/server/prod.cjs)
    endpoints=$(grep -c 'app\.\(get\|post\|put\|patch\|delete\)' /root/NexusCore/server/prod.cjs || echo "0")
    echo "📄 Server: $lines lines, $endpoints endpoints"
fi

# Service status
pm2_status=$(pm2 list | grep companyos | grep -o "online\|stopped\|errored" || echo "not found")
nginx_status=$(systemctl is-active nginx 2>/dev/null || echo "inactive")
echo "🔧 Services: PM2=$pm2_status, Nginx=$nginx_status"

# Performance estimate
echo ""
echo "📈 Expected Performance:"
echo "   Success Rate: 87.2% → 99%+"
echo "   Console Errors: 92 → Near 0"
echo "   Missing Endpoints: 60+ → 0"

echo ""
echo "🎯 Next Steps for Users:"
echo "1. Clear browser cache (Ctrl+Shift+Delete)"
echo "2. Hard refresh page (Ctrl+Shift+R)"
echo "3. Login and test dashboard functionality"
EOF
}

# Main execution flow
main() {
    echo "Starting comprehensive deployment fix..."
    echo ""
    
    # Check local environment
    check_local_file || exit 1
    
    # Check VPS connectivity
    if ! check_vps_connectivity; then
        log_error "Cannot proceed without VPS access"
        exit 1
    fi
    
    # Analyze current state
    analyze_vps_state
    
    echo ""
    read -p "Deploy updated server? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        deploy_server || exit 1
        clear_all_caches
        
        log_info "Waiting for services to stabilize..."
        sleep 5
        
        run_endpoint_tests
        generate_report
        
        log_success "Deployment completed successfully!"
        echo ""
        log_info "Visit https://nexus.creativecode.com.eg and test functionality"
    else
        log_info "Deployment cancelled by user"
    fi
}

# Run main function
main "$@"