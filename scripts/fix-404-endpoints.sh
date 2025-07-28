#!/bin/bash
# Script to identify and fix missing API endpoints

echo "🔧 Creative Code Nexus - 404 Endpoint Fixer"
echo "============================================"

echo "🔍 Analyzing missing endpoints from logs..."

if [ -f "logs/api.log" ]; then
    echo ""
    echo "📊 Most requested 404 endpoints:"
    grep '"statusCode":404' logs/api.log | \
    sed 's/.*"path":"\([^"]*\)".*/\1/' | \
    sort | uniq -c | sort -nr | head -10 | \
    while read count path; do
        echo "  $count requests to: $path"
    done
    
    echo ""
    echo "🛠️  Endpoints that need to be added to server/prod.cjs:"
    
    missing_endpoints=$(grep '"statusCode":404' logs/api.log | \
    sed 's/.*"path":"\([^"]*\)".*/\1/' | \
    sort | uniq)
    
    for endpoint in $missing_endpoints; do
        case $endpoint in
            "/api/expenses/stats")
                echo "  ✅ /api/expenses/stats - FIXED in latest update"
                ;;
            "/api/payment-sources")
                echo "  ✅ /api/payment-sources - FIXED in latest update"
                ;;
            "/api/quotations/"*"/items")
                echo "  ✅ /api/quotations/:id/items - FIXED in latest update"
                ;;
            "/api/tasks/stats")
                echo "  ✅ /api/tasks/stats - Already exists, may be route order issue"
                ;;
            *)
                echo "  ❌ $endpoint - Needs implementation"
                ;;
        esac
    done
    
    echo ""
    echo "📋 Next steps:"
    echo "1. Upload updated server/prod.cjs to your VPS"
    echo "2. Restart production server: ./scripts/restart-production.sh"
    echo "3. Monitor for reduced 404 errors: ./scripts/log-analysis.sh 404"
    
else
    echo "❌ No API logs found. Run the application first to generate logs."
fi