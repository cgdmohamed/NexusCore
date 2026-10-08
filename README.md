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

### Production (PM2)

The app is built to `dist/` and started from `dist/index.js` (`npm run build`, `npm start`).

```bash
npm install -g pm2
npm ci && npm run build
pm2 start dist/index.js --name nexus-app      # first time
pm2 save && pm2 startup                        # restart on reboot
```

Updating an existing server:

```bash
cd ~/htdocs/nexus.creativecode.com.eg
git pull && npm run build && pm2 restart nexus-app
```

Take a `pg_dump` and a copy of `uploads/` first. Run `npm ci` only when `package.json` changed and
you have tested the new dependency versions (see `docs/REVIEW_NOTES.md`).

### Configuration

Copy `.env.example` to `.env`. Required: `DATABASE_URL`, `SESSION_SECRET`, `VAULT_ENCRYPTION_KEY`.
Optional: `UPLOADS_DIR`, `LOG_LEVEL`, `SESSION_COOKIE_SAMESITE`, `SEED_DEFAULT_DATA`, SMTP settings.

### Tests

```bash
npm test                                   # unit tests (no database needed)
TEST_DATABASE_URL=postgresql://... npm test   # + integration tests (WARNING: drops the public schema of that DB)
```

### Database

The schema is created with `npm run db:push`; migrations live in `drizzle/` (see `drizzle/README.md`).
Data export is available to administrators in Settings; real backups need `pg_dump` plus a copy of `uploads/`.
To move old base64 profile pictures out of the database: `npm run images:migrate` (dry run) then `-- --apply`.

### Legacy files

`server/prod.cjs`, `server/simple-prod.js` and `deploy-to-server.sh` belong to an older deployment style and are
**not** used by `npm run build` / `npm start`. They are kept only so existing servers that still run them keep working.

**Default Login (development only):** admin / admin123 — change it immediately; it is not created in production unless `SEED_DEFAULT_DATA=true`.

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