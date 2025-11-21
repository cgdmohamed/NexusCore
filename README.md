# CompanyOS - Enterprise Management Platform

A comprehensive company management system with CRM, financial management, task tracking, and analytics. Built with React, Express.js, and PostgreSQL.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database

### Development Setup
```bash
npm install
npm run dev
```

### Production Setup with PM2

1. **Install PM2 Globally:**
```bash
npm install -g pm2
```

2. **Start Application with PM2:**
```bash
pm2 start npm --name "companyos" -- run dev
```

3. **Save PM2 Configuration:**
```bash
pm2 save
pm2 startup
```

4. **Monitor Application:**
```bash
pm2 monit           # Real-time monitoring
pm2 logs companyos  # View logs
pm2 status          # Check status
```

5. **Restart/Stop Application:**
```bash
pm2 restart companyos
pm2 stop companyos
pm2 delete companyos
```

6. **Auto-restart on Crash:**
PM2 automatically restarts the application on crashes and on server reboot after running `pm2 startup`.

**Default Login:** admin / admin123

## 🏢 Core Modules

- **CRM** - Client management and relationship tracking
- **Financial** - Invoices, quotations, payments, and expenses
- **Tasks** - Team task management and tracking
- **Analytics** - Business intelligence and reporting
- **HR** - Employee management and KPI tracking

## 🌐 Features

- **Bilingual Support** - Full Arabic/English with RTL layout
- **Smart API System** - Automatic error handling and retry logic
- **Modern UI** - Professional interface with dark/light themes
- **Role-Based Access** - Department-based permissions
- **Real-time Updates** - Live dashboard and notifications

## 🛠️ Technology Stack

**Frontend:** React 18, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query
**Backend:** Express.js, TypeScript, Drizzle ORM, PostgreSQL
**Tools:** Vite, ESBuild, Wouter routing