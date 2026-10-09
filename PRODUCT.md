# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Internal staff of a digital-services company (Creative Code, Egypt). Four groups use the system every working day, in Arabic or English:

- **Management / owners**: follow revenue, expenses, outstanding balances, KPIs and team load; approve expenses and refunds.
- **Accounting / finance**: issue and track invoices, record payments and refunds, manage client credit, expenses and payment sources (cash, bank, wallets). Number-heavy tables, reconciliation, printing.
- **Sales / account managers**: manage clients, write quotations, convert accepted quotations into invoices, keep client notes and credentials.
- **Team members**: work through tasks and projects (kanban), message colleagues, receive notifications.

Access is role-based: each role sees and can act on only the modules its permissions allow.

## Product Purpose
One internal system that carries a client from first contact to money received: clients, quotations, invoices, payments, expenses, payment sources, tasks, projects, employees and KPIs, messages and notifications, with reports on top. Success is that finance and management trust the numbers and that nobody keeps a parallel spreadsheet.

## Positioning
A single bilingual (Arabic + English, true RTL and LTR) operations and finance system built around how an Egyptian service agency actually bills: EGP as the base currency, quotations and invoices that print with company details and can be shown in EGP, USD or SAR, and client credit/refund handling.

## Operating Context
- Used on desktop browsers in an office and on phones by managers away from the desk.
- Quotations and invoices are printed or saved as PDF and sent to clients; the printed document is part of the product and must stay correct in both languages.
- Money is recorded in Egyptian pounds (ج.م); display currency can be converted on printed documents.
- Several people may work at the same time (concurrent invoice numbering, shared payment sources).

## Capabilities and Constraints
- Modules: dashboard, clients (CRM with notes and an encrypted credential vault), quotations (items, status flow, conversion to invoice, print), invoices (items, payments, overpayment credit, refunds, cancellation, QR code, attachments, print), expenses (categories, receipts, approval, recurring), payment sources (balances and transactions), services catalogue, tasks and projects (kanban), employees, KPIs, users and roles, messages, notifications, analytics, settings and data export.
- **Records are never deleted.** Clients are archived (and can be restored); invoices are cancelled, not deleted. Interfaces must offer archive/cancel/restore, not delete, for these.
- Existing stack to keep: React 18, TypeScript, Tailwind CSS, shadcn/ui (Radix), TanStack Query, wouter; Vite build served by the Express app.
- Language switching changes `dir` on the document; layouts must work in both directions (use logical properties, not left/right).
- Undecided: formal accessibility standard (none established); logo and brand colours (none in the repository).

## Brand Commitments
Product name "Creative Code Nexus", tagline "Digital Solutions & Innovation" (current defaults, configurable by environment variables). No logo, brand colours or typefaces exist in the repository.

**Standing visual preference (chosen by the product owner, October 2026):** the category standard played straight: a clean, restrained SaaS dashboard with a neutral ground, one calm primary colour, an orderly grid and a clear type scale. No themed world, costume or ornamental signature. The craft bar is Stripe Dashboard (numbers and tables), Linear (speed, consistency, detail) and Zoho Books / Odoo (a complete accounting product that handles Arabic and RTL for real). The redesign replaces the current look with this standard executed at full fidelity, rolled out in batches across the whole system.

## Evidence on Hand
No testimonials, customer logos, benchmarks or imagery exist in the repository and none should be invented. Real data is entered by staff at runtime.

## Product Principles
1. Numbers are the product: totals, balances and statuses must be unmistakable and consistent across lists, detail pages and printed documents.
2. Arabic and English are equal citizens; neither is a translation of the other's layout.
3. Financial history is permanent: destructive actions are replaced by archive, cancel and restore, and the interface says so plainly.
4. Each role sees what it can act on; unavailable actions are absent or explained, never silently failing.
5. Dense work screens favour scanning and speed over decoration; expression belongs in precise details.
