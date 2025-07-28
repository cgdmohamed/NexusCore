# Docker Deployment Guide for CompanyOS

This guide covers deploying CompanyOS using Docker containers for both development and production environments.

## Quick Start

### Production Deployment

1. **Clone and Configure**
   ```bash
   git clone <repository-url>
   cd companyos
   cp .env.docker.example .env.docker
   # Edit .env.docker with your configuration
   ```

2. **Deploy with Docker Compose**
   ```bash
   docker-compose --env-file .env.docker up -d
   ```

3. **Access Application**
   - Application: http://localhost:5000
   - Login: admin / admin123

### Development Deployment

1. **Start Development Environment**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **Access Services**
   - Application: http://localhost:5000
   - Frontend Dev Server: http://localhost:5173
   - Database Admin: http://localhost:8080 (with --profile with-adminer)

## Deployment Options

### 1. Basic Production Setup

**Single Container with External Database:**
```bash
# Build the image
docker build -t companyos:latest .

# Run with external PostgreSQL
docker run -d \
  --name companyos \
  -p 5000:5000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e SESSION_SECRET="your-secure-secret" \
  -e NODE_ENV=production \
  companyos:latest
```

### 2. Full Stack with Docker Compose

**All services included:**
```bash
# Production with all services
docker-compose --env-file .env.docker up -d

# Include Nginx reverse proxy
docker-compose --env-file .env.docker --profile with-nginx up -d

# Include Redis for session storage
docker-compose --env-file .env.docker up -d app postgres redis
```

### 3. Development Environment

**Hot reload and debugging:**
```bash
# Development with hot reload
docker-compose -f docker-compose.dev.yml up -d

# Include database admin interface
docker-compose -f docker-compose.dev.yml --profile with-adminer up -d
```

## Configuration

### Environment Variables

Create `.env.docker` file based on `.env.docker.example`:

```bash
# Essential Configuration
NODE_ENV=production
DB_PASSWORD=your-secure-database-password
SESSION_SECRET=your-super-secure-session-secret-32chars+

# Optional Configuration
DOMAIN=your-domain.com
PORT=5000
DB_PORT=5432
REDIS_PASSWORD=your-redis-password
```

### Database Configuration

**Automatic Setup:**
- PostgreSQL 15 with automatic database creation
- Health checks ensure database readiness
- Automatic schema migrations on startup
- Admin user creation if not exists

**Manual Database Setup:**
```bash
# Connect to database container
docker exec -it companyos-postgres psql -U companyos_user -d companyos

# Check admin user
SELECT username, email, role FROM users WHERE username = 'admin';
```

### SSL/HTTPS Configuration

**For production with custom domain:**

