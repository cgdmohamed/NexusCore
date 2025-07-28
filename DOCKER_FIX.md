# Docker Deployment Fix Guide

## Issue Resolution

The Docker build was failing because the original Dockerfile was installing only production dependencies (`npm ci --only=production`) but then trying to run the build process which requires development dependencies like Vite.

## Fixed Dockerfile

I've updated the Dockerfile to:
1. Install ALL dependencies (including dev dependencies) in the builder stage
2. Keep production-only dependencies in the final production stage
3. Maintain proper multi-stage build optimization

## Quick Fix Commands

If you're currently experiencing the build failure, run these commands:

```bash
# Stop any running containers
docker-compose down

# Remove any failed build cache
docker system prune -f

# Rebuild with the fixed Dockerfile
docker-compose --env-file .env.docker up -d --build
```

## Company Branding Configuration

To customize your company branding, edit your `.env.docker` file:

```bash
# Copy the example file
cp .env.docker.example .env.docker

# Edit with your company details
nano .env.docker
```

Update these variables:
```bash
COMPANY_NAME=Your Company Name
COMPANY_TAGLINE=Your Company Tagline
```

## Complete Docker Deployment Steps

1. **Prepare Environment File**
   ```bash
   cp .env.docker.example .env.docker
   # Edit .env.docker with your company settings
   ```

2. **Deploy with Docker Compose**
   ```bash
   docker-compose --env-file .env.docker up -d --build
   ```

3. **Verify Deployment**
   ```bash
   # Check container status
   docker-compose ps
   
   # Check application logs
   docker-compose logs app
   
   # Test the application
   curl http://localhost:5000/api/health
   ```

4. **Access Your Application**
   - Open: http://localhost:5000
   - Login: admin / admin123

## Troubleshooting

### Build Issues
- Clear Docker cache: `docker system prune -f`
- Force rebuild: `docker-compose up -d --build --force-recreate`

### Database Issues
- Check database logs: `docker-compose logs postgres`
- Reset database: `docker-compose down -v && docker-compose up -d`

### Permission Issues
- Ensure proper file permissions: `chmod +x docker-*.sh`
- Check container user: `docker-compose exec app whoami`

## Configuration Verification

After successful deployment, verify your company branding:
1. Visit the login page - should show your company name
2. Check the navigation header - should display your company name
3. Test the configuration API: `curl http://localhost:5000/api/config`

Your application should now be running with your custom company branding!