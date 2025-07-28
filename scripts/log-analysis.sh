#!/bin/bash
# Advanced log analysis for Creative Code Nexus

echo "🔍 Creative Code Nexus - Log Analysis"
echo "====================================="

# Create logs directory if it doesn't exist
mkdir -p logs

# Function to analyze API performance
analyze_api_performance() {
    echo ""
    echo "📊 API Performance Analysis:"
    echo "-----------------------------"
    
    if [ -f "logs/api.log" ]; then
        echo "🚀 Fastest API responses:"
        grep '"duration":"[0-9]*ms"' logs/api.log | \
        sed 's/.*"duration":"\([0-9]*\)ms".*/\1/' | \
        sort -n | head -5 | \
        while read duration; do
            grep "\"duration\":\"${duration}ms\"" logs/api.log | head -1 | \
            python3 -c "import sys, json; data=json.loads(sys.stdin.read()); print(f'  {data[\"duration\"]} - {data[\"method\"]} {data[\"path\"]} ({data[\"statusCode\"]})')"
        done
        
        echo ""
        echo "🐌 Slowest API responses:"
        grep '"duration":"[0-9]*ms"' logs/api.log | \
        sed 's/.*"duration":"\([0-9]*\)ms".*/\1/' | \
        sort -nr | head -5 | \
        while read duration; do
            grep "\"duration\":\"${duration}ms\"" logs/api.log | head -1 | \
            python3 -c "import sys, json; data=json.loads(sys.stdin.read()); print(f'  {data[\"duration\"]} - {data[\"method\"]} {data[\"path\"]} ({data[\"statusCode\"]})')"
        done
    else
        echo "❌ No API logs found"
    fi
}

# Function to analyze errors
analyze_errors() {
    echo ""
    echo "🚨 Error Analysis:"
    echo "------------------"
    
    if [ -f "logs/error.log" ]; then
        echo "📈 Error frequency by type:"
        grep '"message"' logs/error.log | \
        sed 's/.*"message":"\([^"]*\)".*/\1/' | \
        sort | uniq -c | sort -nr | head -10
        
        echo ""
        echo "🌐 Most common error sources (IP addresses):"
        grep '"ip"' logs/error.log | \
        sed 's/.*"ip":"\([^"]*\)".*/\1/' | \
        sort | uniq -c | sort -nr | head -5
    else
        echo "✅ No error logs found - system running clean!"
    fi
}

# Function to analyze user activity
analyze_user_activity() {
    echo ""
    echo "👥 User Activity Analysis:"
    echo "-------------------------"
    
    if [ -f "logs/api.log" ]; then
        echo "📊 Request distribution by user:"
        grep '"userId"' logs/api.log | \
        sed 's/.*"userId":"\([^"]*\)".*/\1/' | \
        sort | uniq -c | sort -nr
        
        echo ""
        echo "🕐 Activity timeline (last 10 requests):"
        tail -10 logs/api.log | \
        python3 -c "
import sys, json
for line in sys.stdin:
    try:
        data = json.loads(line.strip())
        timestamp = data['timestamp'][:19].replace('T', ' ')
        print(f'  {timestamp} - {data[\"method\"]} {data[\"path\"]} ({data[\"statusCode\"]}) - {data[\"userId\"]}')
    except:
        pass
"
    else
        echo "❌ No API logs found"
    fi
}

# Function to show system health
show_system_health() {
    echo ""
    echo "💊 System Health Summary:"
    echo "------------------------"
    
    if [ -f "logs/app.log" ]; then
        echo "✅ Server starts: $(grep 'Server started' logs/app.log | wc -l)"
        echo "🔐 Successful logins: $(grep 'Successful login' logs/app.log | wc -l)"
        echo "🚪 Successful logouts: $(grep 'Successful logout' logs/app.log | wc -l)"
    fi
    
    if [ -f "logs/api.log" ]; then
        total_requests=$(wc -l < logs/api.log)
        error_requests=$(grep '"statusCode":[45][0-9][0-9]' logs/api.log | wc -l)
        success_rate=$(python3 -c "print(f'{((${total_requests} - ${error_requests}) / ${total_requests} * 100):.1f}%' if ${total_requests} > 0 else '0%')")
        
        echo "📈 Total API requests: $total_requests"
        echo "❌ Error requests: $error_requests"
        echo "✅ Success rate: $success_rate"
    fi
    
    if [ -f "logs/error.log" ]; then
        echo "🚨 Total errors logged: $(wc -l < logs/error.log)"
    else
        echo "🎉 No errors logged - system healthy!"
    fi
}

# Function to show 404 analysis
analyze_404s() {
    echo ""
    echo "🔍 404 Error Analysis:"
    echo "---------------------"
    
    if [ -f "logs/api.log" ]; then
        echo "📊 Most requested missing endpoints:"
        grep '"statusCode":404' logs/api.log | \
        sed 's/.*"path":"\([^"]*\)".*/\1/' | \
        sort | uniq -c | sort -nr | head -10 | \
        while read count path; do
            echo "  $count requests to: $path"
        done
    else
        echo "❌ No API logs found"
    fi
}

# Parse command line arguments
case "$1" in
    "performance"|"perf")
        analyze_api_performance
        ;;
    "errors"|"error")
        analyze_errors
        ;;
    "users"|"activity")
        analyze_user_activity
        ;;
    "health")
        show_system_health
        ;;
    "404"|"missing")
        analyze_404s
        ;;
    "full"|"complete")
        show_system_health
        analyze_api_performance
        analyze_user_activity
        analyze_errors
        analyze_404s
        ;;
    *)
        echo "Usage: $0 [analysis_type]"
        echo ""
        echo "Analysis Types:"
        echo "  performance - API response time analysis"
        echo "  errors      - Error frequency and sources"
        echo "  users       - User activity patterns"
        echo "  health      - Overall system health"
        echo "  404         - Missing endpoint analysis"
        echo "  full        - Complete system analysis"
        echo ""
        echo "Examples:"
        echo "  $0 health      # Quick system health check"
        echo "  $0 performance # API performance analysis"
        echo "  $0 full        # Complete analysis report"
        ;;
esac