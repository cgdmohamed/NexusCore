#!/bin/bash
# Log viewing script for Creative Code Nexus

echo "📊 Creative Code Nexus - Log Viewer"
echo "=================================="

# Create logs directory if it doesn't exist
mkdir -p logs

echo ""
echo "Available log files:"
echo "1. error.log - Application errors and failures"
echo "2. app.log - General application info and events"
echo "3. api.log - API request/response logs"
echo ""

# Function to display log file
show_log() {
    local file=$1
    local lines=${2:-20}
    
    if [ -f "logs/$file" ]; then
        echo "🔍 Last $lines lines from logs/$file:"
        echo "----------------------------------------"
        tail -n $lines "logs/$file" | while IFS= read -r line; do
            # Pretty print JSON logs
            echo "$line" | python3 -m json.tool 2>/dev/null || echo "$line"
        done
        echo ""
    else
        echo "❌ Log file logs/$file not found"
        echo ""
    fi
}

# Parse command line arguments
case "$1" in
    "error"|"errors")
        show_log "error.log" ${2:-20}
        ;;
    "app"|"info")
        show_log "app.log" ${2:-20}
        ;;
    "api")
        show_log "api.log" ${2:-20}
        ;;
    "all")
        echo "🔴 ERROR LOGS:"
        show_log "error.log" 10
        echo "🟢 APP LOGS:"
        show_log "app.log" 10
        echo "🔵 API LOGS:"
        show_log "api.log" 10
        ;;
    "live")
        echo "📡 Live log monitoring (Press Ctrl+C to stop)"
        echo "Watching all log files..."
        tail -f logs/*.log 2>/dev/null
        ;;
    "clear")
        echo "🗑️  Clearing all log files..."
        rm -f logs/*.log
        echo "✅ All logs cleared"
        ;;
    *)
        echo "Usage: $0 [command] [lines]"
        echo ""
        echo "Commands:"
        echo "  error   - Show error logs (default: 20 lines)"
        echo "  app     - Show application logs (default: 20 lines)"
        echo "  api     - Show API access logs (default: 20 lines)"
        echo "  all     - Show summary of all logs (10 lines each)"
        echo "  live    - Monitor logs in real-time"
        echo "  clear   - Clear all log files"
        echo ""
        echo "Examples:"
        echo "  $0 error 50      # Show last 50 error log entries"
        echo "  $0 api           # Show last 20 API log entries"
        echo "  $0 all           # Show summary of all logs"
        echo "  $0 live          # Watch logs in real-time"
        ;;
esac