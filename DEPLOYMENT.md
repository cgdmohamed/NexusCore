# CompanyOS Deployment Guide

## Overview

CompanyOS is a comprehensive internal company management system that can be deployed in multiple environments. This guide covers deployment on Replit, Docker, cloud platforms, and traditional servers.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Replit Deployment](#replit-deployment)
4. [cPanel Deployment](#cpanel-deployment)
5. [Docker Deployment](#docker-deployment)
6. [Cloud Platform Deployment](#cloud-platform-deployment)
7. [Traditional Server Deployment](#traditional-server-deployment)
8. [Database Setup](#database-setup)
9. [Security Configuration](#security-configuration)
10. [Performance Optimization](#performance-optimization)
11. [Monitoring and Logging](#monitoring-and-logging)
12. [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 18.x or higher
- PostgreSQL 13.x or higher
- SSL certificates (for production)
- Domain name (optional but recommended)
- Admin credentials for initial access

## Environment Configuration

### Required Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database
PGHOST=your-postgres-host
PGPORT=5432
PGDATABASE=companyos
PGUSER=your-username
PGPASSWORD=your-password

# Session Configuration
SESSION_SECRET=your-super-secret-session-key-min-32-chars

# Server Configuration
NODE_ENV=production
PORT=5000

# Optional: Additional Security
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Environment Variable Descriptions

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `DATABASE_URL` | Full PostgreSQL connection string | Yes | `postgresql://user:pass@host:5432/db` |
| `SESSION_SECRET` | Secret key for session encryption (min 32 chars) | Yes | Random 32+ character string |
| `NODE_ENV` | Application environment | Yes | `production` |
| `PORT` | Server port | No | `5000` (default) |
| `ALLOWED_ORIGINS` | CORS allowed origins | No | Comma-separated URLs |

## Replit Deployment

CompanyOS is optimized for Replit deployment with built-in features.

### Steps:

1. **Import Project**
   ```bash
   # Import from GitHub or upload files to Replit
   ```

2. **Set Environment Variables**
   - Go to Replit Secrets (Environment Variables)
   - Add all required variables from the list above
   - Generate a secure SESSION_SECRET

3. **Provision Database**
   ```bash
   # In Replit Console
   replit db create postgresql
   ```

4. **Run Database Migrations**
   ```bash
   npm run db:push
   ```

5. **Create Admin User**
   - Access the database through Replit's database interface
   - Run the admin user creation SQL (see Database Setup section)

6. **Start Application**
   ```bash
   npm run dev  # Development
   npm run start  # Production
   ```

7. **Enable Deployments**
   - Go to Replit Deployments tab
   - Configure custom domain (optional)
   - Deploy with automatic SSL

### Replit-Specific Features:
- Automatic HTTPS/SSL
- Built-in PostgreSQL
- Admin authentication system
- Zero-config deployment
- Automatic scaling

## cPanel Deployment

For detailed cPanel deployment instructions, see **[CPANEL_DEPLOYMENT.md](./CPANEL_DEPLOYMENT.md)**.

### Quick Overview:

1. **Build Application Locally**
   ```bash
   npm install
   npm run build
   ```

2. **Upload to cPanel**
   - Create production package with `dist/` folder
   - Upload via File Manager
   - Set proper permissions

3. **Configure Node.js App**
   - Use Node.js 18+ 
   - Set startup file: `dist/index.js`
   - Configure environment variables

4. **Setup Database**
   - Create PostgreSQL database
   - Run schema migrations
   - Create admin user

5. **Authentication System**
   - Admin-only login system
   - Username: `admin`
   - Default password: `admin123` (change after first login)

**Note:** cPanel deployment uses traditional username/password authentication instead of OIDC. See the complete guide in CPANEL_DEPLOYMENT.md for detailed step-by-step instructions.

## Docker Deployment

### Quick Start with Docker Compose

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd companyos
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build and Run**
   ```bash
   docker-compose up -d
   ```

This will start:
- Application server (port 5000)
- PostgreSQL database (port 5432)
- Nginx reverse proxy (ports 80, 443)

### Production Docker Deployment

1. **Build Production Image**
   ```bash
   docker build -t companyos:latest .
   ```

2. **Run with External Database**
   ```bash
   docker run -d \
     --name companyos \
     --env-file .env \
     -p 5000:5000 \
     companyos:latest
   ```

3. **Run Database Migrations**
   ```bash
   docker exec companyos npm run db:push
   ```

### Docker Security Best Practices

- Use non-root user (already configured)
- Set resource limits
- Use secrets management
- Regular security updates
- Network isolation

## Cloud Platform Deployment

### AWS (Amazon Web Services)

#### Using Elastic Beanstalk:

1. **Prepare Application**
   ```bash
   npm install
   npm run build
   zip -r companyos.zip . -x "node_modules/*" ".git/*"
   ```

2. **Create Beanstalk Application**
   - Choose Node.js platform
   - Upload companyos.zip
   - Configure environment variables

3. **Database Setup**
   - Use AWS RDS PostgreSQL
   - Configure VPC and security groups
   - Update DATABASE_URL

#### Using ECS (Elastic Container Service):

1. **Push to ECR**
   ```bash
   aws ecr create-repository --repository-name companyos
   docker tag companyos:latest <account>.dkr.ecr.<region>.amazonaws.com/companyos:latest
   docker push <account>.dkr.ecr.<region>.amazonaws.com/companyos:latest
   ```

2. **Create ECS Service**
   - Define task definition
   - Configure load balancer
   - Set up auto-scaling

### Google Cloud Platform (GCP)

#### Using Cloud Run:

1. **Build and Deploy**
   ```bash
   gcloud run deploy companyos \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

2. **Set Environment Variables**
   ```bash
   gcloud run services update companyos \
     --set-env-vars="NODE_ENV=production,DATABASE_URL=..."
   ```

### Microsoft Azure

#### Using Container Instances:

1. **Create Resource Group**
   ```bash
   az group create --name companyos-rg --location eastus
   ```

2. **Deploy Container**
   ```bash
   az container create \
     --resource-group companyos-rg \
     --name companyos \
     --image companyos:latest \
     --dns-name-label companyos-app \
     --ports 5000
   ```

## Traditional Server Deployment

### Ubuntu/Debian Server

1. **Install Dependencies**
   ```bash
   # Install Node.js 20
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Install PostgreSQL
   sudo apt-get install -y postgresql postgresql-contrib

   # Install PM2 for process management
   sudo npm install -g pm2
   ```

2. **Setup Database**
   ```bash
   sudo -u postgres createdb companyos
   sudo -u postgres createuser companyos_user
   sudo -u postgres psql -c "ALTER USER companyos_user PASSWORD 'your_password';"
   sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE companyos TO companyos_user;"
   ```

3. **Deploy Application**
   ```bash
   # Clone and install
   git clone <repository-url> /opt/companyos
   cd /opt/companyos
   npm ci --production
   npm run build

   # Copy environment file
   cp .env.example .env
   # Edit .env with your configuration

   # Run migrations
   npm run db:push

   # Create admin user (see Database Setup section for SQL)

   # Start with PM2
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

4. **Setup Nginx Reverse Proxy**
   ```bash
   sudo apt-get install nginx
   sudo cp nginx.conf /etc/nginx/sites-available/companyos
   sudo ln -s /etc/nginx/sites-available/companyos /etc/nginx/sites-enabled/
   sudo systemctl restart nginx
   ```

5. **Setup SSL with Let's Encrypt**
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

### CentOS/RHEL Server

1. **Install Dependencies**
   ```bash
   # Install Node.js 20
   curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
   sudo yum install -y nodejs

   # Install PostgreSQL
   sudo yum install -y postgresql-server postgresql-contrib
   sudo postgresql-setup initdb
   sudo systemctl enable postgresql
   sudo systemctl start postgresql
   ```

2. **Follow similar steps as Ubuntu** (adjust package manager commands)

## Database Setup

### PostgreSQL Configuration

1. **Create Database and User**
   ```sql
   CREATE DATABASE companyos;
   CREATE USER companyos_user WITH ENCRYPTED PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE companyos TO companyos_user;
   ALTER USER companyos_user CREATEDB;
   ```

2. **Create Admin User**
   After running migrations, create the admin user:
   ```sql
   -- First, generate password hash locally:
   -- const bcrypt = require('bcrypt');
   -- const hash = bcrypt.hashSync('admin123', 10);
   
   INSERT INTO users (
     id, username, password_hash, email, 
     first_name, last_name, role, department, is_active
   ) VALUES (
     gen_random_uuid(),
     'admin',
     '$2b$10$[YOUR_GENERATED_HASH_HERE]',
     'admin@yourcompany.com',
     'System',
     'Administrator',
     'admin',
     'management',
     true
   );
   ```

3. **Configure Connection Pool**
   ```bash
   # In postgresql.conf
   max_connections = 100
   shared_buffers = 256MB
   effective_cache_size = 1GB
   work_mem = 4MB
   maintenance_work_mem = 64MB
   ```

4. **Run Migrations**
   ```bash
   npm run db:push
   ```

### Database Backup Strategy

1. **Automated Backups**
   ```bash
   # Create backup script
   #!/bin/bash
   BACKUP_DIR="/backups/companyos"
   TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
   
   pg_dump -h localhost -U companyos_user companyos > $BACKUP_DIR/backup_$TIMESTAMP.sql
   
   # Keep only last 7 days
   find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
   ```

2. **Schedule with Cron**
   ```bash
   # Add to crontab
   0 2 * * * /path/to/backup_script.sh
   ```

## Security Configuration

### SSL/TLS Setup

1. **Generate SSL Certificates**
   ```bash
   # Using Let's Encrypt
   certbot certonly --standalone -d yourdomain.com
   
   # Or use existing certificates
   cp fullchain.pem /etc/nginx/ssl/
   cp privkey.pem /etc/nginx/ssl/
   ```

2. **Configure Nginx SSL**
   - Already included in provided nginx.conf
   - Uses TLS 1.2+ with secure ciphers
   - Includes security headers

### Security Headers

The application automatically includes these security headers in production:

- `Strict-Transport-Security`: Enforces HTTPS
- `X-Frame-Options`: Prevents clickjacking
- `X-Content-Type-Options`: Prevents MIME sniffing
- `X-XSS-Protection`: XSS protection
- `Referrer-Policy`: Controls referrer information

### Rate Limiting

Nginx configuration includes rate limiting:
- API endpoints: 10 requests/second
- Login endpoints: 5 requests/minute
- Burst handling with delays

### Authentication Security

- Admin-only authentication system
- bcrypt password hashing
- Session-based authentication
- HTTP-only cookies
- CSRF protection
- Secure session storage

## Performance Optimization

### Application Level

1. **Enable Gzip Compression**
   - Automatically enabled in production
   - Reduces bandwidth usage by 70-80%

2. **Database Connection Pooling**
   - PostgreSQL connection pool configured
   - Handles concurrent requests efficiently

3. **Caching Strategy**
   - Static file caching (1 year)
   - API response caching where appropriate
   - React Query for client-side caching

### Server Level

1. **PM2 Cluster Mode**
   ```bash
   # In ecosystem.config.js
   instances: 'max'  # Uses all CPU cores
   exec_mode: 'cluster'
   ```

2. **Nginx Optimizations**
   - Gzip compression
   - Static file caching
   - Connection keep-alive
   - Worker process tuning

3. **Database Tuning**
   ```sql
   -- PostgreSQL optimization
   ALTER SYSTEM SET shared_buffers = '256MB';
   ALTER SYSTEM SET effective_cache_size = '1GB';
   ALTER SYSTEM SET work_mem = '4MB';
   ```

### CDN Integration

1. **CloudFlare Setup**
   - DNS configuration
   - SSL/TLS encryption
   - Global CDN
   - DDoS protection

2. **AWS CloudFront**
   - S3 bucket for static assets
   - Edge locations worldwide
   - Custom cache behaviors

## Monitoring and Logging

### Application Monitoring

1. **PM2 Monitoring**
   ```bash
   pm2 monit  # Real-time monitoring
   pm2 logs   # View logs
   pm2 status # Process status
   ```

2. **Health Checks**
   - `/api/health` - Basic health check
   - `/api/ready` - Database connectivity check
   - Automatic health monitoring in containers

### Log Management

1. **Application Logs**
   ```bash
   # Log locations
   ./logs/combined.log  # All logs
   ./logs/out.log      # Standard output
   ./logs/error.log    # Error logs
   ```

2. **Nginx Logs**
   ```bash
   tail -f /var/log/nginx/access.log
   tail -f /var/log/nginx/error.log
   ```

3. **PostgreSQL Logs**
   ```bash
   tail -f /var/log/postgresql/postgresql-15-main.log
   ```

### External Monitoring Services

1. **Uptime Monitoring**
   - UptimeRobot
   - Pingdom
   - StatusCake

2. **Application Performance**
   - New Relic
   - DataDog
   - ApplicationInsights

3. **Error Tracking**
   - Sentry
   - Rollbar
   - Bugsnag

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```
   Error: connection refused
   ```
   **Solutions:**
   - Verify DATABASE_URL format
   - Check PostgreSQL service status
   - Verify firewall rules
   - Check connection limits

2. **Authentication Issues**
   ```
   Error: Unauthorized 401
   ```
   **Solutions:**
   - Verify admin user exists in database
   - Check username/password credentials
   - Validate SESSION_SECRET configuration
   - Clear browser cookies
   - Ensure bcrypt password hash is correct

3. **Build Failures**
   ```
   Error: Build failed
   ```
   **Solutions:**
   - Check Node.js version (20.x required)
   - Verify dependencies installation
   - Clear node_modules and reinstall
   - Check TypeScript compilation errors

4. **Performance Issues**
   ```
   Slow response times
   ```
   **Solutions:**
   - Check database query performance
   - Monitor memory usage
   - Verify connection pool settings
   - Enable caching strategies

### Debug Mode

Enable debug logging:
```bash
DEBUG=* npm start  # Enable all debug logs
DEBUG=app:* npm start  # App-specific logs only
```

### Log Analysis

1. **Check Application Logs**
   ```bash
   pm2 logs companyos --lines 100
   tail -f logs/error.log
   ```

2. **Monitor Resource Usage**
   ```bash
   htop
   iotop
   postgres activity monitoring
   ```

3. **Database Performance**
   ```sql
   -- Check active connections
   SELECT * FROM pg_stat_activity;
   
   -- Check slow queries
   SELECT query, mean_time, calls 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC 
   LIMIT 10;
   ```

### Support and Maintenance

1. **Regular Updates**
   ```bash
   # Update dependencies
   npm audit fix
   npm update
   
   # Database maintenance
   VACUUM ANALYZE;
   REINDEX DATABASE companyos;
   ```

2. **Backup Verification**
   ```bash
   # Test backup restoration
   pg_restore -d test_db backup.sql
   ```

3. **Security Audits**
   ```bash
   npm audit
   nmap -sV yourdomain.com
   ```

## Production Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Database created and migrated
- [ ] SSL certificates installed
- [ ] DNS records configured
- [ ] Backup strategy implemented
- [ ] Monitoring setup complete

### Post-Deployment
- [ ] Health checks passing
- [ ] Authentication working
- [ ] Database queries performing well
- [ ] SSL/HTTPS working
- [ ] Monitoring alerts configured
- [ ] Backup restoration tested
- [ ] Load testing completed

### Ongoing Maintenance
- [ ] Regular security updates
- [ ] Database backups verified
- [ ] Performance monitoring
- [ ] Log rotation configured
- [ ] SSL certificate renewal
- [ ] Dependency updates

## Scaling Considerations

### Horizontal Scaling
- Load balancer configuration
- Multiple application instances
- Database read replicas
- CDN for static assets

### Vertical Scaling
- Increase server resources
- Database optimization
- Connection pool tuning
- Memory allocation

### Microservices Migration
- Service separation strategy
- API gateway implementation
- Service mesh considerations
- Data consistency patterns

---

## Support

For deployment issues and questions:
- Check the troubleshooting section
- Review application logs
- Verify environment configuration
- Test database connectivity

Remember to always test deployments in a staging environment before production deployment.