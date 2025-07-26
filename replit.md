# CompanyOS - Company Management System

## Overview

CompanyOS is a comprehensive internal company management system built with React (frontend) and Express.js (backend). The application provides modules for CRM, quotations, invoices, expenses, employee management, tasks, and analytics. It features a modern UI built with shadcn/ui components and Tailwind CSS, with full internationalization support (English/Arabic).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for development and production builds
- **UI Library**: shadcn/ui components based on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: OpenID Connect (OIDC) with Replit authentication
- **Session Management**: express-session with PostgreSQL store
- **API Design**: RESTful API with structured error handling

### Database Architecture
- **ORM**: Drizzle ORM with TypeScript-first approach
- **Database**: PostgreSQL (configured for Neon serverless)
- **Schema Location**: `shared/schema.ts` for type sharing between frontend and backend
- **Migrations**: Handled via drizzle-kit

## Key Components

### Authentication System
- **Provider**: Replit OIDC integration
- **Session Storage**: PostgreSQL-backed sessions with connect-pg-simple
- **User Management**: Role-based access with departments and permissions
- **Security**: HTTP-only cookies, CSRF protection

### Database Schema
- **Users**: Role-based system with departments (operations, finance, hr, sales, management)
- **Clients**: Customer relationship management
- **Quotations**: Business proposal system
- **Invoices**: Billing and payment tracking
- **Expenses**: Company expense logging
- **Tasks**: Team task management
- **Activities**: System activity logging

### Frontend Modules
- **Dashboard**: KPI cards, recent activities, quick actions, team performance
- **CRM**: Client management with contact details and status tracking
- **Quotations**: Create and manage client quotations
- **Invoices**: Invoice generation and payment tracking
- **Expenses**: Expense logging and approval workflow
- **Employees**: HR management and employee records
- **Tasks**: Task assignment and progress tracking
- **Analytics**: Business intelligence and reporting

### UI/UX Features
- **Internationalization**: Full Arabic/English support with RTL layout
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Theme System**: CSS custom properties for consistent theming
- **Component Library**: Comprehensive shadcn/ui component set
- **Real-time Updates**: React Query for optimistic updates and caching

## Data Flow

### Authentication Flow
1. User accesses protected route
2. Express middleware checks session
3. Replit OIDC handles authentication
4. Session stored in PostgreSQL
5. User data cached in React Query

### API Request Flow
1. Frontend makes API request with credentials
2. Express middleware validates session
3. Business logic processes request
4. Drizzle ORM handles database operations
5. Response returned with proper error handling

### Data Fetching
- **Server State**: TanStack Query for API data management
- **Optimistic Updates**: Immediate UI updates with rollback capability
- **Caching Strategy**: Infinite stale time with manual invalidation
- **Error Handling**: Centralized error handling with toast notifications

## External Dependencies

### Frontend Dependencies
- **UI Components**: Radix UI primitives for accessibility
- **Styling**: Tailwind CSS with PostCSS processing
- **Date Handling**: date-fns for date manipulation
- **Icons**: Lucide React for consistent iconography
- **Routing**: Wouter for lightweight routing

### Backend Dependencies
- **Database**: @neondatabase/serverless for PostgreSQL connection
- **ORM**: drizzle-orm with drizzle-kit for schema management
- **Authentication**: openid-client for OIDC integration
- **Session**: express-session with connect-pg-simple store
- **Validation**: Zod for runtime type validation

### Development Tools
- **TypeScript**: Full type safety across the stack
- **ESBuild**: Fast production builds for server code
- **Vite**: Development server with HMR
- **Replit Integration**: Development environment optimization

## Deployment Strategy

### Development Environment
- **Server**: tsx for TypeScript execution with hot reload
- **Client**: Vite dev server with HMR
- **Database**: Environment variable configuration
- **Authentication**: Replit OIDC integration

### Production Build
- **Frontend**: Vite builds to `dist/public` directory
- **Backend**: ESBuild bundles server code to `dist/index.js`
- **Static Files**: Express serves built frontend from `/dist/public`
- **Environment**: NODE_ENV=production configuration

### Database Management
- **Schema**: Shared TypeScript definitions in `shared/schema.ts`
- **Migrations**: `drizzle-kit push` for schema deployment
- **Connection**: Pool-based connection with environment configuration
- **Sessions**: Automatic session table management

### Environment Configuration
- **Required Variables**: DATABASE_URL, SESSION_SECRET, REPL_ID
- **Optional Variables**: ISSUER_URL for custom OIDC provider
- **Security**: HTTP-only cookies, secure session configuration

## Recent Changes

