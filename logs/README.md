# Creative Code Nexus - Logs Directory

This directory contains comprehensive logging for the Creative Code Nexus enterprise management system.

## Log Files

### error.log
- **Purpose**: Application errors, exceptions, and failures
- **Format**: JSON structured logs
- **Contains**: 
  - Authentication failures
  - Unauthorized access attempts
  - Server errors and exceptions
  - Stack traces and error context
  - IP addresses and user agents for security tracking

### app.log
- **Purpose**: General application events and information
- **Format**: JSON structured logs
- **Contains**:
  - Server startup/shutdown events
  - Successful login/logout events
  - Configuration changes
  - System status updates

### api.log
- **Purpose**: API request and response tracking
- **Format**: JSON structured logs
- **Contains**:
  - All API endpoint access
  - Request method, path, and response codes
  - Response times and performance metrics
  - User identification (authenticated/anonymous)
  - IP addresses and user agents

## Log Format

All logs follow this JSON structure:
```json
{
  "timestamp": "2025-01-28T22:45:00.000Z",
  "level": "ERROR|INFO|API",
  "message": "Human readable message",
  "context": {
    "endpoint": "POST /api/login",
    "ip": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "userId": "admin-001"
  },
  "pid": 12345
}
```

## Viewing Logs

Use the log viewer script:
```bash
# View recent errors
./scripts/view-logs.sh error

# View API access logs
./scripts/view-logs.sh api

# Monitor logs in real-time
./scripts/view-logs.sh live

# View summary of all logs
./scripts/view-logs.sh all
```

## Log Rotation

For production environments, consider setting up log rotation:
```bash
# Example logrotate configuration
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

## Security Considerations

- Log files contain IP addresses and user agents for security monitoring
- Failed login attempts are logged with attempted usernames
- Unauthorized access attempts are tracked with full context
- Consider restricting access to log files in production

## Troubleshooting

- **Large log files**: Use log rotation or the clear command
- **Missing logs**: Check file permissions and disk space
- **JSON parsing errors**: Some logs may contain non-JSON content for compatibility