# CompanyOS - Enterprise Management Platform

<div align="center">

![CompanyOS Logo](https://via.placeholder.com/200x80/0066cc/ffffff?text=CompanyOS)

**A comprehensive internal company management system built with modern web technologies**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61dafb.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed.svg)](https://www.docker.com/)

[🚀 Quick Start](#quick-start) • [📖 Documentation](#documentation) • [🐳 Docker Deploy](#docker-deployment) • [🛠️ Development](#development) • [🔧 Support](#support)

</div>

## Overview

CompanyOS is a modern, full-featured enterprise management platform designed to streamline business operations across multiple departments. Built with React, TypeScript, Express.js, and PostgreSQL, it provides a comprehensive suite of tools for CRM, project management, financial tracking, and team collaboration.

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
cd companyos

# Configure environment
cp .env.docker.example .env.docker
# Edit .env.docker with your settings

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
# Configure your database and session secret

# Start development server
npm run dev

# Access the application
open http://localhost:5000
```

## Architecture

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Tailwind CSS + shadcn/ui components
- TanStack Query for state management
- Wouter for routing
- React Hook Form with Zod validation

**Backend:**
- Express.js with TypeScript
- Drizzle ORM with PostgreSQL
- Bcrypt authentication
- Express sessions

**Infrastructure:**
- Docker containerization
- Nginx reverse proxy
- PostgreSQL 15 database
- Redis caching (optional)

### Project Structure

```
companyos/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Application pages
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities and configurations
├── server/                 # Express.js backend
│   ├── routes.ts           # API route definitions
│   ├── auth.ts             # Authentication logic
│   └── storage.ts          # Database operations
├── shared/                 # Shared TypeScript schemas
├── nginx/                  # Nginx configuration
├── scripts/                # Deployment and utility scripts
└── docs/                   # Documentation files
```

## Documentation

### Deployment Guides

- **[🐳 Docker Deployment](./DOCKER_DEPLOYMENT.md)** - Complete containerized deployment guide
- **[🌐 cPanel Hosting](./CPANEL_DEPLOYMENT.md)** - Shared hosting deployment instructions
- **[🚀 General Deployment](./DEPLOYMENT.md)** - Comprehensive deployment options
- **[⚙️ Technical Stack](./TECH_STACK.md)** - Detailed technology overview

### Development Guides

- **[📋 Production Checklist](./PRODUCTION_CHECKLIST.md)** - Pre-deployment verification
- **[🏗️ Project Architecture](./replit.md)** - System design and preferences

## Docker Deployment

### Production Environment

```bash
# Quick production deployment
cp .env.docker.example .env.docker
docker-compose --env-file .env.docker up -d
```

### Development Environment

```bash
# Development with hot reload
docker-compose -f docker-compose.dev.yml up -d

# Access services
# - Application: http://localhost:5000
# - Dev Server: http://localhost:5173
# - Database Admin: http://localhost:8080 (with --profile with-adminer)
```

### Available Docker Services

| Service | Description | Ports |
|---------|-------------|-------|
| **app** | CompanyOS application | 5000 |
| **postgres** | PostgreSQL database | 5432 |
| **redis** | Redis cache (optional) | 6379 |
| **nginx** | Reverse proxy (optional) | 80, 443 |
| **adminer** | Database admin (dev only) | 8080 |

## Development

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- npm or yarn

### Setup

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd companyos
   npm install
   ```

2. **Database Setup**
   ```bash
   # Create database
   createdb companyos

   # Run migrations
   npm run db:push
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and session secret
   ```

4. **Start Development**
   ```bash
   npm run dev
   ```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run db:push` | Push database schema |
| `npm run db:studio` | Open database studio |
| `npm start` | Start production server |

### Development Features

- **Hot Reload** - Automatic server and client restart
- **TypeScript** - Full type safety across the stack
- **Database Tools** - Drizzle Studio for database management
- **API Testing** - Built-in health checks and endpoints
- **Code Quality** - ESLint and Prettier configuration

## Features & Modules

### Dashboard
- Real-time KPI cards and metrics
- Recent activity feed
- Quick action shortcuts
- Team performance overview

### Customer Relationship Management (CRM)
- Client profiles and contact management
- Lead tracking and conversion
- Client activity history
- Status management and filtering

### Financial Management
- **Quotations** - Create, send, and track business proposals
- **Invoices** - Generate invoices, track payments, manage overdue accounts
- **Expenses** - Expense tracking with receipt management
- **Payments** - Payment source management and transaction history

### Task Management
- Task creation and assignment
- Priority and status tracking
- Team collaboration tools
- Progress monitoring

### Human Resources
- Employee profiles and management
- Performance tracking and KPIs
- Department organization
- Role-based access control

### Analytics & Reporting
- Business intelligence dashboard
- Financial reports and insights
- Performance metrics
- Data export capabilities

### Services Catalog
- Service offerings management
- Pricing and category organization
- Integration with quotation system

## Internationalization

CompanyOS supports full bilingual operation:

- **Languages**: English and Arabic
- **RTL Support**: Complete right-to-left layout optimization
- **Font Integration**: Tajawal font for proper Arabic rendering
- **UI Translation**: All interface elements translated
- **Business Terms**: Industry-specific terminology support

## Security Features

- **Admin-Only Access** - No user registration, admin-controlled access
- **Secure Authentication** - bcrypt password hashing
- **Session Management** - Express sessions with PostgreSQL storage
- **Role-Based Access** - Department and role-based permissions
- **Input Validation** - Zod schema validation throughout
- **HTTPS Support** - SSL/TLS configuration ready

## API Documentation

### Authentication Endpoints

- `POST /api/login` - Admin authentication
- `POST /api/logout` - Session termination
- `GET /api/user` - Current user information

### Core API Routes

- `/api/clients` - Customer management
- `/api/quotations` - Business proposals
- `/api/invoices` - Billing and payments
- `/api/expenses` - Expense tracking
- `/api/tasks` - Task management
- `/api/users` - User management
- `/api/services` - Service catalog
- `/api/analytics` - Business intelligence

### Health & Monitoring

- `GET /api/health` - Application health check
- Built-in logging and error tracking
- Database connection monitoring

## Deployment Options

### 1. Docker (Recommended)
- **Production**: Multi-stage builds with security hardening
- **Development**: Hot reload with debugging tools
- **Scaling**: Load balancer ready with health checks

### 2. cPanel Hosting
- **Shared Hosting**: Compatible with most cPanel providers
- **Node.js Support**: Requires Node.js 18+ capability
- **Database**: PostgreSQL or MySQL support

### 3. Cloud Platforms
- **VPS/Dedicated**: Full control deployment
- **Container Services**: Docker-ready for cloud deployment
- **Managed Databases**: External PostgreSQL support

### 4. Traditional Servers
- **Linux/Unix**: Standard deployment on any server
- **Process Management**: PM2 or systemd integration
- **Reverse Proxy**: Nginx/Apache configuration included

## Environment Variables

### Required Configuration

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Security
SESSION_SECRET=your-super-secure-session-secret-32chars+

# Application
NODE_ENV=production
PORT=5000
```

### Optional Configuration

```bash
# Redis (for session storage)
REDIS_URL=redis://localhost:6379

# Monitoring
SENTRY_DSN=https://your-sentry-dsn

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@company.com
SMTP_PASS=your-app-password
```

## Performance & Optimization

### Built-in Optimizations
- **Caching**: Redis integration for session and data caching
- **Database**: Optimized queries with proper indexing
- **Assets**: Gzip compression and static file optimization
- **Monitoring**: Health checks and performance metrics

### Scaling Considerations
- **Horizontal Scaling**: Load balancer ready
- **Database**: Connection pooling and optimization
- **Caching**: Redis for distributed caching
- **CDN**: Static asset optimization ready

## Backup & Maintenance

### Automated Backups
```bash
# Database backup
npm run backup:db

# Full application backup
npm run backup:full
```

### Update Procedures
1. Backup current data
2. Deploy new version
3. Run database migrations
4. Verify functionality

### Monitoring
- Application health checks
- Database performance monitoring
- Error tracking and logging
- User activity monitoring

## Support

### Getting Help

1. **Documentation**: Check the comprehensive guides in `/docs`
2. **Issues**: Review common problems in troubleshooting guides
3. **Community**: Join our discussion forums
4. **Enterprise**: Contact support for enterprise assistance

### Troubleshooting

- **[🔧 Common Issues](./DEPLOYMENT.md#troubleshooting)** - Deployment problems
- **[🐳 Docker Issues](./DOCKER_DEPLOYMENT.md#troubleshooting)** - Container problems
- **[🌐 cPanel Issues](./CPANEL_DEPLOYMENT.md#troubleshooting)** - Hosting problems

### Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with modern web technologies
- Inspired by Salesforce and Monday.com design principles
- Optimized for business productivity and user experience
- Designed for scalability and maintainability

---

<div align="center">

**[🚀 Get Started](#quick-start)** • **[📖 Full Documentation](./DEPLOYMENT.md)** • **[🐳 Docker Guide](./DOCKER_DEPLOYMENT.md)**

Made with ❤️ for modern businesses

</div>