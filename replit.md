# CompanyOS - Company Management System

## Overview
CompanyOS is a comprehensive internal company management system designed to streamline business operations. Built with React for the frontend and Express.js for the backend, it offers modules for CRM, quotations, invoices, expenses, employee management, tasks, and analytics. The system features a modern, responsive UI developed with shadcn/ui and Tailwind CSS, supporting full internationalization (English/Arabic). Its purpose is to provide a robust, all-in-one solution for managing various aspects of a company's day-to-day operations, enhancing efficiency and providing valuable insights.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Framework**: React 18 with TypeScript.
- **Styling**: Tailwind CSS with custom CSS variables for theming, ensuring a modern and consistent look.
- **Component Library**: shadcn/ui components built on Radix UI primitives for accessibility and high quality.
- **Internationalization**: Full Arabic/English support with RTL layout for global usability.
- **Responsiveness**: Mobile-first approach with adaptive layouts.

### Technical Implementations
- **Frontend Build**: Vite for fast development and optimized production builds.
- **State Management**: TanStack Query (React Query) for efficient server state management, caching, and optimistic updates.
- **Routing**: Wouter for lightweight client-side routing.
- **Forms**: React Hook Form with Zod for robust form validation.
- **Backend Framework**: Express.js with TypeScript for a scalable and maintainable API.
- **Database ORM**: Drizzle ORM with a TypeScript-first approach for PostgreSQL.
- **Authentication**: OpenID Connect (OIDC) with Replit authentication, including session management via `express-session` and a PostgreSQL store.
- **API Design**: RESTful API with structured error handling and full CRUD operations across all modules. Standardized apiRequest pattern for all mutations.
- **Security**: Production-ready security infrastructure with:
  - PostgreSQL-backed session storage (connect-pg-simple) replacing in-memory store
  - Environment-based SESSION_SECRET (required, no fallback)
  - Full CSRF protection using csrf-sync on all POST/PATCH/DELETE/PUT routes
  - Frontend automatic CSRF token management (fetch on login, clear on logout)
  - Role-based access control with department-level permissions
  - HTTP-only cookies with SameSite protection
  - Authenticated-only API access with proper 401 handling
- **Date Handling**: Centralized date utilities for consistent and error-free date formatting.
- **Notification System**: Optimized polling system that only queries when user is authenticated, with 30-second intervals to prevent server flooding.

### Feature Specifications
- **Authentication System**: Replit OIDC integration, PostgreSQL-backed sessions, role-based access with departments, HTTP-only cookies, CSRF protection. Admin-only login.
- **Database Schema**: Comprehensive schema covering Users (role-based), Clients, Quotations, Invoices, Expenses, Tasks, and Activities.
- **Modules**:
    - **Dashboard**: KPI cards, recent activities, quick actions, team performance.
    - **CRM**: Client management with filtering, search, and activity tracking.
    - **Quotations**: Creation, management, status workflow, PDF export, and conversion to invoices.
    - **Invoices**: Generation, payment tracking, overpayment prevention, and client credit balance management.
    - **Expenses**: Logging, approval workflow, file uploads, categorization, and integration with payment sources.
    - **Employees**: HR management, employee records, and KPI tracking.
    - **Tasks**: Assignment, progress tracking, and status management.
    - **Analytics**: Business intelligence and reporting, including real-time KPI performance tracking.
    - **Services & Offerings**: Catalog management with CRUD operations and integration with quotations.
    - **Notifications**: Real-time system notifications with unread counts and historical views.
- **System Logging**: Three-tier logging architecture (error, app, api) with structured JSON format for comprehensive error and performance tracking.

## External Dependencies

### Frontend
- **UI Components**: Radix UI primitives.
- **Styling**: Tailwind CSS.
- **Date Handling**: date-fns (managed via internal `dateUtils`).
- **Icons**: Lucide React.
- **Routing**: Wouter.

### Backend
- **Database**: @neondatabase/serverless (for PostgreSQL).
- **ORM**: drizzle-orm with drizzle-kit.
- **Authentication**: openid-client, express-session, connect-pg-simple.
- **Validation**: Zod.
- **Password Hashing**: bcrypt.
- **CSRF Protection**: csrf-sync.

### Development & Deployment
- **TypeScript**: For full type safety.
- **Build Tools**: Vite (frontend), ESBuild (backend).
- **Docker**: Multi-stage Dockerfile and docker-compose for development and production environments.
- **Nginx**: For reverse proxying, SSL, and static file serving in production.
- **PM2**: For Node.js process management in production.

## Recent Changes (November 2025)

### Security Infrastructure Overhaul
**Critical security fixes implemented for production readiness:**

1. **Session Management**
   - Migrated from in-memory session store to PostgreSQL-backed sessions using connect-pg-simple
   - Ensures sessions persist across server restarts and support horizontal scaling
   - Session data stored in `session` table in PostgreSQL database
   - Configurable session TTL via environment variables

2. **Environment Security**
   - Removed hardcoded SESSION_SECRET fallback - now requires environment variable
   - Created comprehensive `.env.example` with all required production variables
   - Documentation for generating cryptographically secure secrets
   - Proper separation of development and production configurations

3. **CSRF Protection**
   - Implemented full CSRF protection using csrf-sync library
   - Backend: Global middleware protecting all POST/PATCH/DELETE/PUT routes
   - Frontend: Automatic CSRF token fetching, caching, and header injection
   - Login/registration endpoints exempt (pre-middleware registration)
   - Logout endpoint protected to prevent forced logout attacks
   - Token endpoint at `/api/csrf-token` for frontend consumption

4. **Authentication Flood Prevention**
   - Fixed notification polling that flooded server with 401 errors for unauthenticated users
   - Notification system now only polls when user is authenticated
   - Optimized polling intervals to 30 seconds (down from aggressive intervals)
   - Proper authentication guards on all dashboard API endpoints

5. **Code Cleanup**
   - Removed duplicate API system files (api.ts, smartApi.ts, useSmartQuery.ts)
   - Standardized on single apiRequest pattern from queryClient.ts
   - Eliminated conflicting API patterns causing maintenance issues

### Production Deployment Checklist
Before deploying to production, ensure:

1. **Environment Variables Set:**
   - `SESSION_SECRET` - Cryptographically secure random string (min 32 chars)
   - `DATABASE_URL` - PostgreSQL connection string
   - `NODE_ENV=production`
   - `PORT` - Server port (default: 5000)

2. **Database:**
   - Run database migrations: `npm run db:push`
   - Verify session table exists and is accessible
   - Ensure PostgreSQL connection is stable and production-ready

3. **Security Verification:**
   - Test CSRF protection on mutating endpoints
   - Verify session persistence across server restarts
   - Confirm authentication flow works end-to-end
   - Check that unauthenticated users cannot access protected resources

4. **Performance:**
   - Monitor notification polling intervals
   - Check for any authentication-related error floods
   - Verify database connection pooling is configured

### Known Limitations
- CSRF token cached in memory (cleared on page refresh, requires re-login)
- Session table grows over time (configure cleanup job for expired sessions)
- Notification polling is client-side (consider WebSockets for real-time updates)