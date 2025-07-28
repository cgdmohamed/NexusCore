# {{COMPANY_NAME}} - {{COMPANY_TAGLINE}}

<div align="center">

![{{COMPANY_NAME}} Logo](https://via.placeholder.com/200x80/0066cc/ffffff?text={{COMPANY_NAME}})

**A comprehensive internal company management system built with modern web technologies**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61dafb.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed.svg)](https://www.docker.com/)

[🚀 Quick Start](#quick-start) • [📖 Documentation](#documentation) • [🐳 Docker Deploy](#docker-deployment) • [🛠️ Development](#development) • [🔧 Support](#support)

</div>

## Overview

{{COMPANY_NAME}} is a modern, full-featured enterprise management platform designed to streamline business operations across multiple departments. Built with React, TypeScript, Express.js, and PostgreSQL, it provides a comprehensive suite of tools for CRM, project management, financial tracking, and team collaboration.

### Key Features

- **🏢 Multi-Module Dashboard** - Centralized business intelligence and KPI tracking
- **👥 Customer Relationship Management** - Complete client lifecycle management
- **💰 Financial Management** - Quotations, invoices, expenses, and payment tracking
- **📋 Task & Project Management** - Team collaboration and productivity tracking
- **👨‍💼 Human Resources** - Employee management and performance evaluation
- **📊 Analytics & Reporting** - Real-time business insights and data visualization
- **🌐 Internationalization** - Full Arabic/English support with RTL optimization
- **🔐 Secure Authentication** - Admin-only access with role-based permissions
- **📱 Responsive Design** - Mobile-first approach with modern UI components

## Quick Start

### Option 1: Docker Deployment (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd your-company-system

# Configure company branding
cp .env.docker.example .env.docker
# Edit .env.docker with your company settings:
# COMPANY_NAME=YourCompanyName
# COMPANY_TAGLINE=Your Company Tagline

# Deploy with Docker Compose
docker-compose --env-file .env.docker up -d

# Access the application
open http://localhost:5000
```

**Default Login:** `admin` / `admin123`

### Option 2: Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Configure your database and company branding:
# COMPANY_NAME=YourCompanyName
# COMPANY_TAGLINE=Your Company Tagline

# Start development server
npm run dev

# Access the application
open http://localhost:5000
```

## Company Configuration

{{COMPANY_NAME}} supports configurable company branding through environment variables:

### Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `COMPANY_NAME` | Your company's display name | `CompanyOS` | `Acme Corporation` |
| `COMPANY_TAGLINE` | Your company's tagline/description | `Enterprise Management Platform` | `Building the Future Together` |

### Configuration Examples

```bash
# Technology Company
COMPANY_NAME=TechCorp Solutions
COMPANY_TAGLINE=Innovation Through Technology

# Consulting Firm
COMPANY_NAME=Strategic Advisors
COMPANY_TAGLINE=Excellence in Business Consulting

# Manufacturing Company
COMPANY_NAME=Industrial Systems Ltd
COMPANY_TAGLINE=Quality Manufacturing Solutions
```

These settings will automatically update:
- Application title and branding
- Login page company name
- Navigation header
- All user-facing interfaces

## Technology Stack

### Frontend Architecture
- **React 18** with TypeScript for component-based UI
- **Vite** for fast development and optimized production builds
- **shadcn/ui** components built on Radix UI primitives
- **Tailwind CSS** for utility-first styling with custom theming
- **TanStack Query** for intelligent server state management
- **Wouter** for lightweight client-side routing
- **React Hook Form** with Zod validation for form handling

### Backend Architecture
- **Express.js** with TypeScript for robust API development
- **PostgreSQL** with Drizzle ORM for type-safe database operations
- **bcrypt** for secure password hashing and authentication
- **express-session** with PostgreSQL store for session management
- **Comprehensive API** with structured error handling and validation

### Infrastructure & Deployment
- **Docker** containerization with multi-stage builds
- **Nginx** reverse proxy with SSL support and load balancing
- **PostgreSQL 15** with automated backups and health monitoring
- **Redis** caching for improved performance (optional)
- **cPanel compatibility** for traditional hosting environments

## Core Business Modules

### Customer Relationship Management (CRM)
- Client profiles and contact management
- Lead tracking and conversion analytics
- Client activity history and interaction logs
- Status management and advanced filtering
- Real-time client metrics and performance dashboards

### Financial Management
- **Quotations** - Create, send, and track business proposals with PDF export
- **Invoices** - Generate invoices, track payments, manage overdue accounts
- **Expenses** - Comprehensive expense tracking with receipt management
- **Payments** - Payment source management and transaction history

### Task Management
- Task creation and assignment with priority levels
- Status tracking and progress monitoring
- Team collaboration tools and communication
- Project organization and milestone tracking
- Performance analytics and productivity insights

### Human Resources
- Employee profiles and comprehensive management
- Performance tracking and KPI monitoring
- Department organization and role management
- Role-based access control and permissions
- Employee onboarding and development tracking

### Analytics & Reporting
- Business intelligence dashboard with real-time KPIs
- Financial reports and insights with data visualization
- Performance metrics and trend analysis
- Customizable reporting and data export capabilities
- Predictive analytics and forecasting tools

### Services Catalog
- Service offerings management and organization
- Pricing and category structure
- Integration with quotation and invoice systems
- Service performance tracking and optimization

## Internationalization

{{COMPANY_NAME}} supports full bilingual operation:

- **Languages**: English and Arabic with complete translations
- **RTL Support**: Complete right-to-left layout optimization for Arabic
- **Cultural Adaptation**: Date formats, number formatting, and cultural conventions
- **Font Integration**: Tajawal font for proper Arabic typography
- **Dynamic Switching**: Real-time language switching without page reload

## Authentication & Security

- **Admin-Only Access** - Secure login system with no public registration
- **Password Security** - bcrypt hashing with salt generation
- **Session Management** - Secure server-side sessions with PostgreSQL storage
- **Role-Based Access** - Department-based permissions and access control
- **HTTPS Ready** - SSL certificate support and security headers
- **Data Protection** - Input validation and SQL injection prevention

## Production Deployment

{{COMPANY_NAME}} supports multiple deployment strategies for different environments and requirements.

### 📦 Docker Deployment (Recommended)

**Best for**: Production environments, cloud deployment, scalability

Docker provides the most reliable and scalable deployment option with automated setup and health monitoring.

#### Quick Setup

```bash
# Clone and configure
git clone <repository-url>
cd your-company-system

# Configure company branding and environment
cp .env.docker.example .env.docker
# Edit .env.docker with your settings:
# COMPANY_NAME=Your Company Name
# COMPANY_TAGLINE=Your Company Tagline

# Deploy with Docker Compose
docker-compose --env-file .env.docker up -d
```

#### Complete Docker Configuration

**Prerequisites:**
- Docker Engine 20.x or higher
- Docker Compose 2.x or higher
- 2GB+ available RAM
- 10GB+ available disk space

**Environment Variables:**
```bash
# Company Branding
COMPANY_NAME=Your Company Name
COMPANY_TAGLINE=Your Company Tagline

# Application
NODE_ENV=production
PORT=5000
DOMAIN=yourdomain.com

# Database (uses port 5433 to avoid conflicts)
DB_PASSWORD=your-secure-password
DB_PORT=5433

# Redis (uses port 6380 to avoid conflicts)
REDIS_PASSWORD=your-redis-password
REDIS_PORT=6380

# Security
SESSION_SECRET=your-super-secure-session-secret-minimum-32-characters
```

**Deployment Commands:**
```bash
# Initial deployment
docker-compose --env-file .env.docker up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f app

# Update application
git pull
docker-compose --env-file .env.docker up -d --build

# Stop services
docker-compose down

# Complete reset (removes all data)
docker-compose down -v
```

**Troubleshooting Docker Issues:**

*Port Conflicts:*
```bash
# If you get "port already in use" errors
docker-compose down
# Edit .env.docker to use different ports
DB_PORT=5434
REDIS_PORT=6381
# Then redeploy
docker-compose --env-file .env.docker up -d
```

*Build Failures:*
```bash
# Clear Docker cache and rebuild
docker system prune -f
docker-compose --env-file .env.docker up -d --build --force-recreate
```

*Database Issues:*
```bash
# Reset database
docker-compose down -v
docker-compose --env-file .env.docker up -d

# Check database connection
docker-compose exec postgres psql -U companyos_user -d companyos -c "SELECT version();"
```

**Production Hardening:**
- Change default passwords in `.env.docker`
- Use strong SESSION_SECRET (minimum 32 characters)
- Configure SSL certificates in nginx service
- Set up automated backups using the backup scripts
- Enable monitoring with health checks

### 🌐 cPanel Hosting

**Best for**: Traditional web hosting, shared hosting environments

cPanel deployment works with most hosting providers that support Node.js applications.

#### Setup Requirements

**Hosting Requirements:**
- Node.js 18.x or higher support
- PostgreSQL database access
- File manager or SSH access
- SSL certificate capability

#### Deployment Steps

**1. Prepare Files:**
```bash
# Build the application locally
npm install
npm run build

# Create deployment package
zip -r companyos-deployment.zip dist/ shared/ package.json package-lock.json
```

**2. Upload and Configure:**
```bash
# Via cPanel File Manager:
# 1. Upload companyos-deployment.zip to public_html/
# 2. Extract the zip file
# 3. Set Node.js version to 18.x in cPanel

# Create .env file with:
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
SESSION_SECRET=your-secure-session-secret
COMPANY_NAME=Your Company Name
COMPANY_TAGLINE=Your Company Tagline
```

**3. Database Setup:**
```sql
-- Create database and user in cPanel MySQL/PostgreSQL
CREATE DATABASE companyos_db;
CREATE USER companyos_user WITH PASSWORD 'secure-password';
GRANT ALL PRIVILEGES ON DATABASE companyos_db TO companyos_user;
```

**4. Application Startup:**
```bash
# In cPanel Terminal or SSH:
cd public_html
npm install --production
node dist/index.js

# For persistent running, use PM2:
npm install -g pm2
pm2 start dist/index.js --name "companyos"
pm2 save
pm2 startup
```

**cPanel Troubleshooting:**

*Node.js Version Issues:*
- Ensure Node.js 18.x is selected in cPanel
- Clear npm cache: `npm cache clean --force`
- Reinstall dependencies: `rm -rf node_modules && npm install`

*Database Connection Issues:*
- Verify DATABASE_URL format
- Check database user permissions
- Ensure PostgreSQL is enabled in cPanel

*Port Configuration:*
- Use the port provided by hosting provider
- Update PORT environment variable accordingly

### ☁️ Cloud Platform Deployment

**Best for**: Heroku, DigitalOcean, AWS, Google Cloud

#### Heroku Deployment

```bash
# Install Heroku CLI and login
heroku login

# Create application
heroku create your-company-app

# Configure environment variables
heroku config:set NODE_ENV=production
heroku config:set SESSION_SECRET=your-secure-session-secret
heroku config:set COMPANY_NAME="Your Company Name"
heroku config:set COMPANY_TAGLINE="Your Company Tagline"

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Deploy
git push heroku main

# Run initial setup
heroku run npm run db:push
```

#### DigitalOcean App Platform

```yaml
# .do/app.yaml
name: companyos
services:
- name: web
  source_dir: /
  github:
    repo: your-username/your-repo
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: COMPANY_NAME
    value: Your Company Name
  - key: COMPANY_TAGLINE
    value: Your Company Tagline
databases:
- name: companyos-db
  engine: PG
  version: "15"
```

### 🖥️ Traditional Server Deployment

**Best for**: VPS, dedicated servers, on-premises installations

#### Ubuntu/Debian Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Create database and user
sudo -u postgres psql
CREATE DATABASE companyos;
CREATE USER companyos_user WITH PASSWORD 'secure-password';
GRANT ALL PRIVILEGES ON DATABASE companyos TO companyos_user;
\q

# Clone and setup application
git clone <repository-url>
cd your-company-system
npm install --production

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Build application
npm run build

# Setup PM2 for process management
npm install -g pm2
pm2 start dist/index.js --name "companyos"
pm2 save
pm2 startup

# Setup Nginx reverse proxy
sudo apt install nginx -y
```

**Nginx Configuration (`/etc/nginx/sites-available/companyos`):**
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL Certificate Setup

**For Docker (Let's Encrypt):**
```bash
# Add to docker-compose.yml
certbot:
  image: certbot/certbot
  volumes:
    - ./certbot/conf:/etc/letsencrypt
    - ./certbot/www:/var/www/certbot
  command: certonly --webroot -w /var/www/certbot --email admin@yourdomain.com -d yourdomain.com --agree-tos
```

**For Traditional Server:**
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Production Checklist

**Before Deployment:**
- [ ] Change default admin password
- [ ] Configure strong SESSION_SECRET
- [ ] Set proper COMPANY_NAME and COMPANY_TAGLINE
- [ ] Configure DATABASE_URL for production database
- [ ] Set NODE_ENV=production
- [ ] Configure SSL certificates
- [ ] Set up automated backups
- [ ] Configure monitoring and health checks
- [ ] Test all functionality in staging environment

**After Deployment:**
- [ ] Verify application loads correctly
- [ ] Test login functionality
- [ ] Check database connections
- [ ] Verify all modules work (CRM, Invoices, Tasks, etc.)
- [ ] Test company branding display
- [ ] Confirm SSL certificate is working
- [ ] Set up monitoring alerts
- [ ] Document access credentials securely

### Support and Troubleshooting

**Common Issues:**

*Application Won't Start:*
- Check environment variables are set correctly
- Verify database connection string
- Ensure proper Node.js version (18.x+)
- Check port conflicts

*Database Connection Errors:*
- Verify DATABASE_URL format
- Check database user permissions
- Ensure PostgreSQL is running and accessible

*Build Failures:*
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check Node.js and npm versions
- Verify all dependencies are available

*Authentication Issues:*
- Verify SESSION_SECRET is set
- Check admin user exists in database
- Ensure proper session configuration

**Getting Help:**
For deployment issues, check the logs first:
- Docker: `docker-compose logs -f app`
- PM2: `pm2 logs companyos`
- System: `journalctl -u your-service-name`

**Performance Monitoring:**
- Use health check endpoint: `/api/health`
- Monitor database performance
- Set up automated backups
- Configure log rotation

## Default Credentials

**Admin Login:**
- Username: `admin`
- Password: `admin123`
- Email: `admin@company.com`

⚠️ **Important:** Change these credentials immediately after deployment for security.

## Development

### Prerequisites
- Node.js 18.x or higher
- PostgreSQL 13.x or higher
- Git for version control

### Development Setup

```bash
# Clone and setup
git clone <repository-url>
cd your-company-system
npm install

# Environment configuration
cp .env.example .env
# Configure DATABASE_URL, SESSION_SECRET, and company branding

# Database setup
npm run db:push

# Start development server
npm run dev
```

### Available Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server
npm run db:push      # Push database schema changes
npm run db:studio    # Open database studio interface
npm run type-check   # Run TypeScript type checking
npm run lint         # Run ESLint code analysis
```

### Development Workflow

1. **Feature Development** - Create feature branches for new functionality
2. **Database Changes** - Update `shared/schema.ts` for data model changes
3. **API Development** - Add new endpoints in `server/routes.ts`
4. **Frontend Components** - Create reusable components in `client/src/components`
5. **Testing** - Test all functionality before deployment
6. **Documentation** - Update documentation for new features

## API Documentation

### Core Endpoints

```bash
# Authentication
POST /api/login                    # Admin login
POST /api/logout                   # User logout
GET  /api/user                     # Get current user

# Configuration
GET  /api/config                   # Get company configuration

# Business Modules
GET  /api/clients                  # Client management
GET  /api/quotations              # Quotation system
GET  /api/invoices                # Invoice management
GET  /api/expenses                # Expense tracking
GET  /api/tasks                   # Task management
GET  /api/users                   # User management

# System
GET  /api/health                  # Health check
GET  /api/ready                   # Readiness check
```

### Request/Response Format

All API responses follow a consistent structure:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

Error responses include detailed information:

```json
{
  "success": false,
  "error": "Detailed error message",
  "code": "ERROR_CODE"
}
```

## Performance & Optimization

- **Frontend Optimization** - Code splitting, lazy loading, and bundle optimization
- **Database Optimization** - Indexed queries, connection pooling, and caching
- **API Efficiency** - Response compression, rate limiting, and caching headers
- **Resource Management** - Optimized images, fonts, and static assets
- **Monitoring** - Built-in health checks and performance metrics

## Security Features

- **Authentication Security** - bcrypt password hashing and secure sessions
- **Data Protection** - Input validation and sanitization
- **API Security** - Rate limiting and request validation
- **Database Security** - Parameterized queries and access controls
- **Infrastructure Security** - HTTPS enforcement and security headers

## Documentation

All deployment and configuration information is included in this README. For additional technical details:

- **[Technology Stack](./TECH_STACK.md)** - Detailed technical overview and architecture
- **Production Deployment** - Complete deployment guide included above
- **Company Configuration** - Environment variable setup and customization options
- **Troubleshooting** - Common issues and solutions included in deployment sections

## Support

### Quick Troubleshooting

1. **Application Won't Start**: Check environment variables and database connection
2. **Authentication Issues**: Verify admin credentials and session configuration
3. **Database Errors**: Ensure PostgreSQL is running and accessible
4. **Build Failures**: Clear `node_modules` and reinstall dependencies

### Getting Help

- **Documentation**: Check the relevant deployment guide for your platform
- **Configuration**: Review environment variable setup
- **Database**: Verify PostgreSQL connection and schema
- **Performance**: Monitor system resources and database performance

### Development Support

For development questions and feature requests:
1. Check existing documentation
2. Review the technology stack guide
3. Examine the production checklist
4. Consult the deployment guides

---

**{{COMPANY_NAME}}** - Professional business management for the modern enterprise.

*Built with modern web technologies for reliability, scalability, and performance.*