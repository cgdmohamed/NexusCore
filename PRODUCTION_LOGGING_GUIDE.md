# Creative Code Nexus - Production Logging Guide

## Quick Deployment Update

Your Creative Code Nexus system now has comprehensive error logging. To update your production server:

### 1. Upload Updated Files
```bash
# Upload these files to your VPS:
- server/prod.cjs (updated with logging)
- scripts/view-logs.sh (new log viewer)
- scripts/log-analysis.sh (new analysis tool)
```

### 2. Restart Production Server
```bash
# Method 1: Use the restart script
./scripts/restart-production.sh

# Method 2: Manual PM2 commands
pm2 delete companyos
pm2 start server/prod.cjs \
  --name companyos \
  --log logs/pm2-combined.log \
  --out-log logs/pm2-out.log \
  --error-log logs/pm2-error.log \
  --time
pm2 save
```

### 3. Monitor Logs
```bash
# View logs in real-time
./scripts/view-logs.sh live

# Check system health
./scripts/log-analysis.sh health

# View recent errors
./scripts/view-logs.sh error

# Complete system analysis
./scripts/log-analysis.sh full
```

## Log Files Created

Your system now creates three types of logs in the `logs/` directory:

### error.log
- Authentication failures
- Unauthorized access attempts
- Server errors and exceptions
- Security events with IP tracking

### app.log
- Server startup/shutdown events
- Successful login/logout activities
- System status changes
- Configuration updates

### api.log
- All API endpoint requests
- Response times and status codes
- User identification and IP addresses
- Performance metrics

## Log Analysis Commands

```bash
# Quick system health check
./scripts/log-analysis.sh health

# API performance analysis
./scripts/log-analysis.sh performance

# User activity patterns
./scripts/log-analysis.sh users

# Error frequency analysis
./scripts/log-analysis.sh errors

# 404 endpoint analysis
./scripts/log-analysis.sh 404

# Complete system report
./scripts/log-analysis.sh full
```

## Log Management

### View Recent Logs
```bash
# Last 20 error entries
./scripts/view-logs.sh error

# Last 50 API requests
./scripts/view-logs.sh api 50

# Summary of all logs
./scripts/view-logs.sh all

# Monitor in real-time
./scripts/view-logs.sh live
```

### Clear Logs
```bash
# Clear all log files
./scripts/view-logs.sh clear

# Manual cleanup
rm -f logs/*.log
```

## Security Features

### Authentication Monitoring
- Failed login attempts logged with usernames and IP addresses
- Unauthorized access attempts tracked with full context
- Session management events recorded

### Performance Tracking
- API response times monitored
- Slow endpoint identification
- Error rate calculations

### User Activity
- All API requests logged with user identification
- Activity timeline tracking
- Request pattern analysis

## Production Recommendations

### Log Rotation
Set up automatic log rotation to prevent disk space issues:
```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/nexus

# Add this content:
/path/to/nexus/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
```

### Monitoring Alerts
Create monitoring scripts for critical errors:
```bash
# Check for critical errors every 5 minutes
*/5 * * * * /path/to/nexus/scripts/log-analysis.sh errors | grep -q "ERROR" && echo "Critical errors detected" | mail -s "Nexus Alert" admin@company.com
```

### Backup Strategy
```bash
# Daily log backup
0 2 * * * tar -czf /backup/nexus-logs-$(date +%Y%m%d).tar.gz /path/to/nexus/logs/
```

## Troubleshooting

### Common Issues

**Missing tasks/stats endpoint (404 errors):**
- Check route order in prod.cjs
- Verify authentication middleware
- Review server restart logs

**High memory usage:**
- Check log file sizes
- Implement log rotation
- Monitor API request frequency

**Authentication failures:**
- Review error.log for patterns
- Check session configuration
- Verify user credentials

### Log Analysis Tips

1. **Performance Issues**: Use `./scripts/log-analysis.sh performance` to identify slow endpoints
2. **Security Concerns**: Monitor `error.log` for repeated unauthorized access attempts
3. **User Patterns**: Use `./scripts/log-analysis.sh users` to understand usage patterns
4. **System Health**: Regular `./scripts/log-analysis.sh health` checks

## Log Format Reference

All logs use structured JSON format:
```json
{
  "timestamp": "2025-01-28T22:47:00.000Z",
  "level": "ERROR|INFO|API",
  "message": "Human readable message",
  "context": {
    "endpoint": "POST /api/login",
    "ip": "127.0.0.1",
    "userId": "admin-001"
  },
  "pid": 12345
}
```

This comprehensive logging system provides complete visibility into your Creative Code Nexus application's performance, security, and user activity.