# API Documentation - CompanyOS

## Smart API System

CompanyOS uses a smart API client system with automatic error handling, retry logic, and authentication management.

### Available API Clients

#### 1. Smart Query Hooks (Recommended)
```typescript
import { useSmartQuery, useSmartMutation } from '@/hooks/useSmartQuery';

// Query data with automatic error handling
const { data, isLoading, error } = useSmartQuery({
  queryKey: ['/api/clients'],
  endpoint: '/api/clients',
  showError: false, // Optional: disable error toasts
});

// Mutations with automatic cache invalidation
const createClient = useSmartMutation({
  method: 'POST',
  endpoint: '/api/clients',
  successMessage: 'Client created successfully',
  invalidateKeys: [['/api/clients']], // Auto-refresh client list
});
```

#### 2. Simple API Utilities
```typescript
import { GET, POST, PUT, DELETE } from '@/lib/smartApi';

// Simple API calls with automatic error handling
const clients = await GET('/api/clients');
const newClient = await POST('/api/clients', clientData);
const updated = await PUT('/api/clients/123', updateData);
await DELETE('/api/clients/123');
```

#### 3. Full API Client
```typescript
import { api } from '@/lib/api';

const response = await api.get('/api/clients');
if (response.success) {
  console.log(response.data);
} else {
  console.error(response.error);
}
```

## Core API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout  
- `GET /api/user` - Get current user

### Dashboard
- `GET /api/dashboard/kpis` - Dashboard statistics
- `GET /api/tasks/stats` - Task statistics
- `GET /api/clients/stats` - Client statistics

### Data Endpoints
- `GET /api/clients` - List all clients
- `GET /api/tasks` - List all tasks
- `GET /api/invoices` - List all invoices
- `GET /api/activities` - Recent activities
- `GET /api/notifications` - User notifications
- `GET /api/notifications/unread-count` - Unread notification count

## Error Handling

The smart API system automatically handles:
- **Network failures** - Automatic retry with exponential backoff
- **Timeouts** - 10-second timeout with graceful fallback
- **Authentication errors** - Automatic redirect to login page
- **Server errors** - User-friendly error messages
- **Offline detection** - Smart handling when network is unavailable

## Features

### Automatic Retry Logic
- Failed requests are automatically retried up to 2 times
- Exponential backoff between retries (1s, 2s, 4s)
- No retry for authentication or client errors (4xx)

### Authentication Management
- Automatic detection of 401 responses
- Redirects to `/auth` when authentication expires
- Clears cache on authentication failure

### Network Resilience
- Detects offline/online status
- Handles timeout scenarios gracefully
- Provides meaningful error messages

### Cache Management
- Smart cache invalidation on mutations
- Automatic cache clearing on authentication changes
- Optimistic updates with rollback capability