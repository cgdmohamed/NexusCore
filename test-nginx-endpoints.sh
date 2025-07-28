#!/bin/bash

echo "🔍 Testing Nginx Endpoint Availability After Cache Clear"
echo "====================================================="

# Test the main problematic endpoints that were showing 404s
endpoints=(
    "/api/tasks/stats"
    "/api/dashboard/kpis" 
    "/api/activities"
    "/api/employees"
    "/api/payment-sources/stats"
    "/api/notifications/unread-count"
    "/api/user"
)

echo "Testing endpoints through Nginx (public domain):"
echo ""

for endpoint in "${endpoints[@]}"; do
    echo "Testing: $endpoint"
    # Test through your domain (Nginx proxy)
    response=$(curl -s -o /dev/null -w "%{http_code}" "https://nexus.creativecode.com.eg$endpoint" 2>/dev/null)
    
    if [ "$response" = "200" ] || [ "$response" = "304" ]; then
        echo "✅ $endpoint → $response (Success)"
    elif [ "$response" = "401" ]; then
        echo "🔐 $endpoint → $response (Auth required - Normal)"
    else
        echo "❌ $endpoint → $response (Still failing)"
    fi
    echo ""
done

echo "📋 Next Steps:"
echo "1. If you see 401 errors: Normal - login required"
echo "2. If you see 200/304: Nginx cache clear worked!"
echo "3. If you see 404/500: Server deployment still needed"
echo ""
echo "Test with authentication by visiting the site and checking browser console."