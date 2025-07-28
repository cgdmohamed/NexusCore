// Simple production server without ESM complications
require('dotenv/config');
const express = require('express');
const path = require('path');

const app = express();

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

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      console.log(`${new Date().toLocaleTimeString()} [express] ${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
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
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ message: 'Not authenticated' });
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
  const { username, password } = req.body;
  
  if (username === mockUser.username && password === mockUser.password) {
    req.session.user = {
      id: mockUser.id,
      username: mockUser.username,
      email: mockUser.email,
      firstName: mockUser.firstName,
      lastName: mockUser.lastName,
      profileImageUrl: mockUser.profileImageUrl
    };
    res.json(req.session.user);
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Could not log out' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

app.get('/api/user', isAuthenticated, (req, res) => {
  res.json(req.session.user);
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

// CRUD routes for invoices
app.get('/api/invoices', isAuthenticated, (req, res) => {
  res.json(invoices);
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

// CRUD routes for quotations
app.get('/api/quotations', isAuthenticated, (req, res) => {
  res.json(quotations);
});

app.post('/api/quotations', isAuthenticated, (req, res) => {
  const quotation = {
    id: generateId(),
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  quotations.push(quotation);
  res.status(201).json(quotation);
});

// CRUD routes for expenses
app.get('/api/expenses', isAuthenticated, (req, res) => {
  res.json(expenses);
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

// Catch-all handler for SPA
app.get('*', (req, res) => {
  res.sendFile(path.resolve(distPath, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
  console.error(err);
});

const port = parseInt(process.env.PORT || '5000', 10);
const server = require('http').createServer(app);

server.listen(port, '0.0.0.0', () => {
  console.log(`${new Date().toLocaleTimeString()} [express] serving on port ${port}`);
});