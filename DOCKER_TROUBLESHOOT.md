# Docker Health Check Troubleshooting Guide

## Current Issue
The application container is showing as "unhealthy" - this means the health check endpoint `/api/health` is not responding properly.

## Immediate Diagnosis Commands

Run these commands on your server to diagnose the issue:

```bash
# Check container status
docker-compose ps

# Check application logs (most important)
docker-compose logs -f app

# Check database logs
docker-compose logs postgres

# Check Redis logs
docker-compose logs redis

# Test health endpoint directly
curl http://localhost:5000/api/health

# Check if application is running inside container
docker-compose exec app ps aux

# Check container network connectivity
docker-compose exec app wget -q --spider http://localhost:5000/api/health && echo "Health check works" || echo "Health check failed"
```

## Common Issues and Solutions

### 1. Database Connection Issues
**Symptoms:** App logs show database connection errors

**Solution:**
```bash
# Check if database is ready
docker-compose exec postgres pg_isready -U companyos_user -d companyos

# If database isn't ready, restart services
docker-compose down
docker-compose --env-file .env.docker up -d
```

### 2. Missing Environment Variables
**Symptoms:** App logs show missing configuration errors

**Check your `.env.docker` file contains:**
```bash
COMPANY_NAME=Creative Code Nexus
COMPANY_TAGLINE=Digital Solutions & Innovation
SESSION_SECRET=your-super-secure-session-secret-minimum-32-characters
DB_PASSWORD=companyos123
```

### 3. Application Startup Issues
**Symptoms:** App container exits immediately or shows Node.js errors

**Solution:**
```bash
# Rebuild with updated configuration
docker-compose down
docker-compose --env-file .env.docker up -d --build

# Check if application files are properly copied
docker-compose exec app ls -la dist/
```

### 4. Health Check Timeout
**Symptoms:** Container marked unhealthy after some time

I've updated the health check with:
- Longer start period (40s instead of 5s) 
- Longer timeout (10s instead of 3s)
- Better error handling

**Deploy the fix:**
```bash
docker-compose down
docker-compose --env-file .env.docker up -d --build
```

## Quick Fix Commands

If the basic diagnosis shows issues, try these in order:

### Option 1: Restart Services
```bash
docker-compose restart app
# Wait 60 seconds for health check
docker-compose ps
```

### Option 2: Full Rebuild
```bash
docker-compose down
docker-compose --env-file .env.docker up -d --build
```

### Option 3: Complete Reset
```bash
# WARNING: This removes all data
docker-compose down -v
docker-compose --env-file .env.docker up -d
```

## Verification Commands

Once fixed, verify everything works:

```bash
# Check all containers are healthy
docker-compose ps

# Test health endpoint
curl http://localhost:5000/api/health
# Expected response: {"status":"ok","timestamp":"..."}

# Test company configuration
curl http://localhost:5000/api/config
# Expected response: {"companyName":"Creative Code Nexus","companyTagline":"..."}

# Test login page
curl -I http://localhost:5000
# Expected: HTTP/1.1 200 OK

# Check database connection
docker-compose exec app node -e "
const { Pool } = require('@neondatabase/serverless');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT version()').then(r => console.log('DB OK:', r.rows[0].version)).catch(e => console.log('DB Error:', e.message));
"
```

## Expected Behavior

When working correctly:
- `docker-compose ps` shows all containers as "Up (healthy)"
- `curl http://localhost:5000/api/health` returns `{"status":"ok"}`
- Application accessible at http://localhost:5000
- Login with admin/admin123 works

## If Still Having Issues

1. **Check the application logs first:**
   ```bash
   docker-compose logs app
   ```

2. **Look for these common error patterns:**
   - Database connection errors
   - Missing environment variables
   - Port binding issues
   - Permission errors

3. **Test database connectivity separately:**
   ```bash
   docker-compose exec postgres psql -U companyos_user -d companyos -c "SELECT 1;"
   ```

## Production Notes

The health check issue is likely due to:
1. Application taking longer to start than expected (fixed with longer start-period)
2. Database not being ready when app starts (fixed with depends_on condition)
3. Missing environment variables (fixed with proper .env.docker configuration)

Your application build was successful, so this is a configuration/timing issue that should resolve with the updated health check settings.