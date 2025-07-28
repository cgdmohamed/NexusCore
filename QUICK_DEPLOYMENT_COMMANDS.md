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

## Expected Results After Deployment

### Before (Current State):
- Success rate: 86.6%
- Missing 404 error details in logs
- POST /api/quotations/:id/items causing 404s
- Error logging incomplete

### After (With Updates):
- Success rate: 95%+
- Complete 404 error tracking in error.log
- Fixed quotation item creation
- Comprehensive error visibility

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