### January 26, 2025 - Complete Quotation System Integration & Enhanced List Views
- **Advanced CRM Client List Interface**: Professional client relationship management interface with real-time statistics, comprehensive filtering by status, multi-field search, sortable columns, and dual view modes (table/cards)
- **CRM Statistics Dashboard**: Live KPI cards showing total clients, status breakdowns (Active/Lead/Inactive), total client value, and average client value with visual icons
- **Enhanced Client Business Intelligence**: Integration with quotations and invoices data to show client activity metrics and relationship history
- **Comprehensive Invoices Module Implementation**: Complete invoicing system with extended database schema supporting invoice items, payment records, and enhanced tracking functionality
- **Advanced Invoice List Interface**: Professional invoice management dashboard with real-time KPI cards, comprehensive filtering, sorting, and dual view modes
- **Invoice Financial Dashboard**: Live statistics showing total invoices, payment status breakdowns (Paid/Partial/Overdue), total amounts, and outstanding balances
- **Enhanced Payment Tracking**: Visual payment progress bars, overdue indicators, and comprehensive payment status management
- **Complete Invoice API Suite**: Full CRUD operations for invoices, invoice items, and payment records with automatic status updates and calculation handling
- **Advanced Quotations List Interface**: Completely redesigned quotations list with professional dashboard-style layout featuring statistics cards, advanced filtering, sorting, and dual view modes
- **Real-time Statistics Dashboard**: Live KPI cards showing total quotations, status breakdowns (Draft/Sent/Accepted), total value, and average quotation value with color-coded icons
- **Powerful Search & Filter System**: Multi-criteria search by title, quotation number, or client name with status filtering and advanced sorting options (by date, amount, title, status)
- **Dual View Modes**: Toggle between detailed table view with sortable columns and card view for better visual browsing experience
- **Enhanced Table Features**: Clickable column headers for sorting, hover effects, status icons, client name resolution, and improved date formatting
- **Professional Card Layout**: Elegant card view showing key quotation information with quick action buttons and status indicators
- **Interactive UI Elements**: Responsive design with loading states, empty states, and filtered results counter
- **Enhanced Quotation Creation Form**: Updated form to work with enhanced quotation system, including notes, terms, and automatic navigation to detail page
- **Fixed Backend Route Conflicts**: Resolved duplicate quotation creation routes causing database insertion failures
- **Corrected Amount Field Handling**: Fixed amount field initialization (set to 0) for quotations that start empty and calculate totals from added items
- **API Request Parameter Order Fix**: Corrected all apiRequest calls to use proper parameter order (method, URL, data)
- **Complete Quotation Workflow**: Full end-to-end quotation creation working from form submission through item addition to PDF export and invoice conversion
- **Enhanced Database Integration**: All quotation CRUD operations now working with real PostgreSQL database instead of mock data
- **Professional Form Design**: Expanded dialog width and improved field organization for better user experience
- **Status Workflow Management**: Complete quotation lifecycle from Draft → Sent → Accepted → Rejected → Invoiced with manual status controls
- **Quotation-to-Invoice Conversion**: Automatic invoice generation from accepted quotations with full data transfer and relationship tracking
- **Professional PDF Export**: Clean, branded quotation documents with company information, client details, itemized services, and terms
- **Admin Quotation Management Dashboard**: Comprehensive overview with statistics, status distribution, and bulk management capabilities
- **Enhanced Client Profiles**: Integrated quotation history, invoice relationships, and activity tracking with cross-module navigation
- **Predefined Services System**: Service catalog with default pricing for quick quotation item creation

### January 26, 2025 - Advanced Overpayment System & Invoice Interface Refinements
- **Comprehensive Overpayment Prevention System**: Advanced payment validation with automatic overpayment detection and admin override capabilities for authorized transactions
- **Client Credit Balance Management**: Full credit tracking system with audit trails, credit application to future invoices, and transparent financial management
- **Enhanced Invoice Detail Interface**: Fixed React hooks rendering errors, added credit balance display, and comprehensive payment management functionality
- **Streamlined Invoice List Interface**: Removed status update buttons from invoice list for cleaner, more focused invoice management experience
- **Credit Balance Integration**: Real-time credit balance display in CRM and invoice detail pages with application capabilities for outstanding invoices

### January 26, 2025 - Complete Expenses Module CRUD Implementation
- **Full Expenses CRUD Operations**: Implemented comprehensive Create, Read, Update, Delete functionality for expense management
- **Enhanced Expense Creation**: Create dialog with comprehensive form validation, mandatory receipt upload, and file type/size validation
- **Detailed Expense View**: Complete expense detail page showing all metadata, attachments, and quick action buttons
- **Expense Edit Functionality**: Full edit capability with pre-populated forms and proper navigation breadcrumbs
- **Delete with Confirmation**: Safe expense deletion with confirmation dialogs and proper error handling
- **Advanced Form Validation**: Required fields enforcement (title, amount, category, date, receipt) with user-friendly error messages
- **File Upload System**: Mandatory receipt attachment with support for multiple file types and size validation
- **Expense Categorization**: Full category system with color-coded badges and filtering capabilities
- **Payment Method Support**: Comprehensive payment method selection with visual icons and validation
- **Recurring Expense Options**: Support for recurring expense tracking with proper indicators
- **Professional UI Integration**: Consistent design matching other modules with responsive layouts and proper navigation
- **Route Integration**: Complete routing setup for /expenses, /expenses/:id, and /expenses/:id/edit with proper breadcrumb navigation