1. **Obtain SSL certificates** (Let's Encrypt recommended)
2. **Place certificates** in `nginx/ssl/` directory
3. **Update nginx configuration** to enable HTTPS
4. **Deploy with Nginx**:
   ```bash
   docker-compose --profile with-nginx up -d
   ```

## Service Management

### Container Operations

```bash
# View running containers
docker-compose ps

# View logs
docker-compose logs -f app
docker-compose logs -f postgres

# Restart services
docker-compose restart app
docker-compose restart postgres

# Stop all services
docker-compose down

# Stop and remove volumes (destructive)
docker-compose down -v
```

### Health Monitoring

**Built-in health checks:**
- Application: http://localhost:5000/api/health
- Database: Automatic PostgreSQL health checks
- Redis: Automatic Redis health checks

**Check container health:**
```bash
docker-compose ps
docker inspect companyos-app --format='{{.State.Health.Status}}'
```

### Backup and Restore

**Database Backup:**
```bash
# Create backup
docker exec companyos-postgres pg_dump -U companyos_user companyos > backup.sql

# Automated backup script
docker exec companyos-postgres pg_dump -U companyos_user companyos | gzip > "backup-$(date +%Y%m%d-%H%M%S).sql.gz"
```

**Database Restore:**
```bash
# Restore from backup
docker exec -i companyos-postgres psql -U companyos_user companyos < backup.sql
```

**Volume Backup:**
```bash
# Backup volumes
docker run --rm -v companyos_postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-data.tar.gz -C /data .
```

## Scaling and Performance

### Horizontal Scaling

**Multiple Application Instances:**
```yaml
# In docker-compose.yml
services:
  app:
    deploy:
      replicas: 3
    ports:
      - "5000-5002:5000"
```

**Load Balancer Configuration:**
- Use Nginx upstream for load balancing
- Configure session affinity if needed
- Implement health check endpoints

### Performance Optimization

**Resource Limits:**
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
        reservations:
          memory: 512M
```

**Database Optimization:**
```yaml
postgres:
  environment:
    - POSTGRES_SHARED_BUFFERS=256MB
    - POSTGRES_EFFECTIVE_CACHE_SIZE=1GB
    - POSTGRES_MAX_CONNECTIONS=100
```

## Security

### Container Security

**Non-root user execution:**
- Application runs as `companyos` user (UID 1001)
- Read-only filesystem where possible
- Minimal attack surface

**Network Security:**
- Isolated Docker network
- No direct database access from outside
- Rate limiting via Nginx

**Secrets Management:**
```bash
# Use Docker secrets in production
echo "your-secret" | docker secret create session_secret -
```

### SSL/TLS Configuration

**Nginx SSL Setup:**
1. Place certificates in `nginx/ssl/`
2. Update `nginx/nginx.conf` SSL section
3. Enable HTTPS redirects

**Certificate Management:**
```bash
# Let's Encrypt with Certbot
docker run -it --rm \
  -v /path/to/nginx/ssl:/etc/letsencrypt \
  certbot/certbot certonly --standalone -d your-domain.com
```

## Monitoring and Logging

### Log Management

**Container Logs:**
```bash
# View all logs
docker-compose logs -f

# Specific service logs
docker-compose logs -f app
docker-compose logs -f postgres
docker-compose logs -f nginx

# Log rotation (production)
docker-compose --log-driver json-file --log-opt max-size=10m --log-opt max-file=3
```

**External Log Shipping:**
```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Monitoring Stack

**Basic Monitoring:**
- Built-in health checks
- Container resource monitoring
- Application health endpoints

**Advanced Monitoring (Optional):**
```yaml
# Add to docker-compose.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
  
  grafana:
    image: grafana/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

## Troubleshooting

### Common Issues

**Container Won't Start:**
```bash
# Check logs
docker-compose logs app

# Check container status
docker-compose ps

# Verify environment variables
docker-compose config
```

**Database Connection Issues:**
```bash
# Test database connectivity
docker exec companyos-app nc -z postgres 5432

# Check database logs
docker-compose logs postgres

# Verify database initialization
docker exec -it companyos-postgres psql -U companyos_user -d companyos -c "SELECT 1;"
```

**Permission Issues:**
```bash
# Fix volume permissions
docker-compose down
sudo chown -R 1001:1001 ./logs
docker-compose up -d
```

**Port Conflicts:**
```bash
# Check port usage
netstat -tulpn | grep :5000

# Use different ports
PORT=5001 docker-compose up -d
```

### Performance Issues

**High Memory Usage:**
```bash
# Monitor resource usage
docker stats

# Adjust memory limits
docker-compose --memory=1g up -d
```

**Slow Database:**
```bash
# Check database performance
docker exec -it companyos-postgres psql -U companyos_user -d companyos -c "SELECT * FROM pg_stat_activity;"

# Analyze slow queries
docker exec -it companyos-postgres psql -U companyos_user -d companyos -c "SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

## Production Checklist

### Pre-deployment
- [ ] Environment variables configured securely
- [ ] SSL certificates obtained and configured
- [ ] Database passwords changed from defaults
- [ ] Backup strategy implemented
- [ ] Monitoring configured
- [ ] Resource limits set appropriately

### Post-deployment
- [ ] Health checks passing
- [ ] SSL/HTTPS working correctly
- [ ] Database connectivity verified
- [ ] Admin login working
- [ ] Backup and restore tested
- [ ] Performance monitoring active

### Maintenance
- [ ] Regular security updates
- [ ] Log rotation configured
- [ ] Database maintenance scheduled
- [ ] SSL certificate renewal planned
- [ ] Monitoring alerts configured

## Advanced Deployment

### Multi-Environment Setup

**Staging Environment:**
```bash
# Create staging configuration
cp docker-compose.yml docker-compose.staging.yml
# Edit staging-specific settings

# Deploy staging
docker-compose -f docker-compose.staging.yml up -d
```

**Production with Secrets:**
```bash
# Use Docker Swarm for production
docker swarm init
docker stack deploy -c docker-compose.prod.yml companyos
```

### CI/CD Integration

**GitLab CI Example:**
```yaml
deploy:
  script:
    - docker build -t companyos:$CI_COMMIT_SHA .
    - docker tag companyos:$CI_COMMIT_SHA companyos:latest
    - docker-compose up -d
```

**GitHub Actions Example:**
```yaml
- name: Deploy to production
  run: |
    docker-compose --env-file .env.production up -d
```

---

## Support and Resources

- **Docker Documentation**: https://docs.docker.com/
- **Docker Compose Reference**: https://docs.docker.com/compose/
- **PostgreSQL Docker**: https://hub.docker.com/_/postgres
- **Nginx Docker**: https://hub.docker.com/_/nginx

For deployment issues, check the troubleshooting section or review container logs for specific error messages.