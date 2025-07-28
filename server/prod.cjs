// Simple production server without ESM complications
require('dotenv/config');
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Error logging function
function logError(error, context = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: 'ERROR',
    message: error.message,
    stack: error.stack,
    context,
    pid: process.pid
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  
  // Log to file
  fs.appendFileSync(path.join(logsDir, 'error.log'), logLine);
  
  // Also log to console for immediate visibility
  console.error(`[${timestamp}] ERROR:`, error.message);
  if (error.stack) {
    console.error('Stack:', error.stack);
  }
}

// General info logging function
function logInfo(message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: 'INFO',
    message,
    data,
    pid: process.pid
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  fs.appendFileSync(path.join(logsDir, 'app.log'), logLine);
  console.log(`[${timestamp}] INFO:`, message);
}

// API access logging function
function logApiAccess(req, res, duration) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: 'API',
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    userId: req.session?.user?.id || 'anonymous'
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  fs.appendFileSync(path.join(logsDir, 'api.log'), logLine);
}

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Security middleware for production
if (process.env.NODE_ENV === 'production') {
  try {
    const helmet = require("helmet");
    const compression = require("compression");
    const cors = require("cors");
    
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", "wss:", "https:"],
        },
      },
    }));
    
    app.use(compression());
    app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5000'],
      credentials: true,
    }));
  } catch (e) {
    console.log('Security middleware not available, continuing without it');
  }
}

// Enhanced logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      console.log(`${new Date().toLocaleTimeString()} [express] ${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
      logApiAccess(req, res, duration);
    }
  });
  next();
});

// Session management
const session = require('express-session');

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-super-secure-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Mock user for authentication
const mockUser = {
  id: 'admin-001',
  username: 'admin',
  password: 'admin123', // In production, this should be hashed
  email: 'admin@company.com',
  firstName: 'System',
  lastName: 'Administrator',
  profileImageUrl: null
};

// Authentication middleware
function isAuthenticated(req, res, next) {
  try {
    if (req.session && req.session.user) {
      return next();
    }
    logError(new Error('Unauthorized access attempt'), {
      endpoint: `${req.method} ${req.path}`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      hasSession: !!req.session,
      hasUser: !!req.session?.user
    });
    return res.status(401).json({ message: 'Not authenticated' });
  } catch (error) {
    logError(error, { 
      endpoint: 'Authentication middleware',
      path: req.path,
      ip: req.ip 
    });
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/config', (req, res) => {
  res.json({
    companyName: process.env.COMPANY_NAME || 'Creative Code Nexus',
    companyTagline: process.env.COMPANY_TAGLINE || 'Digital Solutions & Innovation'
  });
});

// Authentication routes
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      logError(new Error('Login attempt with missing credentials'), { 
        ip: req.ip, 
        userAgent: req.get('User-Agent'),
        providedUsername: username ? 'provided' : 'missing',
        providedPassword: password ? 'provided' : 'missing'
      });
      return res.status(400).json({ message: 'Username and password required' });
    }
    
    if (username === mockUser.username && password === mockUser.password) {
      req.session.user = {
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        profileImageUrl: mockUser.profileImageUrl
      };
      logInfo('Successful login', { 
        userId: mockUser.id, 
        username: mockUser.username,
        ip: req.ip 
      });
      res.json(req.session.user);
    } else {
      logError(new Error('Invalid login attempt'), { 
        attemptedUsername: username,
        ip: req.ip, 
        userAgent: req.get('User-Agent')
      });
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    logError(error, { 
      endpoint: 'POST /api/login',
      ip: req.ip,
      body: req.body 
    });
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/logout', (req, res) => {
  try {
    const userId = req.session?.user?.id;
    req.session.destroy((err) => {
      if (err) {
        logError(err, { 
          endpoint: 'POST /api/logout',
          userId,
          ip: req.ip 
        });
        return res.status(500).json({ message: 'Could not log out' });
      }
      logInfo('Successful logout', { userId, ip: req.ip });
      res.json({ message: 'Logged out successfully' });
    });
  } catch (error) {
    logError(error, { 
      endpoint: 'POST /api/logout',
      ip: req.ip 
    });
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/user', isAuthenticated, (req, res) => {
  res.json(req.session.user);
});

