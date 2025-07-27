# CompanyOS - Production Ready

CompanyOS is a comprehensive internal company management system featuring CRM, quotations, invoices, expenses, HR management, task tracking, and analytics capabilities.

## Production Features

✅ **Admin-Only Authentication** - Secure login system with bcrypt password hashing  
✅ **Multi-Language Support** - Full Arabic/English internationalization with RTL layout  
✅ **PostgreSQL Database** - Production-ready database with proper schema and relations  
✅ **Comprehensive Modules** - Complete business management functionality  
✅ **Clean Codebase** - No debug code, mock data, or development bypasses  
✅ **cPanel Compatible** - Ready for Node.js hosting deployment  

## Default Admin Credentials

- **Username:** admin
- **Password:** admin123
- **Email:** admin@company.com

⚠️ **Important:** Change these credentials immediately after deployment.

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and session secret
   ```

3. **Database Setup**
   ```bash
   npm run db:push
   ```

4. **Start Application**
   ```bash
   npm run dev
   ```

## Deployment

For detailed production deployment instructions, see [CPANEL_DEPLOYMENT.md](./CPANEL_DEPLOYMENT.md).

## System Modules

### Core Business Management
- **Dashboard** - KPI tracking and business overview
- **Clients** - Customer relationship management
- **Quotations** - Business proposal system with PDF export
- **Invoices** - Billing and payment tracking
- **Payments** - Payment source management and transaction tracking
- **Expenses** - Company expense logging and approval workflow

### Team & Operations
- **Tasks** - Team task assignment and progress tracking  
- **Team & Roles** - Employee management and role-based permissions
- **Reports & KPIs** - Business intelligence and performance analytics

### System Features
- **Notifications** - Real-time system notifications
- **Internationalization** - Arabic/English language support
- **Role-Based Access** - Department and permission-based security
- **Audit Logging** - Complete activity tracking and audit trails

## Security Features

- Admin-only authentication (no user registration)
- bcrypt password hashing with salt
- Express session management
- HTTPS ready configuration
- Role-based access control
- Input validation and sanitization

## Performance Optimizations

- Production-ready Express server configuration
- Optimized database queries with proper indexing
- Static file serving configuration
- Caching headers for assets
- Memory-efficient session storage

## Architecture

### Frontend
- **React 18** with TypeScript
- **Vite** build system
- **Tailwind CSS** + **shadcn/ui** components
- **TanStack Query** for server state management
- **Wouter** for routing

### Backend  
- **Express.js** with TypeScript
- **PostgreSQL** with Drizzle ORM
- **bcrypt** for password hashing
- **express-session** for session management

## Support

For deployment issues, see the troubleshooting section in [CPANEL_DEPLOYMENT.md](./CPANEL_DEPLOYMENT.md).

---

**CompanyOS** - Professional business management made simple.