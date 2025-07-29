const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session setup
app.use(session({
  secret: 'nexus-session-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// In-memory data
let users = [
  {
    id: 'admin-user-001',
    username: 'admin',
    passwordHash: '$2b$10$rQJ5qKqKp0wGGq5qKqKp0wGGq5qKqKp0wGGq5qKqKp0wGGq5qKq',
    email: 'admin@company.com',
    firstName: 'System',
    lastName: 'Administrator',
    isActive: true
  }
];

let clients = [
  { id: '1', name: 'ABC Corp', email: 'contact@abc.com', status: 'active', totalValue: '25000', createdAt: new Date() },
  { id: '2', name: 'XYZ Ltd', email: 'info@xyz.com', status: 'active', totalValue: '15000', createdAt: new Date() },
  { id: '3', name: 'Tech Solutions', email: 'hello@tech.com', status: 'lead', totalValue: '0', createdAt: new Date() }
];

let tasks = [
  { id: '1', title: 'Website Redesign', status: 'in-progress', priority: 'high', assignedTo: 'admin-user-001', createdAt: new Date() },
  { id: '2', title: 'Database Migration', status: 'pending', priority: 'medium', assignedTo: 'admin-user-001', createdAt: new Date() },
  { id: '3', title: 'API Documentation', status: 'completed', priority: 'low', assignedTo: 'admin-user-001', createdAt: new Date() }
];

let invoices = [
  { id: '1', invoiceNumber: 'INV-001', clientId: '1', amount: '5000', paidAmount: '5000', status: 'paid', createdAt: new Date() },
  { id: '2', invoiceNumber: 'INV-002', clientId: '2', amount: '3000', paidAmount: '1500', status: 'partially_paid', createdAt: new Date() }
];

let activities = [
  { id: '1', title: 'Payment Received', description: 'Invoice INV-001 paid by ABC Corp', type: 'invoice_paid', createdAt: new Date() },
  { id: '2', title: 'New Client Added', description: 'Tech Solutions added as lead', type: 'client_added', createdAt: new Date() }
];

let notifications = [
  { id: '1', title: 'Payment Received', message: 'ABC Corp paid $5,000', type: 'payment_received', isRead: false, createdAt: new Date() },
  { id: '2', title: 'New Task Assigned', message: 'Database Migration task assigned', type: 'task_assigned', isRead: false, createdAt: new Date() }
];

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  next();
};

// Auth routes
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (username === 'admin' && password === 'admin123') {
    req.session.user = users[0];
    res.json(users[0]);
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.sendStatus(200);
});

app.get('/api/user', isAuthenticated, (req, res) => {
  res.json(req.session.user);
});

// Dashboard endpoints
app.get('/api/dashboard/kpis', isAuthenticated, (req, res) => {
  const totalRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.paidAmount || 0), 0);
  const activeClients = clients.filter(c => c.status === 'active').length;
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  
  res.json({
    totalRevenue,
    activeClients,
    totalTasks,
    completedTasks,
    taskCompletionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
  });
});

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
    totalTasks: tasks.length,
    statusBreakdown,
    priorityBreakdown,
    overdueTasks: 0
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

// Data endpoints
app.get('/api/clients', isAuthenticated, (req, res) => res.json(clients));
app.get('/api/tasks', isAuthenticated, (req, res) => res.json(tasks));
app.get('/api/invoices', isAuthenticated, (req, res) => res.json(invoices));
app.get('/api/activities', isAuthenticated, (req, res) => res.json(activities));
app.get('/api/notifications', isAuthenticated, (req, res) => res.json(notifications));
app.get('/api/notifications/unread-count', isAuthenticated, (req, res) => {
  const unreadCount = notifications.filter(n => !n.isRead).length;
  res.json({ count: unreadCount });
});

// Serve static files
app.use(express.static(path.join(__dirname, '../dist/public')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Creative Code Nexus running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
});