app.get('/api/users/:id', isAuthenticated, (req, res) => {
  if (req.params.id === req.session.user.id) {
    res.json(req.session.user);
  } else {
    const user = users.find(u => u.id === req.params.id);
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  }
});

// In-memory data storage
let clients = [];
let invoices = [];
let quotations = [];
let expenses = [];
let tasks = [];
let services = [
  { id: '1', name: 'Web Development', description: 'Custom website development', category: 'development', price: 5000, isActive: true },
  { id: '2', name: 'Mobile App Development', description: 'iOS and Android app development', category: 'development', price: 8000, isActive: true },
  { id: '3', name: 'Digital Marketing', description: 'SEO and social media marketing', category: 'marketing', price: 2000, isActive: true },
  { id: '4', name: 'UI/UX Design', description: 'User interface and experience design', category: 'design', price: 3000, isActive: true },
];
let users = [];
let notifications = [];

// Initialize global storage for quotation items
global.quotationItems = global.quotationItems || [];

// Helper function to generate IDs
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// CRUD routes for clients
app.get('/api/clients', isAuthenticated, (req, res) => {
  res.json(clients);
});

app.post('/api/clients', isAuthenticated, (req, res) => {
  const client = {
    id: generateId(),
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  clients.push(client);
  res.status(201).json(client);
});

app.put('/api/clients/:id', isAuthenticated, (req, res) => {
  const index = clients.findIndex(c => c.id === req.params.id);
  if (index !== -1) {
    clients[index] = { ...clients[index], ...req.body, updatedAt: new Date().toISOString() };
    res.json(clients[index]);
  } else {
    res.status(404).json({ message: 'Client not found' });
  }
});

app.delete('/api/clients/:id', isAuthenticated, (req, res) => {
  const index = clients.findIndex(c => c.id === req.params.id);
  if (index !== -1) {
    clients.splice(index, 1);
    res.json({ message: 'Client deleted successfully' });
  } else {
    res.status(404).json({ message: 'Client not found' });
  }
});

// CRUD routes for users
app.get('/api/users', isAuthenticated, (req, res) => {
  res.json(users);
});

app.post('/api/users', isAuthenticated, (req, res) => {
  const user = {
    id: generateId(),
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  users.push(user);
  res.status(201).json(user);
});

app.put('/api/users/:id', isAuthenticated, (req, res) => {
  const index = users.findIndex(u => u.id === req.params.id);
  if (index !== -1) {
    users[index] = { ...users[index], ...req.body, updatedAt: new Date().toISOString() };
    res.json(users[index]);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

// CRUD routes for tasks
app.get('/api/tasks', isAuthenticated, (req, res) => {
  res.json(tasks);
});

app.get('/api/tasks/:id', isAuthenticated, (req, res) => {
  const task = tasks.find(t => t.id === req.params.id);
  if (task) {
    res.json(task);
  } else {
    res.status(404).json({ message: 'Task not found' });
  }
});

app.post('/api/tasks', isAuthenticated, (req, res) => {
  const task = {
    id: generateId(),
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  tasks.push(task);
  res.status(201).json(task);
});

app.put('/api/tasks/:id', isAuthenticated, (req, res) => {
  const index = tasks.findIndex(t => t.id === req.params.id);
  if (index !== -1) {
    tasks[index] = { ...tasks[index], ...req.body, updatedAt: new Date().toISOString() };
    res.json(tasks[index]);
  } else {
    res.status(404).json({ message: 'Task not found' });
  }
});

app.delete('/api/tasks/:id', isAuthenticated, (req, res) => {
  const index = tasks.findIndex(t => t.id === req.params.id);
  if (index !== -1) {
    tasks.splice(index, 1);
    res.json({ message: 'Task deleted successfully' });
  } else {
    res.status(404).json({ message: 'Task not found' });
  }
});

// CRUD routes for invoices
app.get('/api/invoices', isAuthenticated, (req, res) => {
  res.json(invoices);
});

app.get('/api/invoices/:id', isAuthenticated, (req, res) => {
  const invoice = invoices.find(i => i.id === req.params.id);
  if (invoice) {
    res.json(invoice);
  } else {
    res.status(404).json({ message: 'Invoice not found' });
  }
});

app.post('/api/invoices', isAuthenticated, (req, res) => {
  const invoice = {
    id: generateId(),
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  invoices.push(invoice);
  res.status(201).json(invoice);
});

app.put('/api/invoices/:id', isAuthenticated, (req, res) => {
  const index = invoices.findIndex(i => i.id === req.params.id);
  if (index !== -1) {
    invoices[index] = { ...invoices[index], ...req.body, updatedAt: new Date().toISOString() };
    res.json(invoices[index]);
  } else {
    res.status(404).json({ message: 'Invoice not found' });
  }
});

// CRUD routes for quotations
app.get('/api/quotations', isAuthenticated, (req, res) => {
  res.json(quotations);
});

app.get('/api/quotations/:id', isAuthenticated, (req, res) => {
  const quotation = quotations.find(q => q.id === req.params.id);
  if (quotation) {
    res.json(quotation);
  } else {
    res.status(404).json({ message: 'Quotation not found' });
  }
});

app.get('/api/quotations/:id/items', isAuthenticated, (req, res) => {
  const quotation = quotations.find(q => q.id === req.params.id);
  if (quotation) {
    res.json(quotation.items || []);
  } else {
    res.status(404).json({ message: 'Quotation not found' });
  }
});

app.post('/api/quotations', isAuthenticated, (req, res) => {
  const quotation = {
    id: generateId(),
    ...req.body,
    items: req.body.items || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  quotations.push(quotation);
  res.status(201).json(quotation);
});

app.put('/api/quotations/:id', isAuthenticated, (req, res) => {
  const index = quotations.findIndex(q => q.id === req.params.id);
  if (index !== -1) {
    quotations[index] = { ...quotations[index], ...req.body, updatedAt: new Date().toISOString() };
    res.json(quotations[index]);
  } else {
    res.status(404).json({ message: 'Quotation not found' });
  }
});

// CRUD routes for expenses
app.get('/api/expenses', isAuthenticated, (req, res) => {
  res.json(expenses);
});

app.get('/api/expenses/:id', isAuthenticated, (req, res) => {
  const expense = expenses.find(e => e.id === req.params.id);
  if (expense) {
    res.json(expense);
  } else {
    res.status(404).json({ message: 'Expense not found' });
  }
});

app.post('/api/expenses', isAuthenticated, (req, res) => {
  const expense = {
    id: generateId(),
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  expenses.push(expense);
  res.status(201).json(expense);
});

app.put('/api/expenses/:id', isAuthenticated, (req, res) => {
  const index = expenses.findIndex(e => e.id === req.params.id);
  if (index !== -1) {
    expenses[index] = { ...expenses[index], ...req.body, updatedAt: new Date().toISOString() };
    res.json(expenses[index]);
  } else {
    res.status(404).json({ message: 'Expense not found' });
  }
});

app.delete('/api/expenses/:id', isAuthenticated, (req, res) => {
  const index = expenses.findIndex(e => e.id === req.params.id);
  if (index !== -1) {
    expenses.splice(index, 1);
    res.json({ message: 'Expense deleted successfully' });
  } else {
    res.status(404).json({ message: 'Expense not found' });
  }
});

// Services routes
app.get('/api/services', isAuthenticated, (req, res) => {
  res.json(services);
});

app.post('/api/services', isAuthenticated, (req, res) => {
  const service = {
    id: generateId(),
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  services.push(service);
  res.status(201).json(service);
});

app.post('/api/services/initialize', isAuthenticated, (req, res) => {
  // Initialize services if empty - this prevents 404 errors
  if (services.length === 0) {
    services.push(
      { id: '1', name: 'Web Development', description: 'Custom website development', category: 'development', price: 5000, isActive: true },
      { id: '2', name: 'Mobile App Development', description: 'iOS and Android app development', category: 'development', price: 8000, isActive: true },
      { id: '3', name: 'Digital Marketing', description: 'SEO and social media marketing', category: 'marketing', price: 2000, isActive: true },
      { id: '4', name: 'UI/UX Design', description: 'User interface and experience design', category: 'design', price: 3000, isActive: true }
    );
  }
  res.json({ message: 'Services initialized', count: services.length });
});

// Missing endpoints that are causing 404 errors
app.get('/api/expenses/stats', isAuthenticated, (req, res) => {
  try {
    const totalAmount = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const statusBreakdown = expenses.reduce((acc, expense) => {
      const status = expense.status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, { pending: 0, approved: 0, paid: 0 });

    res.json({
      total: expenses.length,
      totalAmount,
      ...statusBreakdown
    });
  } catch (error) {
    logError(error, { endpoint: 'GET /api/expenses/stats', userId: req.session?.user?.id });
    res.status(500).json({ message: 'Error fetching expense statistics' });
  }
});

app.get('/api/payment-sources', isAuthenticated, (req, res) => {
  try {
    // Mock payment sources data
    const paymentSources = [
      { id: '1', name: 'Primary Bank Account', type: 'bank', balance: 50000, isActive: true },
      { id: '2', name: 'Petty Cash', type: 'cash', balance: 2000, isActive: true },
      { id: '3', name: 'Credit Card', type: 'credit', balance: -1500, isActive: true }
    ];
    res.json(paymentSources);
  } catch (error) {
    logError(error, { endpoint: 'GET /api/payment-sources', userId: req.session?.user?.id });
    res.status(500).json({ message: 'Error fetching payment sources' });
  }
});

app.get('/api/quotations/:id/items', isAuthenticated, (req, res) => {
  try {
    const quotationId = req.params.id;
    // Initialize quotationItems if not exists
    if (!global.quotationItems) {
      global.quotationItems = [];
    }
    const items = global.quotationItems.filter(item => item.quotationId === quotationId);
    logAPI(req, res);
    res.json(items);
  } catch (error) {
    logError(error, { 
      endpoint: `GET /api/quotations/${req.params.id}/items`, 
      userId: req.session?.user?.id 
    });
    res.status(500).json({ message: 'Error fetching quotation items' });
  }
});

// POST quotation items - missing endpoint causing 404s
app.post('/api/quotations/:id/items', isAuthenticated, (req, res) => {
  try {
    const quotationId = req.params.id;
    const newItem = {
      id: generateId(),
      quotationId: quotationId,
      description: req.body.description || '',
      quantity: req.body.quantity || 1,
      price: req.body.price || 0,
      total: (req.body.quantity || 1) * (req.body.price || 0)
    };
    
    // Initialize quotationItems if not exists
    if (!global.quotationItems) {
      global.quotationItems = [];
    }
    global.quotationItems.push(newItem);
    logAPI(req, res);
    res.status(201).json(newItem);
  } catch (error) {
    logError(error, { 
      endpoint: `POST /api/quotations/${req.params.id}/items`, 
      userId: req.session?.user?.id 
    });
    res.status(500).json({ message: 'Error creating quotation item' });
  }
});

// PATCH quotation items - missing endpoint
app.patch('/api/quotations/:quotationId/items/:id', isAuthenticated, (req, res) => {
  try {
    if (!global.quotationItems) {
      global.quotationItems = [];
    }
    const item = global.quotationItems.find(item => 
      item.id === req.params.id && item.quotationId === req.params.quotationId
    );
    if (!item) {
      return res.status(404).json({ message: 'Quotation item not found' });
    }
    
    Object.assign(item, req.body);
    item.total = item.quantity * item.price;
    logAPI(req, res);
    res.json(item);
  } catch (error) {
    logError(error, { 
      endpoint: `PATCH /api/quotations/${req.params.quotationId}/items/${req.params.id}`, 
      userId: req.session?.user?.id 
    });
    res.status(500).json({ message: 'Error updating quotation item' });
  }
});

// DELETE quotation items - missing endpoint
app.delete('/api/quotations/:quotationId/items/:id', isAuthenticated, (req, res) => {
  try {
    if (!global.quotationItems) {
      global.quotationItems = [];
    }
    const index = global.quotationItems.findIndex(item => 
      item.id === req.params.id && item.quotationId === req.params.quotationId
    );
    if (index === -1) {
      return res.status(404).json({ message: 'Quotation item not found' });
    }
    
    global.quotationItems.splice(index, 1);
    logAPI(req, res);
    res.status(204).send();
  } catch (error) {
    logError(error, { 
      endpoint: `DELETE /api/quotations/${req.params.quotationId}/items/${req.params.id}`, 
      userId: req.session?.user?.id 
    });
    res.status(500).json({ message: 'Error deleting quotation item' });
  }
});

// Notifications
app.get('/api/notifications', isAuthenticated, (req, res) => {
  res.json(notifications);
});

app.get('/api/notifications/unread-count', isAuthenticated, (req, res) => {
  const unreadCount = notifications.filter(n => !n.read).length;
  res.json({ count: unreadCount });
});

// Dashboard stats with real data
app.get('/api/tasks/stats', isAuthenticated, (req, res) => {
  try {
    const statusBreakdown = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, { pending: 0, 'in-progress': 0, completed: 0 });
    
    const priorityBreakdown = tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, { low: 0, medium: 0, high: 0 });

    res.json({
      total: tasks.length,
      statusBreakdown,
      priorityBreakdown
    });
  } catch (error) {
    logError(error, { endpoint: 'GET /api/tasks/stats', userId: req.session?.user?.id });
    res.status(500).json({ message: 'Error fetching task statistics' });
  }
});

app.get('/api/clients/stats', isAuthenticated, (req, res) => {
  const statusBreakdown = clients.reduce((acc, client) => {
    acc[client.status] = (acc[client.status] || 0) + 1;
    return acc;
  }, { active: 0, lead: 0, inactive: 0 });

  res.json({
    total: clients.length,
    ...statusBreakdown
  });
});

app.get('/api/invoices/stats', isAuthenticated, (req, res) => {
  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const paidAmount = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.amount || 0), 0);
  
  const statusBreakdown = invoices.reduce((acc, invoice) => {
    acc[invoice.status] = (acc[invoice.status] || 0) + 1;
    return acc;
  }, { paid: 0, pending: 0, overdue: 0 });

  res.json({
    total: invoices.length,
    ...statusBreakdown,
    totalAmount,
    paidAmount
  });
});

// Serve static files in production
const distPath = path.resolve(process.cwd(), 'dist', 'public');
app.use(express.static(distPath));

// 404 handler for API routes only - must come before SPA catch-all
app.use('/api', (req, res, next) => {
  // Log 404 API requests as errors for tracking
  logError(new Error(`404 - API Endpoint not found: ${req.method} ${req.originalUrl}`), {
    endpoint: `${req.method} ${req.originalUrl}`,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.session?.user?.id,
    type: '404_api_endpoint_missing'
  });
  
  res.status(404).json({ 
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logError(error, {
    endpoint: `${req.method} ${req.path}`,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.session?.user?.id
  });
  
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Catch-all handler for SPA routing (must be last)
app.get('*', (req, res) => {
  try {
    res.sendFile(path.resolve(distPath, 'index.html'));
  } catch (error) {
    logError(error, { 
      endpoint: 'SPA catchall',
      path: req.path,
      ip: req.ip 
    });
    res.status(500).send('Error loading application');
  }
});

const port = parseInt(process.env.PORT || '5000', 10);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logError(error, { type: 'uncaughtException' });
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logError(new Error(`Unhandled Rejection: ${reason}`), { 
    type: 'unhandledRejection',
    promise: promise.toString()
  });
  console.error('Unhandled Rejection:', reason);
});

const server = require('http').createServer(app);

server.listen(port, '0.0.0.0', () => {
  logInfo('Server started successfully', { 
    port: port,
    environment: process.env.NODE_ENV || 'development',
    pid: process.pid
  });
  console.log(`${new Date().toLocaleTimeString()} [express] serving on port ${port}`);
});