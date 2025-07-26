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

### January 26, 2025 - Complete KPI Performance Tracking System Implementation
- **Flexible KPI Management System**: Comprehensive employee performance tracking with custom KPI definitions per employee role
- **Database Architecture**: Extended schema with employee_kpis table, kpi_status enum, and full relational integrity
- **Complete CRUD API**: Full REST API implementation for KPI management with filtering, statistics, and period-based queries
- **Advanced KPI Dashboard**: Professional interface with real-time statistics cards showing total KPIs, status breakdowns, and performance metrics
- **Comprehensive KPI Form**: Flexible form system supporting custom titles, descriptions, target/actual values, evaluation periods, status tracking, and detailed notes
- **Visual Progress Tracking**: Progress bars, status indicators, and color-coded badges for immediate performance assessment
- **Multi-Criteria Filtering**: Advanced filtering by evaluation period, status, and search functionality across KPI titles and descriptions
- **Data Export Capabilities**: CSV export functionality with complete KPI data including metadata and performance metrics
- **Employee Profile Integration**: Full employee profile pages with tabbed interface showing performance data, profile details, and employment history
- **Manual Entry System**: Flexible system supporting all employee types (developers, designers, marketers, secretaries, freelancers) with customizable KPI definitions
- **Professional UI Components**: Complete shadcn/ui integration with Progress, AlertDialog, Dialog, and Tabs components
- **Routing Integration**: Full navigation system with /employees/:id routes and proper breadcrumb navigation from User Management module
- **Code Cleanup**: Removed redundant /employees routes and sidebar navigation since all employee functionality is now consolidated in User Management module

### January 26, 2025 - Enhanced Task Management Module Implementation
- **Database Schema Synchronization**: Fixed task management database schema to match actual PostgreSQL structure, resolving column mismatch errors
- **Working CRUD Operations**: Implemented functional task creation, reading, and status updates with proper API endpoints
- **Simplified Task Structure**: Streamlined task model with essential fields (title, description, priority, status, due date, assignment) for immediate usability
- **Professional UI Interface**: Complete task management interface with statistics dashboard, filtering, search, and task cards
- **Select Component Fix**: Resolved React Select component error by removing empty string values and implementing proper filter state management
- **Navigation Integration**: Added task management to sidebar navigation with proper routing to /tasks
- **Statistics Dashboard**: Real-time task statistics showing total tasks, status breakdowns, and priority distribution
- **Task Status Management**: Working status update functionality with visual indicators and color-coded badges
- **Search and Filter System**: Comprehensive filtering by status, priority, and search terms with clear filters functionality
- **API Route Consolidation**: Resolved duplicate task route conflicts between database-routes.ts and task-management-routes.ts

### January 26, 2025 - Dashboard and Sidebar Modernization
- **Real-time Navigation Badges**: Updated sidebar navigation with live data badges showing client count, overdue invoices, and pending tasks
- **Enhanced KPI Dashboard**: Integrated task management statistics into dashboard KPI cards showing active tasks and completion rates
- **Dynamic Data Integration**: Connected dashboard components to real-time API data for accurate business metrics
- **User Display Fixes**: Resolved user profile display issues by adapting to actual user schema structure
- **Professional Sidebar Design**: Improved sidebar with real-time badges, system status indicators, and clean navigation
- **Task Performance Metrics**: Added task completion rate calculations and visual indicators for team performance tracking
- **Responsive Data Loading**: Implemented 30-second refresh intervals for live data updates across navigation and dashboard components

### January 26, 2025 - Complete Dashboard Real Data Integration
- **Fixed All KPI Calculations**: Corrected dashboard to show real $740 revenue (not $0), 3 active clients, and accurate task counts
- **Real-time Revenue Tracking**: Updated KPI calculations to use actual paid amounts from invoices instead of placeholder zeros
- **Enhanced Team Performance Widget**: Replaced mock data with real employee metrics, team size, and task completion rates
- **Live Recent Activities**: Added current activities showing actual payment received, client registrations, and task assignments
- **Improved Quick Actions**: Added real-time status badges showing pending tasks and active client counts
- **Data Accuracy Validation**: All dashboard widgets now display authentic business data with proper calculations and live updates
- **TypeScript Error Resolution**: Fixed all component type errors and ensured proper data handling throughout dashboard components

### January 26, 2025 - Enhanced Internationalization and Modern Navbar Implementation
- **Comprehensive Arabic Language Support**: Extended i18n system with full Arabic translations covering navigation, notifications, search results, and common UI elements
- **Optimized RTL Mode**: Implemented complete RTL (Right-to-Left) CSS support with proper text alignment, spacing adjustments, form field alignment, and dropdown positioning
- **Modern Navbar Implementation**: Created new top navigation bar with integrated language switcher, search functionality, and notification system replacing sidebar-based navigation
- **Functional Search System**: Implemented real-time search across clients, invoices, tasks, quotations, and expenses with intelligent result filtering and categorization
- **Notification System**: Built comprehensive notification system with unread count badges, notification history, and mark-as-read functionality
- **Google Fonts Integration**: Added Tajawal font for proper Arabic text rendering and improved typography support
- **Layout Restructuring**: Updated app layout to use navbar + sidebar combination for better space utilization and modern UX patterns
- **User Experience Enhancements**: Added search result previews, notification dropdown, language toggle with flags, and professional user menu
- **API Integration**: Created notification endpoints with mock data structure ready for database integration

### January 26, 2025 - Layout Cleanup and Admin Cascade Delete Implementation
- **Complete Layout Deduplication**: Removed duplicate CompanyOS branding and user profile sections from sidebar, eliminated duplicate search/notifications/user menu from page headers
- **Streamlined Navigation Architecture**: Consolidated all global functionality (search, notifications, user menu) exclusively in top navbar with clean page headers showing only contextual elements
- **Admin Cascade Delete System**: Implemented comprehensive client deletion functionality with cascade delete for all related data including quotations, invoices, payments, client notes, and activity history
- **Role-Based Access Control**: Added admin-only permissions for cascade delete functionality with proper role checking (admin role or management department)
- **Comprehensive Delete Confirmation**: Created detailed confirmation dialogs listing all data that will be permanently deleted with clear warnings about irreversible actions
- **Database Transaction Integrity**: Implemented proper deletion order to avoid foreign key constraints, deleting child records before parent records
- **Activity Logging**: Added automated logging of deletion activities with client name and comprehensive description of deleted data
- **Frontend Integration**: Added delete buttons to both table and card views in CRM module with proper loading states and error handling
- **Data Cache Invalidation**: Proper React Query cache invalidation for clients, quotations, invoices, and activities after successful deletion

### January 26, 2025 - CRM Interface Optimization and AlertDialog Component Fix
- **Streamlined CRM Actions**: Removed unnecessary status update buttons from CRM interface, keeping only View and Delete actions for cleaner user experience
- **Fixed AlertDialog Component**: Resolved runtime error where Button was called as a function instead of using buttonVariants for proper styling
- **TypeScript Error Resolution**: Fixed role-based access control type errors by properly casting user object for admin permission checks
- **Delete Functionality Verification**: Successfully tested cascade delete API endpoints with comprehensive data removal confirmation
- **Component Import Cleanup**: Updated AlertDialog component to import buttonVariants instead of Button component to prevent function call conflicts
- **Interface Consistency**: Maintained consistent button styling across all AlertDialog components while fixing the runtime error