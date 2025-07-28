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

// Basic protected routes that return empty data
app.get('/api/clients', isAuthenticated, (req, res) => {
  res.json([]);
});

app.get('/api/invoices', isAuthenticated, (req, res) => {
  res.json([]);
});

app.get('/api/quotations', isAuthenticated, (req, res) => {
  res.json([]);
});

app.get('/api/expenses', isAuthenticated, (req, res) => {
  res.json([]);
});

app.get('/api/tasks', isAuthenticated, (req, res) => {
  res.json([]);
});

app.get('/api/services', isAuthenticated, (req, res) => {
  res.json([]);
});

app.get('/api/notifications', isAuthenticated, (req, res) => {
  res.json([]);
});

app.get('/api/notifications/unread-count', isAuthenticated, (req, res) => {
  res.json({ count: 0 });
});

// Dashboard stats
app.get('/api/tasks/stats', isAuthenticated, (req, res) => {
  res.json({
    total: 0,
    statusBreakdown: { pending: 0, 'in-progress': 0, completed: 0 },
    priorityBreakdown: { low: 0, medium: 0, high: 0 }
  });
});

app.get('/api/clients/stats', isAuthenticated, (req, res) => {
  res.json({
    total: 0,
    active: 0,
    leads: 0,
    inactive: 0
  });
});

app.get('/api/invoices/stats', isAuthenticated, (req, res) => {
  res.json({
    total: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    totalAmount: 0,
    paidAmount: 0
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