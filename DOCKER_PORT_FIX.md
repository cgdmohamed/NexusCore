# Docker Port Conflict Fix

## Issue
Your server already has PostgreSQL (port 5432) and Redis (port 6379) running, causing Docker port conflicts.

## Solution
I've updated the Docker configuration to use different external ports:
- PostgreSQL: Changed from 5432 → 5433
- Redis: Changed from 6379 → 6380

## Quick Fix Commands

```bash
# Stop any running containers
docker-compose down

# Rebuild with new port configuration
docker-compose --env-file .env.docker up -d
```

## Manual Port Configuration (Optional)

If you want to use different ports, edit your `.env.docker` file:

```bash
# Use custom ports to avoid conflicts
DB_PORT=5434
REDIS_PORT=6381
```

## Verification

After successful deployment:

```bash
# Check container status
docker-compose ps

# Test the application
curl http://localhost:5000/api/health

# Check database connection
docker-compose exec postgres psql -U companyos_user -d companyos -c "SELECT version();"
```

## Access Information

- **Application**: http://localhost:5000
- **Database**: localhost:5433 (instead of 5432)
- **Redis**: localhost:6380 (instead of 6379)
- **Login**: admin / admin123

The application will automatically connect to the Docker services using the internal network, so port changes don't affect functionality.