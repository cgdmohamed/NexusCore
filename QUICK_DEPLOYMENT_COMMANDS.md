# Quick VPS Deployment Commands

## Fix All Script Permissions (Run on VPS)
```bash
chmod +x scripts/*.sh
```

## Deploy Updated Server with Enhanced Error Logging
```bash
# Stop current server
pm2 delete companyos

# Start with enhanced error logging
pm2 start server/prod.cjs --name companyos

# Save configuration
pm2 save

# Check status
pm2 status
```

## Monitor Improvements
```bash
# View real-time logs
./scripts/view-logs.sh live

# Check system health
./scripts/log-analysis.sh health

# Analyze 404 errors (should show detailed tracking now)
./scripts/log-analysis.sh 404

# View recent errors (should now capture all missing endpoints)
./scripts/view-logs.sh error
```

## CRITICAL FIX IDENTIFIED

**Issue**: 404 handler incorrectly catching homepage (GET /) requests
**Impact**: Homepage shows 404 instead of loading the application
**Root Cause**: Overly broad 404 handler pattern `/api/*` catching all routes

## Expected Results After Deployment

### Before (Current State):
- Success rate: 87.8%
- Homepage requests causing 404 errors  
- GET / requests logged as missing endpoints
- App not accessible from root URL

### After (With Critical Fix):
- Success rate: 95%+
- Homepage loads correctly
- Only legitimate API 404s logged
- Complete application accessibility

## Key Files Updated:
- `server/prod.cjs` - Added missing endpoints and enhanced 404 logging
- `scripts/restart-production.sh` - Fixed PM2 command syntax
- Enhanced error handling for all API routes

## Troubleshooting:
If PM2 fails to start:
```bash
pm2 logs companyos  # Check startup errors
node server/prod.cjs  # Test direct execution
```

The enhanced logging system will now capture every error you see in the browser console.