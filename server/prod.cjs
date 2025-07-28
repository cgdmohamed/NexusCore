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

// Basic API routes for production
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/config', (req, res) => {
  res.json({
    companyName: process.env.COMPANY_NAME || 'Creative Code Nexus',
    companyTagline: process.env.COMPANY_TAGLINE || 'Digital Solutions & Innovation'
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